export function PointsFormatPill({
  label,
  sublabel,
  selected,
  onToggle,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: "12px 20px",
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        gap: 8,
        backgroundColor: selected ? "rgba(20,48,75,0.08)" : "#FFFFFF",
        border: selected ? "2px solid #14304B" : "2px solid #E8E6E0",
        transition: "all 0.15s ease",
      }}
    >
      <div style={{ textAlign: "left" }}>
        <div
          style={{
            fontFamily: "Space Mono, monospace",
            fontWeight: 700,
            fontSize: 16,
            color: selected ? "#14304B" : "#6B6B63",
          }}
        >
          {label}
        </div>
        {sublabel && (
          <div style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 11, color: "#A8A8A0" }}>{sublabel}</div>
        )}
      </div>
      {selected && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: "auto" }}>
          <circle cx="8" cy="8" r="7" fill="#14304B" />
          <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
