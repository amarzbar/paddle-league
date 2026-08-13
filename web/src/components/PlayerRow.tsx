import { Avatar, initialsFromName } from "./ui";
import type { User } from "../lib/types";

export function PlayerRow({
  user,
  isHost,
  isMe,
}: {
  user: User;
  isHost?: boolean;
  isMe?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
      <Avatar initials={initialsFromName(user.displayName)} size="md" color={user.avatarColor} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 14, color: "#14304B" }}>
          {user.displayName}
          {isMe && <span style={{ color: "#6B6B63", fontWeight: 400 }}> (you)</span>}
        </div>
      </div>
      {isHost && (
        <span
          style={{
            fontFamily: "Space Mono, monospace",
            fontSize: 10,
            fontWeight: 700,
            color: "#C4F135",
            backgroundColor: "#14304B",
            padding: "2px 8px",
            borderRadius: 6,
          }}
        >
          HOST
        </span>
      )}
    </div>
  );
}

export function EmptyPlayerSlot() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          border: "2px dashed #E8E6E0",
          flexShrink: 0,
        }}
      />
      <span style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#A8A8A0" }}>Open spot</span>
    </div>
  );
}
