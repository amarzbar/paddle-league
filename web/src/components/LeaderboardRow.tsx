import { Avatar, initialsFromName } from "./ui";
import type { LeaderboardRow as LeaderboardRowData } from "../lib/types";

/**
 * SkillLadder's vertical connecting-line + circular-node pattern, repurposed:
 * instead of past/current/future skill tiers, nodes carry rank position
 * (filled+numbered for top 3, outline+numbered otherwise), and the "you are
 * here" highlight becomes the current user's row.
 */
export function LeaderboardRowItem({
  row,
  rank,
  isMe,
  isLast,
  mode,
}: {
  row: LeaderboardRowData;
  rank: number;
  isMe: boolean;
  isLast: boolean;
  mode: "wins" | "points";
}) {
  const pointDiff = row.pointsFor - row.pointsAgainst;
  const topThree = rank <= 3;

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24, flexShrink: 0 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: topThree ? "#14304B" : "#FFFFFF",
            border: topThree ? "none" : "2px solid #E8E6E0",
            color: topThree ? "#FBFAF7" : "#6B6B63",
            fontFamily: "Space Mono, monospace",
            fontWeight: 700,
            fontSize: 11,
          }}
        >
          {rank}
        </div>
        {!isLast && <div style={{ flex: 1, width: 2, backgroundColor: "#E8E6E0", marginTop: 2 }} />}
      </div>

      <div
        style={{
          flex: 1,
          marginBottom: 14,
          padding: isMe ? "10px 14px" : "2px 0",
          borderRadius: 14,
          backgroundColor: isMe ? "#14304B" : "transparent",
          borderLeft: isMe ? "3px solid #C4F135" : "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Avatar initials={initialsFromName(row.displayName)} size="sm" color={row.avatarColor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 600,
              fontSize: 14,
              color: isMe ? "#FBFAF7" : "#14304B",
            }}
          >
            {isMe ? "You" : row.displayName}
          </div>
          <div
            style={{
              fontFamily: "Space Mono, monospace",
              fontSize: 11,
              color: isMe ? "rgba(251,250,247,0.7)" : "#6B6B63",
              marginTop: 2,
            }}
          >
            {mode === "wins" ? (
              <>
                <strong style={{ color: isMe ? "#C4F135" : "#14304B" }}>
                  {row.wins}W–{row.losses}L
                </strong>{" "}
                · {(row.winPct * 100).toFixed(0)}% · {pointDiff >= 0 ? "+" : ""}
                {pointDiff} pts
              </>
            ) : (
              <>
                {row.wins}W–{row.losses}L · {(row.winPct * 100).toFixed(0)}% ·{" "}
                <strong style={{ color: isMe ? "#C4F135" : "#14304B" }}>
                  {pointDiff >= 0 ? "+" : ""}
                  {pointDiff} pts
                </strong>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
