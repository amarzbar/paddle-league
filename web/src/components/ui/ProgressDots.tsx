export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array(total)
        .fill(null)
        .map((_, i) => (
          <div
            key={i}
            style={{
              height: 6,
              borderRadius: 999,
              transition: "all 0.25s ease",
              width: i === current ? 20 : 6,
              backgroundColor: i === current ? "#14304B" : "#E8E6E0",
            }}
          />
        ))}
    </div>
  );
}
