import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton, PrimaryButton, GhostButton, ProgressDots, TextInput } from "../components/ui";
import { PointsFormatPill } from "../components/PointsFormatPill";
import { api, ApiError } from "../lib/api";
import type { PaddleEvent } from "../lib/types";

// maxPoints === pointsToWin for every preset: reaching the target always
// ends the match outright (the backend's hitCap check fires the instant the
// leader reaches maxPoints, regardless of the trailing team's score), so
// there's no win-by-2 grace period at the target - e.g. 24-23 ends the game
// immediately. winBy still matters below the target (need to be ahead by 2
// to win before reaching the cap), just not once you hit it.
const PRESETS = [
  { pointsToWin: 11, winBy: 2, maxPoints: 11, sublabel: "Quick game" },
  { pointsToWin: 15, winBy: 2, maxPoints: 15, sublabel: "Standard" },
  { pointsToWin: 21, winBy: 2, maxPoints: 21, sublabel: "Full set" },
  { pointsToWin: 24, winBy: 2, maxPoints: 24, sublabel: "Long night" },
];

export default function CreateEvent() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [presetIndex, setPresetIndex] = useState<number | null>(1);
  const [customizing, setCustomizing] = useState(false);
  const [pointsToWin, setPointsToWin] = useState(15);
  const [winBy, setWinBy] = useState(2);
  const [maxPoints, setMaxPoints] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectPreset = (i: number) => {
    setPresetIndex(i);
    setCustomizing(false);
    setPointsToWin(PRESETS[i].pointsToWin);
    setWinBy(PRESETS[i].winBy);
    setMaxPoints(PRESETS[i].maxPoints);
  };

  const handlePublish = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const event = await api.post<PaddleEvent>("/api/events", {
        name: name.trim() || "Racket Night",
        pointsToWin,
        winBy,
        maxPoints,
      });
      navigate(`/events/${event.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the event. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <BackButton onPress={() => (step === 0 ? navigate(-1) : setStep(0))} />
        <ProgressDots total={2} current={step} />
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
        {step === 0 && (
          <div className="animate-slide-up">
            <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 24, color: "#14304B", marginBottom: 6 }}>
              Host a night
            </h1>
            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 14, color: "#6B6B63", marginBottom: 24 }}>
              Everyone plays every round, teams never repeat, and courts run in parallel once you've got 4+ players.
            </p>

            <div style={{ marginBottom: 24 }}>
              <TextInput
                label="Event name"
                placeholder="Racket Night"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontWeight: 600, fontSize: 13, color: "#14304B", marginBottom: 10 }}>
              Play to
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {PRESETS.map((p, i) => (
                <PointsFormatPill
                  key={p.pointsToWin}
                  label={String(p.pointsToWin)}
                  sublabel={p.sublabel}
                  selected={presetIndex === i && !customizing}
                  onToggle={() => selectPreset(i)}
                />
              ))}
            </div>

            <GhostButton onClick={() => setCustomizing((c) => !c)} className="!justify-start !px-0">
              {customizing ? "Hide custom settings" : "Customize win-by / cap"}
            </GhostButton>

            {customizing && (
              <div className="animate-fade-in" style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <TextInput
                    label="Points to win"
                    type="number"
                    min={1}
                    value={pointsToWin}
                    onChange={(e) => setPointsToWin(Number(e.target.value))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextInput
                    label="Win by"
                    type="number"
                    min={1}
                    value={winBy}
                    onChange={(e) => setWinBy(Number(e.target.value))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextInput
                    label="Hard cap"
                    type="number"
                    min={pointsToWin}
                    value={maxPoints}
                    onChange={(e) => setMaxPoints(Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="animate-slide-up">
            <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 24, color: "#14304B", marginBottom: 20 }}>
              Review
            </h1>
            <div style={{ backgroundColor: "#14304B", borderRadius: 20, padding: 20 }}>
              <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 18, color: "#FBFAF7", marginBottom: 16 }}>
                {name.trim() || "Racket Night"}
              </div>
              {[
                ["Points to win", pointsToWin],
                ["Win by", winBy],
                ["Hard cap", maxPoints],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <span style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "rgba(251,250,247,0.65)" }}>
                    {label}
                  </span>
                  <span style={{ fontFamily: "Space Mono, monospace", fontWeight: 700, fontSize: 14, color: "#C4F135" }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            {error && (
              <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#FF6F59", marginTop: 16 }}>
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: "12px 20px 24px", flexShrink: 0 }}>
        <PrimaryButton
          onClick={step === 0 ? () => setStep(1) : handlePublish}
          disabled={submitting}
        >
          {step === 0 ? "Continue" : submitting ? "Creating…" : "Create event"}
        </PrimaryButton>
      </div>
    </div>
  );
}
