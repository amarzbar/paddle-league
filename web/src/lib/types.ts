// Mirrors server/internal/models/models.go exactly (field names/JSON tags are
// the source of truth - keep this file in sync by hand when models.go changes).

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarColor: string;
  createdAt: string;
}

export type EventStatus = "lobby" | "active" | "completed";

export interface PaddleEvent {
  id: string;
  hostId: string;
  name: string;
  joinCode: string;
  status: EventStatus;
  /** Target COMBINED total (team1Score + team2Score) a match plays to,
   * Americano-style - not a per-team target. */
  pointsToWin: number;
  /** 0 = no limit. Safety net: whoever's ahead when time's up wins, tied is a draw. */
  timeLimitSeconds: number;
  currentRound: number;
  isPublic: boolean;
  courtCount: number;
  totalRounds: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Participant {
  eventId: string;
  userId: string;
  joinedAt: string;
  user?: User;
}

export type MatchStatus = "pending" | "in_progress" | "completed";

export interface Match {
  id: string;
  roundId: string;
  eventId: string;
  courtLabel: string;
  team1P1: string;
  team1P2: string;
  team2P1: string;
  team2P2: string;
  team1Score: number;
  team2Score: number;
  status: MatchStatus;
  /** 0 = draw (only possible when the event's pointsToWin target is even,
   * or a match was cut off by the time limit while scores were level). */
  winner?: 0 | 1 | 2;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  team1P1User?: User;
  team1P2User?: User;
  team2P1User?: User;
  team2P2User?: User;
}

export interface Round {
  id: string;
  eventId: string;
  number: number;
  createdAt: string;
  matches?: Match[];
}

export interface EventDetail extends PaddleEvent {
  participants: Participant[];
  rounds: Round[];
  isHost: boolean;
}

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  avatarColor: string;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  winPct: number;
}

export interface ScoreResponse {
  team1Score: number;
  team2Score: number;
  status: MatchStatus;
  /** 0 = draw (only possible when the event's pointsToWin target is even,
   * or a match was cut off by the time limit while scores were level). */
  winner?: 0 | 1 | 2;
}
