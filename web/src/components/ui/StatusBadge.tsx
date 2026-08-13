export function StatusBadge({
  label,
  color,
  bg,
  size = "sm",
}: {
  label: string;
  color: string;
  bg: string;
  size?: "xs" | "sm" | "md";
}) {
  const padding = size === "xs" ? "2px 8px" : size === "sm" ? "3px 10px" : "5px 14px";
  const fontSize = size === "xs" ? 10 : size === "sm" ? 11 : 13;
  return (
    <span
      style={{
        backgroundColor: bg,
        color,
        fontFamily: "Space Mono, monospace",
        fontWeight: 700,
        fontSize,
        padding,
        borderRadius: 6,
        display: "inline-block",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}
