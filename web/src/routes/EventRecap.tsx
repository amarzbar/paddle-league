import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaDownload, FaTrophy } from "react-icons/fa";
import { BackButton } from "../components/ui";
import { LeaderboardRowItem } from "../components/LeaderboardRow";
import { CourtScoreCard } from "../components/CourtScoreCard";
import { usePolling } from "../lib/usePolling";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { flattenAllMatchesForDisplay } from "../lib/matchHelpers";
import type { EventDetail, LeaderboardRow } from "../lib/types";

// Not a real participant id - passing this (plus isHost:false) into
// CourtScoreCard guarantees its score controls never render, since a
// completed event's matches shouldn't be editable by anyone.
const READ_ONLY_VIEWER = "";

function exportStandings(name: string, rows: LeaderboardRow[]) {
  const width = 1200;
  const scale = 2;
  const topRows = rows.slice(0, 4);
  const remainingRows = rows.slice(4);
  const height = 520 + Math.max(1, remainingRows.length) * 58;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(scale, scale);

  context.fillStyle = "#14304B";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#C4F135";
  context.font = "700 28px Space Grotesk, sans-serif";
  context.fillText("FINAL STANDING", 64, 72);
  context.fillStyle = "#FBFAF7";
  context.font = "700 44px Space Grotesk, sans-serif";
  context.fillText(name, 64, 126);

  topRows.forEach((row, index) => {
    const column = index % 2;
    const line = Math.floor(index / 2);
    const x = 64 + column * 540;
    const y = 170 + line * 124;
    context.fillStyle = index === 0 ? "#C4F135" : "#FBFAF7";
    context.fillRect(x, y, 512, 100);
    context.fillStyle = "#14304B";
    context.font = "700 20px Space Mono, monospace";
    context.fillText(`#${index + 1}`, x + 22, y + 34);
    context.font = "700 28px Space Grotesk, sans-serif";
    context.fillText(row.displayName, x + 22, y + 66);
    context.font = "600 18px Space Mono, monospace";
    context.fillText(`${row.wins}W-${row.losses}L  ·  ${row.pointsFor} pts`, x + 22, y + 88);
  });

  context.fillStyle = "#FBFAF7";
  context.fillRect(40, 430, width - 80, height - 470);
  context.fillStyle = "#14304B";
  context.font = "700 22px Space Grotesk, sans-serif";
  context.fillText("Full leaderboard", 64, 472);
  remainingRows.forEach((row, index) => {
    const y = 520 + index * 58;
    context.fillStyle = "#14304B";
    context.font = "700 18px Space Mono, monospace";
    context.fillText(`${index + 5}`, 64, y);
    context.font = "600 22px Space Grotesk, sans-serif";
    context.fillText(row.displayName, 124, y);
    context.font = "600 18px Space Mono, monospace";
    context.fillText(`${row.wins}W-${row.losses}L  ·  ${row.pointsFor} pts`, 840, y);
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-final-standing.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, "image/png");
}

export default function EventRecap() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuth();

  // Event is completed - no need to keep polling; a long interval still
  // fetches once on mount via usePolling's immediate tick().
  const { data: rows } = usePolling<LeaderboardRow[]>(
    () => api.get<LeaderboardRow[]>(`/api/events/${id}/leaderboard`),
    [id],
    3_600_000,
  );
  const { data: event } = usePolling<EventDetail>(() => api.get<EventDetail>(`/api/events/${id}`), [id], 3_600_000);

  const winner = rows?.[0];
  const matches = event ? flattenAllMatchesForDisplay(event) : [];
  const onExport = useCallback(() => {
    if (event && rows) exportStandings(event.name, rows);
  }, [event, rows]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ backgroundColor: "#14304B", padding: "16px 24px 32px", flexShrink: 0, textAlign: "center" }}>
        <BackButton onPress={() => navigate("/")} dark />
        <div style={{ color: "#C4F135", margin: "24px 0 12px", display: "flex", justifyContent: "center" }}>
          <FaTrophy size={32} />
        </div>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 24, color: "#FBFAF7", marginBottom: 4 }}>
          {event?.name ?? "Event"} is a wrap
        </h1>
        {winner && (
          <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 14, color: "rgba(251,250,247,0.7)" }}>
            {winner.userId === me?.id ? "You took the top spot" : `${winner.displayName} took the top spot`}
          </p>
        )}
        <button
          type="button"
          onClick={onExport}
          disabled={!rows || !event}
          style={{
            marginTop: 16,
            border: 0,
            borderRadius: 999,
            backgroundColor: "#C4F135",
            color: "#14304B",
            padding: "10px 16px",
            fontFamily: "Space Grotesk, sans-serif",
            fontWeight: 700,
            cursor: rows && event ? "pointer" : "default",
            opacity: rows && event ? 1 : 0.6,
          }}
        >
          <FaDownload style={{ marginRight: 8, verticalAlign: "middle" }} />
          Export PNG
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 24px" }}>
        <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontWeight: 600, fontSize: 13, color: "#14304B", marginBottom: 12 }}>
          Final standings
        </p>
        {rows?.map((row, i) => (
          <LeaderboardRowItem
            key={row.userId}
            row={row}
            rank={i + 1}
            isMe={row.userId === me?.id}
            isLast={i === rows.length - 1}
            mode="wins"
          />
        ))}

        {matches.length > 0 && (
          <>
            <p
              style={{
                fontFamily: "Hanken Grotesk, sans-serif",
                fontWeight: 600,
                fontSize: 13,
                color: "#14304B",
                margin: "24px 0 12px",
              }}
            >
              Every court
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {matches.map((match) => (
                <CourtScoreCard key={match.id} match={match} meId={READ_ONLY_VIEWER} isHost={false} onScore={() => {}} />
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
