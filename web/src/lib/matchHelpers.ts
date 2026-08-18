import type { EventDetail, Match, Round } from "./types";

/** All matches (any status) across the whole event, flattened. */
function allMatches(event: EventDetail): Match[] {
  return event.rounds.flatMap((r) => r.matches ?? []);
}

export function getRound(event: EventDetail, number: number): Round | undefined {
  return event.rounds.find((r) => r.number === number);
}

/** The matches on every court for whichever round is currently live -
 * this is "the board": the whole schedule is precomputed, so this is just
 * a lookup, not something that gets formed on the fly. */
export function currentRoundMatches(event: EventDetail): Match[] {
  return getRound(event, event.currentRound)?.matches ?? [];
}

/** Every match a given player is scheduled for, across the whole event,
 * in round order - the player's full precomputed itinerary. */
export function myMatchesInOrder(event: EventDetail, meId: string): { round: number; match: Match }[] {
  const out: { round: number; match: Match }[] = [];
  for (const r of event.rounds) {
    const m = (r.matches ?? []).find((m) => [m.team1P1, m.team1P2, m.team2P1, m.team2P2].includes(meId));
    if (m) out.push({ round: r.number, match: m });
  }
  return out.sort((a, b) => a.round - b.round);
}

/** My match for the round that's currently live, if I'm playing this round
 * (null if I have a bye this round, or the event hasn't started). */
export function myCurrentMatch(event: EventDetail, meId: string): Match | null {
  return currentRoundMatches(event).find((m) => [m.team1P1, m.team1P2, m.team2P1, m.team2P2].includes(meId)) ?? null;
}

/** My next scheduled match after the one at `afterRound` (defaults to the
 * live round) - since everything's precomputed, this is known the instant
 * I finish my current match, even before the event's official current round
 * has advanced (other courts may still be playing out the live round). */
export function myNextMatch(
  event: EventDetail,
  meId: string,
  afterRound: number = event.currentRound,
): { round: number; match: Match } | null {
  return myMatchesInOrder(event, meId).find((entry) => entry.round > afterRound) ?? null;
}

/** Whether I'm sitting out the currently live round (a scheduled bye, not
 * "not a participant" - use myCurrentMatch === null && isParticipant). */
export function isMyByeThisRound(event: EventDetail, meId: string): boolean {
  return event.participants.some((p) => p.userId === meId) && myCurrentMatch(event, meId) === null;
}

/** Every match in the event, in round order - for the recap view, once the
 * whole precomputed schedule has played out. */
export function flattenAllMatchesForDisplay(event: EventDetail): Match[] {
  return [...event.rounds]
    .sort((a, b) => a.number - b.number)
    .flatMap((r) => r.matches ?? []);
}

/** How many matches (any status) each participant has been assigned to,
 * event-wide - used for the leaderboard/recap, not live scheduling (the
 * schedule itself no longer depends on this at runtime, only at StartEvent
 * precompute time server-side). */
export function computeMatchesPlayed(event: EventDetail): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of allMatches(event)) {
    for (const uid of [m.team1P1, m.team1P2, m.team2P1, m.team2P2]) {
      counts[uid] = (counts[uid] ?? 0) + 1;
    }
  }
  return counts;
}
