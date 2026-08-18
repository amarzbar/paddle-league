import { StatusBadge } from "./ui";
import { GiTennisBall } from "react-icons/gi";
import { EVENT_STATUS_CONFIG } from "../lib/statusConfig";
import type { PaddleEvent } from "../lib/types";

export function EventCard({
  event,
  participantCount,
  onPress,
  joining,
}: {
  event: PaddleEvent;
  /** GET /api/events (the list endpoint) doesn't hydrate participants - only
   * pass this when it's actually known (e.g. from a fetched EventDetail). */
  participantCount?: number;
  onPress: () => void;
  /** Set when this card represents a public event the caller isn't a
   * participant of yet - tapping joins instead of just navigating, and the
   * footer swaps to a "Join" affordance instead of the join code. */
  joining?: boolean;
}) {
  const statusCfg = EVENT_STATUS_CONFIG[event.status];
  const isJoinCard = joining !== undefined;

  return (
    <button
      onClick={onPress}
      disabled={joining}
      style={{
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 22,
        textAlign: "left",
        display: "block",
        border: "1px solid rgba(232,230,224,0.7)",
        boxShadow: "0 4px 12px rgba(20,48,75,.06)",
        opacity: joining ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: "#14304B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "#C4F135",
            }}
          >
            <GiTennisBall size={24} />
          </div>
          <div>
            <div
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 600,
                fontSize: 18,
                color: "#14304B",
                lineHeight: 1.25,
              }}
            >
              {event.name}
            </div>
            <div style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#6B6B63", marginTop: 2 }}>
              {isJoinCard ? "Public event" : `Join code ${event.joinCode}`}
            </div>
          </div>
        </div>
        <StatusBadge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} size="sm" />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 16,
          borderTop: "1px solid #F2F0EB",
        }}
      >
        <span style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 14, color: "#6B6B63" }}>
          {isJoinCard
            ? joining
              ? "Joining…"
              : "Tap to join"
            : participantCount !== undefined
              ? `${participantCount} player${participantCount === 1 ? "" : "s"}`
              : event.status === "lobby"
                ? "Tap to view lobby"
                : "Tap to view"}
          {event.currentRound > 0 ? ` · round ${event.currentRound}` : ""}
        </span>
        <span style={{ fontFamily: "Space Mono, monospace", fontSize: 15, color: "#14304B", fontWeight: 700 }}>
          to {event.pointsToWin}
        </span>
      </div>
    </button>
  );
}

export function EventCardSkeleton() {
  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 22,
        border: "1px solid rgba(232,230,224,0.7)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 14 }}>
          <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 14 }} />
          <div>
            <div className="skeleton" style={{ width: 120, height: 16, borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 90, height: 12, borderRadius: 5 }} />
          </div>
        </div>
        <div className="skeleton" style={{ width: 50, height: 20, borderRadius: 6 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid #F2F0EB" }}>
        <div className="skeleton" style={{ width: 90, height: 12, borderRadius: 5 }} />
        <div className="skeleton" style={{ width: 40, height: 12, borderRadius: 5 }} />
      </div>
    </div>
  );
}
