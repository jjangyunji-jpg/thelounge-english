import { useState } from "react";
import {
  CheckCircle2, Circle, BookOpen, PenLine, Mic, Brain,
  Trophy, ExternalLink, Link2, ClipboardList, Paperclip, Monitor,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import HomeworkSubmitModal from "./HomeworkSubmitModal";
import HomeworkFeedbackModal from "./HomeworkFeedbackModal";

type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file" | "watching";

const HW_META: Record<HwType, { label: string; icon: React.ElementType; color: string }> = {
  writing:    { label: "쓰기",       icon: PenLine,    color: "text-[hsl(var(--navy))]" },
  reading:    { label: "읽기",       icon: BookOpen,   color: "text-[hsl(var(--gold-dark))]" },
  speaking:   { label: "말하기",     icon: Mic,        color: "text-[hsl(var(--success))]" },
  memorizing: { label: "외우기",     icon: Brain,      color: "text-purple-500" },
  file:       { label: "파일올리기", icon: Paperclip,  color: "text-blue-500" },
  watching:   { label: "시청하기",   icon: Monitor, color: "text-rose-500" },
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
  preset_origin_id?: string | null;
  created_at?: string | null;
}

interface Submission {
  id: string;
  assignment_id: string | null;
  status: string;
  text_content: string | null;
  audio_url: string | null;
  file_url: string | null;
  instructor_note: string | null;
  reviewed_at: string | null;
  ai_correction: any | null;
  submitted_at?: string | null;
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
  periodStart?: Date | null;
}

function getWeekLabelFromDate(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default function WeeklyTasksSection({
  assignments, submissions, sessions, studentName,
  vocabWords, testHistory, onSubmissionUpdate, periodStart,
}: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [modalAssignment, setModalAssignment] = useState<Assignment | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [feedbackAssignment, setFeedbackAssignment] = useState<{ assignment: Assignment; submission: Submission } | null>(null);
  const [expandedHwId, setExpandedHwId] = useState<string | null>(null);

  // Find the most recent past session (latest completed/past session)
  const now = new Date();
  const pastSessions = sessions
    .filter(s => new Date(s.scheduled_at) <= now)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  const latestSession = pastSessions[0] ?? null;
  const latestSessionId = latestSession?.id ?? null;
  // Second-most-recent session (used to filter preset submissions)
  const prevSession = pastSessions[1] ?? null;

  // Calculate week number relative to period start
  const weekNumber = latestSession && periodStart
    ? Math.floor((new Date(latestSession.scheduled_at).getTime() - periodStart.getTime()) / (7 * 86400000)) + 1
    : null;

  // Assignments for the latest session (session-specific copies + remaining presets without copies)
  const sessionCopyOriginIds = new Set(
    assignments.filter(a => a.preset_origin_id && a.session_id === latestSessionId)
      .map(a => a.preset_origin_id)
  );
  // Collect titles of session copies to deduplicate manual assignments
  const sessionCopyTitles = new Map(
    assignments.filter(a => a.preset_origin_id && a.session_id === latestSessionId)
      .map(a => [a.title.trim(), a.id])
  );
  const weekAssignments = assignments.filter(a => {
    // Hide vocab-test presets (단어 테스트 handles separately)
    if (a.is_preset && a.type === "memorizing" && a.title.includes("단어 테스트")) return false;
    // Hide preset templates that have session copies
    if (a.is_preset && sessionCopyOriginIds.has(a.id)) return false;
    // For session-specific assignments
    if (a.session_id && a.session_id === latestSessionId) {
      // Hide manual assignments that duplicate a session copy (same title, no preset_origin)
      if (!a.preset_origin_id && sessionCopyTitles.has(a.title.trim())) return false;
      return true;
    }
    // Fallback: show preset templates without copies (instructor hasn't opened classroom yet)
    if (a.is_preset) return true;
    return false;
  });

  // Submission lookup — session copies check both copy ID and preset_origin_id
  const getSub = (aId: string) => {
    const assignment = weekAssignments.find(a => a.id === aId);
    if (!assignment) return undefined;

    // For preset templates (fallback — no session copy exists yet), use time-window
    // Cutoff = latestSession time so that previous-week submissions don't block current week
    if (assignment.is_preset) {
      if (!latestSession) return undefined;
      const cutoffTime = new Date(latestSession.scheduled_at).getTime();
      return submissions
        .filter(s => s.assignment_id === aId && s.submitted_at)
        .filter(s => new Date(s.submitted_at!).getTime() >= cutoffTime)
        .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())[0];
    }

    // For session-specific assignments (including auto-copies), check both IDs
    // Students may have submitted against the preset template before the copy was created
    const directSub = submissions.find(s => s.assignment_id === aId);
    if (directSub) return directSub;
    if (assignment.preset_origin_id) {
      const cutoffTime = new Date(latestSession!.scheduled_at).getTime();
      return submissions
        .filter(s => s.assignment_id === assignment.preset_origin_id && s.submitted_at)
        .filter(s => new Date(s.submitted_at!).getTime() >= cutoffTime)
        .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())[0];
    }
    return undefined;
  };

  // Vocab test: use the latest week_label from actual vocab words (not computed from session date)
  // This ensures the test shows even when session week and vocab week_label differ
  const latestWeekLabel = vocabWords.length > 0
    ? vocabWords.reduce((latest, w) => w.week_label > latest ? w.week_label : latest, vocabWords[0].week_label)
    : null;
  const weekVocabCount = latestWeekLabel ? vocabWords.filter(w => w.week_label === latestWeekLabel).length : 0;
  const weekTestsDone = latestWeekLabel ? testHistory.filter(t => t.week_label === latestWeekLabel && t.completed_at).length : 0;

  const completedCount = weekAssignments.filter(a => {
    const sub = getSub(a.id);
    return sub && (sub.status === "submitted" || sub.status === "reviewed");
  }).length;

  const totalTasks = weekAssignments.length + (weekVocabCount > 0 ? 1 : 0);
  const totalDone = completedCount + (weekTestsDone > 0 ? 1 : 0);

  // Handle quick complete for memorizing type only
  const handleQuickComplete = async (assignment: Assignment) => {
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
      toast({ title: "완료 처리됨 ✓" });
    } catch (e: unknown) {
      toast({ title: "완료 처리 실패", variant: "destructive" });
    } finally {
      setCompletingId(null);
    }
  };

  // Always render the section, even if no tasks

  return (
    <>
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs font-semibold text-foreground">
              {weekNumber ? `${weekNumber}회차 수업 과제` : "최근 수업 과제"}
            </span>
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
            const isDraft = sub && sub.status === "draft";
            const meta = HW_META[a.type as HwType] ?? HW_META.writing;
            const Icon = meta.icon;
            const isQuickType = a.type === "memorizing" || a.type === "speaking";

            return (
              <div key={a.id} className="px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2.5">
                  {/* Check circle */}
                  {isQuickType ? (
                    <button
                      onClick={() => !done && handleQuickComplete(a)}
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
                    {sub?.submitted_at && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(sub.submitted_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })} 제출
                      </p>
                    )}
                  </div>

                  {/* Action button */}
                  {!isQuickType && !done && !isDraft && (
                    <button
                      onClick={() => setModalAssignment(a)}
                      className="flex-shrink-0 text-[10px] font-bold text-navy hover:text-navy-light transition-colors px-2 py-1 rounded-md bg-navy/5 hover:bg-navy/10"
                    >
                      제출하기
                    </button>
                  )}
                  {isDraft && !isQuickType && (
                    <button
                      onClick={() => setModalAssignment(a)}
                      className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))] font-semibold hover:bg-[hsl(var(--gold)/0.25)] transition-colors cursor-pointer"
                    >
                      임시저장 →
                    </button>
                  )}
                  {done && sub?.status === "reviewed" ? (
                    <button
                      onClick={() => setFeedbackAssignment({ assignment: a, submission: sub })}
                      className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] font-semibold hover:bg-[hsl(var(--success)/0.2)] transition-colors cursor-pointer"
                    >
                      검토됨 →
                    </button>
                  ) : done && sub?.status === "submitted" && !isQuickType ? (
                    <button
                      onClick={() => setFeedbackAssignment({ assignment: a, submission: sub })}
                      className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold-dark font-semibold hover:bg-gold/20 transition-colors cursor-pointer"
                    >
                      제출됨 →
                    </button>
                  ) : done ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] font-semibold flex-shrink-0">
                      완료
                    </span>
                  ) : null}
                </div>

                {/* Description for all types */}
                {a.description && (
                  <div className="ml-8">
                    {/* For reading/watching: show URL links */}
                    {(a.type === "reading" || a.type === "watching") && extractUrls(a.description).length > 0 && (
                      <div className="space-y-1">
                        {extractUrls(a.description).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted/20 hover:bg-muted/40 hover:border-[hsl(var(--gold)/0.5)] transition-all group text-xs">
                            <Link2 className="w-3.5 h-3.5 text-[hsl(var(--gold-dark))] flex-shrink-0" />
                            <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors">{getDomain(url)}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                    {/* For non-link types or descriptions without URLs: show expandable detail */}
                    {!(a.type === "reading" || a.type === "watching") || extractUrls(a.description).length === 0 ? (
                      <button
                        onClick={() => setExpandedHwId(prev => prev === a.id ? null : a.id)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                      >
                        {expandedHwId === a.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        상세 보기
                      </button>
                    ) : null}
                    {expandedHwId === a.id && (
                      <div className="mt-1.5 px-2.5 py-2 rounded-md border border-border bg-muted/20 text-xs text-muted-foreground whitespace-pre-wrap">
                        {a.description}
                      </div>
                    )}
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
                      {weekNumber ? `${weekNumber}회차 단어 테스트` : "이번 단어 테스트"}
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
                ) : latestWeekLabel ? (
                  <button
                    onClick={() => navigate(`/my/vocabulary?startTest=${encodeURIComponent(latestWeekLabel)}`)}
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

      {/* Homework feedback modal (student view) */}
      {feedbackAssignment && (
        <HomeworkFeedbackModal
          assignmentTitle={feedbackAssignment.assignment.title}
          assignmentType={feedbackAssignment.assignment.type}
          assignmentDescription={feedbackAssignment.assignment.description}
          textContent={feedbackAssignment.submission.text_content}
          audioUrl={feedbackAssignment.submission.audio_url}
          fileUrl={feedbackAssignment.submission.file_url}
          instructorNote={feedbackAssignment.submission.instructor_note}
          reviewedAt={feedbackAssignment.submission.reviewed_at}
          aiCorrection={feedbackAssignment.submission.ai_correction}
          onClose={() => setFeedbackAssignment(null)}
          onEdit={feedbackAssignment.submission.status === "submitted" ? () => {
            setModalAssignment(feedbackAssignment.assignment);
            setFeedbackAssignment(null);
          } : undefined}
        />
      )}
    </>
  );
}
