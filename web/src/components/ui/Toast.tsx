export function Toast({ message }: { message: string }) {
  return (
    <div
      className="animate-slide-up"
      style={{
        position: "absolute",
        bottom: 90,
        left: 16,
        right: 16,
        zIndex: 50,
        backgroundColor: "#14304B",
        color: "#FBFAF7",
        padding: "12px 16px",
        borderRadius: 14,
        fontFamily: "Hanken Grotesk, sans-serif",
        fontSize: 14,
        fontWeight: 500,
        boxShadow: "0 8px 24px rgba(20,48,75,0.3)",
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}
