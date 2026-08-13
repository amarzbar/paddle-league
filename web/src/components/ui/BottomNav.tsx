import type { ReactElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
      {TABS.map((tab) => {
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
      })}
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
