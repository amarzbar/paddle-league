import { useState } from "react";
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

export function CourtScoreCard({
  match,
  meId,
  isHost,
  onScore,
}: {
  match: Match;
  meId: string;
  isHost: boolean;
  onScore: (team: 1 | 2, delta: 1 | -1) => void;
}) {
  const [flashTeam, setFlashTeam] = useState<1 | 2 | null>(null);

  const team1Names = `${match.team1P1User?.displayName ?? "?"} & ${match.team1P2User?.displayName ?? "?"}`;
  const team2Names = `${match.team2P1User?.displayName ?? "?"} & ${match.team2P2User?.displayName ?? "?"}`;

  const isPlayerHere = [match.team1P1, match.team1P2, match.team2P1, match.team2P2].includes(meId);
  const canScore = (isPlayerHere || isHost) && match.status !== "completed";

  const handleDelta = (team: 1 | 2, delta: 1 | -1) => {
    onScore(team, delta);
    if (delta === 1) {
      setFlashTeam(team);
      setTimeout(() => setFlashTeam(null), 650);
    }
  };

  const statusCfg = MATCH_STATUS_CONFIG[match.status];

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        border: "1px solid rgba(232,230,224,0.7)",
        boxShadow: "0 4px 12px rgba(20,48,75,.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15, color: "#14304B" }}>
          {match.courtLabel}
        </span>
        <StatusBadge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} size="xs" />
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
          size="lg"
        />
      </div>

      {(isPlayerHere || isHost) && (
        <div style={{ borderTop: "1px solid #E8E6E0", paddingTop: 4 }}>
          <TeamScoreRow
            label="Team 1"
            names={team1Names}
            score={match.team1Score}
            onDelta={(d) => handleDelta(1, d)}
            canScore={canScore}
          />
          <TeamScoreRow
            label="Team 2"
            names={team2Names}
            score={match.team2Score}
            onDelta={(d) => handleDelta(2, d)}
            canScore={canScore}
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
            color: "var(--color-status-completed)",
          }}
        >
          {match.winner === 1 ? "Team 1 won" : "Team 2 won"}
        </div>
      )}
    </div>
  );
}
