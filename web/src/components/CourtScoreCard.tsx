import { useEffect, useRef, useState } from "react";
import { ScoreQuadrant } from "./ScoreQuadrant";
import { StatusBadge, initialsFromName } from "./ui";
import { MATCH_STATUS_CONFIG } from "../lib/statusConfig";
import type { Match } from "../lib/types";

function ScoreButton({
  onClick,
  disabled,
  variant,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant: "plus" | "minus";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="active:scale-[0.94] transition-all disabled:opacity-30"
      style={{
        width: 56,
        height: 56,
        borderRadius: 999,
        flexShrink: 0,
        backgroundColor: variant === "plus" ? "#C4F135" : "#F2F0EB",
        color: "#14304B",
        fontFamily: "Space Grotesk, sans-serif",
        fontWeight: 700,
        fontSize: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {variant === "plus" ? "+" : "−"}
    </button>
  );
}

function TeamScoreRow({
  label,
  names,
  score,
  onDelta,
  canScore,
}: {
  label: string;
  names: string;
  score: number;
  onDelta: (delta: 1 | -1) => void;
  canScore: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
      <ScoreButton variant="minus" onClick={() => onDelta(-1)} disabled={!canScore || score <= 0} />
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 13, color: "#14304B" }}>
          {label}
        </div>
        <div style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 11, color: "#6B6B63" }}>{names}</div>
      </div>
      <ScoreButton variant="plus" onClick={() => onDelta(1)} disabled={!canScore} />
    </div>
  );
}

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Ticks down the time remaining on a live match against its own startedAt +
 * the event's timeLimitSeconds - purely a display computation plus a
 * one-shot onTimeout callback, no server round-trip needed to know the
 * remaining time (only to act on it hitting zero).
 */
function useMatchCountdown(match: Match, timeLimitSeconds: number | undefined, onTimeout: (() => void) | undefined) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [match.id]);

  useEffect(() => {
    if (!timeLimitSeconds || timeLimitSeconds <= 0 || !match.startedAt || match.status === "completed") {
      setRemaining(null);
      return;
    }
    const startedAt = new Date(match.startedAt).getTime();
    const tick = () => {
      const left = timeLimitSeconds - (Date.now() - startedAt) / 1000;
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onTimeout?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, match.startedAt, match.status, timeLimitSeconds]);

  return remaining;
}

export function CourtScoreCard({
  match,
  meId,
  isHost,
  onScore,
  timeLimitSeconds,
  onTimeout,
  featured = false,
}: {
  match: Match;
  meId: string;
  isHost: boolean;
  onScore: (team: 1 | 2, delta: 1 | -1) => void;
  /** Event's time limit (seconds), if any - enables the live countdown. */
  timeLimitSeconds?: number;
  /** Fired once, client-side, the instant the countdown reaches zero - the
   * caller is expected to call the /timeout endpoint here. */
  onTimeout?: () => void;
  /** Use the larger score display for the user's current game. */
  featured?: boolean;
}) {
  const [flashTeam, setFlashTeam] = useState<1 | 2 | null>(null);
  const remaining = useMatchCountdown(match, timeLimitSeconds, onTimeout);

  const team1Names = `${match.team1P1User?.displayName ?? "?"} & ${match.team1P2User?.displayName ?? "?"}`;
  const team2Names = `${match.team2P1User?.displayName ?? "?"} & ${match.team2P2User?.displayName ?? "?"}`;

  const isPlayerHere = [match.team1P1, match.team1P2, match.team2P1, match.team2P2].includes(meId);
  const onTeam1 = meId === match.team1P1 || meId === match.team1P2;
  const onTeam2 = meId === match.team2P1 || meId === match.team2P2;
  const canScoreTeam1 = (isHost || onTeam1) && match.status !== "completed";
  const canScoreTeam2 = (isHost || onTeam2) && match.status !== "completed";

  const handleDelta = (team: 1 | 2, delta: 1 | -1) => {
    onScore(team, delta);
    if (delta === 1) {
      setFlashTeam(team);
      setTimeout(() => setFlashTeam(null), 650);
    }
  };

  const statusCfg = MATCH_STATUS_CONFIG[match.status];
  const countdownLow = remaining !== null && remaining <= 30;

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: featured ? 24 : 16,
        border: "1px solid rgba(232,230,224,0.7)",
        boxShadow: "0 4px 12px rgba(20,48,75,.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15, color: "#14304B" }}>
          {match.courtLabel}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {remaining !== null && (
            <span
              style={{
                fontFamily: "Space Mono, monospace",
                fontWeight: 700,
                fontSize: 12,
                color: countdownLow ? "#FF6F59" : "#6B6B63",
              }}
            >
              ⏱ {formatCountdown(remaining)}
            </span>
          )}
          <StatusBadge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} size="xs" />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 18px" }}>
        <ScoreQuadrant
          team1Initials={[
            initialsFromName(match.team1P1User?.displayName ?? "?"),
            initialsFromName(match.team1P2User?.displayName ?? "?"),
          ]}
          team2Initials={[
            initialsFromName(match.team2P1User?.displayName ?? "?"),
            initialsFromName(match.team2P2User?.displayName ?? "?"),
          ]}
          team1Score={match.team1Score}
          team2Score={match.team2Score}
          flashTeam={flashTeam}
          size={featured ? "xl" : "lg"}
        />
      </div>

      {(isPlayerHere || isHost) && (
        <div style={{ borderTop: "1px solid #E8E6E0", paddingTop: 4 }}>
          <TeamScoreRow
            label="Team 1"
            names={team1Names}
            score={match.team1Score}
            onDelta={(d) => handleDelta(1, d)}
            canScore={canScoreTeam1}
          />
          <TeamScoreRow
            label="Team 2"
            names={team2Names}
            score={match.team2Score}
            onDelta={(d) => handleDelta(2, d)}
            canScore={canScoreTeam2}
          />
        </div>
      )}

      {match.status === "completed" && (
        <div
          style={{
            marginTop: 8,
            textAlign: "center",
            fontFamily: "Hanken Grotesk, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: match.winner === 0 ? "#6B6B63" : "var(--color-status-completed)",
          }}
        >
          {match.winner === 0 ? "Draw" : match.winner === 1 ? "Team 1 won" : "Team 2 won"}
        </div>
      )}
    </div>
  );
}
