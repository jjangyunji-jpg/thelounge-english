import { useState, useEffect } from "react";
import { Users, GraduationCap, MessageSquare, Settings, LayoutDashboard, BookOpen, BarChart2, UserCheck, LogOut, Library, ArrowLeft, FileQuestion, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
export type AdminTab = "dashboard" | "operations" | "instructors" | "students" | "approval" | "materials" | "student-feedback" | "guide" | "messages" | "settings";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

const navItems = [
  { id: "dashboard" as AdminTab, label: "대시보드", icon: LayoutDashboard },
  { id: "operations" as AdminTab, label: "운영 대시보드", icon: BarChart2 },
  { id: "instructors" as AdminTab, label: "강사 관리", icon: Users },
  { id: "students" as AdminTab, label: "수강생 관리", icon: GraduationCap },
  { id: "approval" as AdminTab, label: "가입 승인", icon: UserCheck },
  { id: "materials" as AdminTab, label: "수업 자료", icon: Library },
  { id: "guide" as AdminTab, label: "이용가이드 관리", icon: FileQuestion },
  { id: "messages" as AdminTab, label: "메시지 관리", icon: MessageSquare },
  { id: "settings" as AdminTab, label: "기본 설정", icon: Settings },
];

export default function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <aside className="w-64 min-h-screen sidebar-gradient flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center shadow-gold">
            <BookOpen className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <p className="text-sidebar-accent-foreground font-bold text-sm leading-tight">The Lounge</p>
            <p className="text-gold text-xs font-medium">English Admin</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-gold pl-[10px]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-gold" : "")} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer - logged in user */}
      <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
        <button
          onClick={() => navigate("/t/dashboard")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gold hover:bg-sidebar-accent/50 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          강사 대시보드로 이동
        </button>
        {email && (
          <p className="text-sidebar-foreground/70 text-xs truncate" title={email}>
            🔑 {email}
          </p>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
