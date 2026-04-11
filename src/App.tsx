import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Admin from "./pages/Admin";
import Classroom from "./pages/Classroom";
import ClassroomNotesMirror from "./pages/ClassroomNotesMirror";
import RemarksPopup from "./pages/RemarksPopup";
import ClassroomEditorFullscreen from "./pages/ClassroomEditorFullscreen";
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
          
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Admin: manager + staff */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={["admin", "manager", "staff"]}>
              <Admin />
            </ProtectedRoute>
          } />

          {/* /t/* 강사 전용 라우트 (admin도 접근 가능) */}
          <Route path="/t/dashboard" element={
            <ProtectedRoute allowedRoles={["instructor"]}>
              <InstructorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/t/student-dashboard" element={
            <ProtectedRoute allowedRoles={["instructor", "admin", "manager", "staff"]}>
              <StudentDashboard />
            </ProtectedRoute>
          } />
          <Route path="/t/classroom" element={
            <ProtectedRoute allowedRoles={["instructor"]}>
              <Classroom />
            </ProtectedRoute>
          } />
          <Route path="/t/classroom/notes" element={
            <ProtectedRoute allowedRoles={["instructor"]}>
              <ClassroomNotesMirror />
            </ProtectedRoute>
          } />
          <Route path="/t/classroom/editor" element={
            <ProtectedRoute allowedRoles={["instructor"]}>
              <ClassroomEditorFullscreen />
            </ProtectedRoute>
          } />
          <Route path="/t/classroom/remarks" element={
            <ProtectedRoute allowedRoles={["instructor"]}>
              <RemarksPopup />
            </ProtectedRoute>
          } />
          <Route path="/t/profile" element={
            <ProtectedRoute allowedRoles={["instructor"]}>
              <MyProfile />
            </ProtectedRoute>
          } />

          {/* /my/* 학생 전용 라우트 (admin도 접근 가능) */}
          <Route path="/my/profile" element={
            <ProtectedRoute allowedRoles={["student"]}>
              <MyProfile />
            </ProtectedRoute>
          } />
          <Route path="/my/classroom" element={
            <ProtectedRoute allowedRoles={["student", "instructor", "admin", "manager", "staff"]}>
              <Classroom />
            </ProtectedRoute>
          } />
          <Route path="/my/vocabulary" element={
            <ProtectedRoute allowedRoles={["student", "instructor", "admin", "manager", "staff"]}>
              <Vocabulary />
            </ProtectedRoute>
          } />
          <Route path="/my/classnote" element={
            <ProtectedRoute allowedRoles={["student", "instructor", "admin", "manager", "staff"]}>
              <ClassNote />
            </ProtectedRoute>
          } />
          <Route path="/my/dashboard" element={
            <ProtectedRoute allowedRoles={["student", "instructor", "admin", "manager", "staff"]}>
              <StudentDashboard />
            </ProtectedRoute>
          } />
          <Route path="/my/makeup" element={
            <ProtectedRoute allowedRoles={["student", "instructor", "admin", "manager", "staff"]}>
              <MakeupRequest />
            </ProtectedRoute>
          } />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
