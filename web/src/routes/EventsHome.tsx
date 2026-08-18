import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GiTennisBall } from "react-icons/gi";
import { Chip } from "../components/ui";
import { EventCard, EventCardSkeleton } from "../components/EventCard";
import { CurrentGameSection } from "../components/CurrentGameSection";
import { usePolling } from "../lib/usePolling";
import { api, ApiError } from "../lib/api";
import type { PaddleEvent, EventStatus } from "../lib/types";

const FILTERS: { id: "all" | EventStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "lobby", label: "Lobby" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];

export default function EventsHome() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | EventStatus>("all");
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const { data: events, loading } = usePolling<PaddleEvent[]>(
    () => api.get<PaddleEvent[]>("/api/events"),
    [],
    5000,
  );
  const { data: publicEvents } = usePolling<PaddleEvent[]>(
    () => api.get<PaddleEvent[]>("/api/events/public"),
    [],
    10000,
  );

  const filtered = useMemo(() => {
    if (!events) return [];
    if (filter === "all") return events;
    return events.filter((e) => e.status === filter);
  }, [events, filter]);

  const myEventIds = useMemo(() => new Set((events ?? []).map((e) => e.id)), [events]);
  // Public events I haven't already joined - once I'm in, it just shows up
  // in "Your events" like anything else.
  const joinablePublicEvents = useMemo(
    () => (publicEvents ?? []).filter((e) => !myEventIds.has(e.id)),
    [publicEvents, myEventIds],
  );

  const handleJoinPublic = async (eventId: string) => {
    setJoiningId(eventId);
    try {
      await api.post(`/api/events/${eventId}/join`);
      navigate(`/events/${eventId}`);
    } catch (err) {
      setJoiningId(null);
      if (!(err instanceof ApiError)) throw err;
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ padding: "20px 20px 12px", flexShrink: 0 }}>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 24, color: "#14304B" }}>
          Your events
        </h1>
      </div>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
        <CurrentGameSection events={events} />
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "0 20px 16px",
            overflowX: "auto",
          }}
        >
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} active={filter === f.id} onClick={() => setFilter(f.id)} />
          ))}
        </div>

        <div style={{ padding: "0 20px" }}>
          {loading && !events && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <EventCardSkeleton />
              <EventCardSkeleton />
            </div>
          )}

          {events && filtered.length === 0 && (
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                padding: "32px 20px",
                textAlign: "center",
                border: "1px solid rgba(232,230,224,0.7)",
              }}
            >
              <div style={{ color: "#14304B", marginBottom: 8 }}>
                <GiTennisBall size={28} />
              </div>
              <p style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15, color: "#14304B" }}>
                No events yet
              </p>
              <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#6B6B63", marginTop: 4 }}>
                Host a night or join one with a code.
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} onPress={() => navigate(`/events/${event.id}`)} />
            ))}
          </div>

          {joinablePublicEvents.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 16, color: "#14304B", marginBottom: 10 }}>
                Available events
              </h2>
              <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 12, color: "#6B6B63", marginBottom: 12 }}>
                Public - join with one tap, no code needed.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {joinablePublicEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onPress={() => handleJoinPublic(event.id)}
                    joining={joiningId === event.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => navigate("/events/new")}
        className="active:scale-[0.96] transition-all"
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          height: 52,
          padding: "0 22px",
          borderRadius: 999,
          backgroundColor: "#C4F135",
          color: "#14304B",
          fontFamily: "Space Grotesk, sans-serif",
          fontWeight: 600,
          fontSize: 14,
          boxShadow: "0 8px 20px rgba(196,241,53,0.4)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        + Host a night
      </button>
    </div>
  );
}
