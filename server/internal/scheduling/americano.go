// Package scheduling generates the full Americano round schedule for an
// event up front, in memory, before a single match is written to the DB -
// as opposed to the old continuous-rotation model (see handlers/rotation.go
// history), which formed one round's matches reactively every time a court
// freed up. Precomputing the whole schedule means a player's "next matchup"
// is just their assignment in round N+1 - no runtime computation needed to
// answer that question once the event has started.
package scheduling

import (
	"errors"
	"math/rand"

	"paddle-league/server/internal/shuffle"
)

var ErrNotEnoughPlayers = errors.New("need at least 4 players to schedule an Americano event")

// RoundPlan is one precomputed round: up to CourtCount matches, plus whoever
// sat out this round (either an odd-player-count bye, or - when the player
// pool exceeds what CourtCount can seat in one round - a capacity bye).
type RoundPlan struct {
	Number int
	Pairs  [][2]shuffle.Team // one entry per match, court i = Pairs[i]
	Byes   []string
}

// Plan builds totalRounds worth of matches for players, never seating more
// than courtCount*4 players in a single round. Byes (both the classic
// odd-player-count kind and the "pool bigger than court capacity" kind) are
// chosen fairly each round by preferring whoever has played the fewest
// matches so far in this in-memory plan, mirroring the fairness rule the old
// per-round DB queries (loadMatchesPlayedCount) used to enforce.
func Plan(players []string, courtCount, totalRounds int, rng *rand.Rand) ([]RoundPlan, error) {
	if len(players) < 4 {
		return nil, ErrNotEnoughPlayers
	}
	if rng == nil {
		rng = rand.New(rand.NewSource(1))
	}
	capacity := courtCount * 4

	played := map[string]int{}
	teammateHistory := map[string]bool{}
	matchupHistory := map[string]bool{}
	teamKey := func(t shuffle.Team) string { return t[0] + "," + t[1] }
	pairKey := func(a, b string) string {
		if a > b {
			a, b = b, a
		}
		return a + "|" + b
	}

	plans := make([]RoundPlan, 0, totalRounds)
	for roundNum := 1; roundNum <= totalRounds; roundNum++ {
		pool := selectRoundPool(players, played, capacity)

		sitOutProxy := map[string]int{}
		for _, p := range pool {
			sitOutProxy[p] = -played[p] // fewer matches played => more eligible to play
		}

		result, err := shuffle.GenerateTeams(shuffle.Input{
			Players:         pool,
			TeammateHistory: teammateHistory,
			SitOutCount:     sitOutProxy,
			Rand:            rng,
		})
		if err != nil {
			// No valid non-repeating teammate grouping left in this pool -
			// clear teammate history and let pairings repeat rather than
			// stall the schedule; matchup (team-vs-team) variety is still
			// preferred by MatchUp below.
			teammateHistory = map[string]bool{}
			result, err = shuffle.GenerateTeams(shuffle.Input{
				Players:     pool,
				SitOutCount: sitOutProxy,
				Rand:        rng,
			})
			if err != nil {
				return nil, err
			}
		}

		pairs, byeTeam := shuffle.MatchUp(result.Teams, matchupHistory, sitOutProxy, rng)
		if len(pairs) > courtCount {
			pairs = pairs[:courtCount] // pool is already capped to capacity, so this shouldn't trigger - defensive only
		}

		byes := append([]string{}, result.Byes...)
		if byeTeam != nil {
			byes = append(byes, byeTeam[0], byeTeam[1])
		}
		poolSet := map[string]bool{}
		for _, p := range pool {
			poolSet[p] = true
		}
		for _, p := range players {
			if !poolSet[p] {
				byes = append(byes, p)
			}
		}

		for _, pair := range pairs {
			played[pair[0][0]]++
			played[pair[0][1]]++
			played[pair[1][0]]++
			played[pair[1][1]]++
			teammateHistory[pairKey(pair[0][0], pair[0][1])] = true
			teammateHistory[pairKey(pair[1][0], pair[1][1])] = true
			matchupHistory[pairKey(teamKey(pair[0]), teamKey(pair[1]))] = true
		}

		plans = append(plans, RoundPlan{Number: roundNum, Pairs: pairs, Byes: byes})
	}
	return plans, nil
}

// selectRoundPool picks up to `capacity` players for this round, preferring
// whoever has played the fewest matches so far so capacity byes rotate
// fairly across rounds instead of always falling on the same players.
func selectRoundPool(players []string, played map[string]int, capacity int) []string {
	if len(players) <= capacity {
		return players
	}
	ordered := append([]string{}, players...)
	// stable sort by played count ascending (fewest-played first)
	for i := 1; i < len(ordered); i++ {
		for j := i; j > 0 && played[ordered[j]] < played[ordered[j-1]]; j-- {
			ordered[j], ordered[j-1] = ordered[j-1], ordered[j]
		}
	}
	pool := ordered[:capacity]
	// keep the pool at a multiple of 4 so nobody gets stranded as an
	// unpairable single leftover once byes/teams are formed
	pool = pool[:len(pool)-len(pool)%4]
	return pool
}
