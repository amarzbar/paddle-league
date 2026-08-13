package models

import "time"

type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"displayName"`
	AvatarColor string    `json:"avatarColor"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Event struct {
	ID           string     `json:"id"`
	HostID       string     `json:"hostId"`
	Name         string     `json:"name"`
	JoinCode     string     `json:"joinCode"`
	Status       string     `json:"status"` // lobby | active | completed
	PointsToWin  int        `json:"pointsToWin"`
	WinBy        int        `json:"winBy"`
	MaxPoints    int        `json:"maxPoints"`
	CurrentRound int        `json:"currentRound"`
	CreatedAt    time.Time  `json:"createdAt"`
	StartedAt    *time.Time `json:"startedAt,omitempty"`
	CompletedAt  *time.Time `json:"completedAt,omitempty"`
}

type Participant struct {
	EventID  string    `json:"eventId"`
	UserID   string    `json:"userId"`
	JoinedAt time.Time `json:"joinedAt"`
	User     *User     `json:"user,omitempty"`
}

type Round struct {
	ID        string    `json:"id"`
	EventID   string    `json:"eventId"`
	Number    int       `json:"number"`
	CreatedAt time.Time `json:"createdAt"`
	Matches   []Match   `json:"matches,omitempty"`
}

type Match struct {
	ID          string     `json:"id"`
	RoundID     string     `json:"roundId"`
	EventID     string     `json:"eventId"`
	CourtLabel  string     `json:"courtLabel"`
	Team1P1     string     `json:"team1P1"`
	Team1P2     string     `json:"team1P2"`
	Team2P1     string     `json:"team2P1"`
	Team2P2     string     `json:"team2P2"`
	Team1Score  int        `json:"team1Score"`
	Team2Score  int        `json:"team2Score"`
	Status      string     `json:"status"` // pending | in_progress | completed
	Winner      *int       `json:"winner,omitempty"`
	StartedAt   *time.Time `json:"startedAt,omitempty"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`

	// Hydrated for API responses
	Team1P1User *User `json:"team1P1User,omitempty"`
	Team1P2User *User `json:"team1P2User,omitempty"`
	Team2P1User *User `json:"team2P1User,omitempty"`
	Team2P2User *User `json:"team2P2User,omitempty"`
}

type LeaderboardRow struct {
	UserID        string  `json:"userId"`
	DisplayName   string  `json:"displayName"`
	AvatarColor   string  `json:"avatarColor"`
	Wins          int     `json:"wins"`
	Losses        int     `json:"losses"`
	MatchesPlayed int     `json:"matchesPlayed"`
	PointsFor     int     `json:"pointsFor"`
	PointsAgainst int     `json:"pointsAgainst"`
	WinPct        float64 `json:"winPct"`
}
