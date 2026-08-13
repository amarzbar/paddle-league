package handlers

import (
	"context"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"paddle-league/server/internal/shuffle"
)

// querier is satisfied by both *pgxpool.Pool and pgx.Tx, so the helpers below
// can run either standalone or inside the locked transaction in
// formMatchesFromFreePlayers.
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// loadFreePlayerIDs returns participant IDs for eventID who are not currently
// assigned to any pending/in_progress match - i.e. eligible to be shuffled
// into a new match right now.
func loadFreePlayerIDs(ctx context.Context, db querier, eventID string) ([]string, error) {
	rows, err := db.Query(ctx, `
		SELECT p.user_id
		FROM event_participants p
		WHERE p.event_id = $1
		AND p.user_id NOT IN (
			SELECT unnest(ARRAY[m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2])
			FROM matches m
			WHERE m.event_id = $1 AND m.status IN ('pending', 'in_progress')
		)
	`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// loadMatchesPlayedCount counts how many matches (any status) each
// participant has been assigned to, event-wide - the fairness signal for
// continuous rotation, replacing round-based sit-out counting (there's no
// stable "round" to count sit-outs against anymore once matches interleave).
func loadMatchesPlayedCount(ctx context.Context, db querier, eventID string) (map[string]int, error) {
	rows, err := db.Query(ctx, `
		SELECT user_id, count(*) FROM (
			SELECT team1_p1 AS user_id FROM matches WHERE event_id = $1
			UNION ALL SELECT team1_p2 FROM matches WHERE event_id = $1
			UNION ALL SELECT team2_p1 FROM matches WHERE event_id = $1
			UNION ALL SELECT team2_p2 FROM matches WHERE event_id = $1
		) played
		GROUP BY user_id
	`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]int{}
	for rows.Next() {
		var id string
		var count int
		if err := rows.Scan(&id, &count); err != nil {
			return nil, err
		}
		out[id] = count
	}
	return out, rows.Err()
}

// loadTeammateMatchupHistory is the same event-wide history query
// loadHistory used to build inline - split out so formMatchesFromFreePlayers
// can run it inside its own locked transaction.
func loadTeammateMatchupHistory(ctx context.Context, db querier, eventID string) (teammates map[string]bool, matchups map[string]bool, err error) {
	teammates = map[string]bool{}
	matchups = map[string]bool{}

	rows, err := db.Query(ctx, `SELECT team1_p1, team1_p2, team2_p1, team2_p2 FROM matches WHERE event_id = $1`, eventID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t1p1, t1p2, t2p1, t2p2 string
		if err := rows.Scan(&t1p1, &t1p2, &t2p1, &t2p2); err != nil {
			return nil, nil, err
		}
		teammates[sortedKey(t1p1, t1p2)] = true
		teammates[sortedKey(t2p1, t2p2)] = true
		matchups[sortedKey(teamKeyOf(t1p1, t1p2), teamKeyOf(t2p1, t2p2))] = true
	}
	return teammates, matchups, rows.Err()
}

// tieredCandidatePools groups `free` players into tiers by how many matches
// they've already played, then returns progressively-larger cumulative pools
// (tier 0, tier 0+1, tier 0+1+2, ...) - each pool only ever includes whole
// tiers, never a partial one, so within any given pool no included player has
// played strictly more matches than any excluded player. The caller should
// try pools in order and stop at the first one a valid grouping is found in:
// this is what guarantees nobody plays game N+1 while someone free has yet
// to play game N, rather than leaving that to chance via team-random-shuffle
// (a team-level bye alone can't guarantee this - a high-play-count player can
// still get randomly teamed with a low-play-count one and "hide" behind
// them). The final pool is always the full free list, so a match still forms
// eventually if any valid grouping exists at all, even a very mixed one.
func tieredCandidatePools(free []string, played map[string]int) [][]string {
	byTier := map[int][]string{}
	tierKeys := []int{}
	for _, p := range free {
		t := played[p]
		if _, ok := byTier[t]; !ok {
			tierKeys = append(tierKeys, t)
		}
		byTier[t] = append(byTier[t], p)
	}
	sort.Ints(tierKeys)

	// By the last tier, cumulative == free (every tier included), and callers
	// only invoke this with len(free) >= 4 - so at least one pool (the full
	// free list) is always produced.
	var pools [][]string
	var cumulative []string
	for _, t := range tierKeys {
		cumulative = append(append([]string{}, cumulative...), byTier[t]...)
		if len(cumulative) >= 4 {
			pools = append(pools, append([]string{}, cumulative...))
		}
	}
	return pools
}

// formationResult reports what formMatchesFromFreePlayers actually did, for
// the caller to relay back to the client (e.g. the host's manual "check for
// new games" nudge, or the initial kickoff).
type formationResult struct {
	Created        int      // matches created this call
	RoundNumber    int      // the round number they were created under, if any
	Byes           []string // player IDs left over (free but not matched this time)
	EventCompleted bool     // true if this call auto-completed the event (see maybeAutoComplete)
}

func countParticipants(ctx context.Context, db querier, eventID string) (int, error) {
	var n int
	err := db.QueryRow(ctx, `SELECT count(*) FROM event_participants WHERE event_id = $1`, eventID).Scan(&n)
	return n, err
}

// maybeAutoComplete marks the event completed if nobody is playing *anywhere*
// right now (every participant is in `free`) and this call still couldn't
// form a single new match from them - the only way that combination happens
// is a genuine dead end: either every remaining valid teammate/matchup
// pairing has already been used, or fewer than 4 players are left in the
// event at all. Either way nothing will ever change on its own (nobody's
// mid-match to eventually free up and alter the pool), so there's no reason
// to leave the event sitting open. Returns whether it completed the event.
func maybeAutoComplete(ctx context.Context, tx pgx.Tx, eventID string, status string, free []string) (bool, error) {
	if status != "active" {
		return false, nil // already completed, or still in the lobby (handled by NextRound's own pre-check)
	}
	total, err := countParticipants(ctx, tx, eventID)
	if err != nil {
		return false, err
	}
	if total-len(free) > 0 {
		return false, nil // someone's still mid-match elsewhere - the pool can still change later
	}
	_, err = tx.Exec(ctx, `UPDATE events SET status = 'completed', completed_at = now() WHERE id = $1`, eventID)
	return err == nil, err
}

// formMatchesFromFreePlayers is the core of continuous rotation: it looks at
// whoever is currently free (not in a pending/in_progress match) across the
// whole event, and - if a valid non-repeating grouping exists among them -
// forms as many new matches as it can right now. Called both for the host's
// initial kickoff (when the event is still in the lobby, every participant
// is "free" since no matches exist yet) and automatically every time a match
// completes (see matches.go Score). A no-op (0 created, no error) is the
// correct, expected outcome when fewer than 4 players are currently free, or
// when the free group has already all partnered with each other - those
// players simply stay pending until the free set changes on some future
// call.
func (a *API) formMatchesFromFreePlayers(ctx context.Context, eventID string) (*formationResult, error) {
	tx, err := a.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Lock the event row so two near-simultaneous triggers (e.g. two matches
	// completing within milliseconds of each other) can't both compute an
	// overlapping "free" set and double-book a player into two new matches.
	var status string
	if err := tx.QueryRow(ctx, `SELECT status FROM events WHERE id = $1 FOR UPDATE`, eventID).Scan(&status); err != nil {
		return nil, err
	}

	free, err := loadFreePlayerIDs(ctx, tx, eventID)
	if err != nil {
		return nil, err
	}
	if len(free) < 4 {
		completed, err := maybeAutoComplete(ctx, tx, eventID, status, free)
		if err != nil {
			return nil, err
		}
		return &formationResult{EventCompleted: completed}, tx.Commit(ctx)
	}

	teammateHistory, matchupHistory, err := loadTeammateMatchupHistory(ctx, tx, eventID)
	if err != nil {
		return nil, err
	}
	played, err := loadMatchesPlayedCount(ctx, tx, eventID)
	if err != nil {
		return nil, err
	}

	// Try the least-played tier first, only widening to include more-played
	// players if no valid non-repeat grouping exists among the fairer pool -
	// see tieredCandidatePools. This is what guarantees nobody plays again
	// while a less-played free player is available, instead of leaving it to
	// chance via random team composition.
	var result *shuffle.Result
	var pairs [][2]shuffle.Team
	for _, pool := range tieredCandidatePools(free, played) {
		sitOutProxy := map[string]int{}
		for _, p := range pool {
			// shuffle.go's SitOutCount is "how many times already sat out" -
			// lowest value is picked to bye next. Fewer matches played
			// should mean *more* eligible to play, so negate.
			sitOutProxy[p] = -played[p]
		}
		r, err := shuffle.GenerateTeams(shuffle.Input{
			Players:         pool,
			TeammateHistory: teammateHistory,
			SitOutCount:     sitOutProxy,
		})
		if err != nil {
			continue // no valid pairing in this pool yet - try the next, wider one
		}
		p, _ := shuffle.MatchUp(r.Teams, matchupHistory, sitOutProxy, nil)
		if len(p) == 0 {
			continue
		}
		result, pairs = r, p
		break
	}
	if result == nil {
		// No valid grouping anywhere in the free pool right now. If someone
		// else is still mid-match, the pool can still change later - stay
		// pending. If nobody is playing anywhere, this is a genuine dead end
		// (everyone free has already partnered with everyone else) - auto
		// end the event instead of leaving it stuck open forever.
		completed, err := maybeAutoComplete(ctx, tx, eventID, status, free)
		if err != nil {
			return nil, err
		}
		return &formationResult{EventCompleted: completed}, tx.Commit(ctx)
	}

	var nextNum int
	if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(number), 0) + 1 FROM rounds WHERE event_id = $1`, eventID).Scan(&nextNum); err != nil {
		return nil, err
	}
	var roundID string
	if err := tx.QueryRow(ctx, `INSERT INTO rounds (event_id, number) VALUES ($1, $2) RETURNING id`, eventID, nextNum).Scan(&roundID); err != nil {
		return nil, err
	}
	for i, pair := range pairs {
		court := "Court " + itoa(i+1)
		_, err := tx.Exec(ctx, `
			INSERT INTO matches (round_id, event_id, court_label, team1_p1, team1_p2, team2_p1, team2_p2)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, roundID, eventID, court, pair[0][0], pair[0][1], pair[1][0], pair[1][1])
		if err != nil {
			return nil, err
		}
	}

	// Everyone free but not actually placed into a match this call - this is
	// broader than result.Byes/byeTeam alone, since a whole higher tier can
	// have been excluded from the candidate pool entirely (see
	// tieredCandidatePools) without ever being passed to the shuffler.
	playing := map[string]bool{}
	for _, pair := range pairs {
		playing[pair[0][0]], playing[pair[0][1]] = true, true
		playing[pair[1][0]], playing[pair[1][1]] = true, true
	}
	byes := []string{}
	for _, p := range free {
		if !playing[p] {
			byes = append(byes, p)
		}
	}

	if status == "lobby" {
		_, err = tx.Exec(ctx, `UPDATE events SET status = 'active', current_round = $1, started_at = COALESCE(started_at, now()) WHERE id = $2`, nextNum, eventID)
	} else {
		_, err = tx.Exec(ctx, `UPDATE events SET current_round = $1 WHERE id = $2`, nextNum, eventID)
	}
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &formationResult{Created: len(pairs), RoundNumber: nextNum, Byes: byes}, nil
}
