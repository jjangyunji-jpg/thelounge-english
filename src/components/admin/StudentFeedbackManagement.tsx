import { useState, useEffect } from "react";
import { Target, Star, ChevronDown, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


interface SchedulePeriod {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface FeedbackRecord {
  id: string;
  instructor_name: string;
  student_name: string;
  period_id: string | null;
  period_label: string;
  checklist: Record<string, number>;
  comment: string | null;
  suggested_goals: string | null;
  applied_goals: boolean;
  created_at: string;
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
          className={`w-3.5 h-3.5 ${s <= value ? "text-gold fill-gold" : "text-muted-foreground/20"}`}
        />
      ))}
    </div>
  );
}

export default function StudentFeedbackManagement() {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructorFilter, setInstructorFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentPeriodIdx = periods.findIndex((p) => p.id === selectedPeriodId);
  const instructorNames = [...new Set(feedbacks.map((f) => f.instructor_name))].sort();

  const goToPeriod = (dir: -1 | 1) => {
    const nextIdx = currentPeriodIdx + dir;
    if (nextIdx >= 0 && nextIdx < periods.length) {
      setSelectedPeriodId(periods[nextIdx].id);
    }
  };

  useEffect(() => { loadPeriods(); }, []);
  useEffect(() => { if (selectedPeriodId) loadFeedbacks(); }, [selectedPeriodId]);

  const loadPeriods = async () => {
    const { data } = await supabase.from("schedule_periods").select("*").order("start_date", { ascending: false });
    const list = (data || []) as SchedulePeriod[];
    setPeriods(list);
    const active = list.find((p) => p.is_active);
    if (active) setSelectedPeriodId(active.id);
    else if (list.length > 0) setSelectedPeriodId(list[0].id);
    setLoading(false);
  };

  const loadFeedbacks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("instructor_student_feedback" as any)
      .select("*")
      .eq("period_id", selectedPeriodId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "데이터 로딩 실패", description: error.message, variant: "destructive" });
    } else {
      setFeedbacks((data || []) as unknown as FeedbackRecord[]);
    }
    setLoading(false);
  };

  const deleteFeedback = async (id: string) => {
    if (!confirm("이 피드백을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("instructor_student_feedback" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "삭제됨" });
      setFeedbacks((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const filtered = instructorFilter === "all" ? feedbacks : feedbacks.filter((f) => f.instructor_name === instructorFilter);
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);

  // Stats — compute average star rating
  const allRatings = filtered.flatMap((f) => Object.values(f.checklist || {}).filter((v) => typeof v === "number" && v > 0));
  const avgRating = allRatings.length > 0 ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1) : "–";
  const withGoals = filtered.filter((f) => f.suggested_goals?.trim()).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Target className="w-5 h-5 text-gold" />
          강사 → 학생 피드백
        </h2>
        <p className="text-sm text-muted-foreground mt-1">강사가 학생에 대해 작성한 월말 피드백을 확인합니다</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">수업 기간</label>
          <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
            <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="기간 선택" /></SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label} {p.is_active ? "(현재)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">강사</label>
          <Select value={instructorFilter} onValueChange={setInstructorFilter}>
            <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {instructorNames.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "피드백 수", value: `${filtered.length}건`, color: "text-navy" },
          { label: "평균 별점", value: `${avgRating} / 5`, color: "text-gold-dark" },
          { label: "목표 제안", value: `${withGoals}건`, color: "text-gold-dark" },
          { label: "강사 수", value: `${instructorNames.length}명`, color: "text-navy" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-3.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {selectedPeriod ? `${selectedPeriod.label} 기간에 작성된 피드백이 없습니다` : "기간을 선택해주세요"}
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            const grouped: Record<string, FeedbackRecord[]> = {};
            filtered.forEach((fb) => {
              if (!grouped[fb.instructor_name]) grouped[fb.instructor_name] = [];
              grouped[fb.instructor_name].push(fb);
            });
            return Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([instructorName, fbs]) => {
                const instrRatings = fbs.flatMap((f) => Object.values(f.checklist || {}).filter((v) => typeof v === "number" && v > 0));
                const instrAvg = instrRatings.length > 0 ? (instrRatings.reduce((a, b) => a + b, 0) / instrRatings.length).toFixed(1) : "–";

                return (
                  <div key={instructorName} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <h3 className="text-sm font-bold text-foreground">{instructorName}</h3>
                      <Badge variant="secondary" className="text-[10px]">{fbs.length}명</Badge>
                      <span className="text-[10px] font-medium text-gold-dark flex items-center gap-1">
                        <Star className="w-3 h-3 fill-gold text-gold" /> {instrAvg}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {fbs.map((fb) => {
                        const cl = fb.checklist || {};
                        const ratings = Object.values(cl).filter((v) => typeof v === "number" && v > 0);
                        const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "–";
                        const isExpanded = expandedId === fb.id;

                        return (
                          <Card key={fb.id} className="overflow-hidden">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                              className="w-full text-left p-4 flex items-center gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm text-foreground">{fb.student_name}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(fb.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-xs font-medium text-gold-dark flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-gold text-gold" /> {avg} / 5
                                  </span>
                                  {fb.comment && (
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">💬 {fb.comment}</span>
                                  )}
                                  {fb.suggested_goals && (
                                    <span className="text-[10px] text-gold-dark flex items-center gap-0.5">
                                      <Sparkles className="w-3 h-3" /> 목표 제안
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </button>

                            {isExpanded && (
                              <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                                {/* Ratings */}
                                <div className="space-y-1.5">
                                  <p className="text-xs font-semibold text-muted-foreground">별점 평가</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {Object.entries(cl).map(([key, val]) => (
                                      <div key={key} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-muted/30">
                                        <span className="text-xs text-foreground">{RATING_LABELS[key] || key}</span>
                                        <MiniStars value={typeof val === "number" ? val : 0} />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {fb.comment && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">코멘트</p>
                                    <p className="text-sm text-foreground bg-muted/30 rounded-lg px-3 py-2">{fb.comment}</p>
                                  </div>
                                )}

                                {fb.suggested_goals && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                                      <Sparkles className="w-3 h-3 text-gold" /> AI 추천 학습 목표
                                    </p>
                                    <p className="text-sm text-foreground bg-gold/5 border border-gold/20 rounded-lg px-3 py-2 whitespace-pre-line">
                                      {fb.suggested_goals}
                                    </p>
                                  </div>
                                )}

                                <div className="flex justify-end">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive text-xs"
                                    onClick={() => deleteFeedback(fb.id)}
                                  >
                                    삭제
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              });
          })()}
        </div>
      )}
    </div>
  );
}
