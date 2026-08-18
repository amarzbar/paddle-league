import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton, Chip, PrimaryButton, Toast } from "../components/ui";
import { CourtScoreCard } from "../components/CourtScoreCard";
import { usePolling } from "../lib/usePolling";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { currentRoundMatches, myCurrentMatch, myNextMatch, isMyByeThisRound } from "../lib/matchHelpers";
import type { EventDetail, Match, ScoreResponse } from "../lib/types";

function playerNamesOnMatch(match: Match, meId: string) {
  const onTeam1 = [match.team1P1, match.team1P2].includes(meId);
  const partner = onTeam1
    ? match.team1P1 === meId
      ? match.team1P2User
      : match.team1P1User
    : match.team2P1 === meId
      ? match.team2P2User
      : match.team2P1User;
  const opponents = onTeam1
    ? `${match.team2P1User?.displayName ?? "?"} & ${match.team2P2User?.displayName ?? "?"}`
    : `${match.team1P1User?.displayName ?? "?"} & ${match.team1P2User?.displayName ?? "?"}`;
  return { partnerName: partner?.displayName ?? "?", opponents };
}

export default function EventLive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [view, setView] = useState<"mine" | "all">("mine");
  const [justAssigned, setJustAssigned] = useState(false);
  const prevMatchId = useRef<string | null>(null);

  const { data: event, setData, refetch } = usePolling<EventDetail>(
    () => api.get<EventDetail>(`/api/events/${id}`),
    [id],
    4000,
  );

  const myMatch = event && me ? myCurrentMatch(event, me.id) : null;
  const bye = event && me ? isMyByeThisRound(event, me.id) : false;
  const upNext = event && me ? myNextMatch(event, me.id) : null;

  // "Your match has started" - fires the moment I'm assigned into a live
  // match (either the event just started, or the round advanced onto my
  // scheduled game).
  useEffect(() => {
    const currentId = myMatch?.id ?? null;
    if (currentId !== prevMatchId.current) {
      if (currentId) {
        setJustAssigned(true);
        setView("mine");
        const t = setTimeout(() => setJustAssigned(false), 1400);
        prevMatchId.current = currentId;
        return () => clearTimeout(t);
      } else {
        setView("all");
      }
      prevMatchId.current = currentId;
    }
  }, [myMatch?.id]);

  // The event auto-completes server-side once the last round's matches are
  // all done - catch that on the next poll and move to the recap the same
  // way the host's "End event" action already does.
  useEffect(() => {
    if (event?.status === "completed") {
      navigate(`/events/${event.id}/recap`, { replace: true });
    }
  }, [event?.status, event?.id, navigate]);

  if (!event || !me) return null;

  const isHost = event.isHost;

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  const handleScore = async (matchId: string, team: 1 | 2, delta: 1 | -1) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rounds: prev.rounds.map((r) => ({
          ...r,
          matches: r.matches?.map((m) => {
            if (m.id !== matchId) return m;
            const key = team === 1 ? "team1Score" : "team2Score";
            return { ...m, [key]: Math.max(0, m[key] + delta) };
          }),
        })),
      };
    });

    try {
      const result = await api.post<ScoreResponse>(`/api/matches/${matchId}/score`, { team, delta });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rounds: prev.rounds.map((r) => ({
            ...r,
            matches: r.matches?.map((m) =>
              m.id !== matchId
                ? m
                : { ...m, team1Score: result.team1Score, team2Score: result.team2Score, status: result.status, winner: result.winner },
            ),
          })),
        };
      });
      // The full schedule is precomputed, so my next matchup is already known
      // the instant my match ends - no toast needed, the persistent "Up
      // next" card above the courts (driven by upNext/myNextMatch) already
      // reflects it on the next render, no waiting for the round counter to
      // advance (other courts may still be playing).
      if (result.status === "completed") refetch();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't save that point - refreshing.");
      refetch();
    }
  };

  const handleTimeout = async (matchId: string) => {
    try {
      const result = await api.post<ScoreResponse>(`/api/matches/${matchId}/timeout`);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rounds: prev.rounds.map((r) => ({
            ...r,
            matches: r.matches?.map((m) =>
              m.id !== matchId
                ? m
                : { ...m, team1Score: result.team1Score, team2Score: result.team2Score, status: result.status, winner: result.winner },
            ),
          })),
        };
      });
      refetch();
    } catch (err) {
      // A 409 just means someone else's clock (or the server's own safety
      // net on the next score attempt) already closed this match out -
      // harmless, just resync.
      if (!(err instanceof ApiError && err.status === 409)) {
        showToast(err instanceof ApiError ? err.message : "Couldn't close out the match - refreshing.");
      }
      refetch();
    }
  };

  const handleEndEvent = async () => {
    setEnding(true);
    try {
      await api.post(`/api/events/${event.id}/stop`);
      navigate(`/events/${event.id}/leaderboard`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't end the event.");
      setEnding(false);
    }
  };

  const boardMatches = currentRoundMatches(event);
  const visibleMatches = view === "mine" ? (myMatch ? [myMatch] : []) : boardMatches;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ backgroundColor: "#14304B", padding: "16px 20px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <BackButton onPress={() => navigate("/")} dark />
          <button
            onClick={() => navigate(`/events/${event.id}/leaderboard`)}
            style={{
              fontFamily: "Hanken Grotesk, sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "#C4F135",
              backgroundColor: "rgba(196,241,53,0.12)",
              padding: "8px 14px",
              borderRadius: 999,
            }}
          >
            Leaderboard
          </button>
        </div>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 22, color: "#FBFAF7", marginBottom: 4 }}>
          {event.name}
        </h1>
        <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 12, color: "rgba(251,250,247,0.55)", marginBottom: 10 }}>
          Round {event.currentRound} of {event.totalRounds}
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          <Chip label="My court" active={view === "mine"} onClick={() => setView("mine")} />
          <Chip label="All courts" active={view === "all"} onClick={() => setView("all")} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 20px 112px", display: "flex", flexDirection: "column", gap: 14 }}>
        {view === "mine" && bye && (
          <div
            className="animate-fade-in"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: "16px 18px",
              border: "1px solid rgba(232,230,224,0.7)",
            }}
          >
            <p style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 14, color: "#14304B" }}>
              You're sitting out round {event.currentRound}
            </p>
          </div>
        )}

        {/* Persistent "up next" strip - stays visible above the courts the
            whole time a next matchup is known (mid-match, on a bye, or right
            after finishing), not a toast that disappears - the schedule is
            precomputed so this is always an exact answer, never a guess. */}
        {view === "mine" && upNext && (
          <div
            style={{
              backgroundColor: "#14304B",
              borderRadius: 16,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#C4F135", marginBottom: 3 }}>
                Up next - round {upNext.round}
              </p>
              <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "rgba(251,250,247,0.85)" }}>
                {(() => {
                  const { partnerName, opponents } = playerNamesOnMatch(upNext.match, me.id);
                  return `You + ${partnerName} vs ${opponents}`;
                })()}
              </p>
            </div>
            <span style={{ fontFamily: "Space Mono, monospace", fontWeight: 700, fontSize: 13, color: "#FBFAF7", flexShrink: 0 }}>
              {upNext.match.courtLabel}
            </span>
          </div>
        )}

        {view === "mine" && bye && !upNext && (
          <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#6B6B63" }}>
            No more scheduled matches for you this event.
          </p>
        )}

        {view === "mine" && myMatch && justAssigned && (
          <div
            className="animate-bounce-in"
            style={{
              backgroundColor: "#14304B",
              borderRadius: 20,
              padding: "20px",
              textAlign: "center",
            }}
          >
            <p style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 17, color: "#C4F135" }}>
              Your match has started - {myMatch.courtLabel}
            </p>
          </div>
        )}

        {view === "all" && boardMatches.length === 0 && (
          <p style={{ textAlign: "center", fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#6B6B63", marginTop: 20 }}>
            No games this round.
          </p>
        )}

        {visibleMatches.map((match) => (
          <CourtScoreCard
            key={match.id}
            match={match}
            meId={me.id}
            isHost={isHost}
            onScore={(team, delta) => handleScore(match.id, team, delta)}
            timeLimitSeconds={event.timeLimitSeconds}
            onTimeout={() => handleTimeout(match.id)}
          />
        ))}
      </div>

      {isHost && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "16px 20px",
            backgroundColor: "#FBFAF7",
            borderTop: "1px solid #E8E6E0",
          }}
        >
          <PrimaryButton onClick={handleEndEvent} disabled={ending} style={{ backgroundColor: "#FF6F59" }}>
            {ending ? "Ending…" : "Stop event"}
          </PrimaryButton>
        </div>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
