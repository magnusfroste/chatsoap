import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Chats from "./pages/Chats";
import DirectChat from "./pages/DirectChat";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import JoinChat from "./pages/JoinChat";
import { Loader2 } from "lucide-react";

// Lazy load GroupChat to avoid fabric.js and simple-peer blocking the main bundle
const GroupChat = lazy(() => import("./pages/GroupChat"));

const queryClient = new QueryClient();

const App = () => {
  // Apply theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    const root = document.documentElement;
    
    if (savedTheme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(isDark ? "dark" : "light");
    } else {
      root.classList.add(savedTheme);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/chats" element={<Chats />} />
              <Route path="/chat/:id" element={<Chats />} />
              <Route path="/group/:id" element={<Chats />} />
              <Route path="/join/:token" element={<JoinChat />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
