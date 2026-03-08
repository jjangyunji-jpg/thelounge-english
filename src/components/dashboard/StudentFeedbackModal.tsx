import { useState } from "react";
import { Loader2, Sparkles, Target, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StudentPeriodSummary from "./StudentPeriodSummary";

interface StudentInfo {
  student_name: string;
  level: string | null;
  learning_objective: string | null;
}

interface Props {
  instructorName: string;
  students: StudentInfo[];
  periodId: string;
  periodLabel: string;
  periodStartDate?: string;
  periodEndDate?: string;
  onComplete: () => void;
  onClose: () => void;
}

const RATING_ITEMS = [
  { key: "homework_completion", label: "숙제 완료도", description: "숙제를 성실히 제출했는가" },
  { key: "class_participation", label: "수업 참여도", description: "수업 중 적극적으로 참여했는가" },
  { key: "learning_attitude", label: "학습 태도", description: "수업에 집중하고 성실한 태도를 보였는가" },
  { key: "review_preparation", label: "복습/예습", description: "이전 수업 내용을 복습하고 왔는가" },
  { key: "progress_speed", label: "발전 속도", description: "기대 수준만큼 실력이 향상되었는가" },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? 0 : star)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              star <= value
                ? "text-gold fill-gold"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function StudentFeedbackModal({
  instructorName,
  students,
  periodId,
  periodLabel,
  periodStartDate,
  periodEndDate,
  onComplete,
  onClose,
}: Props) {
  const { toast } = useToast();
  type FeedbackEntry = { checklist: Record<string, number>; comment: string; suggestedGoals: string; loadingAI: boolean };
  const [currentIdx, setCurrentIdx] = useState(0);
  const [feedbacks, setFeedbacks] = useState<Record<string, FeedbackEntry>>(() => {
    const init: Record<string, FeedbackEntry> = {};
    students.forEach((s) => {
      init[s.student_name] = {
        checklist: Object.fromEntries(RATING_ITEMS.map((c) => [c.key, 0])),
        comment: "",
        suggestedGoals: "",
        loadingAI: false,
      };
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [showGoals, setShowGoals] = useState(false);

  const student = students[currentIdx];
  const fb = feedbacks[student.student_name];

  const setRating = (key: string, value: number) => {
    setFeedbacks((prev) => ({
      ...prev,
      [student.student_name]: {
        ...prev[student.student_name],
        checklist: {
          ...prev[student.student_name].checklist,
          [key]: value,
        },
      },
    }));
  };

  const setComment = (v: string) => {
    setFeedbacks((prev) => ({
      ...prev,
      [student.student_name]: { ...prev[student.student_name], comment: v },
    }));
  };

  const requestAIGoals = async () => {
    setFeedbacks((prev) => ({
      ...prev,
      [student.student_name]: { ...prev[student.student_name], loadingAI: true },
    }));

    try {
      const ratings = RATING_ITEMS.map((c) => ({
        label: c.label,
        score: fb.checklist[c.key] || 0,
      }));

      const { data, error } = await supabase.functions.invoke("suggest-student-goals", {
        body: {
          student_name: student.student_name,
          level: student.level || "B1",
          current_objective: student.learning_objective || "",
          ratings,
          comment: fb.comment,
          period_label: periodLabel,
        },
      });

      if (error) throw error;
      const goals = data?.goals || "";
      setFeedbacks((prev) => ({
        ...prev,
        [student.student_name]: { ...prev[student.student_name], suggestedGoals: goals, loadingAI: false },
      }));
      setShowGoals(true);
    } catch (e: any) {
      toast({ title: "AI 제안 실패", description: e.message, variant: "destructive" });
      setFeedbacks((prev) => ({
        ...prev,
        [student.student_name]: { ...prev[student.student_name], loadingAI: false },
      }));
    }
  };

  const handleSubmitAll = async () => {
    setSaving(true);
    const rows = students.map((s) => ({
      instructor_name: instructorName,
      student_name: s.student_name,
      period_id: periodId,
      period_label: periodLabel,
      checklist: feedbacks[s.student_name].checklist,
      comment: feedbacks[s.student_name].comment.trim() || null,
      suggested_goals: feedbacks[s.student_name].suggestedGoals.trim() || null,
    }));

    const { error } = await supabase.from("instructor_student_feedback" as any).upsert(rows as any, {
      onConflict: "instructor_name,student_name,period_id",
    });

    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${students.length}명의 학생 피드백이 저장되었습니다 ✓` });
      onComplete();
    }
    setSaving(false);
  };

  const applyGoalsToStudent = async () => {
    if (!fb.suggestedGoals.trim()) return;
    const { error } = await supabase
      .from("instructor_students")
      .update({ learning_objective: fb.suggestedGoals.trim() })
      .eq("student_name", student.student_name)
      .eq("instructor_name", instructorName);

    if (error) {
      toast({ title: "목표 적용 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${student.student_name} 학습 목표 업데이트됨 ✓` });
    }
  };

  const totalSteps = students.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy to-navy-light p-5">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-gold" />
            <span className="text-[10px] font-bold text-gold uppercase tracking-widest">학생 피드백</span>
          </div>
          <p className="text-primary-foreground font-bold text-lg">{periodLabel} 학생 평가</p>
          <p className="text-primary-foreground/70 text-xs mt-1">
            {student.student_name} ({currentIdx + 1}/{totalSteps})
          </p>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4">
          <div className="flex gap-1">
            {students.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${i <= currentIdx ? "bg-gold" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {!showGoals ? (
            <>
              {/* Star Ratings */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">평가 항목</p>
                {RATING_ITEMS.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.description}</p>
                    </div>
                    <StarRating
                      value={fb.checklist[item.key] as number}
                      onChange={(v) => setRating(item.key, v)}
                    />
                  </div>
                ))}
              </div>

              {/* Comment */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">코멘트 (선택)</p>
                <textarea
                  value={fb.comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="학생의 수업 성과나 개선점을 자유롭게 작성해주세요..."
                  className="w-full h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </>
          ) : (
            /* AI Suggested Goals view */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gold" />
                <p className="text-sm font-semibold text-foreground">AI 추천 학습 목표</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <textarea
                  value={fb.suggestedGoals}
                  onChange={(e) =>
                    setFeedbacks((prev) => ({
                      ...prev,
                      [student.student_name]: { ...prev[student.student_name], suggestedGoals: e.target.value },
                    }))
                  }
                  className="w-full h-28 bg-transparent text-sm resize-none focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">AI가 제안한 목표를 수정할 수 있습니다. 적용 시 학생의 장기 학습 목표에 반영됩니다.</p>
              <Button
                onClick={applyGoalsToStudent}
                disabled={!fb.suggestedGoals.trim()}
                className="w-full bg-gold hover:bg-gold/90 text-foreground font-bold"
              >
                <Target className="w-4 h-4 mr-2" /> 학습 목표에 적용
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          {showGoals ? (
            <Button variant="outline" onClick={() => setShowGoals(false)} className="flex-1">
              피드백으로 돌아가기
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
                나중에
              </Button>
              <Button
                variant="outline"
                onClick={requestAIGoals}
                disabled={fb.loadingAI}
                className="gap-1"
              >
                {fb.loadingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI 목표 제안
              </Button>
            </>
          )}
          <div className="flex-1" />
          {currentIdx > 0 && !showGoals && (
            <Button variant="outline" onClick={() => { setCurrentIdx((i) => i - 1); setShowGoals(false); }}>
              이전
            </Button>
          )}
          {currentIdx < totalSteps - 1 && !showGoals ? (
            <Button
              onClick={() => { setCurrentIdx((i) => i + 1); setShowGoals(false); }}
              className="bg-navy hover:bg-navy-light text-primary-foreground"
            >
              다음 학생
            </Button>
          ) : !showGoals ? (
            <Button
              onClick={handleSubmitAll}
              disabled={saving}
              className="bg-gold hover:bg-gold/90 text-foreground font-bold"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              전체 저장
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
