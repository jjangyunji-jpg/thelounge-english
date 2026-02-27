import { useState } from "react";
import {
  X, Loader2, Sparkles, Check, PenLine, Mic, Send, Paperclip, ExternalLink,
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

/** Render inline diff: strikethrough original, colored corrected */
function InlineCorrectedText({ original, errors }: { original: string; errors: CorrectionItem[] }) {
  if (!errors || errors.length === 0) {
    return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{original}</p>;
  }

  // Build the diff display by replacing errors inline
  let remaining = original;
  const parts: React.ReactNode[] = [];
  let key = 0;

  // Sort errors by position in original text (find first occurrence)
  const sortedErrors = [...errors].sort((a, b) => {
    const posA = remaining.toLowerCase().indexOf(a.original.toLowerCase());
    const posB = remaining.toLowerCase().indexOf(b.original.toLowerCase());
    return posA - posB;
  });

  for (const err of sortedErrors) {
    const idx = remaining.toLowerCase().indexOf(err.original.toLowerCase());
    if (idx === -1) continue;

    // Text before the error
    if (idx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
    }

    // The error with strikethrough + correction
    parts.push(
      <span key={key++} className="inline-flex items-baseline gap-0.5 group relative">
        <span className="line-through text-destructive/70 decoration-destructive/50">{remaining.slice(idx, idx + err.original.length)}</span>
        <span className="text-[hsl(var(--navy))] font-semibold">{err.corrected}</span>
        <span className="hidden group-hover:block absolute -top-8 left-0 z-10 px-2 py-1 rounded bg-popover border border-border shadow-lg text-[10px] text-muted-foreground whitespace-nowrap max-w-[200px]">
          {err.explanation}
        </span>
      </span>
    );

    remaining = remaining.slice(idx + err.original.length);
  }

  // Remaining text
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
                <span className="text-[10px] text-muted-foreground">
                  자연스러움 점수: <span className="font-bold text-[hsl(var(--navy))]">{aiResult.score}/10</span>
                </span>
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
                  <InlineCorrectedText original={textContent} errors={aiResult.errors} />
                ) : (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{textContent}</p>
                )}
              </div>
            )}
          </div>

          {/* Error details */}
          {aiResult && aiResult.errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">교정 상세</p>
              <div className="space-y-1.5">
                {aiResult.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border">
                    <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs line-through text-destructive/70">{err.original}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-xs font-semibold text-[hsl(var(--navy))]">{err.corrected}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{err.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
