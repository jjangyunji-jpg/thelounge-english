import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatStudentName } from "@/lib/formatStudentName";
import {
  ChevronLeft, ChevronRight, Star, MessageSquare, TrendingUp,
  Edit3, Loader2, Sparkles, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Types ────────────────────────────────────────────────────────────────────
interface SchedulePeriod {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface ClassFeedbackRow {
  id: string;
  student_name: string;
  period_label: string;
  ratings: Record<string, number> | null;
  comment: string | null;
  created_at: string;
}

interface StudentFeedbackRow {
  id: string;
  student_name: string;
  period_label: string;
  checklist: Record<string, any>;
  comment: string | null;
  suggested_goals: string | null;
  instructor_name: string;
  created_at: string;
}

interface Props {
  instructorName: string;
  allPeriods: SchedulePeriod[];
}

const RATING_ITEMS = [
  { key: "homework_completion", label: "숙제 완료도" },
  { key: "class_participation", label: "수업 참여도" },
  { key: "learning_attitude", label: "학습 태도" },
  { key: "review_preparation", label: "복습/예습" },
  { key: "progress_speed", label: "발전 속도" },
];

function MiniStars({ value }: { value: number }) {
  return (
    <div className="flex gap-px">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn("w-3 h-3", s <= value ? "text-gold fill-gold" : "text-muted-foreground/20")}
        />
      ))}
    </div>
  );
}

function EditableStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
            className={cn(
              "w-3.5 h-3.5 transition-colors",
              star <= value ? "text-gold fill-gold" : "text-muted-foreground/30",
            )}
          />
        </button>
      ))}
    </div>
  );
}

type SubTab = "from_students" | "to_students";

export default function InstructorFeedbackTab({ instructorName, allPeriods }: Props) {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>("from_students");
  const [periodIdx, setPeriodIdx] = useState<number>(-1);

  // Initialize to latest period once
  useEffect(() => {
    if (allPeriods.length > 0 && periodIdx < 0) {
      // Default to the active period if found, else latest
      const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
      const activeIdx = allPeriods.findIndex(p => p.start_date <= todayStr && p.end_date >= todayStr);
      setPeriodIdx(activeIdx >= 0 ? activeIdx : allPeriods.length - 1);
    }
  }, [allPeriods, periodIdx]);

  const currentPeriod = periodIdx >= 0 && periodIdx < allPeriods.length ? allPeriods[periodIdx] : null;

  return (
    <div className="space-y-4">
      {/* Sub-tab header */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setSubTab("from_students")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            subTab === "from_students"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          학생 → 강사 피드백
        </button>
        <button
          onClick={() => setSubTab("to_students")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            subTab === "to_students"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          강사 → 학생 피드백
        </button>
      </div>

      {/* Shared period navigator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPeriodIdx((i) => Math.max(0, i - 1))}
            disabled={periodIdx <= 0}
            className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-bold text-foreground min-w-[80px] text-center">
            {currentPeriod?.label || "—"}
            {currentPeriod?.is_active && (
              <span className="ml-1 text-[10px] text-gold font-normal">(이번 달)</span>
            )}
          </span>
          <button
            onClick={() => setPeriodIdx((i) => Math.min(allPeriods.length - 1, i + 1))}
            disabled={periodIdx >= allPeriods.length - 1}
            className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {subTab === "from_students" ? (
        <FromStudentsSection instructorName={instructorName} period={currentPeriod} />
      ) : (
        <ToStudentsSection instructorName={instructorName} period={currentPeriod} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 학생 → 강사 피드백 (기존 로직 이식)
// ─────────────────────────────────────────────────────────────────────────────

function FromStudentsSection({
  instructorName,
  period,
}: {
  instructorName: string;
  period: SchedulePeriod | null;
}) {
  const [categories, setCategories] = useState<{ key: string; label: string }[]>([]);
  const [feedbackData, setFeedbackData] = useState<ClassFeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [catRes, fbRes] = await Promise.all([
        supabase.from("feedback_categories").select("key,label").eq("is_active", true).order("sort_order"),
        (() => {
          let q = supabase
            .from("class_feedback")
            .select("*")
            .eq("instructor_name", instructorName)
            .order("created_at", { ascending: false });
          if (period?.id) q = q.eq("period_id", period.id);
          return q;
        })(),
      ]);
      if (cancelled) return;
      setCategories((catRes.data as any) || []);
      setFeedbackData((fbRes.data as any) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [instructorName, period?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (feedbackData.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        이 기간의 피드백이 아직 없습니다
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <span className="text-xs text-muted-foreground">응답 {feedbackData.length}건</span>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-navy" />
          평균 평점
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map((cat) => {
            const values = feedbackData
              .map((fb) => (fb.ratings as Record<string, number> | null)?.[cat.key] ?? 0)
              .filter((v) => v > 0);
            const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            return (
              <div key={cat.key} className="rounded-lg bg-muted/50 p-3 text-center space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium">{cat.label}</p>
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 text-gold fill-gold" />
                  <span className="text-lg font-bold text-foreground">{avg.toFixed(1)}</span>
                </div>
                <p className="text-[9px] text-muted-foreground">{values.length}명 응답</p>
              </div>
            );
          })}
        </div>
        {(() => {
          const allValues = feedbackData.flatMap((fb) => {
            const r = fb.ratings as Record<string, number> | null;
            if (!r) return [];
            return Object.values(r).filter((v) => typeof v === "number" && v > 0) as number[];
          });
          const overallAvg = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;
          return (
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs font-semibold text-foreground">종합 평균</span>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={cn("w-3.5 h-3.5", n <= Math.round(overallAvg) ? "text-gold fill-gold" : "text-muted-foreground/20")} />
                  ))}
                </div>
                <span className="text-sm font-bold text-foreground">{overallAvg.toFixed(1)}</span>
                <span className="text-[10px] text-muted-foreground">/ 5.0</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Individual */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-navy" />
          개별 피드백
        </h3>
        {[...feedbackData]
          .sort((a, b) => {
            const hasComment = (fb: ClassFeedbackRow) => (fb.comment?.trim() ? 1 : 0);
            const commentDiff = hasComment(b) - hasComment(a);
            if (commentDiff !== 0) return commentDiff;
            const avgScore = (fb: ClassFeedbackRow) => {
              const r = fb.ratings as Record<string, number> | null;
              if (!r) return 0;
              const vals = Object.values(r).filter((v) => typeof v === "number" && v > 0) as number[];
              return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
            };
            return avgScore(a) - avgScore(b);
          })
          .map((fb) => {
            const ratings = fb.ratings as Record<string, number> | null;
            return (
              <div key={fb.id} className="rounded-lg border border-border bg-card p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{formatStudentName(fb.student_name)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(fb.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const val = ratings?.[cat.key] ?? 0;
                    return (
                      <div key={cat.key} className="flex items-center gap-1 text-[10px]">
                        <span className="text-muted-foreground">{cat.label}</span>
                        <div className="flex gap-px">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={cn("w-2.5 h-2.5", n <= val ? "text-gold fill-gold" : "text-muted-foreground/20")} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {fb.comment && (
                  <p className="text-xs text-foreground/80 bg-muted/30 rounded-md px-3 py-2 italic">"{fb.comment}"</p>
                )}
              </div>
            );
          })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 강사 → 학생 피드백 (테이블 + 인라인/일괄 편집)
// ─────────────────────────────────────────────────────────────────────────────

type DraftEntry = {
  checklist: Record<string, number>;
  needs_consultation: boolean;
  comment: string;
  goals: string;
};

function buildDraft(fb: StudentFeedbackRow): DraftEntry {
  const cl = (fb.checklist || {}) as Record<string, any>;
  const ratings: Record<string, number> = {};
  RATING_ITEMS.forEach((r) => {
    ratings[r.key] = typeof cl[r.key] === "number" ? cl[r.key] : 0;
  });
  return {
    checklist: ratings,
    needs_consultation: !!cl.needs_consultation,
    comment: fb.comment || "",
    goals: fb.suggested_goals || "",
  };
}

function ToStudentsSection({
  instructorName,
  period,
}: {
  instructorName: string;
  period: SchedulePeriod | null;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<StudentFeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftEntry>>({});
  const [bulkEditing, setBulkEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    const { data } = await supabase
      .from("instructor_student_feedback" as any)
      .select("id, student_name, period_label, checklist, comment, suggested_goals, instructor_name, created_at")
      .eq("instructor_name", instructorName)
      .eq("period_label", period.label)
      .order("created_at", { ascending: false });
    setRows(((data as any) || []) as StudentFeedbackRow[]);
    setEditingId(null);
    setBulkEditing(false);
    setDrafts({});
    setLoading(false);
  }, [instructorName, period?.id, period?.label]);

  useEffect(() => {
    load();
  }, [load]);

  const isCurrentPeriod = !!period?.is_active;

  const startIndividualEdit = (fb: StudentFeedbackRow) => {
    setDrafts({ [fb.id]: buildDraft(fb) });
    setEditingId(fb.id);
    setBulkEditing(false);
  };

  const startBulkEdit = () => {
    const next: Record<string, DraftEntry> = {};
    rows.forEach((fb) => {
      next[fb.id] = buildDraft(fb);
    });
    setDrafts(next);
    setBulkEditing(true);
    setEditingId(null);
  };

  const cancelAll = () => {
    setDrafts({});
    setEditingId(null);
    setBulkEditing(false);
  };

  const patchDraft = (id: string, patch: Partial<DraftEntry>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveOne = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    setSaving(true);
    const { error } = await supabase
      .from("instructor_student_feedback" as any)
      .update({
        checklist: { ...d.checklist, needs_consultation: d.needs_consultation },
        comment: d.comment.trim() || null,
        suggested_goals: d.goals.trim() || null,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "피드백이 수정되었습니다 ✓" });
    await load();
  };

  const saveBulk = async () => {
    const ids = Object.keys(drafts);
    if (ids.length === 0) return;
    setSaving(true);
    const results = await Promise.all(
      ids.map((id) => {
        const d = drafts[id];
        return supabase
          .from("instructor_student_feedback" as any)
          .update({
            checklist: { ...d.checklist, needs_consultation: d.needs_consultation },
            comment: d.comment.trim() || null,
            suggested_goals: d.goals.trim() || null,
          })
          .eq("id", id);
      }),
    );
    setSaving(false);
    const failed = results.filter((r: any) => r.error);
    if (failed.length > 0) {
      toast({ title: "일부 저장 실패", description: `${failed.length}건 저장 중 오류가 발생했습니다.`, variant: "destructive" });
      return;
    }
    toast({ title: `${ids.length}건의 피드백이 저장되었습니다 ✓` });
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        이 기간에 작성한 학생 피드백이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {rows.length}명 · {bulkEditing ? "일괄 편집 모드" : editingId ? "개별 편집 모드" : "조회 모드"}
        </span>
        <div className="flex items-center gap-2">
          {!bulkEditing && !editingId && isCurrentPeriod && (
            <Button variant="outline" size="sm" onClick={startBulkEdit} className="h-8 gap-1 text-xs">
              <Edit3 className="w-3 h-3" /> 전체 편집 ({rows.length})
            </Button>
          )}
          {(bulkEditing || editingId) && (
            <>
              <Button variant="ghost" size="sm" onClick={cancelAll} disabled={saving} className="h-8 text-xs">
                취소
              </Button>
              {bulkEditing ? (
                <Button size="sm" onClick={saveBulk} disabled={saving} className="h-8 gap-1 text-xs bg-gold hover:bg-gold/90 text-foreground">
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />} 모두 저장
                </Button>
              ) : (
                editingId && (
                  <Button size="sm" onClick={() => saveOne(editingId)} disabled={saving} className="h-8 gap-1 text-xs">
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />} 저장
                  </Button>
                )
              )}
            </>
          )}
        </div>
      </div>

      {!isCurrentPeriod && (
        <p className="text-[11px] text-muted-foreground italic">
          지난 기간은 개별 편집만 가능합니다 (행의 ✏️ 아이콘 클릭).
        </p>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium whitespace-nowrap">학생</th>
                {RATING_ITEMS.map((r) => (
                  <th key={r.key} className="px-2 py-2 font-medium whitespace-nowrap text-center">
                    {r.label}
                  </th>
                ))}
                <th className="px-2 py-2 font-medium whitespace-nowrap text-center">상담</th>
                <th className="px-3 py-2 font-medium">코멘트</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap text-center">수정</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((fb) => {
                const isEditingThis = bulkEditing || editingId === fb.id;
                const d = drafts[fb.id];
                const cl = (fb.checklist || {}) as Record<string, any>;
                return (
                  <tr
                    key={fb.id}
                    className={cn(
                      "border-t border-border align-top",
                      isEditingThis ? "bg-gold/5" : "hover:bg-muted/30",
                    )}
                  >
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                      {formatStudentName(fb.student_name)}
                    </td>
                    {RATING_ITEMS.map((item) => (
                      <td key={item.key} className="px-2 py-2 text-center">
                        {isEditingThis && d ? (
                          <div className="flex justify-center">
                            <EditableStars
                              value={d.checklist[item.key] || 0}
                              onChange={(v) => patchDraft(fb.id, { checklist: { ...d.checklist, [item.key]: v } })}
                            />
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <MiniStars value={(cl[item.key] as number) || 0} />
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center">
                      {isEditingThis && d ? (
                        <button
                          type="button"
                          onClick={() => patchDraft(fb.id, { needs_consultation: !d.needs_consultation })}
                          className={cn(
                            "w-5 h-5 rounded border inline-flex items-center justify-center transition-colors",
                            d.needs_consultation
                              ? "bg-destructive border-destructive"
                              : "border-muted-foreground/40 hover:border-muted-foreground",
                          )}
                          title="상담 필요"
                        >
                          {d.needs_consultation && <Check className="w-3 h-3 text-destructive-foreground" />}
                        </button>
                      ) : cl.needs_consultation ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-destructive/10 text-destructive">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-[240px]">
                      {isEditingThis && d ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={d.comment}
                            onChange={(e) => patchDraft(fb.id, { comment: e.target.value })}
                            rows={2}
                            placeholder="코멘트"
                            className="w-full rounded border border-input bg-background px-2 py-1 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <div className="flex items-start gap-1">
                            <Sparkles className="w-3 h-3 text-gold mt-1 shrink-0" />
                            <textarea
                              value={d.goals}
                              onChange={(e) => patchDraft(fb.id, { goals: e.target.value })}
                              rows={2}
                              placeholder="제안 학습 목표"
                              className="w-full rounded border border-input bg-background px-2 py-1 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {fb.comment ? (
                            <p className="text-foreground/80 italic">"{fb.comment}"</p>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                          {fb.suggested_goals && (
                            <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                              <Sparkles className="w-3 h-3 text-gold mt-0.5 shrink-0" />
                              <span>{fb.suggested_goals}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {!bulkEditing && editingId !== fb.id && (
                        <button
                          onClick={() => startIndividualEdit(fb)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="수정"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
