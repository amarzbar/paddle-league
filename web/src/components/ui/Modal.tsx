import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={onClose}
        className="animate-fade-in"
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(20,48,75,0.45)" }}
      />
      <div
        className="animate-slide-up"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          backgroundColor: "#FBFAF7",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: "10px 20px 28px",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            width: 40,
            height: 5,
            borderRadius: 999,
            backgroundColor: "#E8E6E0",
            margin: "0 auto 16px",
          }}
        />
        {title && (
          <h2
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              fontSize: 18,
              color: "#14304B",
              marginBottom: 16,
            }}
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
