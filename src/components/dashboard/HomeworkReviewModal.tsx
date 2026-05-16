import { useState, useRef, useEffect } from "react";
import {
  X, Loader2, Sparkles, Check, PenLine, Mic, Send, Paperclip, ExternalLink, Undo2, Plus, Trash2, HelpCircle, Pencil, Wand2, ArrowUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface CorrectionItem {
  original: string;
  corrected: string;
  explanation: string;
}

interface ParaphraseResult {
  detected_level: string;
  target_level: string;
  paraphrased: string;
  key_improvements: string[];
  instructor_comment: string;
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
  paraphrase?: ParaphraseResult | null;
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

/** Inline edit popover for a correction */
function InlineEditForm({
  item, onSave, onCancel,
}: {
  item: CorrectionItem;
  onSave: (updated: CorrectionItem) => void;
  onCancel: () => void;
}) {
  const [corrected, setCorrected] = useState(item.corrected);
  const [explanation, setExplanation] = useState(item.explanation);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  return (
    <div ref={ref} className="absolute top-full left-0 z-20 mt-1 p-2.5 rounded-lg bg-popover border border-border shadow-xl space-y-1.5 min-w-[220px]"
      onClick={e => e.stopPropagation()}>
      <p className="text-[10px] text-muted-foreground font-semibold">교정 수정</p>
      <Input value={corrected} onChange={e => setCorrected(e.target.value)}
        placeholder="올바른 표현" className="h-7 text-xs" autoFocus />
      <Textarea value={explanation} onChange={e => setExplanation(e.target.value)}
        placeholder="설명 (선택)" className="min-h-[56px] text-xs resize-y" />
      <div className="flex gap-1.5 pt-0.5">
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-6 text-[10px] px-2">취소</Button>
        <Button size="sm" onClick={() => onSave({ ...item, corrected, explanation })}
          className="h-6 text-[10px] px-2 bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground">저장</Button>
      </div>
    </div>
  );
}

/** Render inline diff: strikethrough original, colored corrected — click to dismiss, pencil to edit */
function InlineCorrectedText({
  original, errors, dismissedIndices, onToggleDismiss,
  editedCorrections, editingIndex, onStartEdit, onSaveEdit, onCancelEdit,
}: {
  original: string;
  errors: CorrectionItem[];
  dismissedIndices: Set<number>;
  onToggleDismiss: (idx: number) => void;
  editedCorrections: Map<number, CorrectionItem>;
  editingIndex: number | null;
  onStartEdit: (idx: number) => void;
  onSaveEdit: (idx: number, item: CorrectionItem) => void;
  onCancelEdit: () => void;
}) {
  if (!errors || errors.length === 0) {
    return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{original}</p>;
  }

  let remaining = original;
  const parts: React.ReactNode[] = [];
  let key = 0;

  const indexedErrors = errors.map((e, i) => {
    const edited = editedCorrections.get(i);
    return { ...(edited ?? e), origIdx: i };
  });
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
    const isEditing = editingIndex === err.origIdx;

    if (isDismissed) {
      // 취소된 교정: 완전 일반 텍스트로 흐름에 합쳐 수동 교정 매칭 대상이 되도록 함
      // (되돌리기는 본문 아래 별도 패널에서 처리)
      parts.push(
        <span key={key++}>{remaining.slice(idx, idx + err.original.length)}</span>
      );
    } else {
      parts.push(
        <span key={key++} className="relative inline-flex items-baseline gap-0.5 group rounded px-0.5 hover:bg-destructive/5 transition-colors">
          <span className="line-through text-destructive/70 decoration-destructive/50">{remaining.slice(idx, idx + err.original.length)}</span>
          <span className="text-[hsl(var(--navy))] font-semibold">{err.corrected}</span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5 ml-0.5">
            <button onClick={(e) => { e.stopPropagation(); onStartEdit(err.origIdx); }}
              className="text-muted-foreground hover:text-[hsl(var(--navy))] transition-colors" title="교정 수정">
              <Pencil className="w-2.5 h-2.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onToggleDismiss(err.origIdx); }}
              className="text-muted-foreground hover:text-destructive transition-colors" title="교정 취소">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
          <span className="hidden group-hover:block absolute -top-8 left-0 z-10 px-2 py-1 rounded bg-popover border border-border shadow-lg text-[10px] text-muted-foreground whitespace-nowrap max-w-[200px]">
            {err.explanation}
          </span>
          {isEditing && (
            <InlineEditForm
              item={err}
              onSave={(updated) => onSaveEdit(err.origIdx, updated)}
              onCancel={onCancelEdit}
            />
          )}
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
  const [manualCorrections, setManualCorrections] = useState<CorrectionItem[]>([]);
  const [editedAICorrections, setEditedAICorrections] = useState<Map<number, CorrectionItem>>(new Map());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [paraphrase, setParaphrase] = useState<ParaphraseResult | null>(null);
  const [paraphraseLoading, setParaphraseLoading] = useState(false);
  const [editedParaphrase, setEditedParaphrase] = useState<string>("");
  const [includeParaphrase, setIncludeParaphrase] = useState(true);

  const handleSaveEdit = (idx: number, item: CorrectionItem) => {
    setEditedAICorrections(prev => new Map(prev).set(idx, item));
    setEditingIndex(null);
  };

  const toggleDismiss = (idx: number) => {
    setDismissedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const addManualCorrection = () => {
    setManualCorrections(prev => [...prev, { original: "", corrected: "", explanation: "" }]);
  };

  const updateManualCorrection = (idx: number, field: keyof CorrectionItem, value: string) => {
    setManualCorrections(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const removeManualCorrection = (idx: number) => {
    setManualCorrections(prev => prev.filter((_, i) => i !== idx));
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

  const runParaphrase = async () => {
    if (!textContent?.trim()) {
      toast({ title: "Paraphrase할 텍스트가 없습니다", variant: "destructive" });
      return;
    }
    setParaphraseLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-correct", {
        body: { text: textContent, mode: "paraphrase" },
      });
      if (error) throw error;
      setParaphrase(data);
      setEditedParaphrase(data.paraphrased || "");
      // Note: key_improvements are shown separately in the model essay card on the student view,
      // so we intentionally do NOT append them to the instructor feedback to avoid duplication.
    } catch (e: any) {
      toast({ title: "Paraphrase 실패", description: e.message, variant: "destructive" });
    } finally {
      setParaphraseLoading(false);
    }
  };

  const handleReview = async () => {
    setSaving(true);
    try {
      // Build paraphrase payload (only include if user kept it enabled and it exists)
      const paraphrasePayload = (paraphrase && includeParaphrase) ? {
        ...paraphrase,
        paraphrased: editedParaphrase.trim() || paraphrase.paraphrased,
      } : null;

      // Build the final ai_correction object
      let finalAiCorrection: any = null;
      if (aiResult) {
        finalAiCorrection = {
          ...aiResult,
          errors: [
            ...aiResult.errors
              .map((e, i) => editedAICorrections.has(i) ? editedAICorrections.get(i)! : e)
              .filter((_, i) => !dismissedIndices.has(i)),
            ...manualCorrections.filter(c => c.original.trim() && c.corrected.trim()),
          ],
          paraphrase: paraphrasePayload,
        };
      } else if (paraphrasePayload) {
        // Paraphrase only, no other corrections
        finalAiCorrection = {
          errors: manualCorrections.filter(c => c.original.trim() && c.corrected.trim()),
          score: null,
          corrected: null,
          feedback: null,
          paraphrase: paraphrasePayload,
        };
      } else if (manualCorrections.filter(c => c.original.trim() && c.corrected.trim()).length > 0) {
        finalAiCorrection = {
          errors: manualCorrections.filter(c => c.original.trim() && c.corrected.trim()),
          score: null,
          corrected: null,
          feedback: null,
        };
      }

      const { error } = await supabase
        .from("homework_submissions")
        .update({
          status: "reviewed",
          instructor_note: instructorNote.trim() || null,
          reviewed_at: new Date().toISOString(),
          ai_correction: finalAiCorrection ? JSON.parse(JSON.stringify(finalAiCorrection)) : null,
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
            <div className="flex items-center gap-2 flex-wrap">
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
              {/* Paraphrasing button moved to footer (between 취소 and 검토 완료) */}
              {aiResult && (
                <div className="flex items-center gap-3 flex-wrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5 cursor-help">
                        자연스러움 <span className="font-bold text-[hsl(var(--navy))]">{aiResult.score}/10</span>
                        <HelpCircle className="w-3 h-3 ml-0.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                      원어민이 자연스럽게 느끼는 정도를 1~10점으로 평가합니다. 7점 이상이면 자연스러운 영어입니다.
                    </TooltipContent>
                  </Tooltip>
                  {aiResult.english_level && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5 cursor-help">
                          영어 레벨 <span className="font-bold text-[hsl(var(--navy))]">{aiResult.english_level}</span>
                          <HelpCircle className="w-3 h-3 ml-0.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                        CEFR 기준 영어 숙련도입니다. A1(입문)→A2(초급)→B1(중급)→B2(중상급)→C1(상급)→C2(원어민급)
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {aiResult.vocab_level && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5 cursor-help">
                          어휘 레벨 <span className="font-bold text-[hsl(var(--navy))]">{aiResult.vocab_level}</span>
                          <HelpCircle className="w-3 h-3 ml-0.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                        사용된 어휘의 난이도입니다. 초급→중급→중상급→고급 순으로 다양하고 정확한 어휘 사용을 평가합니다.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Paraphrase Preview Card */}
          {isWriting && paraphrase && (
            <div className="rounded-lg border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.05)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5 text-[hsl(var(--gold))]" />
                  <p className="text-xs font-bold text-foreground">모델 에세이 미리보기</p>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
                    {paraphrase.detected_level}
                    <ArrowUp className="w-2.5 h-2.5 text-[hsl(var(--gold))]" />
                    <span className="text-[hsl(var(--gold))]">{paraphrase.target_level}</span>
                  </span>
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeParaphrase}
                    onChange={(e) => setIncludeParaphrase(e.target.checked)}
                    className="w-3 h-3 accent-[hsl(var(--gold))]"
                  />
                  학생에게 전달
                </label>
              </div>

              <Textarea
                value={editedParaphrase}
                onChange={(e) => setEditedParaphrase(e.target.value)}
                className="min-h-[140px] text-sm resize-y bg-card"
              />

              {paraphrase.key_improvements?.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-[hsl(var(--gold)/0.2)]">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">핵심 개선점</p>
                  {paraphrase.key_improvements.map((imp, i) => (
                    <p key={i} className="text-[11px] text-foreground/80 leading-relaxed">
                      <span className="font-bold text-[hsl(var(--gold))]">{i + 1}.</span> {imp}
                    </p>
                  ))}
                </div>
              )}

              <button
                onClick={() => { setParaphrase(null); setEditedParaphrase(""); }}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
              >
                다시 생성하기
              </button>
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
                {(aiResult || manualCorrections.some(c => c.original.trim())) ? (
                  <InlineCorrectedText
                    original={textContent}
                    errors={[
                      ...(aiResult?.errors || []),
                      ...manualCorrections.filter(c => c.original.trim() && c.corrected.trim()),
                    ]}
                    dismissedIndices={dismissedIndices}
                    onToggleDismiss={toggleDismiss}
                    editedCorrections={editedAICorrections}
                    editingIndex={editingIndex}
                    onStartEdit={setEditingIndex}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingIndex(null)}
                  />
                ) : (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{textContent}</p>
                )}
              </div>
            )}
          </div>



          {/* Manual corrections by instructor */}
          {isWriting && textContent && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">강사 추가 교정</p>
                <button
                  onClick={addManualCorrection}
                  className="flex items-center gap-1 text-[10px] font-semibold text-[hsl(var(--navy))] hover:text-[hsl(var(--navy-light))] transition-colors"
                >
                  <Plus className="w-3 h-3" /> 교정 추가
                </button>
              </div>
              {manualCorrections.map((c, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Input
                        value={c.original}
                        onChange={e => updateManualCorrection(i, "original", e.target.value)}
                        placeholder="틀린 부분 (원문 그대로)"
                        className="h-7 text-xs"
                      />
                      <Input
                        value={c.corrected}
                        onChange={e => updateManualCorrection(i, "corrected", e.target.value)}
                        placeholder="올바른 표현"
                        className="h-7 text-xs"
                      />
                      <Textarea
                        value={c.explanation}
                        onChange={e => updateManualCorrection(i, "explanation", e.target.value)}
                        placeholder="설명 (선택)"
                        className="min-h-[56px] text-xs resize-y"
                      />
                    </div>
                    <button
                      onClick={() => removeManualCorrection(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {manualCorrections.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">AI 교정 외 추가로 교정할 내용이 있으면 위 버튼을 눌러주세요.</p>
              )}
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
          <div className="flex gap-2 pt-2 items-stretch">
            <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">취소</Button>
            {isWriting && textContent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex-1">
                    <Button
                      onClick={runParaphrase}
                      disabled={!aiResult || paraphraseLoading || !!paraphrase}
                      variant="outline"
                      className="w-full h-9 text-sm gap-1.5 border-[hsl(var(--gold))] text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold)/0.1)] hover:text-[hsl(var(--gold))] disabled:opacity-50"
                    >
                      {paraphraseLoading ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />생성 중...</>
                      ) : paraphrase ? (
                        <><Check className="w-3.5 h-3.5" />모델 에세이 완료</>
                      ) : (
                        <><Wand2 className="w-3.5 h-3.5" />Paraphrasing</>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] text-xs">
                  {!aiResult
                    ? "먼저 'AI 교정하기'를 실행한 후에 활성화됩니다. 학생 글을 한 단계 위 CEFR 레벨로 다시 써서 모델 에세이를 만들어줍니다."
                    : "학생 글의 레벨을 자동 판정한 뒤, 같은 내용을 한 단계 위 CEFR 레벨로 다시 써서 모델 에세이를 만들어줍니다."}
                </TooltipContent>
              </Tooltip>
            )}
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
