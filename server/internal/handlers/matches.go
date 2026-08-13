package handlers

import (
	"errors"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"paddle-league/server/internal/models"
)

type matchRow struct {
	ID          string
	EventID     string
	Team1P1     string
	Team1P2     string
	Team2P1     string
	Team2P2     string
	Team1Score  int
	Team2Score  int
	Status      string
	PointsToWin int
	WinBy       int
	MaxPoints   int
}

func (a *API) loadMatchForScoring(r *http.Request, w http.ResponseWriter, matchID string) (*matchRow, bool) {
	var m matchRow
	err := a.DB.QueryRow(r.Context(), `
		SELECT m.id, m.event_id, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, m.team1_score, m.team2_score, m.status,
		       e.points_to_win, e.win_by, e.max_points
		FROM matches m JOIN events e ON e.id = m.event_id
		WHERE m.id = $1
	`, matchID).Scan(&m.ID, &m.EventID, &m.Team1P1, &m.Team1P2, &m.Team2P1, &m.Team2P2, &m.Team1Score, &m.Team2Score, &m.Status, &m.PointsToWin, &m.WinBy, &m.MaxPoints)
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

type scoreReq struct {
	Team  int `json:"team"`  // 1 or 2
	Delta int `json:"delta"` // +1 or -1
}

// Score applies a point change to one team and checks for a match win,
// clamping at zero and never scoring a completed match further.
func (a *API) Score(w http.ResponseWriter, r *http.Request) {
	matchID := chi.URLParam(r, "id")
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

	winner := 0
	leader, trailer := t1, t2
	if t2 > t1 {
		leader, trailer = t2, t1
	}
	reachedTarget := leader >= m.PointsToWin && (leader-trailer) >= m.WinBy
	hitCap := leader >= m.MaxPoints
	if reachedTarget || hitCap {
		if t1 > t2 {
			winner = 1
		} else if t2 > t1 {
			winner = 2
		}
	}

	status := m.Status
	if status == "pending" {
		status = "in_progress"
	}

	if winner != 0 {
		status = "completed" // was left stale as "in_progress"/"pending" in the response below - the DB write was always correct, only the JSON reply lagged
		_, err := a.DB.Exec(r.Context(), `
			UPDATE matches SET team1_score = $1, team2_score = $2, status = 'completed', winner = $3,
			       started_at = COALESCE(started_at, now()), completed_at = now()
			WHERE id = $4
		`, t1, t2, winner, matchID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "could not update match")
			return
		}

		// Continuous rotation: this match just freed up 4 players - see if a
		// new non-repeating group is available right now and, if so, form
		// their next match immediately. Best-effort: the point the scorer
		// just entered has already been saved above, so a formation hiccup
		// here shouldn't fail the score request itself (the host's manual
		// "check for new games" endpoint is the fallback).
		if _, err := a.formMatchesFromFreePlayers(r.Context(), m.EventID); err != nil {
			log.Printf("formMatchesFromFreePlayers after match %s: %v", matchID, err)
		}
	} else {
		_, err := a.DB.Exec(r.Context(), `
			UPDATE matches SET team1_score = $1, team2_score = $2, status = $3,
			       started_at = COALESCE(started_at, now())
			WHERE id = $4
		`, t1, t2, status, matchID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "could not update match")
			return
		}
	}

	_, _ = a.DB.Exec(r.Context(), `INSERT INTO match_events (match_id, team) VALUES ($1, $2)`, matchID, req.Team)

	writeJSON(w, http.StatusOK, map[string]any{
		"team1Score": t1,
		"team2Score": t2,
		"status":     status,
		"winner":     winner,
	})
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
		u              models.User
		wins, losses   int
		pf, pa, played int
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
		won := (onTeam1 && winner == 1) || (!onTeam1 && winner == 2)
		if won {
			e.wins++
		} else {
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
			Wins: e.wins, Losses: e.losses, MatchesPlayed: e.played,
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
