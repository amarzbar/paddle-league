import { StatusBadge } from "./ui";
import { EVENT_STATUS_CONFIG } from "../lib/statusConfig";
import type { PaddleEvent } from "../lib/types";

export function EventCard({
  event,
  participantCount,
  onPress,
}: {
  event: PaddleEvent;
  /** GET /api/events (the list endpoint) doesn't hydrate participants - only
   * pass this when it's actually known (e.g. from a fetched EventDetail). */
  participantCount?: number;
  onPress: () => void;
}) {
  const statusCfg = EVENT_STATUS_CONFIG[event.status];

  return (
    <button
      onClick={onPress}
      style={{
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        textAlign: "left",
        display: "block",
        border: "1px solid rgba(232,230,224,0.7)",
        boxShadow: "0 4px 12px rgba(20,48,75,.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "#14304B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "#FBFAF7",
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {event.name.charAt(0).toUpperCase() || "R"}
          </div>
          <div>
            <div
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: "#14304B",
                lineHeight: 1.2,
              }}
            >
              {event.name}
            </div>
            <div style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 12, color: "#6B6B63", marginTop: 1 }}>
              Join code {event.joinCode}
            </div>
          </div>
        </div>
        <StatusBadge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} size="sm" />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#6B6B63" }}>
          {participantCount !== undefined
            ? `${participantCount} player${participantCount === 1 ? "" : "s"}`
            : event.status === "lobby"
              ? "Tap to view lobby"
              : "Tap to view"}
          {event.currentRound > 0 ? ` · round ${event.currentRound}` : ""}
        </span>
        <span style={{ fontFamily: "Space Mono, monospace", fontSize: 13, color: "#14304B", fontWeight: 700 }}>
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
        borderRadius: 20,
        padding: 16,
        border: "1px solid rgba(232,230,224,0.7)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <div>
            <div className="skeleton" style={{ width: 100, height: 14, borderRadius: 6, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: 80, height: 11, borderRadius: 5 }} />
          </div>
        </div>
        <div className="skeleton" style={{ width: 50, height: 20, borderRadius: 6 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div className="skeleton" style={{ width: 90, height: 12, borderRadius: 5 }} />
        <div className="skeleton" style={{ width: 40, height: 12, borderRadius: 5 }} />
      </div>
    </div>
  );
}
