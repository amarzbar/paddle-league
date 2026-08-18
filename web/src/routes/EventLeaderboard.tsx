import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton, Chip } from "../components/ui";
import { LeaderboardRowItem } from "../components/LeaderboardRow";
import { usePolling } from "../lib/usePolling";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { LeaderboardRow, PaddleEvent } from "../lib/types";

export default function EventLeaderboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [mode, setMode] = useState<"wins" | "points">("wins");

  const { data: rows } = usePolling<LeaderboardRow[]>(
    () => api.get<LeaderboardRow[]>(`/api/events/${id}/leaderboard`),
    [id],
    5000,
  );
  const { data: event } = usePolling<PaddleEvent>(() => api.get<PaddleEvent>(`/api/events/${id}`), [id], 8000);

  const sorted = useMemo(() => {
    if (!rows) return [];
    if (mode === "wins") return rows; // server order: wins desc -> total points desc
    return [...rows].sort((a, b) => b.pointsFor - a.pointsFor);
  }, [rows, mode]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px 12px", flexShrink: 0 }}>
        <div style={{ marginBottom: 12 }}>
          <BackButton onPress={() => navigate(-1)} />
        </div>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 22, color: "#14304B" }}>
          Leaderboard
        </h1>
        {event && (
          <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#6B6B63" }}>{event.name}</p>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "8px 20px 16px", flexShrink: 0 }}>
        <Chip label="By Wins" active={mode === "wins"} onClick={() => setMode("wins")} />
        <Chip label="By Points" active={mode === "points"} onClick={() => setMode("points")} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 40px" }}>
        {rows && sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 14, color: "#6B6B63" }}>
              Scores will appear here once matches finish.
            </p>
          </div>
        )}

        {sorted.map((row, i) => (
          <LeaderboardRowItem
            key={row.userId}
            row={row}
            rank={i + 1}
            isMe={row.userId === me?.id}
            isLast={i === sorted.length - 1}
            mode={mode}
          />
        ))}
      </div>
    </div>
  );
}
