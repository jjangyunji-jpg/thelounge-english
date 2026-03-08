import { useState, useEffect } from "react";
import { Target, Star, ChevronDown, Loader2, Filter, CheckCircle, Circle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  checklist: Record<string, boolean>;
  comment: string | null;
  suggested_goals: string | null;
  applied_goals: boolean;
  created_at: string;
}

const CHECKLIST_LABELS: Record<string, string> = {
  homework_completion: "숙제 완료도",
  class_participation: "수업 참여도",
  learning_attitude: "학습 태도",
  review_preparation: "복습/예습",
  progress_speed: "발전 속도",
};

export default function StudentFeedbackManagement() {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructorFilter, setInstructorFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Unique instructor names from feedbacks
  const instructorNames = [...new Set(feedbacks.map((f) => f.instructor_name))].sort();

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) loadFeedbacks();
  }, [selectedPeriodId]);

  const loadPeriods = async () => {
    const { data } = await supabase
      .from("schedule_periods")
      .select("*")
      .order("start_date", { ascending: false });
    const list = (data || []) as SchedulePeriod[];
    setPeriods(list);
    // Default to latest period
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

  // Stats
  const totalChecked = filtered.reduce((sum, f) => {
    const cl = f.checklist || {};
    return sum + Object.values(cl).filter(Boolean).length;
  }, 0);
  const totalItems = filtered.reduce((sum, f) => {
    const cl = f.checklist || {};
    return sum + Object.keys(cl).length;
  }, 0);
  const avgRate = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;
  const withGoals = filtered.filter((f) => f.suggested_goals?.trim()).length;

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="기간 선택" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label} {p.is_active ? "(현재)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">강사</label>
          <Select value={instructorFilter} onValueChange={setInstructorFilter}>
            <SelectTrigger className="w-32 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {instructorNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "피드백 수", value: `${filtered.length}건`, color: "text-navy" },
          { label: "평균 달성률", value: `${avgRate}%`, color: avgRate >= 70 ? "text-success" : avgRate >= 40 ? "text-gold-dark" : "text-destructive" },
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
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {selectedPeriod ? `${selectedPeriod.label} 기간에 작성된 피드백이 없습니다` : "기간을 선택해주세요"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((fb) => {
            const cl = fb.checklist || {};
            const checked = Object.values(cl).filter(Boolean).length;
            const total = Object.keys(cl).length;
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
                      <Badge variant="outline" className="text-[10px]">{fb.instructor_name}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(fb.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-xs font-medium ${checked === total ? "text-success" : checked >= total / 2 ? "text-gold-dark" : "text-destructive"}`}>
                        체크 {checked}/{total}
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
                    {/* Checklist */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground">체크리스트</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {Object.entries(cl).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30">
                            {val ? (
                              <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                            )}
                            <span className="text-xs text-foreground">{CHECKLIST_LABELS[key] || key}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Comment */}
                    {fb.comment && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">코멘트</p>
                        <p className="text-sm text-foreground bg-muted/30 rounded-lg px-3 py-2">{fb.comment}</p>
                      </div>
                    )}

                    {/* Suggested Goals */}
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

                    {/* Delete */}
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
      )}
    </div>
  );
}
