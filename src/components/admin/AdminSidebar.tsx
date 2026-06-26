import { useState, useEffect } from "react";
import { Users, GraduationCap, MessageSquare, Settings, LayoutDashboard, BookOpen, BarChart2, UserCheck, LogOut, ArrowLeft, Library, FileQuestion, Target, MapIcon, MessageSquareHeart, Receipt, LifeBuoy, ChevronDown, KeyRound, ClipboardCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import type { AdminLevel } from "@/pages/Admin";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export type AdminTab = "dashboard" | "operations" | "instructors" | "students" | "approval" | "materials" | "curriculum" | "level-tests" | "class-feedback" | "student-feedback" | "cash-receipts" | "support" | "guide" | "messages" | "settings" | "api-keys" | "homework-errors";

// Tabs staff can access (read-only / limited)
const staffAllowedTabs: AdminTab[] = ["materials"];

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  adminLevel: AdminLevel;
}

interface NavGroup {
  label: string;
  icon: typeof LayoutDashboard;
  items: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[];
}

const standaloneItems: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "cash-receipts", label: "결제확인", icon: Receipt },
];

const navGroups: NavGroup[] = [
  {
    label: "회원 관리",
    icon: Users,
    items: [
      { id: "approval", label: "가입 승인", icon: UserCheck },
      { id: "instructors", label: "강사 관리", icon: Users },
      { id: "students", label: "수강생 관리", icon: GraduationCap },
    ],
  },
  {
    label: "피드백",
    icon: MessageSquareHeart,
    items: [
      { id: "class-feedback", label: "강사 피드백", icon: MessageSquareHeart },
      { id: "student-feedback", label: "학생 피드백", icon: Target },
    ],
  },
  {
    label: "자료 관리",
    icon: Library,
    items: [
      { id: "curriculum", label: "커리큘럼 가이드", icon: MapIcon },
      { id: "materials", label: "수업 자료", icon: Library },
      { id: "level-tests", label: "레벨 테스트", icon: ClipboardCheck },
      { id: "guide", label: "이용가이드 관리", icon: FileQuestion },
    ],
  },
  {
    label: "시스템",
    icon: Settings,
    items: [
      { id: "operations", label: "운영 대시보드", icon: BarChart2 },
      { id: "support", label: "버그/개선 관리", icon: LifeBuoy },
      { id: "homework-errors", label: "숙제 오류 추적", icon: AlertCircle },
      { id: "messages", label: "메시지 관리", icon: MessageSquare },
      { id: "api-keys", label: "외부 API 키", icon: KeyRound },
      { id: "settings", label: "기본 설정", icon: Settings },
    ],
  },
];

export default function AdminSidebar({ activeTab, onTabChange, adminLevel }: AdminSidebarProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      if (g.items.some((i) => i.id === activeTab)) initial[g.label] = true;
    });
    return initial;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Auto-open group when activeTab changes
  useEffect(() => {
    navGroups.forEach((g) => {
      if (g.items.some((i) => i.id === activeTab)) {
        setOpenGroups((prev) => ({ ...prev, [g.label]: true }));
      }
    });
  }, [activeTab]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const isTabAllowed = (id: AdminTab) => adminLevel !== "staff" || staffAllowedTabs.includes(id);

  const renderButton = (item: { id: AdminTab; label: string; icon: typeof LayoutDashboard }, indent = false) => {
    if (!isTabAllowed(item.id)) return null;
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onTabChange(item.id)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
          indent && "pl-9",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-gold pl-[10px]"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-gold" : "")} />
        {item.label}
      </button>
    );
  };

  return (
    <aside className="w-64 min-h-screen sidebar-gradient flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border">
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
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Standalone items */}
        {standaloneItems.map((item) => renderButton(item))}

        {/* Grouped items */}
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((i) => isTabAllowed(i.id));
          if (visibleItems.length === 0) return null;
          const isOpen = !!openGroups[group.label];
          const hasActive = group.items.some((i) => i.id === activeTab);
          const GroupIcon = group.icon;

          return (
            <Collapsible key={group.label} open={isOpen} onOpenChange={() => toggleGroup(group.label)}>
              <CollapsibleTrigger className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                hasActive
                  ? "text-gold"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}>
                <GroupIcon className={cn("w-4 h-4 flex-shrink-0", hasActive ? "text-gold" : "")} />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 mt-0.5">
                {visibleItems.map((item) => renderButton(item, true))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border space-y-1.5">
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
