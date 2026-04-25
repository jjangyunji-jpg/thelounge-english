import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Save, X, ArrowRightCircle, ArrowLeftCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SessionEditModalProps {
  open: boolean;
  onClose: () => void;
  studentName: string;
  rangeStart: string; // YYYY-MM-DD
  rangeEnd: string;   // YYYY-MM-DD
  computedBillable?: number; // current auto-computed billable (4 - prev carryover)
  onSaved?: () => void;
}

interface SessionItem {
  id: string;
  scheduled_at: string;
  ended_at: string | null;
  cancellation_type: string | null;
  reschedule_origin_dates: string[] | null;
  topic: string | null;
  is_carryover: boolean;
  carryover_direction: "prev" | "next" | null;
}

type CarryoverDirection = "prev" | "next" | null;

type StatusKey =
  | "completed"
  | "scheduled"
  | "no_show"
  | "student_cancel"
  | "advance_cancel"
  | "sick"
  | "instructor_cancel";

const STATUS_OPTIONS: { key: StatusKey; label: string; tone: string }[] = [
  { key: "completed", label: "완료", tone: "bg-success/15 text-success border-success/30" },
  { key: "scheduled", label: "예정", tone: "bg-muted text-muted-foreground border-border" },
  { key: "no_show", label: "노쇼", tone: "bg-warning/15 text-warning border-warning/30" },
  { key: "student_cancel", label: "당일취소", tone: "bg-muted text-muted-foreground border-border" },
  { key: "advance_cancel", label: "사전취소", tone: "bg-muted text-muted-foreground border-border" },
  { key: "sick", label: "병결", tone: "bg-muted text-muted-foreground border-border" },
  { key: "instructor_cancel", label: "강사취소", tone: "bg-muted text-muted-foreground border-border" },
];

function deriveStatus(s: SessionItem): StatusKey {
  if (s.cancellation_type === "no_show") return "no_show";
  if (s.cancellation_type === "student_cancel") return "student_cancel";
  if (s.cancellation_type === "advance_cancel") return "advance_cancel";
  if (s.cancellation_type === "sick") return "sick";
  if (s.cancellation_type === "instructor_cancel") return "instructor_cancel";
  
  if (s.ended_at) return "completed";
  return "scheduled";
}

function formatKstDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface PendingEdit {
  status?: StatusKey;
  carryover_direction?: CarryoverDirection;
}

export default function SessionEditModal({
  open,
  onClose,
  studentName,
  rangeStart,
  rangeEnd,
  computedBillable,
  onSaved,
}: SessionEditModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [edits, setEdits] = useState<Record<string, PendingEdit>>({});
  const [billableOverride, setBillableOverride] = useState<number | null>(null);
  const [billableNote, setBillableNote] = useState<string>("");
  const [billableInput, setBillableInput] = useState<string>("");
  const [billableNoteInput, setBillableNoteInput] = useState<string>("");
  const [billableDirty, setBillableDirty] = useState(false);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    const startTs = `${rangeStart}T00:00:00+09:00`;
    const endTs = `${rangeEnd}T23:59:59+09:00`;
    // Wide range to catch makeups whose origin falls inside [rangeStart, rangeEnd]
    const wideStart = new Date(`${rangeStart}T00:00:00+09:00`);
    wideStart.setDate(wideStart.getDate() - 60);
    const wideEnd = new Date(`${rangeEnd}T23:59:59+09:00`);
    wideEnd.setDate(wideEnd.getDate() + 60);
    const [sessRes, originRes, ovRes] = await Promise.all([
      supabase
        .from("class_sessions")
        .select("id, scheduled_at, ended_at, cancellation_type, reschedule_origin_dates, topic, is_carryover, carryover_direction")
        .eq("student_name", studentName)
        .gte("scheduled_at", startTs)
        .lte("scheduled_at", endTs)
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("class_sessions")
        .select("id, scheduled_at, ended_at, cancellation_type, reschedule_origin_dates, topic, is_carryover, carryover_direction")
        .eq("student_name", studentName)
        .gte("scheduled_at", wideStart.toISOString())
        .lte("scheduled_at", wideEnd.toISOString())
        .not("reschedule_origin_dates", "eq", "{}"),
      supabase
        .from("billable_overrides")
        .select("billable_count, note")
        .eq("student_name", studentName)
        .eq("period_start", rangeStart)
        .eq("period_end", rangeEnd)
        .maybeSingle(),
    ]);
    if (sessRes.error) {
      toast({ title: "수업 조회 실패", description: sessRes.error.message, variant: "destructive" });
    }
    // Same logic as SessionCountReport: include sessions whose origins fall in range,
    // exclude in-range sessions whose origins all fall outside the range (they belong to origin month).
    const inRange = (sessRes.data || []) as SessionItem[];
    const inRangeFiltered = inRange.filter(s => {
      const origins = Array.isArray(s.reschedule_origin_dates) ? s.reschedule_origin_dates : [];
      if (origins.length === 0) return true;
      return origins.some(d => d >= rangeStart && d <= rangeEnd);
    });
    const originExtras = ((originRes.data || []) as SessionItem[]).filter(s => {
      if (inRangeFiltered.some(x => x.id === s.id)) return false;
      const origins = Array.isArray(s.reschedule_origin_dates) ? s.reschedule_origin_dates : [];
      return origins.some(d => d >= rangeStart && d <= rangeEnd);
    });
    const list = [...inRangeFiltered, ...originExtras].sort((a, b) =>
      a.scheduled_at.localeCompare(b.scheduled_at)
    );
    setSessions(list);
    setEdits({});
    const ov = ovRes.data as { billable_count: number; note: string | null } | null;
    if (ov) {
      setBillableOverride(ov.billable_count);
      setBillableNote(ov.note || "");
      setBillableInput(String(ov.billable_count));
      setBillableNoteInput(ov.note || "");
    } else {
      setBillableOverride(null);
      setBillableNote("");
      setBillableInput(computedBillable !== undefined ? String(computedBillable) : "");
      setBillableNoteInput("");
    }
    setBillableDirty(false);
    setLoading(false);
  }, [open, studentName, rangeStart, rangeEnd, computedBillable, toast]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = (sessionId: string, status: StatusKey) => {
    setEdits(prev => ({ ...prev, [sessionId]: { ...prev[sessionId], status } }));
  };

  const handleCarryoverDirection = (sessionId: string, current: CarryoverDirection, target: "prev" | "next") => {
    // Toggle: clicking the active direction clears it
    const next: CarryoverDirection = current === target ? null : target;
    setEdits(prev => ({ ...prev, [sessionId]: { ...prev[sessionId], carryover_direction: next } }));
  };

  const handleSave = async () => {
    const changedIds = Object.keys(edits);
    if (changedIds.length === 0 && !billableDirty) {
      toast({ title: "변경된 항목이 없습니다" });
      return;
    }
    setSaving(true);
    try {
      let deletedCount = 0;
      let updatedCount = 0;
      for (const id of changedIds) {
        const edit = edits[id];
        const session = sessions.find(s => s.id === id);
        if (!session) continue;

        // 사전취소: 세션 자체 삭제
        if (edit.status === "advance_cancel") {
          const { error } = await supabase
            .from("class_sessions")
            .delete()
            .eq("id", id);
          if (error) throw error;
          deletedCount += 1;
          continue;
        }

        const update: Record<string, unknown> = {};

        if (edit.status) {
          if (edit.status === "completed") {
            update.cancellation_type = null;
            update.cancellation_resolution = null;
            update.ended_at = session.ended_at || new Date().toISOString();
          } else if (edit.status === "scheduled") {
            update.cancellation_type = null;
            update.cancellation_resolution = null;
            update.ended_at = null;
          } else {
            update.cancellation_type = edit.status;
            update.ended_at = null;
          }
        }

        if (edit.carryover_direction !== undefined) {
          update.carryover_direction = edit.carryover_direction;
          update.is_carryover = edit.carryover_direction !== null;
          // 이월(당월/전월) 설정 시 기존 취소 카테고리를 자동 해제하여 중복 카운트 방지
          // (사용자가 이번 편집에서 명시적으로 status를 지정한 경우는 그 값을 우선)
          if (edit.carryover_direction !== null && edit.status === undefined) {
            update.cancellation_type = null;
            update.cancellation_resolution = null;
            update.ended_at = null;
          }
        }

        const { error } = await supabase
          .from("class_sessions")
          .update(update)
          .eq("id", id);
        if (error) throw error;
        updatedCount += 1;
      }

      // Billable override save / clear
      let billableMsg = "";
      if (billableDirty) {
        const trimmed = billableInput.trim();
        if (trimmed === "") {
          // Clear override (revert to auto-calculated)
          const { error } = await supabase
            .from("billable_overrides")
            .delete()
            .eq("student_name", studentName)
            .eq("period_start", rangeStart)
            .eq("period_end", rangeEnd);
          if (error) throw error;
          billableMsg = "결제대상 자동값 복원";
        } else {
          const num = parseInt(trimmed, 10);
          if (!Number.isFinite(num) || num < 0) throw new Error("결제대상은 0 이상 정수여야 합니다.");
          const { error } = await supabase
            .from("billable_overrides")
            .upsert(
              {
                student_name: studentName,
                period_start: rangeStart,
                period_end: rangeEnd,
                billable_count: num,
                note: billableNoteInput.trim() || null,
              },
              { onConflict: "student_name,period_start,period_end" },
            );
          if (error) throw error;
          billableMsg = `결제대상 ${num}회 저장`;
        }
      }

      const parts: string[] = [];
      if (updatedCount) parts.push(`${updatedCount}건 업데이트`);
      if (deletedCount) parts.push(`${deletedCount}건 삭제(사전취소)`);
      if (billableMsg) parts.push(billableMsg);
      toast({ title: parts.join(" · ") || "처리 완료" });
      onSaved?.();
      onClose();
    } catch (e) {
      const err = e as Error;
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const dirtyCount = Object.keys(edits).length + (billableDirty ? 1 : 0);
  const hasOverride = billableOverride !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            {studentName} — 수업 상태 수정
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{rangeStart} ~ {rangeEnd}</p>
          <p className="text-[11px] text-muted-foreground">
            💡 <span className="font-semibold">전월 이월</span>: 지난달에서 넘어온 수업 (이번 달 카운트 +1).<br />
            ➡️ <span className="font-semibold">당월 이월</span>: 이번 달 수업이 다음달로 이월 (다음달 결제에서 1회 차감).<br />
            🗑️ <span className="font-semibold">사전취소</span>: 직전 월 사전 통보 1회 차감 — 저장 시 세션이 삭제됩니다.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              해당 기간에 수업이 없습니다.
            </p>
          ) : (
            <div className="space-y-2 py-2">
              {sessions.map(s => {
                const editEntry = edits[s.id];
                const currentStatus = editEntry?.status || deriveStatus(s);
                const currentDirection: CarryoverDirection =
                  editEntry?.carryover_direction !== undefined
                    ? editEntry.carryover_direction
                    : (s.carryover_direction ?? (s.is_carryover ? "prev" : null));
                const isMakeup = Array.isArray(s.reschedule_origin_dates) && s.reschedule_origin_dates.length > 0;
                const isDirty = !!editEntry;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "rounded-lg border p-3 space-y-2 transition-colors",
                      isDirty ? "border-primary bg-primary/5" : "border-border bg-card"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-foreground">{formatKstDate(s.scheduled_at)}</span>
                        {isMakeup && (
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                            보강
                          </span>
                        )}
                        {currentDirection === "prev" && (
                          <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground text-[10px] font-semibold border border-accent/30">
                            전월 이월
                          </span>
                        )}
                        {currentDirection === "next" && (
                          <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning text-[10px] font-semibold border border-warning/30">
                            당월 이월
                          </span>
                        )}
                        {s.topic && (
                          <span className="text-muted-foreground truncate max-w-[200px]">· {s.topic}</span>
                        )}
                      </div>
                      {isDirty && (
                        <span className="text-[10px] text-primary font-semibold">변경됨</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => handleStatusChange(s.id, opt.key)}
                          className={cn(
                            "px-2 py-1 rounded border text-[11px] font-semibold transition-colors min-h-[28px]",
                            currentStatus === opt.key
                              ? opt.tone
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <button
                        onClick={() => handleCarryoverDirection(s.id, currentDirection, "prev")}
                        className={cn(
                          "px-2 py-1 rounded border text-[11px] font-semibold transition-colors min-h-[28px] inline-flex items-center gap-1",
                          currentDirection === "prev"
                            ? "bg-accent/20 text-accent-foreground border-accent/40"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        )}
                        title="전월(예: 3월)에서 이월되어 온 수업. 이번 달 결제 카운트에 추가됨"
                      >
                        <ArrowLeftCircle className="w-3 h-3" />
                        전월 이월
                      </button>
                      <button
                        onClick={() => handleCarryoverDirection(s.id, currentDirection, "next")}
                        className={cn(
                          "px-2 py-1 rounded border text-[11px] font-semibold transition-colors min-h-[28px] inline-flex items-center gap-1",
                          currentDirection === "next"
                            ? "bg-warning/20 text-warning border-warning/40"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        )}
                        title="이번 달 수업이지만 다음 달(예: 5월)로 이월. 다음 달 결제 카운트에서 1회 차감됨"
                      >
                        <ArrowRightCircle className="w-3 h-3" />
                        당월 이월
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!loading && (
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-foreground">결제대상 수동 설정</span>
                {hasOverride ? (
                  <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 text-[10px] font-semibold">
                    오버라이드 적용중
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    자동 계산값: {computedBillable ?? "-"}회
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">비워두면 자동 계산값 사용</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                min={0}
                value={billableInput}
                onChange={e => { setBillableInput(e.target.value); setBillableDirty(true); }}
                placeholder={computedBillable !== undefined ? String(computedBillable) : "0"}
                className="w-20 h-8 px-2 rounded border border-input bg-background text-xs"
              />
              <span className="text-xs text-muted-foreground">회</span>
              <input
                type="text"
                value={billableNoteInput}
                onChange={e => { setBillableNoteInput(e.target.value); setBillableDirty(true); }}
                placeholder="메모 (선택)"
                className="flex-1 min-w-[160px] h-8 px-2 rounded border border-input bg-background text-xs"
              />
              {hasOverride && (
                <button
                  onClick={() => { setBillableInput(""); setBillableNoteInput(""); setBillableDirty(true); }}
                  className="text-[10px] text-muted-foreground underline hover:text-foreground"
                >
                  자동값으로 복원
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {dirtyCount > 0 ? `${dirtyCount}개 변경 대기` : "변경 사항 없음"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              <X className="w-3.5 h-3.5" /> 취소
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || dirtyCount === 0}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              저장
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
