/**
 * Reworked from Rally's CourtQuadrant - keeps the exact 2x2-grid-with-crosshair
 * motif (Rally's single most distinctive visual signature) but makes it
 * load-bearing instead of decorative: top half = Team 1 (ink), bottom half =
 * Team 2 (coral), each cell shows a player's initials, and each team's live
 * score overlays its half as a large Space Mono numeral.
 */
export function ScoreQuadrant({
  team1Initials,
  team2Initials,
  team1Score,
  team2Score,
  flashTeam,
  size = "lg",
}: {
  team1Initials: [string, string];
  team2Initials: [string, string];
  team1Score: number;
  team2Score: number;
  flashTeam?: 1 | 2 | null;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const cell = { sm: 40, md: 52, lg: 64, xl: 84 }[size];
  const gap = { sm: 3, md: 4, lg: 5, xl: 6 }[size];
  const lineW = { sm: 1, md: 1, lg: 1.5, xl: 1.5 }[size];
  const initialsFs = { sm: 11, md: 13, lg: 15, xl: 18 }[size];
  const scoreFs = { sm: 22, md: 28, lg: 36, xl: 48 }[size];

  const cells = [
    { text: team1Initials[0], bg: "var(--color-team1)" },
    { text: team1Initials[1], bg: "var(--color-team1)" },
    { text: team2Initials[0], bg: "var(--color-team2)" },
    { text: team2Initials[1], bg: "var(--color-team2)" },
  ];

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap }}>
        {cells.map((c, i) => (
          <div
            key={i}
            style={{
              width: cell,
              height: cell,
              borderRadius: Math.max(4, cell / 8),
              backgroundColor: c.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FBFAF7",
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 600,
              fontSize: initialsFs,
              transition: "all 0.2s ease",
            }}
          >
            {c.text}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: lineW,
          backgroundColor: "rgba(251,250,247,0.5)",
          transform: "translateX(-50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: lineW,
          backgroundColor: "rgba(251,250,247,0.5)",
          transform: "translateY(-50%)",
        }}
      />

      {/* Score overlays, one per half */}
      <div
        className={flashTeam === 1 ? "animate-score-flash" : undefined}
        style={{
          position: "absolute",
          top: -10,
          right: -14,
          backgroundColor: "#FBFAF7",
          border: "2px solid var(--color-team1)",
          borderRadius: 999,
          minWidth: scoreFs * 1.1,
          height: scoreFs * 1.1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 6px",
          fontFamily: "Space Mono, monospace",
          fontWeight: 700,
          fontSize: scoreFs * 0.55,
          color: "var(--color-team1)",
        }}
      >
        {team1Score}
      </div>
      <div
        className={flashTeam === 2 ? "animate-score-flash" : undefined}
        style={{
          position: "absolute",
          bottom: -10,
          right: -14,
          backgroundColor: "#FBFAF7",
          border: "2px solid var(--color-team2)",
          borderRadius: 999,
          minWidth: scoreFs * 1.1,
          height: scoreFs * 1.1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 6px",
          fontFamily: "Space Mono, monospace",
          fontWeight: 700,
          fontSize: scoreFs * 0.55,
          color: "var(--color-team2)",
        }}
      >
        {team2Score}
      </div>
    </div>
  );
}
