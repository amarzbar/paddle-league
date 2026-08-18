import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton, PrimaryButton, GhostButton, HostCard, Toast, Modal } from "../components/ui";
import { PlayerRow } from "../components/PlayerRow";
import { usePolling } from "../lib/usePolling";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { EventDetail } from "../lib/types";

export default function EventLobby() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: event, error: fetchError } = usePolling<EventDetail>(
    () => api.get<EventDetail>(`/api/events/${id}`),
    [id],
    4000,
  );

  useEffect(() => {
    if (!event) return;
    if (event.status === "active") navigate(`/events/${event.id}/live`, { replace: true });
    if (event.status === "completed") navigate(`/events/${event.id}/recap`, { replace: true });
  }, [event, navigate]);

  if (fetchError instanceof ApiError && fetchError.status === 404) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontFamily: "Hanken Grotesk, sans-serif", color: "#6B6B63" }}>Event not found.</p>
      </div>
    );
  }

  if (!event || !me) return null;

  const host = event.participants.find((p) => p.userId === event.hostId)?.user;
  const isHost = event.isHost;

  const handleStart = async () => {
    setError(null);
    setStarting(true);
    try {
      await api.post(`/api/events/${event.id}/start`);
      // StartEvent precomputes and writes the whole schedule, then flips the
      // event to "active" - land straight in the live view.
      navigate(`/events/${event.id}/live`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the games.");
      setStarting(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await api.del(`/api/events/${event.id}`);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete the event.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(event.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const canStart = event.participants.length >= 4;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ backgroundColor: "#14304B", padding: "16px 20px 28px", flexShrink: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <BackButton onPress={() => navigate("/")} dark />
        </div>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 24, color: "#FBFAF7", marginBottom: 4 }}>
          {event.name}
        </h1>
        <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "rgba(251,250,247,0.6)", marginBottom: 16 }}>
          Race to {event.pointsToWin} combined
          {event.timeLimitSeconds > 0 ? ` or ${Math.round(event.timeLimitSeconds / 60)} min` : ""} · Americano,{" "}
          {event.courtCount} courts, {event.totalRounds} rounds{event.isPublic ? " · Public" : ""}
        </p>

        <button
          onClick={copyCode}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: "12px 16px",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 11, color: "rgba(251,250,247,0.5)" }}>
              Join code
            </div>
            <div style={{ fontFamily: "Space Mono, monospace", fontWeight: 700, fontSize: 20, letterSpacing: "0.15em", color: "#C4F135" }}>
              {event.joinCode}
            </div>
          </div>
          <span style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 12, color: "rgba(251,250,247,0.6)" }}>
            {copied ? "Copied!" : "Tap to copy"}
          </span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 120px" }}>
        {host && (
          <div style={{ marginBottom: 20 }}>
            <HostCard user={host} />
          </div>
        )}

        <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontWeight: 600, fontSize: 13, color: "#14304B", marginBottom: 4 }}>
          Players ({event.participants.length})
        </p>
        <div style={{ borderTop: "1px solid #E8E6E0" }}>
          {event.participants.map((p) =>
            p.user ? (
              <div key={p.userId} style={{ borderBottom: "1px solid #E8E6E0" }}>
                <PlayerRow user={p.user} isHost={p.userId === event.hostId} isMe={p.userId === me.id} />
              </div>
            ) : null,
          )}
        </div>

        {!canStart && (
          <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#A8A8A0", marginTop: 16, textAlign: "center" }}>
            Need at least 4 players to start.
          </p>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 20px",
          backgroundColor: "#FBFAF7",
          borderTop: "1px solid #E8E6E0",
        }}
      >
        {isHost ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <PrimaryButton onClick={handleStart} disabled={!canStart || starting}>
              {starting ? "Building the schedule…" : "Start the games"}
            </PrimaryButton>
            <GhostButton onClick={() => setConfirmDelete(true)} style={{ color: "#FF6F59" }}>
              Delete event
            </GhostButton>
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              fontFamily: "Hanken Grotesk, sans-serif",
              fontSize: 13,
              color: "#6B6B63",
              padding: "16px 0",
            }}
          >
            Waiting for the host to start the games…
          </div>
        )}
        {error && <Toast message={error} />}
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this event?">
        <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 14, color: "#6B6B63", marginBottom: 20 }}>
          This permanently removes the event and its schedule for everyone. This can't be undone.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PrimaryButton onClick={handleDelete} disabled={deleting} style={{ backgroundColor: "#FF6F59" }}>
            {deleting ? "Deleting…" : "Delete event"}
          </PrimaryButton>
          <GhostButton onClick={() => setConfirmDelete(false)}>Cancel</GhostButton>
        </div>
      </Modal>
    </div>
  );
}
