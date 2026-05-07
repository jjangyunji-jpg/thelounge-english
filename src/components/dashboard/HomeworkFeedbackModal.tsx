import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, PenLine, Mic, Paperclip, ExternalLink, MessageSquare, BookOpen, Brain, Monitor, HelpCircle, Undo2, Loader2, Wand2, ArrowUp, Volume2, Square } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file" | "watching";
const HW_META: Record<HwType, { label: string; icon: React.ElementType; color: string }> = {
  writing:    { label: "쓰기",       icon: PenLine,    color: "text-amber-600" },
  reading:    { label: "읽기",       icon: BookOpen,   color: "text-orange-500" },
  speaking:   { label: "말하기",     icon: Mic,        color: "text-rose-500" },
  memorizing: { label: "외우기",     icon: Brain,      color: "text-violet-500" },
  file:       { label: "파일올리기", icon: Paperclip,  color: "text-blue-500" },
  watching:   { label: "시청하기",   icon: Monitor,    color: "text-rose-500" },
};

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
  feedback: { praise: string; priorities: string[] };
  score: number;
  english_level?: string;
  vocab_level?: string;
  paraphrase?: ParaphraseResult | null;
}

interface Props {
  assignmentTitle: string;
  assignmentType: string;
  assignmentDescription?: string | null;
  textContent: string | null;
  audioUrl: string | null;
  fileUrl: string | null;
  instructorNote: string | null;
  reviewedAt: string | null;
  aiCorrection: AIResult | null;
  onClose: () => void;
  /** If provided, show "Cancel Review" button (instructor only) */
  onUnreview?: () => Promise<void>;
  /** If provided, show "수정하기" button (student can edit submitted hw) */
  onEdit?: () => void;
}

/** Render inline diff: strikethrough original, colored corrected */
const InlineCorrectedText = React.forwardRef<HTMLDivElement, { original: string; errors: CorrectionItem[] }>(function InlineCorrectedText({ original, errors }, ref) {
  if (!errors || errors.length === 0) {
    return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{original}</p>;
  }

  let remaining = original;
  const parts: React.ReactNode[] = [];
  let key = 0;
  let errorIndex = 0;

  const sortedErrors = [...errors].sort((a, b) => {
    const posA = original.toLowerCase().indexOf(a.original.toLowerCase());
    const posB = original.toLowerCase().indexOf(b.original.toLowerCase());
    return posA - posB;
  });

  const matchedErrors: { err: CorrectionItem; index: number }[] = [];

  for (const err of sortedErrors) {
    const idx = remaining.toLowerCase().indexOf(err.original.toLowerCase());
    if (idx === -1) continue;
    errorIndex++;
    matchedErrors.push({ err, index: errorIndex });
    if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
    parts.push(
      <span key={key++} className="inline-flex items-baseline gap-0.5">
        <span className="line-through text-destructive/70 decoration-destructive/50">{remaining.slice(idx, idx + err.original.length)}</span>
        <span className="text-[hsl(var(--navy))] font-semibold">{err.corrected}</span>
        <sup className="text-[9px] text-muted-foreground font-bold ml-0.5">{errorIndex}</sup>
      </span>
    );
    remaining = remaining.slice(idx + err.original.length);
  }
  if (remaining) parts.push(<span key={key++}>{remaining}</span>);

  return (
    <div ref={ref} className="space-y-3">
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{parts}</p>
      {matchedErrors.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          {matchedErrors.map(({ err, index }) => (
            <div key={index} className="flex gap-2 text-xs">
              <span className="text-muted-foreground font-bold shrink-0 w-4 text-right">{index}.</span>
              <span className="text-foreground">
                <span className="line-through text-destructive/60">{err.original}</span>
                {" → "}
                <span className="text-[hsl(var(--navy))] font-semibold">{err.corrected}</span>
                <span className="text-muted-foreground ml-1.5">— {err.explanation}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default function HomeworkFeedbackModal({
  assignmentTitle,
  assignmentType,
  assignmentDescription,
  textContent,
  audioUrl,
  fileUrl,
  instructorNote,
  reviewedAt,
  aiCorrection,
  onClose,
  onUnreview,
  onEdit,
}: Props) {
  const meta = HW_META[assignmentType as HwType] ?? HW_META.writing;
  const Icon = meta.icon;
  const [unreviewLoading, setUnreviewLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card rounded-t-2xl border-b border-border px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Icon className={cn("w-4 h-4", meta.color)} />
              {assignmentTitle}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center flex-wrap gap-x-1">
              <span>{meta.label} 숙제</span>
              <span>·</span>
              <span>{reviewedAt ? `${new Date(reviewedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" })} 검토됨` : aiCorrection || instructorNote ? "검토됨" : "제출됨 (검토 대기중)"}</span>
              {aiCorrection && (
                <span className="ml-2 flex items-center gap-1.5 flex-wrap text-[hsl(var(--navy))] font-semibold">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 cursor-help">
                        자연스러움 {aiCorrection.score}/10
                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                      원어민이 자연스럽게 느끼는 정도를 1~10점으로 평가합니다. 7점 이상이면 자연스러운 영어입니다.
                    </TooltipContent>
                  </Tooltip>
                  {aiCorrection.english_level && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-0.5 cursor-help">
                          · 영어 {aiCorrection.english_level}
                          <HelpCircle className="w-3 h-3 text-muted-foreground" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                        CEFR 기준 영어 숙련도입니다. A1(입문)→A2(초급)→B1(중급)→B2(중상급)→C1(상급)→C2(원어민급)
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {aiCorrection.vocab_level && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-0.5 cursor-help">
                          · 어휘 {aiCorrection.vocab_level}
                          <HelpCircle className="w-3 h-3 text-muted-foreground" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                        사용된 어휘의 난이도입니다. 초급→중급→중상급→고급 순으로 다양하고 정확한 어휘 사용을 평가합니다.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Assignment description */}
          {assignmentDescription && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                숙제 내용
              </p>
              <div className="rounded-lg border border-border bg-muted/10 p-3">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{assignmentDescription}</p>
              </div>
            </div>
          )}

          {/* Submission with inline corrections */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">내 제출물</p>

            {audioUrl && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <audio controls src={audioUrl} className="w-full h-8" />
              </div>
            )}

            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors group">
                <Paperclip className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-xs font-medium text-foreground flex-1 truncate group-hover:text-blue-500 transition-colors">첨부파일 보기</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </a>
            )}

            {textContent && aiCorrection?.errors?.length ? (
              <Tabs defaultValue="inline" className="w-full">
                <TabsList className="w-full h-8">
                  <TabsTrigger value="inline" className="flex-1 text-xs h-7">교정 보기</TabsTrigger>
                  <TabsTrigger value="original" className="flex-1 text-xs h-7">원문</TabsTrigger>
                  <TabsTrigger value="corrected" className="flex-1 text-xs h-7">교정문</TabsTrigger>
                </TabsList>
                <TabsContent value="inline">
                  <div className="rounded-lg border border-border bg-muted/10 p-4">
                    <InlineCorrectedText original={textContent} errors={aiCorrection.errors} />
                  </div>
                </TabsContent>
                <TabsContent value="original">
                  <div className="rounded-lg border border-border bg-muted/10 p-4">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{textContent}</p>
                  </div>
                </TabsContent>
                <TabsContent value="corrected">
                  <div className="rounded-lg border border-border bg-muted/10 p-4">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{aiCorrection.corrected}</p>
                  </div>
                </TabsContent>
              </Tabs>
            ) : textContent ? (
              <div className="rounded-lg border border-border bg-muted/10 p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{textContent}</p>
              </div>
            ) : null}

            {!textContent && !audioUrl && !fileUrl && (
              <p className="text-xs text-muted-foreground">제출 내용 없음</p>
            )}
          </div>



          {/* Instructor feedback */}
          {instructorNote && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                강사 피드백
              </p>
              <div className="rounded-lg border border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.05)] p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{instructorNote}</p>
              </div>
            </div>
          )}

          {/* Paraphrase: Model essay one level above */}
          {aiCorrection?.paraphrase && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Wand2 className="w-3 h-3 text-[hsl(var(--gold))]" />
                모델 에세이
                <span className="inline-flex items-center gap-0.5 ml-1 normal-case tracking-normal">
                  <span className="text-[10px] text-muted-foreground">{aiCorrection.paraphrase.detected_level}</span>
                  <ArrowUp className="w-2.5 h-2.5 text-[hsl(var(--gold))]" />
                  <span className="text-[10px] font-bold text-[hsl(var(--gold))]">{aiCorrection.paraphrase.target_level}</span>
                </span>
              </p>
              <div className="rounded-lg border border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.05)] p-4 space-y-3">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {aiCorrection.paraphrase.paraphrased}
                </p>
                {aiCorrection.paraphrase.key_improvements?.length > 0 && (
                  <div className="space-y-1 pt-3 border-t border-[hsl(var(--gold)/0.2)]">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">핵심 개선점</p>
                    {aiCorrection.paraphrase.key_improvements.map((imp, i) => (
                      <p key={i} className="text-xs text-foreground/85 leading-relaxed">
                        <span className="font-bold text-[hsl(var(--gold))]">{i + 1}.</span> {imp}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!instructorNote && !aiCorrection && !onEdit && (
            <div className="rounded-lg border border-border bg-muted/10 p-4 text-center">
              <p className="text-xs text-muted-foreground">피드백 메시지가 없습니다</p>
            </div>
          )}

          {/* Edit button for submitted (not yet reviewed) homework */}
          {onEdit && (
            <div className="pt-2 border-t border-border flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => { onClose(); onEdit(); }}
              >
                <PenLine className="w-3.5 h-3.5" />
                수정하기
              </Button>
            </div>
          )}

          {/* Unreview button (instructor only) */}
          {onUnreview && (
            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={unreviewLoading}
                onClick={async () => {
                  setUnreviewLoading(true);
                  try {
                    await onUnreview();
                  } finally {
                    setUnreviewLoading(false);
                  }
                }}
              >
                {unreviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                검토 취소
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
