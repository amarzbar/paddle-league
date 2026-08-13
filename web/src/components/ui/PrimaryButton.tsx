import type { ReactNode, CSSProperties } from "react";

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  className = "",
  style,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`h-14 flex items-center justify-center gap-2 font-display font-semibold text-[15px] transition-all active:scale-[0.97] disabled:opacity-40 ${className}`}
      style={{
        fontFamily: "Space Grotesk, sans-serif",
        fontWeight: 600,
        backgroundColor: "#C4F135",
        color: "#14304B",
        borderRadius: 999,
        width: "100%",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
