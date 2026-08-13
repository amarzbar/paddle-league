export function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-9 px-4 flex-shrink-0 text-sm font-medium transition-all"
      style={{
        fontFamily: "Hanken Grotesk, sans-serif",
        fontWeight: 500,
        borderRadius: 999,
        backgroundColor: active ? "#14304B" : "#FFFFFF",
        color: active ? "#FBFAF7" : "#6B6B63",
        border: active ? "none" : "1.5px solid #E8E6E0",
      }}
    >
      {label}
    </button>
  );
}
