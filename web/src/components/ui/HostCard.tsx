import { Avatar, initialsFromName } from "./Avatar";
import type { User } from "../../lib/types";

export function HostCard({ user, onPress }: { user: User; onPress?: () => void }) {
  return (
    <button
      onClick={onPress}
      style={{
        width: "100%",
        backgroundColor: "#F2F0EB",
        borderRadius: 16,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        textAlign: "left",
      }}
    >
      <Avatar initials={initialsFromName(user.displayName)} size="md" color={user.avatarColor} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 15, color: "#14304B" }}>
          {user.displayName}
        </div>
        <span style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 12, color: "#6B6B63" }}>Host</span>
      </div>
      {onPress && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 12l4-4-4-4" stroke="#A8A8A0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
