package shuffle

import (
	"fmt"
	"math/rand"
	"testing"
)

func TestGenerateTeamsNeverRepeatsTeammates(t *testing.T) {
	players := []string{"a", "b", "c", "d", "e", "f", "g", "h"}
	teammateHistory := map[string]bool{}
	sitOut := map[string]int{}
	rng := rand.New(rand.NewSource(42))

	for round := 0; round < 3; round++ {
		res, err := GenerateTeams(Input{
			Players:         players,
			TeammateHistory: teammateHistory,
			SitOutCount:     sitOut,
			Rand:            rng,
		})
		if err != nil {
			t.Fatalf("round %d: %v", round, err)
		}
		if len(res.Teams) != 4 {
			t.Fatalf("round %d: expected 4 teams, got %d", round, len(res.Teams))
		}
		for _, team := range res.Teams {
			k := pairKey(team[0], team[1])
			if teammateHistory[k] {
				t.Fatalf("round %d: repeated teammate pair %v", round, team)
			}
			teammateHistory[k] = true
		}
		fmt.Printf("round %d teams: %v\n", round, res.Teams)
	}
}

func TestGenerateTeamsHandlesOddPlayers(t *testing.T) {
	players := []string{"a", "b", "c", "d", "e"}
	sitOut := map[string]int{}
	rng := rand.New(rand.NewSource(7))

	res, err := GenerateTeams(Input{
		Players:         players,
		TeammateHistory: map[string]bool{},
		SitOutCount:     sitOut,
		Rand:            rng,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Byes) != 1 {
		t.Fatalf("expected 1 bye, got %d", len(res.Byes))
	}
	if len(res.Teams) != 2 {
		t.Fatalf("expected 2 teams, got %d", len(res.Teams))
	}
}

func TestMatchUpPairsAllTeams(t *testing.T) {
	teams := []Team{newTeam("a", "b"), newTeam("c", "d"), newTeam("e", "f"), newTeam("g", "h")}
	rng := rand.New(rand.NewSource(3))
	pairs, bye := MatchUp(teams, map[string]bool{}, map[string]int{}, rng)
	if bye != nil {
		t.Fatalf("did not expect a bye team")
	}
	if len(pairs) != 2 {
		t.Fatalf("expected 2 matches, got %d", len(pairs))
	}
}
