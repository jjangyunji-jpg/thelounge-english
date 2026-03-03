import { useState } from "react";
import {
  X, Loader2, Sparkles, Check, PenLine, Mic, Send, Paperclip, ExternalLink, Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface CorrectionItem {
  original: string;
  corrected: string;
  explanation: string;
}

interface AIResult {
  corrected: string;
  errors: CorrectionItem[];
  feedback: {
    praise: string;
    priorities: string[];
  };
  score: number;
  english_level?: string;
  vocab_level?: string;
}

interface HomeworkReviewModalProps {
  assignmentTitle: string;
  assignmentType: "writing" | "speaking" | "file" | string;
  studentName: string;
  submissionId: string;
  textContent: string | null;
  audioUrl: string | null;
  fileUrl?: string | null;
  onClose: () => void;
  onReviewed: () => void;
}

/** Render inline diff: strikethrough original, colored corrected — click to dismiss */
function InlineCorrectedText({
  original, errors, dismissedIndices, onToggleDismiss,
}: {
  original: string;
  errors: CorrectionItem[];
  dismissedIndices: Set<number>;
  onToggleDismiss: (idx: number) => void;
}) {
  if (!errors || errors.length === 0) {
    return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{original}</p>;
  }

  let remaining = original;
  const parts: React.ReactNode[] = [];
  let key = 0;

  const indexedErrors = errors.map((e, i) => ({ ...e, origIdx: i }));
  const sortedErrors = [...indexedErrors].sort((a, b) => {
    const posA = remaining.toLowerCase().indexOf(a.original.toLowerCase());
    const posB = remaining.toLowerCase().indexOf(b.original.toLowerCase());
    return posA - posB;
  });

  for (const err of sortedErrors) {
    const idx = remaining.toLowerCase().indexOf(err.original.toLowerCase());
    if (idx === -1) continue;

    if (idx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
    }

    const isDismissed = dismissedIndices.has(err.origIdx);

    if (isDismissed) {
      parts.push(
        <span key={key++}
          className="inline-flex items-baseline gap-0.5 cursor-pointer group relative rounded px-0.5 bg-muted/40 hover:bg-muted/60 transition-colors"
          onClick={() => onToggleDismiss(err.origIdx)}
          title="클릭하여 교정 복원"
        >
          <span className="text-foreground">{remaining.slice(idx, idx + err.original.length)}</span>
          <Undo2 className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity inline-block ml-0.5" />
        </span>
      );
    } else {
      parts.push(
        <span key={key++}
          className="inline-flex items-baseline gap-0.5 cursor-pointer group relative rounded px-0.5 hover:bg-destructive/5 transition-colors"
          onClick={() => onToggleDismiss(err.origIdx)}
          title="클릭하여 교정 취소"
        >
          <span className="line-through text-destructive/70 decoration-destructive/50">{remaining.slice(idx, idx + err.original.length)}</span>
          <span className="text-[hsl(var(--navy))] font-semibold">{err.corrected}</span>
          <X className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity inline-block ml-0.5" />
          <span className="hidden group-hover:block absolute -top-8 left-0 z-10 px-2 py-1 rounded bg-popover border border-border shadow-lg text-[10px] text-muted-foreground whitespace-nowrap max-w-[200px]">
            {err.explanation}
          </span>
        </span>
      );
    }

    remaining = remaining.slice(idx + err.original.length);
  }

  if (remaining) {
    parts.push(<span key={key++}>{remaining}</span>);
  }

  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{parts}</p>;
}

export default function HomeworkReviewModal({
  assignmentTitle,
  assignmentType,
  studentName,
  submissionId,
  textContent,
  audioUrl,
  fileUrl,
  onClose,
  onReviewed,
}: HomeworkReviewModalProps) {
  const { toast } = useToast();
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [instructorNote, setInstructorNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissedIndices, setDismissedIndices] = useState<Set<number>>(new Set());

  const toggleDismiss = (idx: number) => {
    setDismissedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const runAICorrection = async () => {
    if (!textContent?.trim()) {
      toast({ title: "교정할 텍스트가 없습니다", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-correct", {
        body: { text: textContent, mode: "homework_review" },
      });
      if (error) throw error;
      setAiResult(data);
      // Auto-populate instructor note with AI feedback
      const feedbackText = [
        data.feedback?.praise || "",
        "",
        ...(data.feedback?.priorities || []).map((p: string, i: number) => `${i + 1}. ${p}`),
      ].join("\n").trim();
      setInstructorNote(feedbackText);
    } catch (e: any) {
      toast({ title: "AI 교정 실패", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("homework_submissions")
        .update({
          status: "reviewed",
          instructor_note: instructorNote.trim() || null,
          reviewed_at: new Date().toISOString(),
          ai_correction: aiResult ? JSON.parse(JSON.stringify({
            ...aiResult,
            errors: aiResult.errors.filter((_, i) => !dismissedIndices.has(i)),
          })) : null,
        })
        .eq("id", submissionId);
      if (error) throw error;
      toast({ title: "숙제 검토 완료 ✓" });
      onReviewed();
      onClose();
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isWriting = assignmentType === "writing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card rounded-t-2xl border-b border-border px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              {isWriting ? <PenLine className="w-4 h-4 text-[hsl(var(--navy))]" /> : <Mic className="w-4 h-4 text-[hsl(var(--success))]" />}
              {assignmentTitle}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{studentName} · {isWriting ? "쓰기" : "말하기"} 숙제</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* AI Correction Button */}
          {isWriting && textContent && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={runAICorrection}
                disabled={loading || !!aiResult}
                className="gap-1.5 h-8 text-xs bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground"
              >
                {loading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />AI 교정 중...</>
                ) : aiResult ? (
                  <><Check className="w-3.5 h-3.5" />교정 완료</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" />AI 교정하기</>
                )}
              </Button>
              {aiResult && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">
                    자연스러움 <span className="font-bold text-[hsl(var(--navy))]">{aiResult.score}/10</span>
                  </span>
                  {aiResult.english_level && (
                    <span className="text-[10px] text-muted-foreground">
                      영어 레벨 <span className="font-bold text-[hsl(var(--navy))]">{aiResult.english_level}</span>
                    </span>
                  )}
                  {aiResult.vocab_level && (
                    <span className="text-[10px] text-muted-foreground">
                      어휘 레벨 <span className="font-bold text-[hsl(var(--navy))]">{aiResult.vocab_level}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Student's submission */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">학생 제출물</p>

            {/* Audio */}
            {audioUrl && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <audio controls src={audioUrl} className="w-full h-8" />
              </div>
            )}

            {/* File */}
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors group">
                <Paperclip className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-xs font-medium text-foreground flex-1 truncate group-hover:text-blue-500 transition-colors">첨부파일 보기</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </a>
            )}

            {/* Text with inline corrections */}
            {textContent && (
              <div className="rounded-lg border border-border bg-muted/10 p-4">
                {aiResult ? (
                  <InlineCorrectedText original={textContent} errors={aiResult.errors} dismissedIndices={dismissedIndices} onToggleDismiss={toggleDismiss} />
                ) : (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{textContent}</p>
                )}
              </div>
            )}
          </div>



          {/* Instructor Feedback */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">강사 피드백 (학생에게 전달됨)</p>
            <Textarea
              value={instructorNote}
              onChange={(e) => setInstructorNote(e.target.value)}
              placeholder="학생에게 보낼 피드백을 작성하세요..."
              className="resize-none min-h-[120px] text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">취소</Button>
            <Button
              onClick={handleReview}
              disabled={saving}
              className="flex-1 h-9 text-sm bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.85)] text-white gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              검토 완료
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
