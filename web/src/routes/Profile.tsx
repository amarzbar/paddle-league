import { useNavigate } from "react-router-dom";
import { Avatar, SecondaryButton, initialsFromName } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/welcome");
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", padding: "40px 24px 32px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 32 }}>
        <Avatar initials={initialsFromName(user.displayName)} size="xl" color={user.avatarColor} />
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 22, color: "#14304B", marginTop: 16 }}>
          {user.displayName}
        </h1>
        <p style={{ fontFamily: "Hanken Grotesk, sans-serif", fontSize: 13, color: "#6B6B63", marginTop: 2 }}>
          {user.email}
        </p>
      </div>

      <div style={{ flex: 1 }} />

      <SecondaryButton onClick={handleLogout}>Log out</SecondaryButton>
    </div>
  );
}
