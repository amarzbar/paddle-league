import type { ReactNode } from "react";

export function SecondaryButton({
  children,
  onClick,
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-14 flex items-center justify-center font-body font-medium text-[15px] transition-all active:bg-fill disabled:opacity-40 ${className}`}
      style={{
        fontFamily: "Hanken Grotesk, sans-serif",
        backgroundColor: "transparent",
        color: "#14304B",
        border: "2px solid #E8E6E0",
        borderRadius: 14,
        width: "100%",
      }}
    >
      {children}
    </button>
  );
}
