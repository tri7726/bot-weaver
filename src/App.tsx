import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Bots from "./pages/Bots";
import BotEdit from "./pages/BotEdit";
import Tasks from "./pages/Tasks";
import Settings from "@/pages/Settings";
import Profiles from "@/pages/Profiles";
import ProfileEdit from "@/pages/ProfileEdit";
import Memories from "@/pages/Memories";
import Logs from "@/pages/Logs";
import NotFound from "@/pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  // Default to dark theme
  if (typeof document !== "undefined" && !document.documentElement.classList.contains("dark")) {
    document.documentElement.classList.add("dark");
  }
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/bots" element={<Bots />} />
                <Route path="/bots/:id" element={<BotEdit />} />
                <Route path="/profiles" element={<Profiles />} />
                <Route path="/profiles/:id" element={<ProfileEdit />} />
                <Route path="/memories" element={<Memories />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/logs" element={<Logs />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
