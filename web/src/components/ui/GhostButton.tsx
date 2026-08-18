import type { CSSProperties, ReactNode } from "react";

export function GhostButton({
  children,
  onClick,
  className = "",
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-10 flex items-center justify-center font-body text-sm text-muted transition-all active:text-ink ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}
