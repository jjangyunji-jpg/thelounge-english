import { X, PenLine, Mic, Paperclip, ExternalLink, MessageSquare, BookOpen, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file";
const HW_META: Record<HwType, { label: string; icon: React.ElementType; color: string }> = {
  writing:    { label: "쓰기",       icon: PenLine,    color: "text-amber-600" },
  reading:    { label: "읽기",       icon: BookOpen,   color: "text-orange-500" },
  speaking:   { label: "말하기",     icon: Mic,        color: "text-rose-500" },
  memorizing: { label: "외우기",     icon: Brain,      color: "text-violet-500" },
  file:       { label: "파일올리기", icon: Paperclip,  color: "text-blue-500" },
};

interface CorrectionItem {
  original: string;
  corrected: string;
  explanation: string;
}

interface AIResult {
  corrected: string;
  errors: CorrectionItem[];
  feedback: { praise: string; priorities: string[] };
  score: number;
}

interface Props {
  assignmentTitle: string;
  assignmentType: string;
  textContent: string | null;
  audioUrl: string | null;
  fileUrl: string | null;
  instructorNote: string | null;
  reviewedAt: string | null;
  aiCorrection: AIResult | null;
  onClose: () => void;
}

/** Render inline diff: strikethrough original, colored corrected */
function InlineCorrectedText({ original, errors }: { original: string; errors: CorrectionItem[] }) {
  if (!errors || errors.length === 0) {
    return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{original}</p>;
  }

  let remaining = original;
  const parts: React.ReactNode[] = [];
  let key = 0;

  const sortedErrors = [...errors].sort((a, b) => {
    const posA = remaining.toLowerCase().indexOf(a.original.toLowerCase());
    const posB = remaining.toLowerCase().indexOf(b.original.toLowerCase());
    return posA - posB;
  });

  for (const err of sortedErrors) {
    const idx = remaining.toLowerCase().indexOf(err.original.toLowerCase());
    if (idx === -1) continue;
    if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
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
  if (remaining) parts.push(<span key={key++}>{remaining}</span>);

  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{parts}</p>;
}

export default function HomeworkFeedbackModal({
  assignmentTitle,
  assignmentType,
  textContent,
  audioUrl,
  fileUrl,
  instructorNote,
  reviewedAt,
  aiCorrection,
  onClose,
}: Props) {
  const meta = HW_META[assignmentType as HwType] ?? HW_META.writing;
  const Icon = meta.icon;

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
            <p className="text-xs text-muted-foreground mt-0.5">
              {meta.label} 숙제 · {reviewedAt ? `${new Date(reviewedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" })} 검토됨` : "검토됨"}
              {aiCorrection && (
                <span className="ml-2 text-[hsl(var(--navy))] font-semibold">자연스러움 {aiCorrection.score}/10</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
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

            {textContent && (
              <div className="rounded-lg border border-border bg-muted/10 p-4">
                {aiCorrection?.errors?.length ? (
                  <InlineCorrectedText original={textContent} errors={aiCorrection.errors} />
                ) : (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{textContent}</p>
                )}
              </div>
            )}

            {!textContent && !audioUrl && !fileUrl && (
              <p className="text-xs text-muted-foreground">제출 내용 없음</p>
            )}
          </div>

          {/* Error details */}
          {aiCorrection?.errors?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">교정 상세</p>
              <div className="space-y-1.5">
                {aiCorrection.errors.map((err: CorrectionItem, i: number) => (
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

          {!instructorNote && !aiCorrection && (
            <div className="rounded-lg border border-border bg-muted/10 p-4 text-center">
              <p className="text-xs text-muted-foreground">피드백 메시지가 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
