import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton, Chip, PrimaryButton, SecondaryButton, Toast } from "../components/ui";
import { CourtScoreCard } from "../components/CourtScoreCard";
import { usePolling } from "../lib/usePolling";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { computeQueueInfo, findMyActiveMatch, flattenAllMatchesForDisplay } from "../lib/matchHelpers";
import type { EventDetail, ScoreResponse } from "../lib/types";

export default function EventLive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [view, setView] = useState<"mine" | "all">("mine");
  const [justAssigned, setJustAssigned] = useState(false);
  const prevMatchId = useRef<string | null>(null);

  const { data: event, setData, refetch } = usePolling<EventDetail>(
    () => api.get<EventDetail>(`/api/events/${id}`),
    [id],
    4000,
  );

  const myMatch = event && me ? findMyActiveMatch(event, me.id) : null;
  const queueInfo = event && me && !myMatch ? computeQueueInfo(event, me.id) : null;

  // Keep the view in sync with whether I currently have a match: the moment
  // mine ends, switch to "All courts" so I can see how everyone else's game
  // is going (with final scores staying visible - see flattenAllMatchesForDisplay)
  // instead of a bare waiting screen. The moment I get re-assigned, switch
  // back to my own court automatically. Manual taps on the toggle still work
  // in between.
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

  // The event can now auto-complete server-side (everyone's played everyone
  // - see formMatchesFromFreePlayers) without anyone tapping "End event" -
  // catch that on the next poll and move to the recap the same way the host
  // action already does.
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
      // A completed match may have freed up enough players for a new game to
      // form server-side - refetch promptly instead of waiting for the next
      // 4s poll tick, so the pending-vs-active transition feels responsive.
      if (result.status === "completed") refetch();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't save that point - refreshing.");
      refetch();
    }
  };

  const handleCheckForNewGames = async () => {
    setChecking(true);
    try {
      await api.post(`/api/events/${event.id}/rounds`);
      refetch();
    } catch (err) {
      // A 409 here just means "nothing to form right now" - not a real error.
      if (!(err instanceof ApiError && err.status === 409)) {
        showToast(err instanceof ApiError ? err.message : "Couldn't check for new games.");
      } else {
        showToast("No new games to form right now.");
      }
    } finally {
      setChecking(false);
    }
  };

  const handleEndEvent = async () => {
    setEnding(true);
    try {
      await api.post(`/api/events/${event.id}/complete`);
      navigate(`/events/${event.id}/recap`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't end the event.");
      setEnding(false);
    }
  };

  const allCourtsMatches = flattenAllMatchesForDisplay(event);
  const visibleMatches = view === "mine" ? (myMatch ? [myMatch] : []) : allCourtsMatches;

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
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 22, color: "#FBFAF7", marginBottom: 10 }}>
          {event.name}
        </h1>

        <div style={{ display: "flex", gap: 8 }}>
          <Chip label="My court" active={view === "mine"} onClick={() => setView("mine")} />
          <Chip label="All courts" active={view === "all"} onClick={() => setView("all")} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 160px", display: "flex", flexDirection: "column", gap: 14 }}>
        {!myMatch && queueInfo && (
          <div
            className="animate-fade-in"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: "16px 18px",
              border: "1px solid rgba(232,230,224,0.7)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span className="animate-spin-slow" style={{ fontSize: 18, display: "inline-block" }}>
                🎾
              </span>
              <p style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 14, color: "#14304B" }}>
                Waiting for your next game
              </p>
            </div>
            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#6B6B63" }}>
              {queueInfo.playersAhead > 0
                ? `${queueInfo.playersAhead} player${queueInfo.playersAhead === 1 ? "" : "s"} need${queueInfo.playersAhead === 1 ? "s" : ""} to play before you're back in the pool — everyone plays evenly before anyone repeats.`
                : queueInfo.tiedWithMe >= 4
                  ? "You're up — waiting on a fresh matchup, since everyone free right now has already partnered with each other."
                  : `You're first in line — waiting on ${Math.max(0, 4 - queueInfo.tiedWithMe)} more free player${4 - queueInfo.tiedWithMe === 1 ? "" : "s"}.`}
            </p>
            <p style={{ fontFamily: "Space Mono, monospace", fontSize: 11, color: "#A8A8A0", marginTop: 8 }}>
              {queueInfo.freeCount} of {queueInfo.participantCount} players free · you've played {queueInfo.myMatchesPlayed}
            </p>
          </div>
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
              You're in! {myMatch.courtLabel}
            </p>
          </div>
        )}

        {view === "all" && allCourtsMatches.length === 0 && (
          <p style={{ textAlign: "center", fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#6B6B63", marginTop: 20 }}>
            No games yet.
          </p>
        )}

        {visibleMatches.map((match) => (
          <CourtScoreCard
            key={match.id}
            match={match}
            meId={me.id}
            isHost={isHost}
            onScore={(team, delta) => handleScore(match.id, team, delta)}
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
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <SecondaryButton onClick={handleCheckForNewGames} disabled={checking}>
            {checking ? "Checking…" : "Check for new games"}
          </SecondaryButton>
          <PrimaryButton onClick={handleEndEvent} disabled={ending} style={{ backgroundColor: "#FF6F59" }}>
            {ending ? "Ending…" : "End event"}
          </PrimaryButton>
        </div>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
