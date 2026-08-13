import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { InstallPrompt } from "./components/InstallPrompt";

import Welcome from "./routes/Welcome";
import Login from "./routes/Login";
import Register from "./routes/Register";
import EventsHome from "./routes/EventsHome";
import CreateEvent from "./routes/CreateEvent";
import JoinEvent from "./routes/JoinEvent";
import EventLobby from "./routes/EventLobby";
import EventLive from "./routes/EventLive";
import EventLeaderboard from "./routes/EventLeaderboard";
import EventRecap from "./routes/EventRecap";
import Profile from "./routes/Profile";

const router = createBrowserRouter([
  { path: "/welcome", element: <Welcome /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <EventsHome /> },
      { path: "/events/new", element: <CreateEvent /> },
      { path: "/join", element: <JoinEvent /> },
      { path: "/join/:code", element: <JoinEvent /> },
      { path: "/events/:id", element: <EventLobby /> },
      { path: "/events/:id/live", element: <EventLive /> },
      { path: "/events/:id/leaderboard", element: <EventLeaderboard /> },
      { path: "/events/:id/recap", element: <EventRecap /> },
      { path: "/profile", element: <Profile /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <InstallPrompt />
    </AuthProvider>
  );
}
