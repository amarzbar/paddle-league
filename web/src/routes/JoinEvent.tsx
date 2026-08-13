import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton, PrimaryButton } from "../components/ui";
import { api, ApiError } from "../lib/api";

export default function JoinEvent() {
  const navigate = useNavigate();
  const { code: codeFromUrl } = useParams<{ code?: string }>();
  const [code, setCode] = useState(codeFromUrl?.toUpperCase() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { eventId } = await api.post<{ eventId: string }>("/api/events/join", {
        joinCode: code.trim().toUpperCase(),
      });
      navigate(`/events/${eventId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't join. Check the code and try again.");
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", flexShrink: 0 }}>
        <BackButton onPress={() => navigate("/")} />
      </div>

      <form onSubmit={handleSubmit} style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 20px 24px" }}>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 24, color: "#14304B", marginBottom: 6 }}>
          Join an event
        </h1>
        <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 14, color: "#6B6B63", marginBottom: 28 }}>
          Enter the 6-character code from the host.
        </p>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="AB12CD"
          style={{
            width: "100%",
            height: 72,
            borderRadius: 18,
            border: "2px solid #E8E6E0",
            backgroundColor: "#F2F0EB",
            textAlign: "center",
            fontFamily: "Space Mono, monospace",
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: "0.3em",
            color: "#14304B",
            outline: "none",
          }}
        />

        {error && (
          <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#FF6F59", marginTop: 16 }}>
            {error}
          </p>
        )}

        <div style={{ flex: 1 }} />

        <PrimaryButton type="submit" disabled={submitting || code.length !== 6}>
          {submitting ? "Joining…" : "Join event"}
        </PrimaryButton>
      </form>
    </div>
  );
}
