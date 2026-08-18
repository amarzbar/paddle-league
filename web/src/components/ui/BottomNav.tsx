import type { ReactElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GiTennisBall } from "react-icons/gi";
import { useAuth } from "../../context/AuthContext";
import { myCurrentMatch } from "../../lib/matchHelpers";
import { usePolling } from "../../lib/usePolling";
import { api } from "../../lib/api";
import type { EventDetail, PaddleEvent } from "../../lib/types";

type TabId = "events" | "host" | "join" | "profile";

const TABS: { id: TabId; label: string; path: string; icon: (active: boolean) => ReactElement }[] = [
  { id: "events", label: "Events", path: "/", icon: EventsIcon },
  { id: "host", label: "Host", path: "/events/new", icon: HostIcon },
  { id: "join", label: "Join", path: "/join", icon: JoinIcon },
  { id: "profile", label: "Profile", path: "/profile", icon: ProfileIcon },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: activeEventId } = usePolling<string | null>(
    async () => {
      const events = await api.get<PaddleEvent[]>("/api/events");
      const activeEvents = events.filter((event) => event.status === "active");
      if (activeEvents.length === 0) return null;
      if (!user || activeEvents.length === 1) return activeEvents[0].id;

      const details = await Promise.all(activeEvents.map((event) => api.get<EventDetail>(`/api/events/${event.id}`)));
      return details.find((event) => myCurrentMatch(event, user.id) !== null)?.id ?? activeEvents[0].id;
    },
    [user?.id],
    5000,
  );
  const gameIsActive = /^\/events\/[^/]+\/live$/.test(location.pathname);

  const renderTab = (tab: (typeof TABS)[number]) => {
    const isActive = tab.path === "/" ? location.pathname === "/" : location.pathname.startsWith(tab.path);
    return (
      <button
        key={tab.id}
        onClick={() => navigate(tab.path)}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          padding: "10px 0 12px",
        }}
      >
        {tab.icon(isActive)}
        <span
          style={{
            fontFamily: "Hanken Grotesk, sans-serif",
            fontSize: 10,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? "#14304B" : "#A8A8A0",
          }}
        >
          {tab.label}
        </span>
      </button>
    );
  };

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: "1px solid #E8E6E0",
        backgroundColor: "#FFFFFF",
        display: "flex",
        alignItems: "center",
      }}
    >
      {TABS.slice(0, 2).map(renderTab)}
      <button
        aria-label={activeEventId ? "Open current game" : "Open events"}
        onClick={() => navigate(activeEventId ? `/events/${activeEventId}/live` : "/")}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 0",
        }}
      >
        <span
          style={{
            width: 50,
            height: 50,
            marginTop: -22,
            borderRadius: 999,
            backgroundColor: gameIsActive ? "#14304B" : "#C4F135",
            color: gameIsActive ? "#C4F135" : "#14304B",
            border: "4px solid #FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(20,48,75,.18)",
          }}
        >
          <GiTennisBall size={28} />
        </span>
      </button>
      {TABS.slice(2).map(renderTab)}
    </div>
  );
}

function EventsIcon(active: boolean) {
  const c = active ? "#14304B" : "#A8A8A0";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3.5" y="4.5" width="15" height="14" rx="2.5" stroke={c} strokeWidth="1.8" />
      <path d="M3.5 9h15M7.5 2.5v4M14.5 2.5v4" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HostIcon(active: boolean) {
  const c = active ? "#C4F135" : "#A8A8A0";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="8.5" stroke={c} strokeWidth="1.8" />
      <path d="M11 7v8M7 11h8" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function JoinIcon(active: boolean) {
  const c = active ? "#14304B" : "#A8A8A0";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M8 4H5.5A1.5 1.5 0 004 5.5v11A1.5 1.5 0 005.5 18H8M13 15l4-4-4-4M17 11H8"
        stroke={c}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon(active: boolean) {
  const c = active ? "#14304B" : "#A8A8A0";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="7.5" r="3.5" stroke={c} strokeWidth="1.8" />
      <path d="M3.5 19c0-3.866 3.358-7 7.5-7s7.5 3.134 7.5 7" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
