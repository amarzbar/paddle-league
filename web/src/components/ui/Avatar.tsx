export function Avatar({
  initials,
  size = "md",
  color,
  isVerified = false,
}: {
  initials: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: string;
  isVerified?: boolean;
}) {
  const px = { xs: 24, sm: 32, md: 44, lg: 56, xl: 80 }[size];
  const fs = { xs: 9, sm: 11, md: 14, lg: 18, xl: 26 }[size];
  const badgePx = { xs: 8, sm: 10, md: 14, lg: 16, xl: 22 }[size];

  return (
    <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <div
        style={{
          width: px,
          height: px,
          borderRadius: px / 2,
          backgroundColor: color || "#14304B",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: color === "#C4F135" ? "#14304B" : "#FBFAF7",
          fontSize: fs,
          fontFamily: "Space Grotesk, sans-serif",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      {isVerified && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: badgePx,
            height: badgePx,
            borderRadius: badgePx / 2,
            backgroundColor: "#5B9BD5",
            border: "2px solid #FBFAF7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={badgePx * 0.55} height={badgePx * 0.55} viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
