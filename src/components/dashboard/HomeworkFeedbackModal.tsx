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

interface Props {
  assignmentTitle: string;
  assignmentType: string;
  textContent: string | null;
  audioUrl: string | null;
  fileUrl: string | null;
  instructorNote: string | null;
  reviewedAt: string | null;
  onClose: () => void;
}

export default function HomeworkFeedbackModal({
  assignmentTitle,
  assignmentType,
  textContent,
  audioUrl,
  fileUrl,
  instructorNote,
  reviewedAt,
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
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* My submission */}
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
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{textContent}</p>
              </div>
            )}

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

          {!instructorNote && (
            <div className="rounded-lg border border-border bg-muted/10 p-4 text-center">
              <p className="text-xs text-muted-foreground">피드백 메시지가 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
