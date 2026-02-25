import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Admin from "./pages/Admin";
import Classroom from "./pages/Classroom";
import StudentDashboard from "./pages/StudentDashboard";
import InstructorDashboard from "./pages/InstructorDashboard";
import NotFound from "./pages/NotFound";
import StudentSetup from "./pages/StudentSetup";
import SetPassword from "./pages/SetPassword";
import MakeupRequest from "./pages/MakeupRequest";
import ClassNote from "./pages/ClassNote";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/classroom" element={<Classroom />} />
          <Route path="/dashboard-student" element={<StudentDashboard />} />
          <Route path="/dashboard-instructor" element={<InstructorDashboard />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/student-setup" element={<StudentSetup />} />
          <Route path="/makeup" element={<MakeupRequest />} />
          <Route path="/classnote" element={<ClassNote />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
