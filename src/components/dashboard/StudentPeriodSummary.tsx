import { useState, useEffect } from "react";
import { BookOpen, ClipboardCheck, Brain, Loader2, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  studentName: string;
  instructorName: string;
  periodStartDate: string;
  periodEndDate: string;
}

interface SessionSummary {
  date: string;
  topic: string | null;
  hasNotes: boolean;
}

export default function StudentPeriodSummary({ studentName, instructorName, periodStartDate, periodEndDate }: Props) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [hwStats, setHwStats] = useState({ total: 0, submitted: 0, reviewed: 0 });
  const [vocabStats, setVocabStats] = useState({ testCount: 0, avgScore: 0 });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [studentName]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const startISO = periodStartDate + "T00:00:00";
      const endISO = periodEndDate + "T23:59:59";

      // Fetch sessions, homework, and vocab tests in parallel
      const [sessionsRes, hwRes, submissionsRes, vocabRes] = await Promise.all([
        supabase
          .from("class_sessions")
          .select("scheduled_at, topic, notes, ended_at")
          .eq("student_name", studentName)
          .eq("instructor_name", instructorName)
          .gte("scheduled_at", startISO)
          .lte("scheduled_at", endISO)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("homework_assignments")
          .select("id, title, type, session_id")
          .eq("student_name", studentName),
        supabase
          .from("homework_submissions")
          .select("assignment_id, status")
          .eq("student_name", studentName),
        supabase
          .from("vocabulary_tests")
          .select("score, total, completed_at")
          .eq("student_name", studentName)
          .gte("started_at", startISO)
          .lte("started_at", endISO)
          .not("completed_at", "is", null),
      ]);

      // Sessions
      const allSessions = sessionsRes.data || [];
      const completedSessions = allSessions.filter(s => s.ended_at);
      setSessions(
        completedSessions.map(s => ({
          date: new Date(s.scheduled_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
          topic: s.topic,
          hasNotes: !!(s.notes && s.notes.trim()),
        }))
      );

      // Homework - filter assignments linked to sessions in this period
      const sessionIds = new Set(allSessions.map(s => s.id));
      const periodAssignments = (hwRes.data || []).filter(
        a => a.session_id && sessionIds.has(a.session_id)
      );
      const assignmentIds = new Set(periodAssignments.map(a => a.id));
      const periodSubmissions = (submissionsRes.data || []).filter(
        s => s.assignment_id && assignmentIds.has(s.assignment_id)
      );
      setHwStats({
        total: periodAssignments.length,
        submitted: periodSubmissions.length,
        reviewed: periodSubmissions.filter(s => s.status === "reviewed").length,
      });

      // Vocab tests
      const tests = vocabRes.data || [];
      setVocabStats({
        testCount: tests.length,
        avgScore: tests.length > 0
          ? Math.round(tests.reduce((sum, t) => sum + ((t.score || 0) / (t.total || 1)) * 100, 0) / tests.length)
          : 0,
      });
    } catch (e) {
      console.error("Failed to load period summary:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground">요약 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">기간 요약</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>수업 {sessions.length}회</span>
          <span>숙제 {hwStats.submitted}/{hwStats.total}</span>
          <span>단어 {vocabStats.testCount}회</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 px-1 animate-in slide-in-from-top-2 duration-200">
          {/* Sessions */}
          <div className="rounded-lg border border-border p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">수업 노트</span>
            </div>
            {sessions.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">완료된 수업이 없습니다</p>
            ) : (
              <div className="space-y-0.5">
                {sessions.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="text-muted-foreground w-14 shrink-0">{s.date}</span>
                    <span className={s.topic ? "text-foreground" : "text-muted-foreground/50 italic"}>
                      {s.topic || "주제 없음"}
                    </span>
                    {s.hasNotes && <span className="text-emerald-500 text-[10px]">✓ 노트</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Homework */}
          <div className="rounded-lg border border-border p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <ClipboardCheck className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-semibold text-foreground">숙제 현황</span>
            </div>
            <div className="flex gap-4 text-[11px]">
              <span className="text-muted-foreground">총 <b className="text-foreground">{hwStats.total}</b>개</span>
              <span className="text-muted-foreground">제출 <b className="text-foreground">{hwStats.submitted}</b></span>
              <span className="text-muted-foreground">검토 <b className="text-foreground">{hwStats.reviewed}</b></span>
            </div>
          </div>

          {/* Vocab Tests */}
          <div className="rounded-lg border border-border p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Brain className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs font-semibold text-foreground">단어 테스트</span>
            </div>
            <div className="flex gap-4 text-[11px]">
              <span className="text-muted-foreground">응시 <b className="text-foreground">{vocabStats.testCount}</b>회</span>
              {vocabStats.testCount > 0 && (
                <span className="text-muted-foreground">
                  평균 <b className={vocabStats.avgScore >= 80 ? "text-emerald-500" : vocabStats.avgScore >= 60 ? "text-gold" : "text-destructive"}>{vocabStats.avgScore}%</b>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
