package handlers

import (
	"context"
	"crypto/rand"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"paddle-league/server/internal/middleware"
	"paddle-league/server/internal/models"
)

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no confusing chars

func genJoinCode() string {
	b := make([]byte, 6)
	buf := make([]byte, 6)
	_, _ = rand.Read(buf)
	for i, v := range buf {
		b[i] = codeAlphabet[int(v)%len(codeAlphabet)]
	}
	return string(b)
}

type createEventReq struct {
	Name        string `json:"name"`
	PointsToWin int    `json:"pointsToWin"`
	WinBy       int    `json:"winBy"`
	MaxPoints   int    `json:"maxPoints"`
}

func (a *API) CreateEvent(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserID(r.Context())
	var req createEventReq
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		req.Name = "Paddle Night"
	}
	if req.PointsToWin <= 0 {
		req.PointsToWin = 11
	}
	if req.WinBy <= 0 {
		req.WinBy = 2
	}
	if req.MaxPoints <= 0 || req.MaxPoints < req.PointsToWin {
		req.MaxPoints = req.PointsToWin + 4
	}

	var ev models.Event
	var err error
	for attempt := 0; attempt < 5; attempt++ {
		code := genJoinCode()
		err = a.DB.QueryRow(r.Context(), `
			INSERT INTO events (host_id, name, join_code, points_to_win, win_by, max_points)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, host_id, name, join_code, status, points_to_win, win_by, max_points, current_round, created_at, started_at, completed_at
		`, userID, req.Name, code, req.PointsToWin, req.WinBy, req.MaxPoints).Scan(
			&ev.ID, &ev.HostID, &ev.Name, &ev.JoinCode, &ev.Status, &ev.PointsToWin, &ev.WinBy, &ev.MaxPoints, &ev.CurrentRound, &ev.CreatedAt, &ev.StartedAt, &ev.CompletedAt,
		)
		if err == nil {
			break
		}
		if !strings.Contains(err.Error(), "duplicate key") {
			break
		}
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create event")
		return
	}

	// host auto-joins as a participant
	_, err = a.DB.Exec(r.Context(), `INSERT INTO event_participants (event_id, user_id) VALUES ($1, $2)`, ev.ID, userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not add host as participant")
		return
	}

	writeJSON(w, http.StatusCreated, ev)
}

func (a *API) ListMyEvents(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserID(r.Context())
	rows, err := a.DB.Query(r.Context(), `
		SELECT e.id, e.host_id, e.name, e.join_code, e.status, e.points_to_win, e.win_by, e.max_points, e.current_round, e.created_at, e.started_at, e.completed_at
		FROM events e
		JOIN event_participants p ON p.event_id = e.id
		WHERE p.user_id = $1
		ORDER BY e.created_at DESC
	`, userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not list events")
		return
	}
	defer rows.Close()

	events := []models.Event{}
	for rows.Next() {
		var ev models.Event
		if err := rows.Scan(&ev.ID, &ev.HostID, &ev.Name, &ev.JoinCode, &ev.Status, &ev.PointsToWin, &ev.WinBy, &ev.MaxPoints, &ev.CurrentRound, &ev.CreatedAt, &ev.StartedAt, &ev.CompletedAt); err != nil {
			writeErr(w, http.StatusInternalServerError, "scan error")
			return
		}
		events = append(events, ev)
	}
	writeJSON(w, http.StatusOK, events)
}

type joinEventReq struct {
	JoinCode string `json:"joinCode"`
}

func (a *API) JoinEvent(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserID(r.Context())
	var req joinEventReq
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	code := strings.ToUpper(strings.TrimSpace(req.JoinCode))

	var eventID string
	err := a.DB.QueryRow(r.Context(), `SELECT id FROM events WHERE join_code = $1`, code).Scan(&eventID)
	if err != nil {
		writeErr(w, http.StatusNotFound, "no event found with that code")
		return
	}

	_, err = a.DB.Exec(r.Context(), `
		INSERT INTO event_participants (event_id, user_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, eventID, userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not join event")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"eventId": eventID})
}

func (a *API) getEventOr404(ctx context.Context, w http.ResponseWriter, id string) (*models.Event, bool) {
	var ev models.Event
	err := a.DB.QueryRow(ctx, `
		SELECT id, host_id, name, join_code, status, points_to_win, win_by, max_points, current_round, created_at, started_at, completed_at
		FROM events WHERE id = $1
	`, id).Scan(&ev.ID, &ev.HostID, &ev.Name, &ev.JoinCode, &ev.Status, &ev.PointsToWin, &ev.WinBy, &ev.MaxPoints, &ev.CurrentRound, &ev.CreatedAt, &ev.StartedAt, &ev.CompletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "event not found")
		return nil, false
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load event")
		return nil, false
	}
	return &ev, true
}

type eventDetail struct {
	models.Event
	Participants []models.Participant `json:"participants"`
	Rounds       []models.Round       `json:"rounds"`
	IsHost       bool                 `json:"isHost"`
}

func (a *API) GetEvent(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserID(r.Context())
	id := chi.URLParam(r, "id")
	ev, ok := a.getEventOr404(r.Context(), w, id)
	if !ok {
		return
	}

	participants, err := a.loadParticipants(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load participants")
		return
	}

	rounds, err := a.loadRounds(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load rounds")
		return
	}

	writeJSON(w, http.StatusOK, eventDetail{
		Event:        *ev,
		Participants: participants,
		Rounds:       rounds,
		IsHost:       ev.HostID == userID,
	})
}

func (a *API) loadParticipants(ctx context.Context, eventID string) ([]models.Participant, error) {
	rows, err := a.DB.Query(ctx, `
		SELECT u.id, u.display_name, u.avatar_color, p.joined_at
		FROM event_participants p
		JOIN users u ON u.id = p.user_id
		WHERE p.event_id = $1
		ORDER BY p.joined_at ASC
	`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Participant{}
	for rows.Next() {
		var p models.Participant
		var u models.User
		if err := rows.Scan(&u.ID, &u.DisplayName, &u.AvatarColor, &p.JoinedAt); err != nil {
			return nil, err
		}
		p.EventID = eventID
		p.UserID = u.ID
		p.User = &u
		out = append(out, p)
	}
	return out, nil
}

func (a *API) loadRounds(ctx context.Context, eventID string) ([]models.Round, error) {
	rows, err := a.DB.Query(ctx, `SELECT id, event_id, number, created_at FROM rounds WHERE event_id = $1 ORDER BY number ASC`, eventID)
	if err != nil {
		return nil, err
	}
	rounds := []models.Round{}
	for rows.Next() {
		var rnd models.Round
		if err := rows.Scan(&rnd.ID, &rnd.EventID, &rnd.Number, &rnd.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		rounds = append(rounds, rnd)
	}
	rows.Close()

	for i := range rounds {
		matches, err := a.loadMatchesForRound(ctx, rounds[i].ID)
		if err != nil {
			return nil, err
		}
		rounds[i].Matches = matches
	}
	return rounds, nil
}

func (a *API) loadMatchesForRound(ctx context.Context, roundID string) ([]models.Match, error) {
	rows, err := a.DB.Query(ctx, `
		SELECT m.id, m.round_id, m.event_id, m.court_label,
		       m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2,
		       m.team1_score, m.team2_score, m.status, m.winner,
		       m.started_at, m.completed_at, m.created_at,
		       u1.display_name, u1.avatar_color,
		       u2.display_name, u2.avatar_color,
		       u3.display_name, u3.avatar_color,
		       u4.display_name, u4.avatar_color
		FROM matches m
		JOIN users u1 ON u1.id = m.team1_p1
		JOIN users u2 ON u2.id = m.team1_p2
		JOIN users u3 ON u3.id = m.team2_p1
		JOIN users u4 ON u4.id = m.team2_p2
		WHERE m.round_id = $1
		ORDER BY m.court_label ASC
	`, roundID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Match{}
	for rows.Next() {
		var m models.Match
		var u1, u2, u3, u4 models.User
		if err := rows.Scan(
			&m.ID, &m.RoundID, &m.EventID, &m.CourtLabel,
			&m.Team1P1, &m.Team1P2, &m.Team2P1, &m.Team2P2,
			&m.Team1Score, &m.Team2Score, &m.Status, &m.Winner,
			&m.StartedAt, &m.CompletedAt, &m.CreatedAt,
			&u1.DisplayName, &u1.AvatarColor,
			&u2.DisplayName, &u2.AvatarColor,
			&u3.DisplayName, &u3.AvatarColor,
			&u4.DisplayName, &u4.AvatarColor,
		); err != nil {
			return nil, err
		}
		u1.ID, u2.ID, u3.ID, u4.ID = m.Team1P1, m.Team1P2, m.Team2P1, m.Team2P2
		m.Team1P1User, m.Team1P2User, m.Team2P1User, m.Team2P2User = &u1, &u2, &u3, &u4
		out = append(out, m)
	}
	return out, nil
}

// NextRound attempts to form new matches right now from whichever
// participants are currently free (not already in a pending/in_progress
// match) - see formMatchesFromFreePlayers in rotation.go. Host-only. This is
// both the initial kickoff (event still in the lobby, everyone is free) and
// a manual "check for new games" fallback the host can call any time -
// under continuous rotation, new matches otherwise form automatically as
// courts finish (see Score in matches.go), so this endpoint is no longer
// the only way rounds advance.
func (a *API) NextRound(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserID(r.Context())
	id := chi.URLParam(r, "id")
	ev, ok := a.getEventOr404(r.Context(), w, id)
	if !ok {
		return
	}
	if ev.HostID != userID {
		writeErr(w, http.StatusForbidden, "only the host can do this")
		return
	}

	participants, err := a.loadParticipants(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load participants")
		return
	}
	if len(participants) < 4 {
		writeErr(w, http.StatusBadRequest, "need at least 4 players to start")
		return
	}

	result, err := a.formMatchesFromFreePlayers(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not form matches")
		return
	}
	if result.EventCompleted {
		writeJSON(w, http.StatusOK, map[string]any{
			"created":        0,
			"eventCompleted": true,
		})
		return
	}
	if result.Created == 0 {
		writeErr(w, http.StatusConflict, "no new matches to form right now — either not enough players are free, or everyone free has already partnered with everyone else")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"roundNumber": result.RoundNumber,
		"created":     result.Created,
		"byes":        result.Byes,
	})
}

func sortedKey(a, b string) string {
	if a > b {
		a, b = b, a
	}
	return a + "|" + b
}

func teamKeyOf(a, b string) string {
	if a > b {
		a, b = b, a
	}
	return a + "," + b
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}

// CompleteEvent marks the event as completed. Host-only.
func (a *API) CompleteEvent(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserID(r.Context())
	id := chi.URLParam(r, "id")
	ev, ok := a.getEventOr404(r.Context(), w, id)
	if !ok {
		return
	}
	if ev.HostID != userID {
		writeErr(w, http.StatusForbidden, "only the host can complete the event")
		return
	}
	_, err := a.DB.Exec(r.Context(), `UPDATE events SET status = 'completed', completed_at = now() WHERE id = $1`, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not complete event")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
