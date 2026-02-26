import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Admin from "./pages/Admin";
import Classroom from "./pages/Classroom";
import ClassroomNotesMirror from "./pages/ClassroomNotesMirror";
import StudentDashboard from "./pages/StudentDashboard";
import InstructorDashboard from "./pages/InstructorDashboard";
import NotFound from "./pages/NotFound";

import SetPassword from "./pages/SetPassword";
import MakeupRequest from "./pages/MakeupRequest";
import ClassNote from "./pages/ClassNote";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Signup from "./pages/Signup";
import Vocabulary from "./pages/Vocabulary";
import MyProfile from "./pages/MyProfile";

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
          <Route path="/set-password" element={<SetPassword />} />
          {/* /t/* 강사 전용 라우트 */}
          <Route path="/t/dashboard" element={<InstructorDashboard />} />
          <Route path="/t/classroom" element={<Classroom />} />
          <Route path="/t/classroom/notes" element={<ClassroomNotesMirror />} />
          <Route path="/t/profile" element={<MyProfile />} />
          {/* /my/* 학생 전용 라우트 */}
          <Route path="/my/profile" element={<MyProfile />} />
          <Route path="/my/classroom" element={<Classroom />} />
          <Route path="/my/vocabulary" element={<Vocabulary />} />
          <Route path="/my/classnote" element={<ClassNote />} />
          <Route path="/my/dashboard" element={<StudentDashboard />} />
          <Route path="/my/makeup" element={<MakeupRequest />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
