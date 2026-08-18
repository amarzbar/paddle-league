package handlers

import (
	"context"
	"crypto/rand"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"paddle-league/server/internal/middleware"
	"paddle-league/server/internal/models"
	"paddle-league/server/internal/scheduling"
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
	Name             string `json:"name"`
	PointsToWin      int    `json:"pointsToWin"` // target COMBINED total for a match, Americano-style
	TimeLimitSeconds int    `json:"timeLimitSeconds"`
	IsPublic         bool   `json:"isPublic"`
	CourtCount       int    `json:"courtCount"`
	TotalRounds      int    `json:"totalRounds"`
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
		req.PointsToWin = 21
	}
	if req.TimeLimitSeconds < 0 {
		req.TimeLimitSeconds = 0
	}
	if req.CourtCount < 1 || req.CourtCount > 4 {
		req.CourtCount = 4
	}
	if req.TotalRounds <= 0 {
		req.TotalRounds = 8
	}

	var ev models.Event
	var err error
	for attempt := 0; attempt < 5; attempt++ {
		code := genJoinCode()
		err = a.DB.QueryRow(r.Context(), `
			INSERT INTO events (host_id, name, join_code, points_to_win, time_limit_seconds, is_public, court_count, total_rounds)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id, host_id, name, join_code, status, points_to_win, time_limit_seconds, current_round, is_public, court_count, total_rounds, created_at, started_at, completed_at
		`, userID, req.Name, code, req.PointsToWin, req.TimeLimitSeconds, req.IsPublic, req.CourtCount, req.TotalRounds).Scan(
			&ev.ID, &ev.HostID, &ev.Name, &ev.JoinCode, &ev.Status, &ev.PointsToWin, &ev.TimeLimitSeconds, &ev.CurrentRound,
			&ev.IsPublic, &ev.CourtCount, &ev.TotalRounds, &ev.CreatedAt, &ev.StartedAt, &ev.CompletedAt,
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

const eventColumns = `e.id, e.host_id, e.name, e.join_code, e.status, e.points_to_win, e.time_limit_seconds, e.current_round, e.is_public, e.court_count, e.total_rounds, e.created_at, e.started_at, e.completed_at`

func scanEvent(row interface{ Scan(...any) error }, ev *models.Event) error {
	return row.Scan(&ev.ID, &ev.HostID, &ev.Name, &ev.JoinCode, &ev.Status, &ev.PointsToWin, &ev.TimeLimitSeconds, &ev.CurrentRound,
		&ev.IsPublic, &ev.CourtCount, &ev.TotalRounds, &ev.CreatedAt, &ev.StartedAt, &ev.CompletedAt)
}

func (a *API) ListMyEvents(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserID(r.Context())
	rows, err := a.DB.Query(r.Context(), `
		SELECT `+eventColumns+`
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
		if err := scanEvent(rows, &ev); err != nil {
			writeErr(w, http.StatusInternalServerError, "scan error")
			return
		}
		events = append(events, ev)
	}
	writeJSON(w, http.StatusOK, events)
}

// ListPublicEvents powers the main page's "available events" section: any
// public event still in lobby or active (not yet completed), regardless of
// whether the requesting user has joined it. Joining one of these never
// requires a join code - see JoinPublicEvent.
func (a *API) ListPublicEvents(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(r.Context(), `
		SELECT `+eventColumns+`
		FROM events e
		WHERE e.is_public AND e.status IN ('lobby', 'active')
		ORDER BY e.created_at DESC
	`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not list public events")
		return
	}
	defer rows.Close()

	events := []models.Event{}
	for rows.Next() {
		var ev models.Event
		if err := scanEvent(rows, &ev); err != nil {
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

// JoinPublicEvent joins the caller to a public event by ID - no join code
// needed, since the whole point of marking an event public is that it's
// browsable and joinable straight from the main page's listing.
func (a *API) JoinPublicEvent(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserID(r.Context())
	id := chi.URLParam(r, "id")

	var isPublic bool
	err := a.DB.QueryRow(r.Context(), `SELECT is_public FROM events WHERE id = $1`, id).Scan(&isPublic)
	if errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "event not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load event")
		return
	}
	if !isPublic {
		writeErr(w, http.StatusForbidden, "this event is private - join with its code instead")
		return
	}

	_, err = a.DB.Exec(r.Context(), `
		INSERT INTO event_participants (event_id, user_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, id, userID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not join event")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"eventId": id})
}

func (a *API) getEventOr404(ctx context.Context, w http.ResponseWriter, id string) (*models.Event, bool) {
	var ev models.Event
	err := scanEvent(a.DB.QueryRow(ctx, `SELECT `+eventColumns+` FROM events e WHERE e.id = $1`, id), &ev)
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

	isHost := ev.HostID == userID
	log.Printf("GetEvent event=%s hostID=%s requestUserID=%q isHost=%v", id, ev.HostID, userID, isHost)

	writeJSON(w, http.StatusOK, eventDetail{
		Event:        *ev,
		Participants: participants,
		Rounds:       rounds,
		IsHost:       isHost,
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

// StartEvent precomputes the entire Americano schedule - every round, every
// match, every court assignment - in one shot and writes it all to the DB
// before anything goes live. Host-only, and only valid while the event is
// still in the lobby (this is a one-time kickoff, not a per-round nudge -
// see scheduling.Plan for why precomputing everything up front is the
// point: a player's "next matchup" after finishing a match is just their
// assignment in the following round, already sitting in the DB).
func (a *API) StartEvent(w http.ResponseWriter, r *http.Request) {
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
	if ev.Status != "lobby" {
		writeErr(w, http.StatusConflict, "event has already started")
		return
	}

	roundCount, matchCount, err := a.buildAndPersistSchedule(r.Context(), id, ev.CourtCount, ev.TotalRounds)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not build schedule: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"totalRounds":  roundCount,
		"totalMatches": matchCount,
	})
}

// buildAndPersistSchedule loads an event's participants, precomputes the
// full Americano schedule (scheduling.Plan), and writes every round/match to
// the DB plus flips the event to active - all in one transaction. Shared by
// the StartEvent HTTP handler and the formmatches ops CLI (cmd/formmatches),
// which triggers the identical logic directly against the DB for
// debugging/demo purposes, no HTTP request or session involved.
func (a *API) buildAndPersistSchedule(ctx context.Context, eventID string, courtCount, totalRounds int) (roundCount, matchCount int, err error) {
	participants, err := a.loadParticipants(ctx, eventID)
	if err != nil {
		return 0, 0, err
	}
	if len(participants) < 4 {
		return 0, 0, errors.New("need at least 4 players to start")
	}

	playerIDs := make([]string, len(participants))
	for i, p := range participants {
		playerIDs[i] = p.UserID
	}

	rounds, err := scheduling.Plan(playerIDs, courtCount, totalRounds, nil)
	if err != nil {
		return 0, 0, err
	}

	tx, err := a.DB.Begin(ctx)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback(ctx)

	for _, rnd := range rounds {
		var roundID string
		if err := tx.QueryRow(ctx, `INSERT INTO rounds (event_id, number) VALUES ($1, $2) RETURNING id`, eventID, rnd.Number).Scan(&roundID); err != nil {
			return 0, 0, err
		}
		for i, pair := range rnd.Pairs {
			court := "Court " + itoa(i+1)
			_, err := tx.Exec(ctx, `
				INSERT INTO matches (round_id, event_id, court_label, team1_p1, team1_p2, team2_p1, team2_p2)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, roundID, eventID, court, pair[0][0], pair[0][1], pair[1][0], pair[1][1])
			if err != nil {
				return 0, 0, err
			}
			matchCount++
		}
	}

	if _, err = tx.Exec(ctx, `UPDATE events SET status = 'active', current_round = 1, started_at = now() WHERE id = $1`, eventID); err != nil {
		return 0, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, 0, err
	}
	return len(rounds), matchCount, nil
}

// advanceRoundIfComplete moves an active event's current_round forward once
// every match in the current round is completed, and marks the whole event
// completed once that was the last round. The schedule itself never changes
// here - it was fully precomputed at StartEvent time - this only tracks
// which precomputed round is "live" for the board/next-matchup views.
func (a *API) advanceRoundIfComplete(ctx context.Context, eventID string) error {
	var status string
	var current int
	if err := a.DB.QueryRow(ctx, `SELECT status, current_round FROM events WHERE id = $1`, eventID).Scan(&status, &current); err != nil {
		return err
	}
	if status != "active" {
		return nil
	}

	var pendingInCurrent int
	err := a.DB.QueryRow(ctx, `
		SELECT count(*) FROM matches m JOIN rounds rnd ON rnd.id = m.round_id
		WHERE rnd.event_id = $1 AND rnd.number = $2 AND m.status != 'completed'
	`, eventID, current).Scan(&pendingInCurrent)
	if err != nil {
		return err
	}
	if pendingInCurrent > 0 {
		return nil // current round still has live matches
	}

	var nextExists bool
	err = a.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM rounds WHERE event_id = $1 AND number = $2)`, eventID, current+1).Scan(&nextExists)
	if err != nil {
		return err
	}
	if nextExists {
		_, err = a.DB.Exec(ctx, `UPDATE events SET current_round = $1 WHERE id = $2`, current+1, eventID)
		return err
	}
	_, err = a.DB.Exec(ctx, `UPDATE events SET status = 'completed', completed_at = now() WHERE id = $1`, eventID)
	return err
}

// AdminFormMatches is the ops-CLI entry point (cmd/formmatches) for
// precomputing and activating an event's schedule directly against the DB,
// bypassing HTTP/auth - useful for demos/debugging. It needs the event's own
// court/round settings, unlike StartEvent's HTTP handler which already has
// them from getEventOr404.
func (a *API) AdminFormMatches(ctx context.Context, eventID string) (matchCount int, err error) {
	var courtCount, totalRounds int
	if err := a.DB.QueryRow(ctx, `SELECT court_count, total_rounds FROM events WHERE id = $1`, eventID).Scan(&courtCount, &totalRounds); err != nil {
		return 0, err
	}
	_, matchCount, err = a.buildAndPersistSchedule(ctx, eventID, courtCount, totalRounds)
	return matchCount, err
}

// DeleteEvent permanently removes an event and everything under it
// (participants, rounds, matches all cascade via FK). Host-only.
func (a *API) DeleteEvent(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserID(r.Context())
	id := chi.URLParam(r, "id")
	ev, ok := a.getEventOr404(r.Context(), w, id)
	if !ok {
		return
	}
	if ev.HostID != userID {
		writeErr(w, http.StatusForbidden, "only the host can delete this event")
		return
	}
	if _, err := a.DB.Exec(r.Context(), `DELETE FROM events WHERE id = $1`, id); err != nil {
		writeErr(w, http.StatusInternalServerError, "could not delete event")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
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
