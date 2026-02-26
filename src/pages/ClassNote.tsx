import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, FileText, CheckSquare, Clock, BookOpen, ChevronDown,
  Calendar, Loader2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import StudentHomeworkPanel from "@/components/classroom/StudentHomeworkPanel";


interface ClassSession {
  id: string;
  scheduled_at: string;
  topic: string | null;
  level: string;
  instructor_name: string;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function ClassNote() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlStudent = searchParams.get("name") || "";

  // 인증 기반 학생 식별 (URL 파라미터 폴백)
  const [authStudent, setAuthStudent] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase
          .from("student_profiles")
          .select("student_name, nickname")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (profile?.student_name) setAuthStudent(profile.student_name);
        if (profile?.nickname) setDisplayName(profile.nickname);
      }
      setAuthLoading(false);
    });
  }, []);

  const student = authStudent || urlStudent;

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    if (!student) return;
    const load = async () => {
      setLoadingSessions(true);
      const { data } = await supabase
        .from("class_sessions")
        .select("id, scheduled_at, topic, level, instructor_name, notes, started_at, ended_at")
        .eq("student_name", student)
        .order("scheduled_at", { ascending: false })
        .limit(30);
      const list = (data ?? []) as ClassSession[];
      setSessions(list);
      if (list.length > 0) setSelectedSession(list[0]);
      setLoadingSessions(false);
    };
    load();
  }, [student]);

  // 주차 계산: scheduled_at 오름차순 인덱스
  const sessionWeekMap = new Map<string, number>();
  [...sessions].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)).forEach((s, i) => {
    sessionWeekMap.set(s.id, i + 1);
  });

  const pastSessions = sessions.filter(
    (s) => new Date(s.scheduled_at) <= new Date()
  );
  const displaySessions = pastSessions.length > 0 ? pastSessions : sessions;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header className="sidebar-gradient text-sidebar-foreground px-4 py-3 flex items-center gap-4 shadow-lg">
        <button
          onClick={() => navigate("/my/dashboard")}
          className="flex items-center gap-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">대시보드</span>
        </button>
        <div className="w-px h-5 bg-sidebar-border" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="w-4 h-4 text-gold" />
            <span className="font-bold text-sidebar-accent-foreground text-sm">수업 노트</span>
            {student && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                {displayName || student}
              </span>
            )}
          </div>
          {selectedSession && (
            <p className="text-sidebar-foreground/50 text-xs mt-0.5">
              {formatDate(selectedSession.scheduled_at)} · {selectedSession.instructor_name}
            </p>
          )}
        </div>

        {/* Session selector */}
        {!loadingSessions && displaySessions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setSelectorOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Calendar className="w-3.5 h-3.5" />
              {selectedSession
                ? `${formatDate(selectedSession.scheduled_at).slice(0, -5)}`
                : "수업 선택"}
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", selectorOpen && "rotate-180")} />
            </button>
            {selectorOpen && (
              <div className="absolute right-0 top-full mt-1 w-60 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden max-h-72 overflow-y-auto">
                {displaySessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSession(s); setSelectorOpen(false); }}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-xs hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0",
                      selectedSession?.id === s.id && "bg-gold/10"
                    )}
                  >
                    <p className="font-semibold text-foreground">
                      <span className="text-gold font-bold">{sessionWeekMap.get(s.id)}주차</span>
                      {" "}{formatDate(s.scheduled_at)}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {formatTime(s.scheduled_at)} · {s.topic || "수업"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex gap-5 px-4 py-5 max-w-5xl w-full mx-auto">

        {/* ── LEFT COLUMN: 수업 노트 ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">

          {/* No student */}
          {!student && (
            <div className="rounded-xl border border-border bg-card shadow-sm flex items-center justify-center py-16">
              <div className="text-center space-y-2">
                <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-semibold text-muted-foreground">학생을 선택해주세요</p>
                <p className="text-xs text-muted-foreground/60">대시보드에서 수업 노트 버튼을 눌러주세요</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {student && loadingSessions && (
            <div className="rounded-xl border border-border bg-card shadow-sm flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* No sessions */}
          {student && !loadingSessions && sessions.length === 0 && (
            <div className="rounded-xl border border-border bg-card shadow-sm flex items-center justify-center py-16">
              <div className="text-center space-y-2">
                <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-semibold text-muted-foreground">수업 이력이 없습니다</p>
              </div>
            </div>
          )}

          {/* Notes panel */}
          {student && !loadingSessions && selectedSession && (
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/30">
                <FileText className="w-4 h-4 text-gold" />
                <span className="font-semibold text-sm text-foreground">수업 노트</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDate(selectedSession.scheduled_at)} {formatTime(selectedSession.scheduled_at)}
                </span>
              </div>

              {/* Session meta */}
              <div className="px-4 py-2.5 border-b border-border/50 bg-muted/10 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> {selectedSession.level}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {selectedSession.instructor_name}
                </span>
                {selectedSession.topic && (
                  <span className="text-gold-dark font-medium">{selectedSession.topic}</span>
                )}
              </div>

              <Textarea
                value={selectedSession.notes || ""}
                readOnly
                placeholder="강사가 수업 노트를 작성하면 여기에 표시됩니다."
                className="h-[420px] resize-none text-sm leading-relaxed border-0 focus-visible:ring-0 bg-transparent p-4 rounded-none overflow-y-auto cursor-default text-muted-foreground"
              />
            </div>
          )}

          {/* Homework panel */}
          {student && !loadingSessions && selectedSession && (
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/30">
                <CheckSquare className="w-4 h-4 text-gold" />
                <span className="font-semibold text-sm text-foreground">이 수업의 숙제</span>
              </div>
              <div className="p-4">
                <StudentHomeworkPanel
                  studentName={student}
                  sessionId={selectedSession.id}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: 수업 이력 목록 ────────────────────────────────── */}
        {student && !loadingSessions && displaySessions.length > 0 && (
          <div className="w-52 flex-shrink-0 hidden lg:flex flex-col gap-3">
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border bg-muted/30 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs font-semibold text-foreground">수업 이력</span>
              </div>
              <div className="divide-y divide-border/50 max-h-[calc(100vh-200px)] overflow-y-auto">
                {displaySessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSession(s)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors",
                      selectedSession?.id === s.id && "bg-gold/8 border-l-2 border-l-gold"
                    )}
                  >
                    <p className={cn(
                      "text-[11px] font-semibold",
                      selectedSession?.id === s.id ? "text-gold-dark" : "text-foreground"
                    )}>
                      <span className="text-gold font-bold">{sessionWeekMap.get(s.id)}주차</span>
                      {" "}{formatDate(s.scheduled_at).slice(0, -5)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {s.topic || "수업"} · {formatTime(s.scheduled_at)}
                    </p>
                    {s.notes && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{s.notes.slice(0, 30)}…</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Click-outside overlay for session selector */}
      {selectorOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setSelectorOpen(false)} />
      )}
    </div>
  );
}
