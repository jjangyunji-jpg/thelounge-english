import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { autoGenerateSessions } from "@/lib/autoGenerateSessions";

const DAYS_OF_WEEK = ["월", "화", "수", "목", "금", "토", "일"];
const HOURS = Array.from({ length: 17 }, (_, i) => `${(i + 6).toString().padStart(2, "0")}:00`);

interface ScheduleSlot { day: string; time: string; frequency?: string }

interface EditTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  fromInstructor: string;
  toInstructor: string;
  oldRecordId: string;
  newRecordId: string;
  currentTransferDate: string;
  currentSchedules: ScheduleSlot[];
  onUpdated: () => void;
}

export default function EditTransferModal({
  open, onOpenChange, studentName, fromInstructor, toInstructor,
  oldRecordId, newRecordId, currentTransferDate, currentSchedules, onUpdated,
}: EditTransferModalProps) {
  const { toast } = useToast();
  const [transferDate, setTransferDate] = useState<Date | undefined>(undefined);
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [schedDay, setSchedDay] = useState("월");
  const [schedTime, setSchedTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTransferDate(currentTransferDate ? new Date(currentTransferDate + "T00:00:00+09:00") : undefined);
      setSchedules([...currentSchedules]);
    }
  }, [open, currentTransferDate, currentSchedules]);

  const addSlot = () => {
    if (schedules.some(s => s.day === schedDay && s.time === schedTime)) return;
    setSchedules(prev => [...prev, { day: schedDay, time: schedTime, frequency: "weekly" }]);
  };
  const removeSlot = (idx: number) => setSchedules(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!transferDate) return;
    setSaving(true);
    try {
      const newDateStr = format(transferDate, "yyyy-MM-dd");
      const oldDateStr = currentTransferDate;
      const minDateStr = newDateStr < oldDateStr ? newDateStr : oldDateStr;

      // 1. Update old record's end_date
      const { error: oldErr } = await supabase
        .from("instructor_students")
        .update({ end_date: newDateStr } as any)
        .eq("id", oldRecordId);
      if (oldErr) throw oldErr;

      // 2. Update new record's transfer_date, start_date, schedules
      const { error: newErr } = await supabase
        .from("instructor_students")
        .update({
          transfer_date: newDateStr,
          start_date: newDateStr,
          schedules: schedules.length > 0 ? JSON.stringify(schedules) : null,
        } as any)
        .eq("id", newRecordId);
      if (newErr) throw newErr;

      // 3. Delete unstarted/no-notes sessions for both instructors from min(old,new)
      const { data: sess } = await supabase
        .from("class_sessions")
        .select("id, notes, instructor_name, scheduled_at")
        .eq("student_name", studentName)
        .in("instructor_name", [fromInstructor, toInstructor])
        .is("started_at", null)
        .gte("scheduled_at", `${minDateStr}T00:00:00+09:00`);
      const deleteIds = (sess || []).filter(s => !s.notes || s.notes === "").map(s => s.id);
      if (deleteIds.length > 0) {
        await supabase.from("class_sessions").delete().in("id", deleteIds);
      }

      // 4. Regenerate sessions for new instructor from new transfer date
      const { totalCreated } = await autoGenerateSessions(newDateStr, studentName);

      if (totalCreated === 0) {
        toast({
          title: `⚠️ ${studentName} 이관 일정 수정됨 — 신규 세션 0건`,
          description: `이관일(${newDateStr}) 이후 ${toInstructor} 강사의 세션이 자동 생성되지 않았습니다. 활성 schedule_period와 일정을 확인 후 수동 재생성하세요.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: `${studentName} 이관 일정 수정 완료 ✓`,
          description: `이관일 ${newDateStr} (기존 세션 ${deleteIds.length}건 삭제, 신규 ${totalCreated}건 생성)`,
        });
      }
      onUpdated();
      onOpenChange(false);
    } catch (e: unknown) {
      toast({ title: "수정 실패", description: e instanceof Error ? e.message : "오류 발생", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-[hsl(var(--navy))]" />
            이관 일정 수정
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 space-y-1">
            <p>{studentName}: <span className="font-semibold text-foreground">{fromInstructor} → {toInstructor}</span></p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">이관일 (새 강사 시작일)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-9 w-full text-sm justify-start", !transferDate && "text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                  {transferDate ? format(transferDate, "yyyy-MM-dd") : "날짜 선택"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={transferDate} onSelect={setTransferDate} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 bg-muted/30 rounded-lg p-3">
            <Label className="text-xs">수업 일정</Label>
            {schedules.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {schedules.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-background border border-border rounded-md px-2 py-1">
                    {s.day} {s.time}
                    <button onClick={() => removeSlot(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Select value={schedDay} onValueChange={setSchedDay}>
                <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS_OF_WEEK.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={schedTime} onValueChange={setSchedTime}>
                <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={addSlot}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !transferDate}
            className="gap-1.5 bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
