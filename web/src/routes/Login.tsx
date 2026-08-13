import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton, PrimaryButton, GhostButton, TextInput } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FBFAF7",
        height: "100%",
        overflowY: "auto",
      }}
    >
      <div style={{ padding: "16px 20px" }}>
        <BackButton onPress={() => navigate("/welcome")} />
      </div>

      <form onSubmit={handleSubmit} style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px" }}>
        <h1
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontWeight: 700,
            fontSize: 28,
            color: "#14304B",
            marginBottom: 8,
          }}
        >
          Welcome back
        </h1>
        <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 14, color: "#6B6B63", marginBottom: 28 }}>
          Sign in to see your events.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextInput
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#FF6F59" }}>{error}</p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </PrimaryButton>
          <GhostButton onClick={() => navigate("/register")}>Don't have an account? Sign up</GhostButton>
        </div>
      </form>
    </div>
  );
}
