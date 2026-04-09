import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

interface FeedbackEntry {
  period_label: string;
  checklist: Record<string, number>;
  comment: string | null;
  suggested_goals: string | null;
  created_at: string;
  instructor_name: string;
}

interface FeedbackHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  feedbacks: FeedbackEntry[];
}

const RATING_LABELS: Record<string, string> = {
  homework_completion: "숙제 완료도",
  class_participation: "수업 참여도",
  learning_attitude: "학습 태도",
  review_preparation: "복습/예습",
  progress_speed: "발전 속도",
};

function MiniStars({ value }: { value: number }) {
  return (
    <div className="flex gap-px">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= value ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`}
        />
      ))}
    </div>
  );
}

export default function FeedbackHistoryModal({ open, onOpenChange, studentName, feedbacks }: FeedbackHistoryModalProps) {
  const periods = useMemo(() => {
    const unique = [...new Set(feedbacks.map((f) => f.period_label))];
    return unique;
  }, [feedbacks]);

  const [currentIdx, setCurrentIdx] = useState(0);

  const selectedPeriod = periods[currentIdx] || "";
  const periodFeedbacks = feedbacks.filter((f) => f.period_label === selectedPeriod);

  const goToPeriod = (dir: -1 | 1) => {
    setCurrentIdx((prev) => Math.max(0, Math.min(periods.length - 1, prev + dir)));
  };

  if (periods.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            {studentName} 피드백 히스토리
          </DialogTitle>
        </DialogHeader>

        {/* Period navigation */}
        <div className="flex items-center justify-center gap-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={currentIdx <= 0}
            onClick={() => goToPeriod(-1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[100px] text-center">
            {selectedPeriod}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={currentIdx >= periods.length - 1}
            onClick={() => goToPeriod(1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Period indicator dots */}
        <div className="flex justify-center gap-1.5">
          {periods.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIdx(idx)}
              className={`w-2 h-2 rounded-full transition-colors ${idx === currentIdx ? "bg-primary" : "bg-muted-foreground/20"}`}
            />
          ))}
        </div>

        {/* Feedback entries for selected period */}
        <div className="space-y-4 mt-2">
          {periodFeedbacks.map((fb, idx) => {
            const cl = (fb.checklist || {}) as Record<string, number>;
            const ratings = Object.values(cl).filter((v) => typeof v === "number" && v > 0);
            const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "–";

            return (
              <div key={idx} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{fb.instructor_name}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(fb.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-yellow-600 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> {avg}
                  </span>
                </div>

                {/* Star ratings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {Object.entries(cl).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-background">
                      <span className="text-xs text-foreground">{RATING_LABELS[key] || key}</span>
                      <MiniStars value={typeof val === "number" ? val : 0} />
                    </div>
                  ))}
                </div>

                {fb.comment && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">코멘트</p>
                    <p className="text-sm text-foreground bg-background rounded-lg px-3 py-2">{fb.comment}</p>
                  </div>
                )}

                {fb.suggested_goals && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-yellow-500" /> AI 추천 학습 목표
                    </p>
                    <p className="text-sm text-foreground bg-yellow-50 dark:bg-yellow-500/5 border border-yellow-200 dark:border-yellow-500/20 rounded-lg px-3 py-2 whitespace-pre-line">
                      {fb.suggested_goals}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
