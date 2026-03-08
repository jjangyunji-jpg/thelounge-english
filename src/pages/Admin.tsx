import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar, { AdminTab } from "@/components/admin/AdminSidebar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import OperationsDashboard from "@/components/admin/OperationsDashboard";
import InstructorManagement from "@/components/admin/InstructorManagement";
import StudentManagement from "@/components/admin/StudentManagement";
import UserApproval from "@/components/admin/UserApproval";
import GuideManagement from "@/components/admin/GuideManagement";
import MessageCenter from "@/components/admin/MessageCenter";
import SystemSettings from "@/components/admin/SystemSettings";
import TeachingMaterials from "@/components/admin/TeachingMaterials";
import StudentFeedbackManagement from "@/components/admin/StudentFeedbackManagement";
import ClassFeedbackManagement from "@/components/admin/ClassFeedbackManagement";
import CurriculumGuideEditor from "@/components/admin/CurriculumGuideEditor";
import { Menu, X, Loader2 } from "lucide-react";

export default function Admin() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");
      if (!data || data.length === 0) { navigate("/login"); return; }
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <AdminDashboard />;
      case "operations":
        return <OperationsDashboard />;
      case "instructors":
        return <InstructorManagement />;
      case "students":
        return <StudentManagement />;
      case "approval":
        return <UserApproval onNavigate={(tab) => setActiveTab(tab as AdminTab)} />;
      case "materials":
        return <TeachingMaterials />;
      case "curriculum":
        return <CurriculumGuideEditor />;
      case "student-feedback":
        return <StudentFeedbackManagement />;
      case "guide":
        return <GuideManagement />;
      case "messages":
        return <MessageCenter />;
      case "settings":
        return <SystemSettings />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10">
            <AdminSidebar
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                setSidebarOpen(false);
              }}
            />
          </div>
          <button
            className="absolute top-4 right-4 z-20 text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm text-foreground">The Lounge English Admin</span>
        </div>

        <main className="flex-1 p-3 sm:p-6 overflow-auto">
          <div className="max-w-5xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
