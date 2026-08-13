import type { EventStatus, MatchStatus } from "./types";

// Same {label, color, bg} shape as Rally's TIER_CONFIG, driving StatusBadge -
// repurposed from a skill-tier concept (which Racket has none of) to event
// and match lifecycle status.

export const EVENT_STATUS_CONFIG: Record<EventStatus, { label: string; color: string; bg: string }> = {
  lobby: { label: "Lobby", color: "var(--color-status-lobby)", bg: "var(--color-status-lobby-bg)" },
  active: { label: "Live", color: "var(--color-status-active)", bg: "var(--color-status-active-bg)" },
  completed: { label: "Completed", color: "var(--color-status-completed)", bg: "var(--color-status-completed-bg)" },
};

export const MATCH_STATUS_CONFIG: Record<MatchStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "var(--color-status-lobby)", bg: "var(--color-status-lobby-bg)" },
  in_progress: { label: "In progress", color: "var(--color-status-active)", bg: "var(--color-status-active-bg)" },
  completed: { label: "Final", color: "var(--color-status-completed)", bg: "var(--color-status-completed-bg)" },
};
