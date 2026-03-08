import { useState, useEffect } from "react";
import { MessageSquareHeart, Star, ChevronLeft, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
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
  student_name: string;
  instructor_name: string;
  period_label: string;
  period_id: string | null;
  satisfaction: number;
  teaching_quality: number;
  communication: number;
  lesson_preparation: number;
  ratings: Record<string, number> | null;
  comment: string | null;
  created_at: string;
}

interface FeedbackCategory {
  key: string;
  label: string;
}

function MiniStars({ value }: { value: number }) {
  return (
    <div className="flex gap-px">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= value ? "text-gold fill-gold" : "text-muted-foreground/20"}`} />
      ))}
    </div>
  );
}

export default function ClassFeedbackManagement() {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [categories, setCategories] = useState<FeedbackCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructorFilter, setInstructorFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentPeriodIdx = periods.findIndex((p) => p.id === selectedPeriodId);
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);
  const instructorNames = [...new Set(feedbacks.map((f) => f.instructor_name))].sort();

  const goToPeriod = (dir: -1 | 1) => {
    const nextIdx = currentPeriodIdx + dir;
    if (nextIdx >= 0 && nextIdx < periods.length) {
      setSelectedPeriodId(periods[nextIdx].id);
    }
  };

  useEffect(() => { loadPeriods(); loadCategories(); }, []);
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

  const loadCategories = async () => {
    const { data } = await supabase
      .from("feedback_categories")
      .select("key, label")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    setCategories(data || []);
  };

  const loadFeedbacks = async () => {
    setLoading(true);
    const period = periods.find((p) => p.id === selectedPeriodId);
    if (!period) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("class_feedback")
      .select("*")
      .eq("period_label", period.label)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "데이터 로딩 실패", description: error.message, variant: "destructive" });
    } else {
      setFeedbacks((data || []) as unknown as FeedbackRecord[]);
    }
    setLoading(false);
  };

  const filtered = instructorFilter === "all" ? feedbacks : feedbacks.filter((f) => f.instructor_name === instructorFilter);

  // Group by instructor
  const byInstructor: Record<string, FeedbackRecord[]> = {};
  filtered.forEach((f) => {
    if (!byInstructor[f.instructor_name]) byInstructor[f.instructor_name] = [];
    byInstructor[f.instructor_name].push(f);
  });

  // Overall stats
  const getAvg = (records: FeedbackRecord[]) => {
    if (records.length === 0) return 0;
    const allScores: number[] = [];
    records.forEach((f) => {
      if (f.ratings && typeof f.ratings === "object") {
        Object.values(f.ratings).forEach((v) => { if (typeof v === "number" && v > 0) allScores.push(v); });
      } else {
        [f.satisfaction, f.teaching_quality, f.communication, f.lesson_preparation].forEach((v) => {
          if (v > 0) allScores.push(v);
        });
      }
    });
    return allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  };

  const overallAvg = getAvg(filtered);
  const withComments = filtered.filter((f) => f.comment?.trim()).length;

  // Sort: with comments first, then by avg score ascending, then by date ascending
  const sortedInstructors = Object.entries(byInstructor).sort(([, a], [, b]) => {
    const aHasComment = a.some((f) => f.comment?.trim());
    const bHasComment = b.some((f) => f.comment?.trim());
    if (aHasComment !== bHasComment) return aHasComment ? -1 : 1;
    const avgDiff = getAvg(a) - getAvg(b);
    if (avgDiff !== 0) return avgDiff;
    const aLatest = Math.max(...a.map((f) => new Date(f.created_at).getTime()));
    const bLatest = Math.max(...b.map((f) => new Date(f.created_at).getTime()));
    return aLatest - bLatest;
  });

  // Sort individual feedback records within each instructor group
  Object.values(byInstructor).forEach((records) => {
    records.sort((a, b) => {
      const aHas = !!a.comment?.trim();
      const bHas = !!b.comment?.trim();
      if (aHas !== bHas) return aHas ? -1 : 1;
      const aAvg = a.ratings ? Object.values(a.ratings as Record<string, number>).reduce((s, v) => s + v, 0) / Object.values(a.ratings as Record<string, number>).length : (a.satisfaction + a.teaching_quality + a.communication + a.lesson_preparation) / 4;
      const bAvg = b.ratings ? Object.values(b.ratings as Record<string, number>).reduce((s, v) => s + v, 0) / Object.values(b.ratings as Record<string, number>).length : (b.satisfaction + b.teaching_quality + b.communication + b.lesson_preparation) / 4;
      if (aAvg !== bAvg) return aAvg - bAvg;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <MessageSquareHeart className="w-5 h-5 text-gold" />
          학생 → 강사 피드백
        </h2>
        <p className="text-sm text-muted-foreground mt-1">학생이 강사에 대해 작성한 수업 만족도 피드백을 확인합니다</p>
      </div>

      {/* Period Navigation + Instructor Filter */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPeriodIdx >= periods.length - 1} onClick={() => goToPeriod(1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[120px] text-center">
            {selectedPeriod ? selectedPeriod.label : "—"}
            {selectedPeriod?.is_active && <Badge variant="secondary" className="ml-1.5 text-[10px] py-0">현재</Badge>}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPeriodIdx <= 0} onClick={() => goToPeriod(-1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          {["all", ...instructorNames].map((name) => (
            <Button
              key={name}
              variant={instructorFilter === name ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setInstructorFilter(name)}
            >
              {name === "all" ? "전체" : name}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "피드백 수", value: `${filtered.length}건`, color: "text-navy" },
          { label: "평균 점수", value: overallAvg > 0 ? overallAvg.toFixed(1) : "–", color: "text-gold" },
          { label: "강사 수", value: `${Object.keys(byInstructor).length}명`, color: "text-foreground" },
          { label: "비고 작성", value: `${withComments}건`, color: "text-foreground" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</p>
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Feedback by instructor */}
      {!loading && sortedInstructors.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">이 기간에 작성된 피드백이 없습니다</p>
      )}

      {!loading && sortedInstructors.map(([instructorName, records]) => {
        const avg = getAvg(records);
        return (
          <Card key={instructorName} className="border-border overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between bg-muted/30 border-b border-border">
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-foreground">{instructorName}</p>
                <Badge variant="outline" className="text-[10px]">{records.length}건</Badge>
                <div className="flex items-center gap-1">
                  <Star className={`w-3.5 h-3.5 ${avg >= 4 ? "text-gold fill-gold" : avg >= 3 ? "text-amber-400 fill-amber-400" : "text-red-400 fill-red-400"}`} />
                  <span className="text-xs font-semibold">{avg > 0 ? avg.toFixed(1) : "–"}</span>
                </div>
              </div>
            </div>
            <CardContent className="p-0 divide-y divide-border">
              {records.map((fb) => {
                const isExpanded = expandedId === fb.id;
                const ratingEntries = fb.ratings && typeof fb.ratings === "object"
                  ? Object.entries(fb.ratings as Record<string, number>)
                  : [];
                const catLabels = categories.reduce<Record<string, string>>((acc, c) => { acc[c.key] = c.label; return acc; }, {});

                return (
                  <div key={fb.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-foreground">{fb.student_name}</span>
                        {fb.comment?.trim() && <Badge variant="secondary" className="text-[9px] px-1.5">비고</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(fb.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-2">
                        {ratingEntries.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {ratingEntries.map(([key, score]) => (
                              <div key={key} className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-muted-foreground">{catLabels[key] || key}</span>
                                <MiniStars value={score} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">수업 만족도</span><MiniStars value={fb.satisfaction} /></div>
                            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">수업 질</span><MiniStars value={fb.teaching_quality} /></div>
                            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">소통</span><MiniStars value={fb.communication} /></div>
                            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">수업 준비</span><MiniStars value={fb.lesson_preparation} /></div>
                          </div>
                        )}
                        {fb.comment?.trim() && (
                          <div className="p-2 rounded bg-muted/50 text-xs text-foreground">{fb.comment}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
