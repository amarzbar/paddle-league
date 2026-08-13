import type { ReactNode } from "react";

export function GhostButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-10 flex items-center justify-center font-body text-sm text-muted transition-all active:text-ink ${className}`}
    >
      {children}
    </button>
  );
}
