import { Users, GraduationCap, MessageSquare, Settings, LayoutDashboard, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminTab = "dashboard" | "instructors" | "students" | "messages" | "settings";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

const navItems = [
  { id: "dashboard" as AdminTab, label: "대시보드", icon: LayoutDashboard },
  { id: "instructors" as AdminTab, label: "강사 관리", icon: Users },
  { id: "students" as AdminTab, label: "수강생 관리", icon: GraduationCap },
  { id: "messages" as AdminTab, label: "메시지 관리", icon: MessageSquare },
  { id: "settings" as AdminTab, label: "기본 설정", icon: Settings },
];

export default function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
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

      {/* Footer */}
      <div className="px-6 py-4 border-t border-sidebar-border">
        <p className="text-sidebar-foreground/50 text-xs">© 2026 The Lounge English</p>
      </div>
    </aside>
  );
}
