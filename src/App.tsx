import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import { InstallAppModal } from "@/components/InstallAppModal";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import Home from "./pages/Home";
import UploadPage from "./pages/Upload";
import Editor from "./pages/Editor";
import Profile from "./pages/Profile";
import Share from "./pages/Share";
import Chat from "./pages/Chat";
import Auth from "./pages/Auth";
import ProfileSetup from "./pages/ProfileSetup";
import LiveScoring from "./pages/LiveScoring";
import Notifications from "./pages/Notifications";
import SearchPage from "./pages/Search";
import PlayerDetail from "./pages/PlayerDetail";
import TeamDetail from "./pages/TeamDetail";
import TournamentDetail from "./pages/TournamentDetail";
import Leaderboard from "./pages/Leaderboard";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "missing-google-client-id";

const App = () => (
  <GoogleOAuthProvider clientId={googleClientId}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/profile/setup"
              element={
                <RequireAuth>
                  <ProfileSetup />
                </RequireAuth>
              }
            />
            <Route path="/scoring/:matchId" element={<LiveScoring />} />
            <Route
              path="/search"
              element={
                <RequireAuth>
                  <SearchPage />
                </RequireAuth>
              }
            />
            <Route
              path="/player/:id"
              element={
                <RequireAuth>
                  <PlayerDetail />
                </RequireAuth>
              }
            />
            <Route path="/team/:id" element={<TeamDetail />} />
            <Route path="/tournament/:id" element={<TournamentDetail />} />
            <Route
              path="/notifications"
              element={
                <RequireAuth>
                  <Notifications />
                </RequireAuth>
              }
            />
            <Route element={<AppShell />}>
              <Route path="/" element={<Home />} />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Home />
                  </RequireAuth>
                }
              />
              <Route
                path="/upload"
                element={
                  <RequireAuth>
                    <UploadPage />
                  </RequireAuth>
                }
              />
              <Route path="/editor" element={<Editor />} />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <Profile />
                  </RequireAuth>
                }
              />
              <Route
                path="/share"
                element={
                  <RequireAuth>
                    <Share />
                  </RequireAuth>
                }
              />
              <Route
                path="/chat"
                element={
                  <RequireAuth>
                    <Chat />
                  </RequireAuth>
                }
              />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <Settings />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
        <InstallAppModal />
      </TooltipProvider>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;
