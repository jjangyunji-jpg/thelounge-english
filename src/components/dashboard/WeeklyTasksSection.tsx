import { useState } from "react";
import {
  CheckCircle2, Circle, BookOpen, PenLine, Mic, Brain,
  Trophy, ExternalLink, Link2, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import HomeworkSubmitModal from "./HomeworkSubmitModal";

type HwType = "writing" | "reading" | "speaking" | "memorizing";

const HW_META: Record<HwType, { label: string; icon: React.ElementType; color: string }> = {
  writing:    { label: "쓰기",   icon: PenLine,  color: "text-[hsl(var(--navy))]" },
  reading:    { label: "읽기",   icon: BookOpen, color: "text-[hsl(var(--gold-dark))]" },
  speaking:   { label: "말하기", icon: Mic,      color: "text-[hsl(var(--success))]" },
  memorizing: { label: "외우기", icon: Brain,    color: "text-purple-500" },
};

const URL_REGEX = /https?:\/\/[^\s<>"']+/g;
function extractUrls(text: string | null): string[] {
  if (!text) return [];
  return text.match(URL_REGEX) || [];
}
function getDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  type: string;
  due_at: string | null;
  is_preset: boolean;
  session_id: string | null;
}

interface Submission {
  id: string;
  assignment_id: string | null;
  status: string;
  text_content: string | null;
  audio_url: string | null;
  instructor_note: string | null;
  reviewed_at: string | null;
}

interface ClassSession {
  id: string;
  scheduled_at: string;
}

interface Props {
  assignments: Assignment[];
  submissions: Submission[];
  sessions: ClassSession[];
  studentName: string;
  vocabWords: { id: string; week_label: string }[];
  testHistory: { id: string; week_label: string | null; completed_at: string | null }[];
  onSubmissionUpdate: (sub: Submission) => void;
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { start: mon, end: sun };
}

function getCurrentWeekLabel() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default function WeeklyTasksSection({
  assignments, submissions, sessions, studentName,
  vocabWords, testHistory, onSubmissionUpdate,
}: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [modalAssignment, setModalAssignment] = useState<Assignment | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const { start: weekStart, end: weekEnd } = getWeekRange();

  // This week's session IDs
  const weekSessionIds = new Set(
    sessions
      .filter(s => {
        const d = new Date(s.scheduled_at);
        return d >= weekStart && d <= weekEnd;
      })
      .map(s => s.id)
  );

  // This week's assignments
  const weekAssignments = assignments.filter(a => a.session_id && weekSessionIds.has(a.session_id));

  const getSub = (aId: string) => submissions.find(s => s.assignment_id === aId);

  // Vocab test this week
  const currentWeek = getCurrentWeekLabel();
  const weekVocabCount = vocabWords.filter(w => w.week_label === currentWeek).length;
  const weekTestsDone = testHistory.filter(t => t.week_label === currentWeek && t.completed_at).length;

  // Find session for vocab test navigation
  const latestWeekSession = sessions
    .filter(s => weekSessionIds.has(s.id))
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];

  const completedCount = weekAssignments.filter(a => {
    const sub = getSub(a.id);
    return sub && (sub.status === "submitted" || sub.status === "reviewed");
  }).length;

  const totalTasks = weekAssignments.length + (weekVocabCount > 0 ? 1 : 0);
  const totalDone = completedCount + (weekTestsDone > 0 ? 1 : 0);

  // Handle reading homework quick complete
  const handleReadingComplete = async (assignment: Assignment) => {
    setCompletingId(assignment.id);
    try {
      const existing = getSub(assignment.id);
      if (existing) {
        const { data, error } = await supabase
          .from("homework_submissions")
          .update({ status: "submitted", submitted_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        if (data) onSubmissionUpdate(data);
      } else {
        const { data, error } = await supabase
          .from("homework_submissions")
          .insert({
            assignment_id: assignment.id,
            student_name: studentName,
            status: "submitted",
          })
          .select()
          .single();
        if (error) throw error;
        if (data) onSubmissionUpdate(data);
      }
      toast({ title: "읽기 숙제 완료 ✓" });
    } catch (e: unknown) {
      toast({ title: "완료 처리 실패", variant: "destructive" });
    } finally {
      setCompletingId(null);
    }
  };

  if (totalTasks === 0) return null;

  return (
    <>
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs font-semibold text-foreground">이번주 과제</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy/10 text-navy font-semibold">
              {totalDone}/{totalTasks}
            </span>
          </div>
          {totalDone === totalTasks && totalTasks > 0 && (
            <span className="text-[10px] text-[hsl(var(--success))] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 모두 완료!
            </span>
          )}
        </div>

        <div className="divide-y divide-border/50">
          {/* Homework items */}
          {weekAssignments.map(a => {
            const sub = getSub(a.id);
            const done = sub && (sub.status === "submitted" || sub.status === "reviewed");
            const meta = HW_META[a.type as HwType] ?? HW_META.writing;
            const Icon = meta.icon;
            const isReading = a.type === "reading";
            const urls = extractUrls(a.description);

            return (
              <div key={a.id} className="px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2.5">
                  {/* Check circle / complete button */}
                  {isReading ? (
                    <button
                      onClick={() => !done && handleReadingComplete(a)}
                      disabled={!!done || completingId === a.id}
                      className="flex-shrink-0"
                    >
                      {done
                        ? <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" />
                        : <Circle className="w-5 h-5 text-muted-foreground hover:text-[hsl(var(--success))] transition-colors" />}
                    </button>
                  ) : (
                    <div className="flex-shrink-0">
                      {done
                        ? <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" />
                        : <Circle className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  )}

                  {/* Title & type */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                      <span className={cn("text-xs font-semibold", done ? "text-muted-foreground line-through" : "text-foreground")}>
                        {a.title}
                      </span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted", meta.color)}>
                        {meta.label}
                      </span>
                    </div>
                  </div>

                  {/* Action button */}
                  {!isReading && !done && (
                    <button
                      onClick={() => setModalAssignment(a)}
                      className="flex-shrink-0 text-[10px] font-bold text-navy hover:text-navy-light transition-colors px-2 py-1 rounded-md bg-navy/5 hover:bg-navy/10"
                    >
                      제출하기
                    </button>
                  )}
                  {done && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] font-semibold flex-shrink-0">
                      {sub?.status === "reviewed" ? "검토됨" : "완료"}
                    </span>
                  )}
                </div>

                {/* Reading: show URLs inline */}
                {isReading && urls.length > 0 && (
                  <div className="ml-8 space-y-1">
                    {urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted/20 hover:bg-muted/40 hover:border-[hsl(var(--gold)/0.5)] transition-all group text-xs">
                        <Link2 className="w-3.5 h-3.5 text-[hsl(var(--gold-dark))] flex-shrink-0" />
                        <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors">{getDomain(url)}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Vocab test */}
          {weekVocabCount > 0 && (
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex-shrink-0">
                  {weekTestsDone > 0
                    ? <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" />
                    : <Circle className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-[hsl(var(--gold))]" />
                    <span className={cn("text-xs font-semibold", weekTestsDone > 0 ? "text-muted-foreground" : "text-foreground")}>
                      이번주 단어 테스트
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                      {weekVocabCount}단어
                    </span>
                  </div>
                </div>
                {weekTestsDone > 0 ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] font-semibold flex-shrink-0">
                    {weekTestsDone}회 완료
                  </span>
                ) : latestWeekSession ? (
                  <button
                    onClick={() => navigate(`/my/classroom?sessionId=${latestWeekSession.id}&role=student&tab=vocab`)}
                    className="flex-shrink-0 text-[10px] font-bold text-navy hover:text-navy-light transition-colors px-2 py-1 rounded-md bg-navy/5 hover:bg-navy/10"
                  >
                    테스트하기
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Homework submit modal */}
      {modalAssignment && (
        <HomeworkSubmitModal
          assignment={modalAssignment}
          submission={getSub(modalAssignment.id) ?? null}
          studentName={studentName}
          onClose={() => setModalAssignment(null)}
          onSubmitted={(sub) => onSubmissionUpdate(sub)}
        />
      )}
    </>
  );
}
