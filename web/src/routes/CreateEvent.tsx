import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton, PrimaryButton, GhostButton, ProgressDots, TextInput, Chip } from "../components/ui";
import { PointsFormatPill } from "../components/PointsFormatPill";
import { api, ApiError } from "../lib/api";
import type { PaddleEvent } from "../lib/types";

// Real Americano scoring: each match plays to a fixed COMBINED total between
// both teams (not a per-team target with a win-by-2 margin) - e.g. a race to
// 24 might end 24-0, or 13-11, whatever adds up to 24 first. An even target
// makes a tied split (12-12 of 24) a possible draw; odd targets can't tie.
const PRESETS = [
  { pointsToWin: 12, sublabel: "Fast" },
  { pointsToWin: 16, sublabel: "Quick game" },
  { pointsToWin: 18, sublabel: "Short set" },
  { pointsToWin: 21, sublabel: "Classic" },
  { pointsToWin: 24, sublabel: "Standard" },
  { pointsToWin: 32, sublabel: "Full set" },
];

const COURT_OPTIONS = [1, 2, 3, 4];

const TIME_LIMIT_OPTIONS = [
  { minutes: 0, label: "No limit" },
  { minutes: 10, label: "10 min" },
  { minutes: 15, label: "15 min" },
  { minutes: 20, label: "20 min" },
];

export default function CreateEvent() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [presetIndex, setPresetIndex] = useState<number | null>(4);
  const [customizing, setCustomizing] = useState(false);
  const [pointsToWin, setPointsToWin] = useState(24);
  const [courtCount, setCourtCount] = useState(4);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(0);
  const [totalRounds, setTotalRounds] = useState<number | "">(8);
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectPreset = (i: number) => {
    setPresetIndex(i);
    setCustomizing(false);
    setPointsToWin(PRESETS[i].pointsToWin);
  };

  const handlePublish = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const event = await api.post<PaddleEvent>("/api/events", {
        name: name.trim() || "Racket Night",
        pointsToWin,
        timeLimitSeconds: timeLimitMinutes * 60,
        courtCount,
        totalRounds: totalRounds || 1,
        isPublic,
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
              Americano rules on up to 4 courts: the whole schedule is shuffled up front so partners never repeat where
              possible, and everyone can see their matchups for the night as soon as it starts.
            </p>

            <div style={{ marginBottom: 24 }}>
              <TextInput
                label="Event name"
                placeholder="Racket Night"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontWeight: 600, fontSize: 13, color: "#14304B", marginBottom: 4 }}>
              Race to
            </p>
            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 12, color: "#6B6B63", marginBottom: 10 }}>
              Combined total between both teams - e.g. a race to 24 could end 24-0 or 13-11.
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
              {customizing ? "Hide custom total" : "Customize race-to total"}
            </GhostButton>

            {customizing && (
              <div className="animate-fade-in" style={{ marginTop: 8, maxWidth: 160 }}>
                <TextInput
                  label="Race to (combined)"
                  type="number"
                  min={2}
                  value={pointsToWin}
                  onChange={(e) => setPointsToWin(Math.max(2, Number(e.target.value)))}
                />
              </div>
            )}

            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontWeight: 600, fontSize: 13, color: "#14304B", margin: "20px 0 10px" }}>
              Available courts
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COURT_OPTIONS.map((count) => (
                <Chip
                  key={count}
                  label={`${count} ${count === 1 ? "court" : "courts"}`}
                  active={courtCount === count}
                  onClick={() => setCourtCount(count)}
                />
              ))}
            </div>

            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontWeight: 600, fontSize: 13, color: "#14304B", margin: "20px 0 4px" }}>
              Time limit
            </p>
            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 12, color: "#6B6B63", marginBottom: 10 }}>
              Safety net, not the main way matches end - if a match runs long, whoever's ahead when time's up wins
              (tied is a draw).
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TIME_LIMIT_OPTIONS.map((t) => (
                <Chip
                  key={t.minutes}
                  label={t.label}
                  active={timeLimitMinutes === t.minutes}
                  onClick={() => setTimeLimitMinutes(t.minutes)}
                />
              ))}
            </div>

            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontWeight: 600, fontSize: 13, color: "#14304B", margin: "20px 0 10px" }}>
              Rounds
            </p>
            <div style={{ maxWidth: 160 }}>
              <TextInput
                label="Total rounds"
                type="number"
                min={1}
                value={totalRounds}
                onChange={(e) => setTotalRounds(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                onBlur={() => setTotalRounds((rounds) => rounds || 1)}
              />
            </div>

            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontWeight: 600, fontSize: 13, color: "#14304B", margin: "20px 0 10px" }}>
              Visibility
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Chip label="Private (join code)" active={!isPublic} onClick={() => setIsPublic(false)} />
              <Chip label="Public (listed for anyone)" active={isPublic} onClick={() => setIsPublic(true)} />
            </div>
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
                ["Race to (combined)", pointsToWin],
                ["Time limit", timeLimitMinutes > 0 ? `${timeLimitMinutes} min` : "None"],
                ["Courts", courtCount],
                ["Rounds", totalRounds],
                ["Visibility", isPublic ? "Public" : "Private"],
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
