import { useNavigate, useParams } from "react-router-dom";
import { FaTrophy } from "react-icons/fa";
import { PrimaryButton } from "../components/ui";
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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ backgroundColor: "#14304B", padding: "40px 24px 32px", flexShrink: 0, textAlign: "center" }}>
        <div style={{ color: "#C4F135", marginBottom: 12 }}>
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

      <div style={{ padding: "12px 20px 24px", flexShrink: 0 }}>
        <PrimaryButton onClick={() => navigate("/")}>Back to events</PrimaryButton>
      </div>
    </div>
  );
}
