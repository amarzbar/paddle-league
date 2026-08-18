package handlers

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"paddle-league/server/internal/middleware"
	"paddle-league/server/internal/models"
)

type matchRow struct {
	ID               string
	EventID          string
	Team1P1          string
	Team1P2          string
	Team2P1          string
	Team2P2          string
	Team1Score       int
	Team2Score       int
	Status           string
	PointsToWin      int // target COMBINED total - see events.points_to_win comment
	TimeLimitSeconds int
	StartedAt        *time.Time
	RoundNumber      int
	EventStatus      string
	CurrentRound     int
}

func (a *API) loadMatchForScoring(r *http.Request, w http.ResponseWriter, matchID string) (*matchRow, bool) {
	var m matchRow
	err := a.DB.QueryRow(r.Context(), `
		SELECT m.id, m.event_id, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, m.team1_score, m.team2_score, m.status,
		       e.points_to_win, e.time_limit_seconds, m.started_at, rnd.number, e.status, e.current_round
		FROM matches m
		JOIN events e ON e.id = m.event_id
		JOIN rounds rnd ON rnd.id = m.round_id
		WHERE m.id = $1
	`, matchID).Scan(&m.ID, &m.EventID, &m.Team1P1, &m.Team1P2, &m.Team2P1, &m.Team2P2, &m.Team1Score, &m.Team2Score, &m.Status,
		&m.PointsToWin, &m.TimeLimitSeconds, &m.StartedAt, &m.RoundNumber, &m.EventStatus, &m.CurrentRound)
	if errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "match not found")
		return nil, false
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load match")
		return nil, false
	}
	return &m, true
}

// timedOut reports whether this match's time limit (if any) has already
// elapsed. A match with no started_at yet (nobody has scored a point) can
// never be timed out, regardless of the limit.
func (m *matchRow) timedOut() bool {
	return m.TimeLimitSeconds > 0 && m.StartedAt != nil && time.Since(*m.StartedAt) >= time.Duration(m.TimeLimitSeconds)*time.Second
}

// winnerFor returns 1 or 2 for a team lead, or 0 for a tie (a draw - only
// reachable when points_to_win is even, or a match is cut off by the time
// limit while scores happen to be level).
func winnerFor(t1, t2 int) int {
	if t1 > t2 {
		return 1
	}
	if t2 > t1 {
		return 2
	}
	return 0
}

// finishMatch marks a match completed with final scores t1/t2, advances the
// event's current round if that was the last live match in it, and writes
// the response. Shared by Score's own win/timeout detection and the
// standalone Timeout endpoint (a client-side countdown hitting zero).
func (a *API) finishMatch(w http.ResponseWriter, r *http.Request, m *matchRow, t1, t2 int) {
	winner := winnerFor(t1, t2)
	_, err := a.DB.Exec(r.Context(), `
		UPDATE matches SET team1_score = $1, team2_score = $2, status = 'completed', winner = $3,
		       started_at = COALESCE(started_at, now()), completed_at = now()
		WHERE id = $4
	`, t1, t2, winner, m.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not update match")
		return
	}

	// Schedule is precomputed, so nothing needs to be *formed* here - just
	// advance which round is "current" once every match in it is done.
	// Best-effort: the score itself is already saved above, so a hiccup here
	// shouldn't fail the request.
	if err := a.advanceRoundIfComplete(r.Context(), m.EventID); err != nil {
		log.Printf("advanceRoundIfComplete after match %s: %v", m.ID, err)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"team1Score": t1,
		"team2Score": t2,
		"status":     "completed",
		"winner":     winner,
	})
}

type scoreReq struct {
	Team  int `json:"team"`  // 1 or 2
	Delta int `json:"delta"` // +1 or -1
}

// Score applies a point change to one team and checks for a match win,
// clamping at zero and never scoring a completed match further. Americano
// scoring: a match plays to a fixed COMBINED total (points_to_win), not a
// per-team target - it ends the instant team1Score+team2Score reaches that
// total, whoever has more wins, a tie is a draw (only possible when the
// target is even).
func (a *API) Score(w http.ResponseWriter, r *http.Request) {
	matchID := chi.URLParam(r, "id")
	userID, _ := middleware.UserID(r.Context())
	var req scoreReq
	if err := decodeJSON(r, &req); err != nil || (req.Team != 1 && req.Team != 2) || (req.Delta != 1 && req.Delta != -1) {
		writeErr(w, http.StatusBadRequest, "team must be 1 or 2, delta must be +1 or -1")
		return
	}

	m, ok := a.loadMatchForScoring(r, w, matchID)
	if !ok {
		return
	}
	if m.Status == "completed" {
		writeErr(w, http.StatusConflict, "match is already completed")
		return
	}
	onTeam1 := userID == m.Team1P1 || userID == m.Team1P2
	onTeam2 := userID == m.Team2P1 || userID == m.Team2P2
	var isHost bool
	_ = a.DB.QueryRow(r.Context(), `SELECT host_id = $1 FROM events WHERE id = $2`, userID, m.EventID).Scan(&isHost)
	if !isHost && ((req.Team == 1 && !onTeam1) || (req.Team == 2 && !onTeam2)) {
		writeErr(w, http.StatusForbidden, "you can only update your team's score")
		return
	}
	// The whole schedule is precomputed up front, so every round's matches
	// already exist as rows the moment the event starts - guard against
	// scoring a future round before its predecessors have finished (this
	// couldn't happen under the old reactive model, since a future round's
	// matches simply didn't exist in the DB yet).
	if m.EventStatus != "active" || m.RoundNumber != m.CurrentRound {
		writeErr(w, http.StatusConflict, "this match's round isn't current yet")
		return
	}
	// Time-limit safety net: if the clock already ran out, close the match
	// out on its current score instead of accepting more points - this
	// mostly won't fire (the frontend's own countdown calls /timeout the
	// instant it hits zero), it's just a backstop for a match nobody touched
	// again after time was already up.
	if m.timedOut() {
		a.finishMatch(w, r, m, m.Team1Score, m.Team2Score)
		return
	}

	t1, t2 := m.Team1Score, m.Team2Score
	if req.Team == 1 {
		t1 += req.Delta
	} else {
		t2 += req.Delta
	}
	if t1 < 0 {
		t1 = 0
	}
	if t2 < 0 {
		t2 = 0
	}

	if t1+t2 >= m.PointsToWin {
		a.finishMatch(w, r, m, t1, t2)
		_, _ = a.DB.Exec(r.Context(), `INSERT INTO match_events (match_id, team) VALUES ($1, $2)`, matchID, req.Team)
		return
	}

	status := m.Status
	if status == "pending" {
		status = "in_progress"
	}
	_, err := a.DB.Exec(r.Context(), `
		UPDATE matches SET team1_score = $1, team2_score = $2, status = $3,
		       started_at = COALESCE(started_at, now())
		WHERE id = $4
	`, t1, t2, status, matchID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not update match")
		return
	}

	_, _ = a.DB.Exec(r.Context(), `INSERT INTO match_events (match_id, team) VALUES ($1, $2)`, matchID, req.Team)

	writeJSON(w, http.StatusOK, map[string]any{
		"team1Score": t1,
		"team2Score": t2,
		"status":     status,
		"winner":     0,
	})
}

// Timeout is called by a client's own countdown the instant a match's time
// limit hits zero, closing it out on whatever the score currently is
// (higher score wins, tied is a draw). Any player in the match, or the
// host, can call it - same permission shape as Score. Idempotent: calling
// it again on an already-completed match is just a 409, harmless if two
// players' timers fire within the same second.
func (a *API) Timeout(w http.ResponseWriter, r *http.Request) {
	matchID := chi.URLParam(r, "id")
	userID, _ := middleware.UserID(r.Context())

	m, ok := a.loadMatchForScoring(r, w, matchID)
	if !ok {
		return
	}
	if m.Status == "completed" {
		writeErr(w, http.StatusConflict, "match is already completed")
		return
	}
	isPlayer := userID == m.Team1P1 || userID == m.Team1P2 || userID == m.Team2P1 || userID == m.Team2P2
	if !isPlayer {
		var isHost bool
		_ = a.DB.QueryRow(r.Context(), `SELECT host_id = $1 FROM events WHERE id = $2`, userID, m.EventID).Scan(&isHost)
		if !isHost {
			writeErr(w, http.StatusForbidden, "not a player in this match")
			return
		}
	}
	if m.TimeLimitSeconds <= 0 {
		writeErr(w, http.StatusBadRequest, "this event has no time limit")
		return
	}

	a.finishMatch(w, r, m, m.Team1Score, m.Team2Score)
}

func (a *API) Leaderboard(w http.ResponseWriter, r *http.Request) {
	eventID := chi.URLParam(r, "id")
	rows, err := a.DB.Query(r.Context(), `
		SELECT u.id, u.display_name, u.avatar_color, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2,
		       m.team1_score, m.team2_score, m.winner
		FROM matches m
		JOIN event_participants ep ON ep.event_id = m.event_id
		JOIN users u ON u.id = ep.user_id
		WHERE m.event_id = $1 AND m.status = 'completed'
	`, eventID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load leaderboard")
		return
	}
	defer rows.Close()

	type acc struct {
		u                   models.User
		wins, losses, draws int
		pf, pa, played      int
	}
	byUser := map[string]*acc{}

	for rows.Next() {
		var uid, name, color, t1p1, t1p2, t2p1, t2p2 string
		var s1, s2, winner int
		if err := rows.Scan(&uid, &name, &color, &t1p1, &t1p2, &t2p1, &t2p2, &s1, &s2, &winner); err != nil {
			writeErr(w, http.StatusInternalServerError, "scan error")
			return
		}
		if uid != t1p1 && uid != t1p2 && uid != t2p1 && uid != t2p2 {
			continue // this participant didn't play in this match
		}
		e, ok := byUser[uid]
		if !ok {
			e = &acc{u: models.User{ID: uid, DisplayName: name, AvatarColor: color}}
			byUser[uid] = e
		}
		onTeam1 := uid == t1p1 || uid == t1p2
		e.played++
		if onTeam1 {
			e.pf += s1
			e.pa += s2
		} else {
			e.pf += s2
			e.pa += s1
		}
		switch {
		case winner == 0:
			e.draws++
		case (onTeam1 && winner == 1) || (!onTeam1 && winner == 2):
			e.wins++
		default:
			e.losses++
		}
	}

	out := []models.LeaderboardRow{}
	for _, e := range byUser {
		winPct := 0.0
		if e.played > 0 {
			winPct = float64(e.wins) / float64(e.played)
		}
		out = append(out, models.LeaderboardRow{
			UserID: e.u.ID, DisplayName: e.u.DisplayName, AvatarColor: e.u.AvatarColor,
			Wins: e.wins, Losses: e.losses, Draws: e.draws, MatchesPlayed: e.played,
			PointsFor: e.pf, PointsAgainst: e.pa, WinPct: winPct,
		})
	}
	// simple sort: wins desc, then win% desc, then point differential desc
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			a, b := out[i], out[j]
			aDiff, bDiff := a.PointsFor-a.PointsAgainst, b.PointsFor-b.PointsAgainst
			swap := b.Wins > a.Wins ||
				(b.Wins == a.Wins && b.WinPct > a.WinPct) ||
				(b.Wins == a.Wins && b.WinPct == a.WinPct && bDiff > aDiff)
			if swap {
				out[i], out[j] = out[j], out[i]
			}
		}
	}

	writeJSON(w, http.StatusOK, out)
}
