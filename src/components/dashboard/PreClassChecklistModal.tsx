import { useState, useEffect } from "react";
import {
  X, ClipboardCheck, Brain, FileText, Check, Loader2,
  Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HomeworkAssignment {
  id: string;
  title: string;
  type: string;
  student_name: string;
  session_id: string | null;
  is_preset: boolean;
  preset_origin_id: string | null;
}

interface HomeworkSubmission {
  id: string;
  assignment_id: string | null;
  status: string;
  student_name: string;
  submitted_at: string;
  text_content: string | null;
  audio_url: string | null;
  file_url: string | null;
  instructor_note: string | null;
  reviewed_at: string | null;
  ai_correction: any | null;
}

interface VocabTest {
  id: string;
  student_name: string;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  total: number | null;
}

interface ClassSession {
  id: string;
  scheduled_at: string;
  topic: string | null;
  level: string;
  student_name: string;
  instructor_name: string;
  meet_link: string | null;
  started_at: string | null;
  ended_at: string | null;
  notes: string | null;
}

type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file" | "watching";

const HW_TYPE_LABELS: Record<string, string> = {
  writing: "쓰기",
  reading: "읽기",
  speaking: "말하기",
  memorizing: "외우기",
  file: "파일",
  watching: "시청",
};

interface Props {
  session: ClassSession;
  allSessions: ClassSession[];
  assignments: HomeworkAssignment[];
  submissions: HomeworkSubmission[];
  vocabTests: VocabTest[];
  onClose: () => void;
  onReviewHw: (assignment: HomeworkAssignment, submission: HomeworkSubmission) => void;
  onViewCheckedHw: (assignment: HomeworkAssignment, submission: HomeworkSubmission) => void;
  onQuickReview: (submissionId: string) => void;
}

function fmtTimeKST(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
}
function fmtDateTimeKST(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
}

export default function PreClassChecklistModal({
  session,
  allSessions,
  assignments,
  submissions,
  vocabTests,
  onClose,
  onReviewHw,
  onViewCheckedHw,
  onQuickReview,
}: Props) {
  const [hwExpanded, setHwExpanded] = useState(true);
  const [vocabExpanded, setVocabExpanded] = useState(true);

  // Find the session immediately before the clicked session for this student
  const clickedTime = new Date(session.scheduled_at).getTime();
  const studentSessions = allSessions
    .filter(ss => ss.student_name === session.student_name && new Date(ss.scheduled_at).getTime() < clickedTime)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  const latestPast = studentSessions[0] || null;

  // Filter assignments for this student
  const studentAssignments = assignments.filter(a => {
    if (a.student_name !== session.student_name) return false;
    if (a.is_preset) {
      if (!latestPast) return true;
      const hasCopy = assignments.some(c => c.preset_origin_id === a.id && c.session_id === latestPast.id);
      return !hasCopy;
    }
    return latestPast && a.session_id === latestPast.id;
  });

  const hwSubmissionMap = new Map<string, HomeworkSubmission>();
  studentAssignments.forEach(a => {
    const sub = submissions.find(sb => sb.assignment_id === a.id);
    if (sub) hwSubmissionMap.set(a.id, sub);
  });

  const submittedCount = studentAssignments.filter(a => {
    const sub = hwSubmissionMap.get(a.id);
    return sub && (sub.status === "submitted" || sub.status === "reviewed");
  }).length;
  const totalHw = studentAssignments.length;

  // Vocab tests for this student
  const studentVocab = vocabTests.filter(v => v.student_name === session.student_name);
  const completedVocab = studentVocab.filter(v => v.completed_at);

  // Prep checklist state
  const [materialsUploaded, setMaterialsUploaded] = useState(false);
  const [hwReviewed, setHwReviewed] = useState(false);

  // Auto-check hw reviewed if all submitted are reviewed
  useEffect(() => {
    const allReviewed = studentAssignments.every(a => {
      const sub = hwSubmissionMap.get(a.id);
      return !sub || sub.status === "reviewed" || sub.status !== "submitted";
    });
    if (allReviewed && totalHw > 0) setHwReviewed(true);
  }, [submissions]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              수업 전 체크리스트
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {session.student_name} · {fmtTimeKST(session.scheduled_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 1. Homework Status */}
          <div className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setHwExpanded(!hwExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
                <span className="text-xs font-semibold text-foreground">수강생이 숙제를 잘 이행했습니까?</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  totalHw === 0 ? "bg-muted text-muted-foreground" :
                  submittedCount === totalHw ? "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]" :
                  submittedCount === 0 ? "bg-destructive/10 text-destructive" :
                  "bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]"
                )}>
                  {submittedCount}/{totalHw}
                </span>
                {hwExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            </button>

            {hwExpanded && (
              <div className="px-4 py-3 space-y-2 border-t border-border">
                {totalHw === 0 ? (
                  <p className="text-xs text-muted-foreground">배정된 숙제가 없습니다</p>
                ) : (
                  studentAssignments.map(a => {
                    const sub = hwSubmissionMap.get(a.id);
                    const isSubmitted = sub && (sub.status === "submitted" || sub.status === "reviewed");
                    const isReviewed = sub?.status === "reviewed";
                    const isQuickCheck = a.type === "reading" || a.type === "memorizing" || a.type === "watching";

                    return (
                      <div key={a.id} className={cn(
                        "rounded-lg border px-3 py-2.5 space-y-1",
                        isSubmitted ? "border-border bg-card" : "border-dashed border-muted-foreground/20 bg-muted/10"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                              {HW_TYPE_LABELS[a.type] || a.type}
                            </span>
                            <span className="text-xs font-medium text-foreground truncate">{a.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isReviewed ? (
                              <button
                                onClick={() => sub && onViewCheckedHw(a, sub)}
                                className="flex items-center gap-1 text-[10px] font-medium text-[hsl(var(--success))] hover:underline"
                              >
                                <CheckCircle className="w-3 h-3" /> 검토완료
                              </button>
                            ) : isSubmitted ? (
                              isQuickCheck ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] gap-0.5 border-[hsl(var(--success)/0.4)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)] px-2"
                                  onClick={() => sub && onQuickReview(sub.id)}
                                >
                                  <Check className="w-2.5 h-2.5" /> 확인
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] gap-0.5 border-[hsl(var(--gold)/0.4)] text-[hsl(var(--gold-dark))] hover:bg-[hsl(var(--gold)/0.1)] px-2"
                                  onClick={() => sub && onReviewHw(a, sub)}
                                >
                                  <FileText className="w-2.5 h-2.5" /> 검토하기
                                </Button>
                              )
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60">미제출</span>
                            )}
                          </div>
                        </div>
                        {/* Submission time */}
                        {sub && isSubmitted && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="w-2.5 h-2.5" />
                            제출: {fmtDateTimeKST(sub.submitted_at)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* 2. Vocab Test Status */}
          <div className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setVocabExpanded(!vocabExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-semibold text-foreground">수강생이 단어 테스트를 이행했습니까?</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  completedVocab.length === 0 ? "bg-muted text-muted-foreground" :
                  "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]"
                )}>
                  {completedVocab.length}회
                </span>
                {vocabExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            </button>

            {vocabExpanded && (
              <div className="px-4 py-3 space-y-2 border-t border-border">
                {completedVocab.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {studentVocab.length === 0 ? "배정된 단어 테스트가 없습니다" : "아직 완료한 테스트가 없습니다"}
                  </p>
                ) : (
                  completedVocab
                    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                    .map(v => {
                      const pct = v.total ? Math.round(((v.score || 0) / v.total) * 100) : 0;
                      return (
                        <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-card">
                          <div className="flex items-center gap-2">
                            <Brain className="w-3 h-3 text-purple-400" />
                            <div>
                              <p className="text-xs font-medium text-foreground">
                                {v.score !== null && v.total !== null ? `${v.score}/${v.total}` : "—"}
                                <span className={cn(
                                  "ml-1.5 text-[10px] font-bold",
                                  pct >= 80 ? "text-[hsl(var(--success))]" :
                                  pct >= 50 ? "text-[hsl(var(--gold-dark))]" :
                                  "text-destructive"
                                )}>
                                  ({pct}%)
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {fmtDateTimeKST(v.started_at)}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}
          </div>

          {/* 3. Class Preparation Checklist */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">수업 노트를 업데이트하셨습니까?</span>
              </div>
            </div>
            <div className="px-4 py-3 space-y-2.5 border-t border-border">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0",
                    materialsUploaded ? "bg-primary border-primary" : "border-muted-foreground/30 group-hover:border-primary/50"
                  )}
                  onClick={() => setMaterialsUploaded(!materialsUploaded)}
                >
                  {materialsUploaded && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className={cn("text-xs", materialsUploaded ? "text-foreground" : "text-muted-foreground")}>
                  수업 자료 업로드
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0",
                    hwReviewed ? "bg-primary border-primary" : "border-muted-foreground/30 group-hover:border-primary/50"
                  )}
                  onClick={() => setHwReviewed(!hwReviewed)}
                >
                  {hwReviewed && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className={cn("text-xs", hwReviewed ? "text-foreground" : "text-muted-foreground")}>
                  숙제 검토
                </span>
              </label>
            </div>
          </div>

          {/* Go to classroom */}
          <a href={`/t/classroom?sessionId=${session.id}`} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full h-10 text-sm gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <FileText className="w-4 h-4" /> 수업 노트 열기
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
