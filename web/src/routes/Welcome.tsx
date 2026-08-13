import { useNavigate } from "react-router-dom";
import { PrimaryButton, SecondaryButton } from "../components/ui";
import { ScoreQuadrant } from "../components/ScoreQuadrant";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#14304B",
        padding: "0 24px 32px",
        height: "100%",
        overflowY: "auto",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 24 }}>
        <div className="animate-fade-in" style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "#C4F135",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 22 }}>🎾</span>
            </div>
            <span
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 700,
                fontSize: 28,
                color: "#FBFAF7",
                letterSpacing: "-0.5px",
              }}
            >
              Racket
            </span>
          </div>
        </div>

        <div className="animate-fade-in" style={{ marginBottom: 40 }}>
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: 24,
              padding: "28px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ScoreQuadrant
              team1Initials={["PS", "FA"]}
              team2Initials={["MC", "DR"]}
              team1Score={18}
              team2Score={14}
              size="xl"
            />
          </div>
        </div>

        <div className="animate-slide-up" style={{ marginBottom: 40 }}>
          <h1
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              fontSize: 38,
              color: "#FBFAF7",
              lineHeight: 1.1,
              letterSpacing: "-1px",
              marginBottom: 14,
            }}
          >
            Game night, sorted.
          </h1>
          <p
            style={{
              fontFamily: "Hanken Grotesk, sans-serif",
              fontSize: 16,
              color: "rgba(251,250,247,0.65)",
              lineHeight: 1.6,
              marginBottom: 0,
            }}
          >
            Host a night, auto-shuffle fair teams that never repeat, track live score courtside, and chase the
            leaderboard.
          </p>
        </div>
      </div>

      <div className="animate-slide-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <PrimaryButton onClick={() => navigate("/register")}>Get started</PrimaryButton>
        <SecondaryButton onClick={() => navigate("/login")} className="!border-white/20 !text-white/80">
          Sign in
        </SecondaryButton>
      </div>
    </div>
  );
}
