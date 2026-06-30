import { useState, useEffect } from "react";
import {
  CheckCircle2, BookOpen, PenLine, Mic, Brain,
  ChevronDown, ChevronUp, Loader2, Clock, MessageSquare,
  ExternalLink, Link2, CheckSquare, Paperclip, Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import HomeworkSubmitModal from "@/components/dashboard/HomeworkSubmitModal";
import HomeworkFeedbackModal from "@/components/dashboard/HomeworkFeedbackModal";

type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file" | "watching";

const HW_META: Record<HwType, { label: string; icon: React.ElementType; color: string }> = {
  writing:    { label: "쓰기",       icon: PenLine,    color: "text-[hsl(var(--navy))]" },
  reading:    { label: "읽기",       icon: BookOpen,   color: "text-[hsl(var(--gold-dark))]" },
  speaking:   { label: "말하기",     icon: Mic,        color: "text-[hsl(var(--success))]" },
  memorizing: { label: "외우기",     icon: Brain,      color: "text-purple-500" },
  file:       { label: "파일올리기", icon: Paperclip,  color: "text-blue-500" },
  watching:   { label: "시청하기",   icon: Monitor,    color: "text-rose-500" },
};

const URL_REGEX = /https?:\/\/[^\s<>"']+/g;
function extractUrls(text: string | null): string[] {
  if (!text) return [];
  return text.match(URL_REGEX) || [];
}
function getDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}
function removeUrls(text: string): string {
  return text.replace(URL_REGEX, "").replace(/\n{2,}/g, "\n").trim();
}

function BookmarkCard({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 hover:border-[hsl(var(--gold)/0.5)] transition-all group"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-[hsl(var(--gold)/0.15)] flex items-center justify-center">
        <Link2 className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate group-hover:text-[hsl(var(--gold-dark))] transition-colors">
          {getDomain(url)}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{url}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[hsl(var(--gold-dark))] flex-shrink-0 transition-colors" />
    </a>
  );
}

interface Assignment {
  id: string;
  type: HwType;
  title: string;
  description: string | null;
  is_preset: boolean;
  session_id: string | null;
  preset_origin_id?: string | null;
}

interface Submission {
  id: string;
  assignment_id: string | null;
  status: string;
  text_content: string | null;
  audio_url: string | null;
  file_url: string | null;
  submitted_at: string;
  instructor_note: string | null;
  reviewed_at: string | null;
  ai_correction: any | null;
}

// ── Submission Card ────────────────────────────────────────────────────────────
// Unified: opens HomeworkSubmitModal for all edits/submissions so the same
// canonical-target resolution, auto-save, sibling-draft prefill, and race
// guards apply regardless of entry point.
function SubmissionCard({
  assignment,
  submission,
  studentName,
  onSubmitted,
  onViewFeedback,
}: {
  assignment: Assignment;
  submission: Submission | null;
  studentName: string;
  onSubmitted: (sub: Submission) => void;
  onViewFeedback: (assignment: Assignment, submission: Submission) => void;
}) {
  const [descOpen, setDescOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const meta = HW_META[assignment.type];
  const Icon = meta.icon;

  const submitted = !!submission && submission.status === "submitted";
  const reviewed = !!submission && submission.status === "reviewed";
  const isDraft = !!submission && submission.status === "draft";

  const handleHeaderClick = () => {
    if (reviewed && submission) {
      onViewFeedback(assignment, submission);
    } else {
      setDescOpen((v) => !v);
    }
  };

  return (
    <>
      <div className={cn(
        "rounded-xl border bg-card overflow-hidden transition-all",
        reviewed ? "border-[hsl(var(--success)/0.5)]" : submitted ? "border-[hsl(var(--gold)/0.4)]" : "border-border"
      )}>
        <button
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
          onClick={handleHeaderClick}
        >
          <div className={cn("flex-shrink-0", meta.color)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{assignment.title}</span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted", meta.color)}>
                {meta.label}
              </span>
              {reviewed && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]">
                  검토 완료
                </span>
              )}
              {submitted && !reviewed && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]">
                  제출 완료
                </span>
              )}
              {isDraft && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]">
                  임시저장
                </span>
              )}
            </div>
            {assignment.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{assignment.description}</p>
            )}
          </div>
          <div className="flex-shrink-0">
            {submitted || reviewed
              ? <CheckCircle2 className={cn("w-4 h-4", reviewed ? "text-[hsl(var(--success))]" : "text-[hsl(var(--gold))]")} />
              : descOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {descOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/50">
            {assignment.description && (
              <div className="mt-3 rounded-lg border border-border/60 overflow-hidden">
                <div className="px-3 py-2.5 bg-muted/20 space-y-2">
                  {extractUrls(assignment.description).map((url, i) => (
                    <BookmarkCard key={i} url={url} />
                  ))}
                  {removeUrls(assignment.description) && (
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {removeUrls(assignment.description)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {submission?.instructor_note && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-[hsl(var(--success)/0.08)] border border-[hsl(var(--success)/0.2)]">
                <p className="text-xs font-semibold text-[hsl(var(--success))] mb-0.5">강사 피드백</p>
                <p className="text-xs text-foreground line-clamp-2">{submission.instructor_note}</p>
              </div>
            )}

            {submission && (submission.status === "reviewed" || submission.ai_correction) && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full h-8 text-xs gap-1.5"
                onClick={(e) => { e.stopPropagation(); onViewFeedback(assignment, submission); }}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                검토 결과 보기
              </Button>
            )}

            {!reviewed && (
              <Button
                size="sm"
                className="mt-2 w-full h-9 text-sm gap-1.5 bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground"
                onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
              >
                {isDraft ? "이어서 작성" : submitted ? "다시 제출하기" : "제출하기"}
              </Button>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <HomeworkSubmitModal
          assignment={{
            id: assignment.id,
            type: assignment.type,
            title: assignment.title,
            description: assignment.description,
            session_id: assignment.session_id,
          }}
          submission={submission as any}
          studentName={studentName}
          onClose={() => setModalOpen(false)}
          onSubmitted={(sub) => onSubmitted(sub as any)}
        />
      )}
    </>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
export default function StudentHomeworkPanel({
  studentName,
  sessionId,
  showPreviousCycle = false,
  headerLabel,
  emptyMessage,
}: {
  studentName: string;
  sessionId: string;
  showPreviousCycle?: boolean;
  headerLabel?: string;
  emptyMessage?: string;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [loading, setLoading] = useState(true);
  const [feedbackTarget, setFeedbackTarget] = useState<{ assignment: Assignment; submission: Submission } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: sessionRows } = await supabase
        .from("class_sessions")
        .select("id, scheduled_at")
        .eq("student_name", studentName)
        .order("scheduled_at", { ascending: true });
      const sessions = (sessionRows ?? []) as { id: string; scheduled_at: string }[];

      let effectiveSessionId = sessionId;
      if (showPreviousCycle) {
        const current = sessions.find((s) => s.id === sessionId);
        if (current) {
          const currentTs = new Date(current.scheduled_at).getTime();
          const previous = [...sessions]
            .filter((s) => new Date(s.scheduled_at).getTime() < currentTs)
            .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];
          if (previous) effectiveSessionId = previous.id;
        }
      }

      const [{ data: asgn }, { data: subs }] = await Promise.all([
        supabase
          .from("homework_assignments")
          .select("id, type, title, description, is_preset, session_id, preset_origin_id")
          .eq("student_name", studentName)
          .or(`session_id.eq.${effectiveSessionId},is_preset.eq.true`)
          .order("created_at", { ascending: true }),
        supabase
          .from("homework_submissions")
          .select("*")
          .eq("student_name", studentName),
      ]);

      const assignmentRows = (asgn ?? []) as (Assignment & { preset_origin_id?: string | null })[];
      const submissionRows = (subs ?? []) as Submission[];

      const copyOriginIds = new Set(
        assignmentRows.filter(a => a.preset_origin_id && a.session_id === effectiveSessionId)
          .map(a => a.preset_origin_id)
      );
      const filtered = assignmentRows.filter(a => {
        if (a.is_preset && copyOriginIds.has(a.id)) return false;
        return true;
      });

      setAssignments(filtered);

      const currentSession = sessions.find((s) => s.id === effectiveSessionId) ?? null;
      const currentSessionTime = currentSession ? new Date(currentSession.scheduled_at).getTime() : null;
      const nextSessionTime = currentSession
        ? sessions
            .filter((s) => new Date(s.scheduled_at).getTime() > currentSessionTime!)
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]?.scheduled_at ?? null
        : null;
      const nextSessionTs = nextSessionTime ? new Date(nextSessionTime).getTime() : Number.POSITIVE_INFINITY;

      const groupedByAssignment = submissionRows.reduce<Record<string, Submission[]>>((acc, sub) => {
        if (!sub.assignment_id) return acc;
        if (!acc[sub.assignment_id]) acc[sub.assignment_id] = [];
        acc[sub.assignment_id].push(sub);
        return acc;
      }, {});

      const pickLatest = (list: Submission[]) =>
        [...list].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0] ?? null;

      const subMap: Record<string, Submission> = {};
      filtered.forEach((assignment) => {
        const candidates = groupedByAssignment[assignment.id] ?? [];
        if (candidates.length === 0) return;

        if (assignment.is_preset && currentSessionTime) {
          const inWindow = candidates.filter((sub) => {
            const ts = new Date(sub.submitted_at).getTime();
            return ts >= currentSessionTime && ts < nextSessionTs;
          });
          const selected = pickLatest(inWindow);
          if (selected) subMap[assignment.id] = selected;
          return;
        }

        const latest = pickLatest(candidates);
        if (latest) subMap[assignment.id] = latest;
      });

      setSubmissions(subMap);
      setLoading(false);
    };
    load();
  }, [studentName, sessionId, showPreviousCycle]);

  const handleSubmitted = (assignmentId: string, sub: Submission) => {
    setSubmissions((prev) => ({ ...prev, [assignmentId]: sub }));
  };

  const total = assignments.length;
  const submitted = assignments.filter(a => submissions[a.id]?.status === "submitted" || submissions[a.id]?.status === "reviewed").length;

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-gold" />
            <span className="font-semibold text-sm text-foreground">{headerLabel ?? "숙제"}</span>
            {!loading && (
              <span className="text-xs bg-gold/15 text-gold-dark px-1.5 py-0.5 rounded-full font-medium">
                {submitted}/{total} 완료
              </span>
            )}
          </div>
          {!loading && total > 0 && submitted === total && (
            <span className="text-xs text-[hsl(var(--success))] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              모두 제출됨
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{emptyMessage ?? "등록된 숙제가 없습니다"}</p>
            {!emptyMessage && (
              <p className="text-xs text-muted-foreground/60">강사가 숙제를 추가하면 여기에 표시됩니다</p>
            )}
          </div>
        ) : (
          assignments.map((a) => (
            <SubmissionCard
              key={a.id}
              assignment={a}
              submission={submissions[a.id] ?? null}
              studentName={studentName}
              onSubmitted={(sub) => handleSubmitted(a.id, sub)}
              onViewFeedback={(asgn, sub) => setFeedbackTarget({ assignment: asgn, submission: sub })}
            />
          ))
        )}
      </div>

      {feedbackTarget && (
        <HomeworkFeedbackModal
          assignmentTitle={feedbackTarget.assignment.title}
          assignmentType={feedbackTarget.assignment.type}
          assignmentDescription={feedbackTarget.assignment.description}
          textContent={feedbackTarget.submission.text_content}
          audioUrl={feedbackTarget.submission.audio_url}
          fileUrl={feedbackTarget.submission.file_url}
          instructorNote={feedbackTarget.submission.instructor_note}
          reviewedAt={feedbackTarget.submission.reviewed_at}
          aiCorrection={feedbackTarget.submission.ai_correction}
          onClose={() => setFeedbackTarget(null)}
        />
      )}
    </div>
  );
}
