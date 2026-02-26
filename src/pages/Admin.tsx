import { useState } from "react";
import AdminSidebar, { AdminTab } from "@/components/admin/AdminSidebar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import OperationsDashboard from "@/components/admin/OperationsDashboard";
import InstructorManagement from "@/components/admin/InstructorManagement";
import StudentManagement from "@/components/admin/StudentManagement";
import UserApproval from "@/components/admin/UserApproval";
import MessageCenter from "@/components/admin/MessageCenter";
import SystemSettings from "@/components/admin/SystemSettings";
import { Menu, X } from "lucide-react";

export default function Admin() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-5xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
