import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BottomNav } from "../components/ui/BottomNav";

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--color-paper)",
        }}
      >
        <div
          className="animate-spin-slow"
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            border: "3px solid var(--color-border)",
            borderTopColor: "var(--color-ink)",
          }}
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-paper)",
      }}
    >
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
