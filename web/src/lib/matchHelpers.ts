import type { EventDetail, Match } from "./types";

/**
 * Every non-completed match across *every* round - necessary under
 * continuous rotation, since multiple waves/rounds can be in flight at once
 * (courts finish and re-form independently, not in synchronized batches).
 */
export function flattenActiveMatches(event: EventDetail): Match[] {
  return event.rounds.flatMap((r) => r.matches ?? []).filter((m) => m.status !== "completed");
}

/** The current user's own in-flight match, if they're in one right now. */
export function findMyActiveMatch(event: EventDetail, meId: string): Match | null {
  return (
    flattenActiveMatches(event).find((m) =>
      [m.team1P1, m.team1P2, m.team2P1, m.team2P2].includes(meId),
    ) ?? null
  );
}

/** All matches (any status) across the whole event, flattened. */
function allMatches(event: EventDetail): Match[] {
  return event.rounds.flatMap((r) => r.matches ?? []);
}

/**
 * Every match in the event, active AND completed - for the "all courts"
 * view, so a court's final score stays visible once it wraps up instead of
 * disappearing the instant it completes. Sorted live/pending courts first
 * (most actionable), then completed ones most-recent-round-first.
 */
export function flattenAllMatchesForDisplay(event: EventDetail): Match[] {
  const roundNumberByMatchId = new Map<string, number>();
  for (const r of event.rounds) {
    for (const m of r.matches ?? []) roundNumberByMatchId.set(m.id, r.number);
  }
  return allMatches(event).sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return 1;
    if (a.status !== "completed" && b.status === "completed") return -1;
    return (roundNumberByMatchId.get(b.id) ?? 0) - (roundNumberByMatchId.get(a.id) ?? 0);
  });
}

/**
 * How many matches (any status) each participant has been assigned to,
 * event-wide - mirrors the backend's loadMatchesPlayedCount exactly (see
 * server/internal/handlers/rotation.go), computed client-side from the same
 * data GetEvent already returns, so no extra endpoint is needed.
 */
export function computeMatchesPlayed(event: EventDetail): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of allMatches(event)) {
    for (const uid of [m.team1P1, m.team1P2, m.team2P1, m.team2P2]) {
      counts[uid] = (counts[uid] ?? 0) + 1;
    }
  }
  return counts;
}

/** Participant IDs not currently in a pending/in_progress match - mirrors
 * the backend's loadFreePlayerIDs. */
export function computeFreeParticipantIds(event: EventDetail): string[] {
  const occupied = new Set<string>();
  for (const m of flattenActiveMatches(event)) {
    occupied.add(m.team1P1);
    occupied.add(m.team1P2);
    occupied.add(m.team2P1);
    occupied.add(m.team2P2);
  }
  return event.participants.map((p) => p.userId).filter((id) => !occupied.has(id));
}

export interface QueueInfo {
  /** Free players who've played strictly fewer matches than me - the
   * tiered-fairness algorithm always considers all of them before it will
   * ever consider me (see tieredCandidatePools server-side). */
  playersAhead: number;
  /** Free players tied with me at the same matches-played count (including
   * myself) - once this reaches 4, my tier becomes eligible to form a match
   * (assuming a valid non-repeat pairing exists among them). */
  tiedWithMe: number;
  myMatchesPlayed: number;
  freeCount: number;
  participantCount: number;
}

/** null if I'm not currently free (e.g. I'm mid-match, or not a participant). */
export function computeQueueInfo(event: EventDetail, meId: string): QueueInfo | null {
  const free = computeFreeParticipantIds(event);
  if (!free.includes(meId)) return null;

  const played = computeMatchesPlayed(event);
  const myMatchesPlayed = played[meId] ?? 0;

  let playersAhead = 0;
  let tiedWithMe = 0;
  for (const id of free) {
    const p = played[id] ?? 0;
    if (p < myMatchesPlayed) playersAhead++;
    else if (p === myMatchesPlayed) tiedWithMe++;
  }

  return {
    playersAhead,
    tiedWithMe,
    myMatchesPlayed,
    freeCount: free.length,
    participantCount: event.participants.length,
  };
}
