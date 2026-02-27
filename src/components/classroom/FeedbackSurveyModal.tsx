import { useState, useEffect } from "react";
import { Star, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FeedbackCategory {
  id: string;
  key: string;
  label: string;
  description: string;
  sort_order: number;
}

interface Props {
  studentName: string;
  instructorName: string;
  periodId: string;
  periodLabel: string;
  onComplete: () => void;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-7 h-7 transition-colors ${
              n <= (hover || value)
                ? "text-gold fill-gold"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackSurveyModal({ studentName, instructorName, periodId, periodLabel, onComplete }: Props) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<FeedbackCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("feedback_categories")
        .select("id,key,label,description,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      const cats = data || [];
      setCategories(cats);
      const initial: Record<string, number> = {};
      cats.forEach(c => { initial[c.key] = 0; });
      setRatings(initial);
      setLoadingCats(false);
    })();
  }, []);

  const totalSteps = categories.length + 1; // categories + comment step
  const allRated = categories.every(c => (ratings[c.key] || 0) > 0);
  const currentCategory = step < categories.length ? categories[step] : null;

  const handleSubmit = async () => {
    if (!allRated) {
      toast({ title: "모든 항목을 평가해주세요", variant: "destructive" });
      return;
    }
    setSaving(true);

    // Build legacy columns + JSONB ratings
    const insertData: Record<string, unknown> = {
      student_name: studentName,
      instructor_name: instructorName,
      period_id: periodId,
      period_label: periodLabel,
      satisfaction: ratings["satisfaction"] || 0,
      teaching_quality: ratings["teaching_quality"] || 0,
      communication: ratings["communication"] || 0,
      lesson_preparation: ratings["lesson_preparation"] || 0,
      ratings: ratings,
      comment: comment.trim() || null,
    };

    const { error } = await supabase.from("class_feedback").insert(insertData as any);

    if (error) {
      toast({ title: "제출 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "피드백이 제출되었습니다. 감사합니다! 🎉" });
      onComplete();
    }
    setSaving(false);
  };

  if (loadingCats) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy to-navy-light p-5">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-gold" />
            <span className="text-[10px] font-bold text-gold uppercase tracking-widest">수업 피드백</span>
          </div>
          <p className="text-primary-foreground font-bold text-lg">{periodLabel} 수업 평가</p>
          <p className="text-primary-foreground/70 text-xs mt-1">담당 강사: {instructorName}</p>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4">
          <div className="flex gap-1">
            {[...Array(totalSteps)].map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-gold" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{step + 1} / {totalSteps}</p>
        </div>

        {/* Content */}
        <div className="p-5 min-h-[180px] flex flex-col items-center justify-center">
          {currentCategory ? (
            <div className="text-center space-y-4">
              <div>
                <p className="font-semibold text-foreground text-base">{currentCategory.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{currentCategory.description}</p>
              </div>
              <StarRating
                value={ratings[currentCategory.key] || 0}
                onChange={(v) => {
                  setRatings(prev => ({ ...prev, [currentCategory.key]: v }));
                  setTimeout(() => setStep(s => Math.min(s + 1, totalSteps - 1)), 300);
                }}
              />
              <div className="flex gap-1 justify-center text-[10px] text-muted-foreground">
                <span>매우 불만족</span>
                <span className="mx-4">보통</span>
                <span>매우 만족</span>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-3">
              <div>
                <p className="font-semibold text-foreground text-base text-center">자유 의견</p>
                <p className="text-xs text-muted-foreground mt-1 text-center">수업에 대한 의견이나 개선점을 자유롭게 작성해주세요 (선택)</p>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="의견을 자유롭게 작성해주세요..."
                className="w-full h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {/* Rating summary */}
              <div className="grid grid-cols-2 gap-2">
                {categories.map(cat => (
                  <div key={cat.key} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-muted/50">
                    <span className="text-[10px] text-muted-foreground">{cat.label}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className={`w-2.5 h-2.5 ${n <= (ratings[cat.key] || 0) ? "text-gold fill-gold" : "text-muted-foreground/20"}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
              이전
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={currentCategory ? (ratings[currentCategory.key] || 0) === 0 : false}
              className="flex-1 bg-navy hover:bg-navy-light text-primary-foreground"
            >
              다음
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={saving || !allRated}
              className="flex-1 bg-gold hover:bg-gold/90 text-foreground font-bold"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              제출하기
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
