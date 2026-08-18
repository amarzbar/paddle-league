import { useNavigate } from "react-router-dom";
import { CourtScoreCard } from "./CourtScoreCard";
import { usePolling } from "../lib/usePolling";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { myCurrentMatch, myNextMatch, isMyByeThisRound } from "../lib/matchHelpers";
import type { EventDetail, Match, PaddleEvent, ScoreResponse } from "../lib/types";

interface Focus {
  event: EventDetail;
  hasLiveMatch: boolean;
}

/**
 * "Your current game" - a dedicated section at the top of the events page
 * for whichever active event you actually need to see right now. If you're
 * in more than one active event at once, this checks ALL of them and
 * prefers the one you have a live match in right now over one where you're
 * just on a bye - picking the most-recently-created active event
 * unconditionally (the old behavior) meant a live match in an older event
 * could get silently hidden behind a newer event you're just waiting in.
 */
export function CurrentGameSection({ events }: { events: PaddleEvent[] | null }) {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const activeEvents = events?.filter((e) => e.status === "active") ?? [];
  const activeIds = activeEvents.map((e) => e.id).join(",");

  const { data: focus, setData } = usePolling<Focus | null>(
    async () => {
      if (!me || activeEvents.length === 0) return null;
      const details = await Promise.all(activeEvents.map((e) => api.get<EventDetail>(`/api/events/${e.id}`)));
      const withLiveMatch = details.find((d) => myCurrentMatch(d, me.id) !== null);
      return withLiveMatch ? { event: withLiveMatch, hasLiveMatch: true } : { event: details[0], hasLiveMatch: false };
    },
    [activeIds, me?.id],
    4000,
  );

  if (!focus || !me) return null;
  const { event } = focus;

  const myMatch = myCurrentMatch(event, me.id);
  const bye = isMyByeThisRound(event, me.id);
  const upNext = myNextMatch(event, me.id);

  const updateMatchInFocus = (matchId: string, patch: Partial<Match>) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        event: {
          ...prev.event,
          rounds: prev.event.rounds.map((r) => ({
            ...r,
            matches: r.matches?.map((m) => (m.id !== matchId ? m : { ...m, ...patch })),
          })),
        },
      };
    });
  };

  const handleScore = async (matchId: string, team: 1 | 2, delta: 1 | -1) => {
    const key = team === 1 ? "team1Score" : "team2Score";
    const current = myMatch && myMatch.id === matchId ? myMatch[key] : 0;
    updateMatchInFocus(matchId, { [key]: Math.max(0, current + delta) });
    try {
      const result = await api.post<ScoreResponse>(`/api/matches/${matchId}/score`, { team, delta });
      updateMatchInFocus(matchId, {
        team1Score: result.team1Score,
        team2Score: result.team2Score,
        status: result.status,
        winner: result.winner,
      });
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      // A stale optimistic update is a minor cosmetic issue here (the events
      // page keeps polling and will correct itself) - not worth a toast on
      // what's meant to be a lightweight glanceable section.
    }
  };

  const handleTimeout = async (matchId: string) => {
    try {
      const result = await api.post<ScoreResponse>(`/api/matches/${matchId}/timeout`);
      updateMatchInFocus(matchId, {
        team1Score: result.team1Score,
        team2Score: result.team2Score,
        status: result.status,
        winner: result.winner,
      });
    } catch {
      // Same reasoning as handleScore's catch.
    }
  };

  const opponentNames = (m: NonNullable<typeof myMatch>) => {
    const onTeam1 = [m.team1P1, m.team1P2].includes(me.id);
    const partner = onTeam1 ? (m.team1P1 === me.id ? m.team1P2User : m.team1P1User) : m.team2P1 === me.id ? m.team2P2User : m.team2P1User;
    const opponents = onTeam1
      ? `${m.team2P1User?.displayName ?? "?"} & ${m.team2P2User?.displayName ?? "?"}`
      : `${m.team1P1User?.displayName ?? "?"} & ${m.team1P2User?.displayName ?? "?"}`;
    return { partnerName: partner?.displayName ?? "?", opponents };
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 16, color: "#14304B", marginBottom: 10 }}>
        Your current game
      </h2>

      {/* Same visual language as EventLive's "Up next" strip, in both states -
          the whole point is this always names the exact event, so it's never
          ambiguous which event a live match or upcoming matchup belongs to,
          even if you're in more than one active event at once. */}
      <button
        onClick={() => navigate(`/events/${event.id}/live`)}
        style={{
          width: "100%",
          backgroundColor: "#14304B",
          borderRadius: 16,
          padding: "14px 18px",
          marginBottom: myMatch ? 10 : 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          textAlign: "left",
        }}
      >
        <div>
          <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#C4F135", marginBottom: 3 }}>
            {myMatch ? "Playing now" : bye ? "Sitting out" : "Up next"} - round {myMatch ? event.currentRound : upNext?.round ?? event.currentRound}
          </p>
          <p style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 14, color: "#FBFAF7" }}>{event.name}</p>
          {!myMatch && (
            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "rgba(251,250,247,0.85)", marginTop: 3 }}>
              {upNext
                ? (() => {
                    const { partnerName, opponents } = opponentNames(upNext.match);
                    return `You + ${partnerName} vs ${opponents}`;
                  })()
                : "No more scheduled matches for you this event."}
            </p>
          )}
        </div>
        <span style={{ fontFamily: "Space Mono, monospace", fontWeight: 700, fontSize: 13, color: "#FBFAF7", flexShrink: 0 }}>
          {myMatch ? myMatch.courtLabel : upNext ? upNext.match.courtLabel : "→"}
        </span>
      </button>

      {myMatch && (
        <CourtScoreCard
          match={myMatch}
          meId={me.id}
          isHost={event.isHost}
          onScore={(team, delta) => handleScore(myMatch.id, team, delta)}
          timeLimitSeconds={event.timeLimitSeconds}
          onTimeout={() => handleTimeout(myMatch.id)}
        />
      )}
    </div>
  );
}
