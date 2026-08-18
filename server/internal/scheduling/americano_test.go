package scheduling

import (
	"fmt"
	"math/rand"
	"testing"
)

func players(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = fmt.Sprintf("p%d", i)
	}
	return out
}

func TestPlan_RejectsTooFewPlayers(t *testing.T) {
	if _, err := Plan(players(3), 4, 5, nil); err != ErrNotEnoughPlayers {
		t.Fatalf("expected ErrNotEnoughPlayers, got %v", err)
	}
}

func TestPlan_NeverExceedsCourtCount(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	for _, n := range []int{4, 8, 15, 16, 20, 33} {
		rounds, err := Plan(players(n), 4, 10, rng)
		if err != nil {
			t.Fatalf("n=%d: %v", n, err)
		}
		for _, rnd := range rounds {
			if len(rnd.Pairs) > 4 {
				t.Fatalf("n=%d round %d: %d matches, want <= 4 courts", n, rnd.Number, len(rnd.Pairs))
			}
		}
	}
}

func TestPlan_NoPlayerDoubleBooked(t *testing.T) {
	rng := rand.New(rand.NewSource(7))
	rounds, err := Plan(players(18), 4, 10, rng)
	if err != nil {
		t.Fatal(err)
	}
	for _, rnd := range rounds {
		seen := map[string]bool{}
		for _, pair := range rnd.Pairs {
			for _, id := range []string{pair[0][0], pair[0][1], pair[1][0], pair[1][1]} {
				if seen[id] {
					t.Fatalf("round %d: player %s appears in two matches", rnd.Number, id)
				}
				seen[id] = true
			}
		}
		for _, id := range rnd.Byes {
			if seen[id] {
				t.Fatalf("round %d: player %s is both playing and a bye", rnd.Number, id)
			}
		}
	}
}

func TestPlan_FairnessAcrossByes(t *testing.T) {
	// 18 players, 4 courts (capacity 16) => 2 players sit out every round on
	// top of the odd-player-count bye logic. Over enough rounds, nobody
	// should be starved relative to the rest.
	rng := rand.New(rand.NewSource(3))
	rounds, err := Plan(players(18), 4, 12, rng)
	if err != nil {
		t.Fatal(err)
	}
	played := map[string]int{}
	for _, rnd := range rounds {
		for _, pair := range rnd.Pairs {
			for _, id := range []string{pair[0][0], pair[0][1], pair[1][0], pair[1][1]} {
				played[id]++
			}
		}
	}
	min, max := -1, -1
	for _, c := range played {
		if min == -1 || c < min {
			min = c
		}
		if c > max {
			max = c
		}
	}
	if max-min > 2 {
		t.Fatalf("unfair distribution: min played %d, max played %d", min, max)
	}
}

func TestPlan_NoRepeatTeammatesWhenPossible(t *testing.T) {
	// 8 players, 4 courts (only 2 matches/round possible), 3 rounds - well
	// within the 7 rounds a perfect round-robin partner rotation supports
	// for 8 players, so no repeat teammates should be necessary at all.
	rng := rand.New(rand.NewSource(11))
	rounds, err := Plan(players(8), 4, 3, rng)
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	pairKey := func(a, b string) string {
		if a > b {
			a, b = b, a
		}
		return a + "|" + b
	}
	for _, rnd := range rounds {
		for _, pair := range rnd.Pairs {
			for _, team := range pair {
				k := pairKey(team[0], team[1])
				if seen[k] {
					t.Fatalf("teammate pair %s repeated within %d rounds for 8 players", k, len(rounds))
				}
				seen[k] = true
			}
		}
	}
}
