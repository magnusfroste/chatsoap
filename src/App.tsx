import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Chats from "./pages/Chats";
import DirectChat from "./pages/DirectChat";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Lazy load GroupChat to avoid fabric.js and simple-peer blocking the main bundle
const GroupChat = lazy(() => import("./pages/GroupChat"));

const queryClient = new QueryClient();

const App = () => {
  // Apply dark mode to html element for proper Tailwind dark mode support
  useEffect(() => {
    document.documentElement.classList.add("dark");
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
              <Route path="/chats" element={<Chats />} />
              <Route path="/chat/:id" element={<DirectChat />} />
              <Route 
                path="/group/:id" 
                element={
                  <Suspense fallback={
                    <div className="min-h-screen flex items-center justify-center bg-background">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  }>
                    <GroupChat />
                  </Suspense>
                } 
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
