import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, FileText, Clock, BookOpen,
  Calendar, Loader2, Download,
} from "lucide-react";
import { exportNotesPdf } from "@/lib/exportNotesPdf";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatStudentName } from "@/lib/formatStudentName";

import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { supabase } from "@/integrations/supabase/client";
import StudentHomeworkPanel from "@/components/classroom/StudentHomeworkPanel";
import StudentVocabPanel from "@/components/classroom/StudentVocabPanel";
import StudentExpressionPanel from "@/components/classroom/StudentExpressionPanel";
import SessionSidebar from "@/components/classroom/SessionSidebar";

interface ClassSession {
  id: string;
  scheduled_at: string;
  topic: string | null;
  level: string;
  instructor_name: string;
  notes: string | null;
  remarks: string | null;
  started_at: string | null;
  ended_at: string | null;
  cancellation_type: string | null;
  cancellation_resolution: string | null;
  reschedule_origin_dates?: string[] | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul",
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
}

export default function ClassNote() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlStudent = searchParams.get("name") || "";
  const sidebarOpen = searchParams.get("sidebar") === "open";

  const { toast } = useToast();
  const [authStudent, setAuthStudent] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [englishName, setEnglishName] = useState<string | null>(null);
  const [instructorDisplayName, setInstructorDisplayName] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled || !session) { setAuthLoading(false); return; }

        const { data: profile } = await supabase
          .from("student_profiles")
          .select("student_name, nickname")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profile?.student_name) setAuthStudent(profile.student_name);
        if (profile?.nickname) setDisplayName(profile.nickname);

        const studentName = profile?.student_name;
        if (studentName) {
          // Transferred students have multiple rows — pick most recent by start_date
          const { data: isRows } = await supabase
            .from("instructor_students")
            .select("instructor_id, english_name, start_date")
            .eq("student_name", studentName)
            .order("start_date", { ascending: false, nullsFirst: false })
            .limit(1);
          const isData = isRows?.[0] ?? null;
          if (cancelled) return;
          if (isData?.english_name) setEnglishName(isData.english_name);
          if (isData?.instructor_id) {
            const { data: insData } = await supabase
              .from("instructors")
              .select("user_id")
              .eq("id", isData.instructor_id)
              .maybeSingle();
            if (cancelled) return;
            if (insData?.user_id) {
              const { data: roleData } = await supabase
                .from("user_roles")
                .select("display_name")
                .eq("user_id", insData.user_id)
                .eq("role", "instructor")
                .maybeSingle();
              if (cancelled) return;
              if (roleData?.display_name) setInstructorDisplayName(roleData.display_name);
            }
          }
        }
      } catch (err) {
        console.warn("[ClassNote] auth load failed:", err);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const student = authStudent || urlStudent;

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    if (!student) return;
    const load = async () => {
      setLoadingSessions(true);

      // Fetch student's start_date, type, and group info
      // Transferred students have multiple rows — pick the most recent record
      const { data: isRows } = await supabase
        .from("instructor_students")
        .select("start_date, student_type, group_students")
        .eq("student_name", student)
        .order("start_date", { ascending: false, nullsFirst: false })
        .limit(1);
      const isData = isRows?.[0] ?? null;
      const startDate = isData?.start_date;
      const studentType = (isData as any)?.student_type || "regular";
      const groupStudents: string[] = (isData as any)?.group_students || [];

      // Collect all related student names (from bidirectional group_students)
      const relatedNames = new Set<string>([student]);
      // Add group members from this student's record
      for (const g of groupStudents) relatedNames.add(g);
      // Also check if this student appears in another student's group_students
      const { data: reverseData } = await supabase
        .from("instructor_students")
        .select("student_name")
        .contains("group_students", [student]);
      if (reverseData) {
        for (const r of reverseData) relatedNames.add(r.student_name);
      }

      const allNames = Array.from(relatedNames);

      // Query sessions for all related student names
      let query = supabase
        .from("class_sessions")
        .select("id, scheduled_at, topic, level, instructor_name, notes, remarks, started_at, ended_at, cancellation_type, cancellation_resolution, reschedule_origin_dates")
        .in("student_name", allNames)
        .order("scheduled_at", { ascending: false })
        .limit(50);

      if (startDate && studentType !== "corporate") {
        query = query.gte("scheduled_at", startDate + "T00:00:00+09:00");
      }

      const { data } = await query;
      let list = (data ?? []) as ClassSession[];

      // Also include sessions where this student appears in group_students column
      const { data: groupSessions } = await supabase
        .from("class_sessions")
        .select("id, scheduled_at, topic, level, instructor_name, notes, remarks, started_at, ended_at, cancellation_type, cancellation_resolution, reschedule_origin_dates")
        .contains("group_students", [student])
        .order("scheduled_at", { ascending: false })
        .limit(50);

      if (groupSessions) {
        const existingIds = new Set(list.map(s => s.id));
        for (const s of groupSessions as ClassSession[]) {
          if (!existingIds.has(s.id)) list.push(s);
        }
        list.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
      }

      setSessions(list);
      const now = new Date();
      const pastSession = list.find(s => new Date(s.scheduled_at) <= now);
      setSelectedSession(pastSession || list[0] || null);
      setLoadingSessions(false);
    };
    load();
  }, [student]);

  const pastSessions = sessions.filter((s) => new Date(s.scheduled_at) <= new Date());
  const displaySessions = pastSessions.length > 0 ? pastSessions : sessions;

  const handleSidebarSelect = (id: string) => {
    const s = sessions.find((s) => s.id === id);
    if (s) setSelectedSession(s);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header className="sidebar-gradient text-sidebar-foreground px-4 py-3 flex items-center gap-4 shadow-lg">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">돌아가기</span>
        </button>
        <div className="w-px h-5 bg-sidebar-border" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="w-4 h-4 text-gold" />
            <span className="font-bold text-sidebar-accent-foreground text-sm">수업 노트</span>
            {student && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                {formatStudentName(displayName || student, englishName)}
              </span>
            )}
            {student && sessions.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] gap-1 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                onClick={async () => {
                  const withNotes = sessions.filter(s => s.notes && s.notes.trim());
                  if (withNotes.length === 0) {
                    toast({ title: "노트가 있는 수업이 없습니다", variant: "destructive" });
                    return;
                  }
                  await exportNotesPdf(withNotes, student);
                  toast({ title: `${withNotes.length}개 수업 노트를 PDF로 내보냈습니다` });
                }}
              >
                <Download className="w-3 h-3" />PDF
              </Button>
            )}
          </div>
          {selectedSession && (
            <p className="text-sidebar-foreground/50 text-xs mt-0.5">
              {formatDate(selectedSession.scheduled_at)} · {selectedSession.instructor_name}
            </p>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      {!student && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm font-semibold text-muted-foreground">학생을 선택해주세요</p>
          </div>
        </div>
      )}

      {student && loadingSessions && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {student && !loadingSessions && sessions.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm font-semibold text-muted-foreground">수업 이력이 없습니다</p>
          </div>
        </div>
      )}

      {/* Two-column layout with sidebar */}
      {student && !loadingSessions && selectedSession && (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Session Sidebar */}
          <SessionSidebar
            sessions={displaySessions}
            selectedId={selectedSession.id}
            onSelect={handleSidebarSelect}
            loading={loadingSessions}
            initialOpen={true}
            showFutureSection={false}
            onDownloadAllPdf={async (periodMonths: number | null) => {
              let filtered = sessions.filter(s => s.notes && s.notes.trim());
              if (periodMonths !== null) {
                const cutoff = new Date();
                cutoff.setMonth(cutoff.getMonth() - periodMonths);
                filtered = filtered.filter(s => new Date(s.scheduled_at) >= cutoff);
              }
              if (filtered.length === 0) {
                toast({ title: "해당 기간에 노트가 있는 수업이 없습니다", variant: "destructive" });
                return;
              }
              await exportNotesPdf(filtered, student);
              toast({ title: `${filtered.length}개 수업 노트를 PDF로 내보냈습니다` });
            }}
          />

          {/* Main content area */}
          <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-5 px-3 sm:px-4 py-4 sm:py-5 max-w-7xl w-full mx-auto overflow-y-auto">
            {/* ── LEFT COLUMN: Notes + Homework ────────────────────────────── */}
            <div className="flex-1 flex flex-col gap-4 lg:gap-5 min-w-0">
              {/* 수업 노트 (읽기 전용) */}
              <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                <div className="px-3 sm:px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/30">
                  <FileText className="w-4 h-4 text-gold flex-shrink-0" />
                  <span className="font-semibold text-sm text-foreground">수업 노트</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {formatDate(selectedSession.scheduled_at)} {formatTime(selectedSession.scheduled_at)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                      onClick={async () => {
                        if (!selectedSession.notes?.trim()) {
                          toast({ title: "이 수업에 노트가 없습니다", variant: "destructive" });
                          return;
                        }
                        await exportNotesPdf([selectedSession], student);
                        toast({ title: "이 수업 노트를 PDF로 내보냈습니다" });
                      }}
                    >
                      <Download className="w-3 h-3" />PDF
                    </Button>
                  </div>
                </div>

                {/* Session meta */}
                <div className="px-3 sm:px-4 py-2.5 border-b border-border/50 bg-muted/10 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
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

                <div
                  className="tiptap h-[400px] sm:h-[600px] overflow-y-auto p-3 sm:p-4 text-sm leading-relaxed text-foreground [&_a]:text-[hsl(var(--gold-dark))] [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-80"
                  dangerouslySetInnerHTML={{ __html: (() => {
                    const raw = selectedSession.notes || "";
                    if (!raw) return "<p class='text-muted-foreground'>강사가 수업 노트를 작성하면 여기에 표시됩니다.</p>";
                    let html = raw;
                    if (html.includes("&lt;") || html.includes("&amp;")) {
                      const tmp = document.createElement("textarea");
                      tmp.innerHTML = html;
                      html = tmp.value;
                    }
                    html = html.replace(
                      /(?<![="'>])(https?:\/\/[^\s<>"']+)/g,
                      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
                    );
                    return sanitizeHtml(html);
                  })() }}
                />
              </div>

              {/* 비고 (read-only) */}
              {selectedSession.remarks && (
                <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                  <div className="px-3 sm:px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/30">
                    <FileText className="w-4 h-4 text-gold" />
                    <span className="font-semibold text-sm text-foreground">비고</span>
                  </div>
                  <div className="px-3 sm:px-4 py-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedSession.remarks}</p>
                  </div>
                </div>
              )}

              {/* 숙제 */}
              <StudentHomeworkPanel studentName={student} sessionId={selectedSession.id} showPreviousCycle />
            </div>

            {/* ── RIGHT COLUMN: Expressions + Vocabulary ───────────────────── */}
            <div className="w-full lg:w-80 xl:w-96 lg:flex-shrink-0 flex flex-col gap-4 lg:gap-5">
              <StudentExpressionPanel
                studentName={student}
                sessionId={selectedSession.id}
              />
              <StudentVocabPanel
                studentName={student}
                scheduledAt={new Date(selectedSession.scheduled_at)}
                sessionId={selectedSession.id}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
