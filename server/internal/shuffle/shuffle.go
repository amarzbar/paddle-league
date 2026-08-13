// Package shuffle generates new round pairings for a paddle event: it splits
// the active player pool into teams of two such that no two players who have
// ever been teammates before in this event are paired again, then pairs
// those teams up into matches, preferring team-vs-team pairings that haven't
// happened yet either.
package shuffle

import (
	"errors"
	"math/rand"
	"sort"
)

var ErrNoValidPairing = errors.New("could not find a valid teammate pairing for this group")

// Team is two player IDs, always stored with the smaller ID first so it can
// be used as a stable map key.
type Team [2]string

func pairKey(a, b string) string {
	if a > b {
		a, b = b, a
	}
	return a + "|" + b
}

func newTeam(a, b string) Team {
	if a > b {
		a, b = b, a
	}
	return Team{a, b}
}

// Result is the outcome of shuffling one round.
type Result struct {
	Teams []Team   // every team playing this round
	Byes  []string // players sitting out this round (odd player count)
}

// Input controls the shuffle.
type Input struct {
	Players []string
	// TeammateHistory holds pairKey(a,b) for every pair that has already
	// been teammates — these pairings are forbidden.
	TeammateHistory map[string]bool
	// SitOutCount tracks how many rounds each player has already sat out,
	// used to fairly rotate byes when the pool is odd.
	SitOutCount map[string]int
	Rand        *rand.Rand
}

// GenerateTeams partitions players into teams of two, honoring the
// "never repeat a teammate" constraint. If the player count is odd, the
// player(s) who have sat out the fewest rounds are chosen to bye — with a
// fallback that retries a few different bye choices if the remaining group
// has no valid perfect matching.
func GenerateTeams(in Input) (*Result, error) {
	if in.Rand == nil {
		in.Rand = rand.New(rand.NewSource(1))
	}
	if len(in.Players) < 4 {
		return nil, errors.New("need at least 4 players to form two teams")
	}

	// Order candidates for sitting out: most rounds played (fewest sit-outs) last,
	// i.e. players with the *most* prior byes are least likely to sit again.
	candidates := append([]string{}, in.Players...)
	sort.SliceStable(candidates, func(i, j int) bool {
		return in.SitOutCount[candidates[i]] < in.SitOutCount[candidates[j]]
	})

	numByes := len(in.Players) % 2

	// Try a handful of bye combinations (starting with the fairest) until a
	// valid perfect matching is found among the rest.
	maxAttempts := 12
	for attempt := 0; attempt < maxAttempts; attempt++ {
		byes := chooseByes(candidates, numByes, attempt, in.Rand)
		byeSet := map[string]bool{}
		for _, b := range byes {
			byeSet[b] = true
		}

		remaining := make([]string, 0, len(in.Players)-numByes)
		for _, p := range in.Players {
			if !byeSet[p] {
				remaining = append(remaining, p)
			}
		}

		shuffled := append([]string{}, remaining...)
		in.Rand.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })

		teams, ok := backtrackMatch(shuffled, in.TeammateHistory)
		if ok {
			return &Result{Teams: teams, Byes: byes}, nil
		}
	}

	return nil, ErrNoValidPairing
}

// chooseByes picks numByes players to sit out. attempt>0 perturbs the
// selection (still biased toward fairness) so a caller can retry.
func chooseByes(fairnessOrdered []string, numByes, attempt int, rng *rand.Rand) []string {
	if numByes == 0 {
		return nil
	}
	pool := append([]string{}, fairnessOrdered...)
	if attempt > 0 {
		// widen the candidate pool a bit each retry, then shuffle within it
		window := min(len(pool), numByes+attempt*2)
		head := append([]string{}, pool[:window]...)
		rng.Shuffle(len(head), func(i, j int) { head[i], head[j] = head[j], head[i] })
		pool = append(head, pool[window:]...)
	}
	return append([]string{}, pool[:numByes]...)
}

// backtrackMatch finds a perfect matching of players into teams of two such
// that no team appears in forbidden. Players slice should already be
// shuffled for pairing variety.
func backtrackMatch(players []string, forbidden map[string]bool) ([]Team, bool) {
	n := len(players)
	used := make([]bool, n)
	teams := make([]Team, 0, n/2)

	var solve func(count int) bool
	solve = func(count int) bool {
		if count == n {
			return true
		}
		// pick first unused player
		i := -1
		for idx := 0; idx < n; idx++ {
			if !used[idx] {
				i = idx
				break
			}
		}
		if i == -1 {
			return true
		}
		used[i] = true
		for j := 0; j < n; j++ {
			if used[j] {
				continue
			}
			if forbidden[pairKey(players[i], players[j])] {
				continue
			}
			used[j] = true
			teams = append(teams, newTeam(players[i], players[j]))
			if solve(count + 2) {
				return true
			}
			teams = teams[:len(teams)-1]
			used[j] = false
		}
		used[i] = false
		return false
	}

	if solve(0) {
		return teams, true
	}
	return nil, false
}

// MatchUp pairs teams into matches (2 teams each), preferring team-vs-team
// combinations that haven't faced each other yet (matchupHistory keyed by
// pairKey of the two teams' "team keys"). If the team count is odd, one team
// byes — chosen fairly via playerSitOut so the same team doesn't keep
// sitting out (rare — only when the whole event has an odd number of teams).
func MatchUp(teams []Team, matchupHistory map[string]bool, playerSitOut map[string]int, rng *rand.Rand) (pairs [][2]Team, byeTeam *Team) {
	if rng == nil {
		rng = rand.New(rand.NewSource(1))
	}
	shuffled := append([]Team{}, teams...)
	rng.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })

	// With an odd team count, explicitly bye the team whose members have
	// rested the *least* so far, so byes rotate fairly instead of always
	// falling on whichever team is left unmatched by chance.
	if len(shuffled)%2 == 1 {
		byeIdx := 0
		byeRest := playerSitOut[shuffled[0][0]] + playerSitOut[shuffled[0][1]]
		for i := 1; i < len(shuffled); i++ {
			rest := playerSitOut[shuffled[i][0]] + playerSitOut[shuffled[i][1]]
			if rest < byeRest {
				byeIdx, byeRest = i, rest
			}
		}
		t := shuffled[byeIdx]
		byeTeam = &t
		shuffled = append(shuffled[:byeIdx], shuffled[byeIdx+1:]...)
	}

	teamKey := func(t Team) string { return t[0] + "," + t[1] }

	used := make([]bool, len(shuffled))
	for i := range shuffled {
		if used[i] {
			continue
		}
		used[i] = true
		bestJ := -1
		for j := i + 1; j < len(shuffled); j++ {
			if used[j] {
				continue
			}
			if bestJ == -1 {
				bestJ = j
			}
			if !matchupHistory[pairKey(teamKey(shuffled[i]), teamKey(shuffled[j]))] {
				bestJ = j
				break
			}
		}
		used[bestJ] = true
		pairs = append(pairs, [2]Team{shuffled[i], shuffled[bestJ]})
	}
	return pairs, byeTeam
}
