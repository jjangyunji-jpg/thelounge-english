import { useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";

interface SessionItem {
  id: string;
  scheduled_at: string;
  topic: string | null;
}

interface SessionSidebarProps {
  sessions: SessionItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
}

export default function SessionSidebar({
  sessions,
  selectedId,
  onSelect,
  loading,
}: SessionSidebarProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div
      className={cn(
        "flex-shrink-0 border-r border-border bg-muted/20 flex flex-col transition-all duration-200 overflow-hidden",
        collapsed ? "w-10" : "w-52"
      )}
    >
      {/* Toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center justify-center h-10 border-b border-border hover:bg-muted/50 transition-colors"
        title={collapsed ? "사이드바 열기" : "사이드바 닫기"}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        ) : (
          <div className="flex items-center gap-1.5 px-3 w-full">
            <FileText className="w-3.5 h-3.5 text-gold flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground flex-1">이전 수업</span>
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        )}
      </button>

      {/* Session list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">로딩 중…</p>
          )}
          {!loading && sessions.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">수업 없음</p>
          )}
          {!loading &&
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors",
                  selectedId === s.id && "bg-gold/10 border-l-2 border-l-gold"
                )}
              >
                <p className="text-[11px] font-semibold text-foreground leading-tight">
                  {fmtDate(s.scheduled_at)}
                </p>
                {s.topic && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {s.topic}
                  </p>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
