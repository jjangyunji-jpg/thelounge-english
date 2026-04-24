import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, Sparkles, ChevronLeft, ChevronRight, Pencil, Check, X, Loader2, Edit3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FeedbackEntry {
  id: string;
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
  /** Name of the instructor currently viewing. Used to gate edit capability. Pass empty string to disable editing. */
  currentInstructorName?: string;
  /** Label of the active schedule period. When a feedback's period matches this, bulk editing is enabled for the instructor's own entries. */
  currentPeriodLabel?: string;
  /** Called after a successful edit so the caller can refresh the list. */
  onUpdated?: () => void | Promise<void>;
}

type DraftEntry = {
  checklist: Record<string, number>;
  needs_consultation: boolean;
  comment: string;
  goals: string;
};

const RATING_ITEMS = [
  { key: "homework_completion", label: "숙제 완료도" },
  { key: "class_participation", label: "수업 참여도" },
  { key: "learning_attitude", label: "학습 태도" },
  { key: "review_preparation", label: "복습/예습" },
  { key: "progress_speed", label: "발전 속도" },
];

const RATING_LABELS: Record<string, string> = Object.fromEntries(
  RATING_ITEMS.map((r) => [r.key, r.label]),
);

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
            className={`w-4 h-4 transition-colors ${
              star <= value ? "text-gold fill-gold" : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackHistoryModal({
  open,
  onOpenChange,
  studentName,
  feedbacks,
  currentInstructorName = "",
  currentPeriodLabel = "",
  onUpdated,
}: FeedbackHistoryModalProps) {
  const { toast } = useToast();
  const periods = useMemo(() => {
    const unique = [...new Set(feedbacks.map((f) => f.period_label))];
    return unique;
  }, [feedbacks]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editChecklist, setEditChecklist] = useState<Record<string, number>>({});
  const [editNeedsConsultation, setEditNeedsConsultation] = useState(false);
  const [editComment, setEditComment] = useState("");
  const [editGoals, setEditGoals] = useState("");
  const [saving, setSaving] = useState(false);

  // Bulk edit state (applies to the currently-viewed period)
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, DraftEntry>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  // Reset editing state when modal reopens or student changes
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setCurrentIdx(0);
      setBulkEditing(false);
      setBulkDrafts({});
    }
  }, [open, studentName]);

  const selectedPeriod = periods[currentIdx] || "";
  const periodFeedbacks = feedbacks.filter((f) => f.period_label === selectedPeriod);

  // Feedback entries in the current period that this instructor can edit
  const ownEditablePeriodFbs = useMemo(
    () =>
      periodFeedbacks.filter(
        (fb) => !!currentInstructorName && fb.instructor_name === currentInstructorName,
      ),
    [periodFeedbacks, currentInstructorName],
  );

  const isCurrentPeriod =
    !!currentPeriodLabel && selectedPeriod === currentPeriodLabel;
  const canBulkEdit = isCurrentPeriod && ownEditablePeriodFbs.length > 0;

  const goToPeriod = (dir: -1 | 1) => {
    if (bulkEditing) return;
    setCurrentIdx((prev) => Math.max(0, Math.min(periods.length - 1, prev + dir)));
    setEditingId(null);
  };

  const buildDraftFromFb = (fb: FeedbackEntry): DraftEntry => {
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
  };

  const startBulkEdit = () => {
    const drafts: Record<string, DraftEntry> = {};
    ownEditablePeriodFbs.forEach((fb) => {
      drafts[fb.id] = buildDraftFromFb(fb);
    });
    setBulkDrafts(drafts);
    setBulkEditing(true);
    setEditingId(null);
  };

  const cancelBulkEdit = () => {
    setBulkEditing(false);
    setBulkDrafts({});
  };

  const updateDraft = (id: string, patch: Partial<DraftEntry>) => {
    setBulkDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveBulkEdit = async () => {
    const ids = Object.keys(bulkDrafts);
    if (ids.length === 0) {
      setBulkEditing(false);
      return;
    }
    setBulkSaving(true);
    const results = await Promise.all(
      ids.map((id) => {
        const d = bulkDrafts[id];
        const checklist = { ...d.checklist, needs_consultation: d.needs_consultation };
        return supabase
          .from("instructor_student_feedback" as any)
          .update({
            checklist,
            comment: d.comment.trim() || null,
            suggested_goals: d.goals.trim() || null,
          })
          .eq("id", id);
      }),
    );
    setBulkSaving(false);
    const failed = results.filter((r: any) => r.error);
    if (failed.length > 0) {
      toast({
        title: "일부 저장 실패",
        description: `${failed.length}건 저장 중 오류가 발생했습니다.`,
        variant: "destructive",
      });
      return;
    }
    toast({ title: `${ids.length}건의 피드백이 저장되었습니다 ✓` });
    setBulkEditing(false);
    setBulkDrafts({});
    await onUpdated?.();
  };

  const startEdit = (fb: FeedbackEntry) => {
    const d = buildDraftFromFb(fb);
    setEditChecklist(d.checklist);
    setEditNeedsConsultation(d.needs_consultation);
    setEditComment(d.comment);
    setEditGoals(d.goals);
    setEditingId(fb.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (fb: FeedbackEntry) => {
    setSaving(true);
    const checklist = {
      ...editChecklist,
      needs_consultation: editNeedsConsultation,
    };
    const { error } = await supabase
      .from("instructor_student_feedback" as any)
      .update({
        checklist,
        comment: editComment.trim() || null,
        suggested_goals: editGoals.trim() || null,
      })
      .eq("id", fb.id);
    setSaving(false);
    if (error) {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "피드백이 수정되었습니다 ✓" });
    setEditingId(null);
    await onUpdated?.();
  };

  if (periods.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={bulkEditing ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            {studentName} 피드백 히스토리
          </DialogTitle>
        </DialogHeader>

        {/* Period navigation + bulk edit button */}
        <div className="px-6 shrink-0">
          <div className="flex items-center justify-center gap-3 py-2 relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={bulkEditing || currentIdx <= 0}
              onClick={() => goToPeriod(-1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground min-w-[100px] text-center">
              {selectedPeriod}
              {isCurrentPeriod && (
                <span className="ml-1 text-[10px] text-gold font-normal">(이번 달)</span>
              )}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={bulkEditing || currentIdx >= periods.length - 1}
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
                disabled={bulkEditing}
                onClick={() => { setCurrentIdx(idx); setEditingId(null); }}
                className={`w-2 h-2 rounded-full transition-colors disabled:opacity-40 ${idx === currentIdx ? "bg-primary" : "bg-muted-foreground/20"}`}
              />
            ))}
          </div>

          {/* Bulk edit toggle */}
          {canBulkEdit && !bulkEditing && editingId === null && (
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={startBulkEdit}
                className="h-7 gap-1 text-xs"
                title="이번 달 내가 작성한 피드백 모두 편집"
              >
                <Edit3 className="w-3 h-3" />
                전체 편집 ({ownEditablePeriodFbs.length})
              </Button>
            </div>
          )}
          {bulkEditing && (
            <div className="flex items-center justify-center pt-2">
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Edit3 className="w-3 h-3" /> 일괄 편집 모드 · {Object.keys(bulkDrafts).length}건
              </Badge>
            </div>
          )}
        </div>

        {/* Feedback entries for selected period */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4">
          {periodFeedbacks.map((fb) => {
            const cl = (fb.checklist || {}) as Record<string, any>;
            const ratings = Object.entries(cl)
              .filter(([k, v]) => k !== "needs_consultation" && typeof v === "number" && v > 0)
              .map(([, v]) => v as number);
            const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "–";
            const isEditing = editingId === fb.id;
            const canEdit = !!currentInstructorName && fb.instructor_name === currentInstructorName;
            const bulkDraft = bulkEditing ? bulkDrafts[fb.id] : undefined;
            const isBulkEditingThis = !!bulkDraft;

            return (
              <div
                key={fb.id}
                className={`rounded-lg border p-4 space-y-3 ${
                  isBulkEditingThis
                    ? "border-gold/40 bg-gold/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{fb.instructor_name}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(fb.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-gold text-gold" /> {avg}
                    </span>
                    {canEdit && !isEditing && !bulkEditing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => startEdit(fb)}
                        title="수정"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {isBulkEditingThis ? (
                  <>
                    {/* Bulk editable ratings */}
                    <div className="space-y-2">
                      {RATING_ITEMS.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-background border border-border"
                        >
                          <span className="text-xs text-foreground">{item.label}</span>
                          <EditableStars
                            value={bulkDraft.checklist[item.key] || 0}
                            onChange={(v) =>
                              updateDraft(fb.id, {
                                checklist: { ...bulkDraft.checklist, [item.key]: v },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        updateDraft(fb.id, { needs_consultation: !bulkDraft.needs_consultation })
                      }
                      className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors text-left ${
                        bulkDraft.needs_consultation
                          ? "border-destructive/50 bg-destructive/5"
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        bulkDraft.needs_consultation
                          ? "bg-destructive border-destructive"
                          : "border-muted-foreground/40"
                      }`}>
                        {bulkDraft.needs_consultation && <Check className="w-2.5 h-2.5 text-destructive-foreground" />}
                      </div>
                      <span className="text-xs text-foreground">상담 필요</span>
                    </button>

                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">코멘트</p>
                      <textarea
                        value={bulkDraft.comment}
                        onChange={(e) => updateDraft(fb.id, { comment: e.target.value })}
                        rows={3}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="코멘트 입력"
                      />
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-gold" /> 제안 학습 목표
                      </p>
                      <textarea
                        value={bulkDraft.goals}
                        onChange={(e) => updateDraft(fb.id, { goals: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="학습 목표 (선택)"
                      />
                    </div>
                  </>
                ) : isEditing ? (
                  <>
                    {/* Editable ratings (single-card edit) */}
                    <div className="space-y-2">
                      {RATING_ITEMS.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-background border border-border"
                        >
                          <span className="text-xs text-foreground">{item.label}</span>
                          <EditableStars
                            value={editChecklist[item.key] || 0}
                            onChange={(v) => setEditChecklist((prev) => ({ ...prev, [item.key]: v }))}
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditNeedsConsultation(!editNeedsConsultation)}
                      className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors text-left ${
                        editNeedsConsultation
                          ? "border-destructive/50 bg-destructive/5"
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        editNeedsConsultation
                          ? "bg-destructive border-destructive"
                          : "border-muted-foreground/40"
                      }`}>
                        {editNeedsConsultation && <Check className="w-2.5 h-2.5 text-destructive-foreground" />}
                      </div>
                      <span className="text-xs text-foreground">상담 필요</span>
                    </button>

                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">코멘트</p>
                      <textarea
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="코멘트 입력"
                      />
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-gold" /> 제안 학습 목표
                      </p>
                      <textarea
                        value={editGoals}
                        onChange={(e) => setEditGoals(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="학습 목표 (선택)"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={saving}
                        className="gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> 취소
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveEdit(fb)}
                        disabled={saving}
                        className="bg-gold hover:bg-gold/90 text-accent-foreground font-bold gap-1"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        저장
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Read-only ratings */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {RATING_ITEMS.map((item) => (
                        <div key={item.key} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-background">
                          <span className="text-xs text-foreground">{item.label}</span>
                          <MiniStars value={typeof cl[item.key] === "number" ? cl[item.key] : 0} />
                        </div>
                      ))}
                    </div>

                    {cl.needs_consultation && (
                      <div className="px-2.5 py-1.5 rounded-lg border border-destructive/40 bg-destructive/5 text-xs text-destructive font-medium">
                        상담 필요
                      </div>
                    )}

                    {fb.comment && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1">코멘트</p>
                        <p className="text-sm text-foreground bg-background rounded-lg px-3 py-2 whitespace-pre-line">{fb.comment}</p>
                      </div>
                    )}

                    {fb.suggested_goals && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-gold" /> AI 추천 학습 목표
                        </p>
                        <p className="text-sm text-foreground bg-gold/10 border border-gold/20 rounded-lg px-3 py-2 whitespace-pre-line">
                          {fb.suggested_goals}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Sticky bulk save footer */}
        {bulkEditing && (
          <div className="shrink-0 border-t border-border bg-background px-6 py-3 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {Object.keys(bulkDrafts).length}건을 한 번에 저장합니다
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelBulkEdit}
                disabled={bulkSaving}
                className="gap-1"
              >
                <X className="w-3.5 h-3.5" /> 취소
              </Button>
              <Button
                size="sm"
                onClick={saveBulkEdit}
                disabled={bulkSaving}
                className="bg-gold hover:bg-gold/90 text-accent-foreground font-bold gap-1"
              >
                {bulkSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                모두 저장
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
