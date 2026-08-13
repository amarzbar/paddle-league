export function BackButton({ onPress, dark = false }: { onPress: () => void; dark?: boolean }) {
  return (
    <button
      onClick={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: dark ? "rgba(255,255,255,0.12)" : "#F2F0EB",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M11 14L6 9L11 4"
          stroke={dark ? "#FBFAF7" : "#14304B"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
