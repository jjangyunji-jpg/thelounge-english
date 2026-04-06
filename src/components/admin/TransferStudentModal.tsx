import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ArrowRightLeft, CalendarIcon, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DAYS_OF_WEEK = ["월", "화", "수", "목", "금", "토", "일"];
const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  return `${h.toString().padStart(2, "0")}:00`;
});

interface ScheduleSlot {
  day: string;
  time: string;
  frequency?: string;
}

interface TransferStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: { dbId?: string; name: string; instructor: string; level: string; schedules: any[]; meetLink: string; learningObjective: string; englishName: string; extraLessons: number; groupStudents: string[]; googleSheetUrl?: string; studentType: string }[];
  instructorNames: string[];
  onTransferred: () => void;
}

export default function TransferStudentModal({ open, onOpenChange, students, instructorNames, onTransferred }: TransferStudentModalProps) {
  const { toast } = useToast();
  const [selectedStudentDbId, setSelectedStudentDbId] = useState("");
  const [newInstructor, setNewInstructor] = useState("");
  const [transferDate, setTransferDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Schedule editing
  const [changeSchedule, setChangeSchedule] = useState(false);
  const [newSchedules, setNewSchedules] = useState<ScheduleSlot[]>([]);
  const [schedDay, setSchedDay] = useState("월");
  const [schedTime, setSchedTime] = useState("09:00");

  useEffect(() => {
    if (open) {
      setSelectedStudentDbId("");
      setNewInstructor("");
      setTransferDate(undefined);
      setChangeSchedule(false);
      setNewSchedules([]);
    }
  }, [open]);

  const selectedStudent = students.find(s => s.dbId === selectedStudentDbId);
  const availableInstructors = instructorNames.filter(n => n !== selectedStudent?.instructor).sort((a, b) => a.localeCompare(b, "ko"));

  // When student changes, reset schedule
  useEffect(() => {
    if (selectedStudent) {
      setNewSchedules([...selectedStudent.schedules]);
    }
  }, [selectedStudentDbId]);

  // Sort students by Korean name (ㄱ-ㅎ)
  const transferableStudents = students
    .filter(s => s.dbId)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const addScheduleSlot = () => {
    if (newSchedules.some(s => s.day === schedDay && s.time === schedTime)) return;
    setNewSchedules(prev => [...prev, { day: schedDay, time: schedTime, frequency: "weekly" }]);
  };

  const removeScheduleSlot = (idx: number) => {
    setNewSchedules(prev => prev.filter((_, i) => i !== idx));
  };

  const handleTransfer = async () => {
    if (!selectedStudent?.dbId || !newInstructor || !transferDate) return;
    setSaving(true);

    try {
      const transferDateStr = format(transferDate, "yyyy-MM-dd");
      const finalSchedules = changeSchedule ? newSchedules : selectedStudent.schedules;

      // 1. Look up the new instructor's ID
      const { data: instrData } = await supabase
        .from("instructors")
        .select("id, meet_link")
        .eq("name", newInstructor)
        .eq("active", true)
        .maybeSingle();
      if (!instrData) throw new Error("새 강사를 찾을 수 없습니다");

      // 2. Update old record: set end_date but keep active until transfer date
      const { error: updateError } = await supabase
        .from("instructor_students")
        .update({ end_date: transferDateStr } as any)
        .eq("id", selectedStudent.dbId);
      if (updateError) throw updateError;

      // 3. Create new instructor record with pending transfer status
      const { error: insertError } = await supabase
        .from("instructor_students")
        .insert({
          student_name: selectedStudent.name,
          english_name: selectedStudent.englishName || null,
          instructor_id: instrData.id,
          instructor_name: newInstructor,
          level: selectedStudent.level,
          start_date: transferDateStr,
          schedules: finalSchedules.length > 0 ? JSON.stringify(finalSchedules) : null,
          meet_link: instrData.meet_link || selectedStudent.meetLink || null,
          learning_objective: selectedStudent.learningObjective || null,
          extra_lessons: selectedStudent.extraLessons,
          status: "active",
          student_type: selectedStudent.studentType,
          group_students: selectedStudent.groupStudents,
          google_sheet_url: selectedStudent.googleSheetUrl || null,
          reminder_enabled: true,
          transfer_from_id: selectedStudent.dbId,
          transfer_date: transferDateStr,
          transfer_status: "pending",
        } as any);
      if (insertError) throw insertError;

      // 4. Delete only unstarted/no-notes sessions AFTER transfer date for old instructor
      const { data: oldInstructorSessions } = await supabase
        .from("class_sessions")
        .select("id, notes, scheduled_at")
        .eq("student_name", selectedStudent.name)
        .eq("instructor_name", selectedStudent.instructor)
        .is("started_at", null)
        .gte("scheduled_at", `${transferDateStr}T00:00:00+09:00`);

      const deleteIds = (oldInstructorSessions || [])
        .filter(s => !s.notes || s.notes === "")
        .map(s => s.id);
      if (deleteIds.length > 0) {
        await supabase.from("class_sessions").delete().in("id", deleteIds);
      }

      // 5. Auto-generate sessions for new instructor from transfer date
      const { autoGenerateSessions } = await import("@/lib/autoGenerateSessions");
      const { totalCreated } = await autoGenerateSessions(transferDateStr, selectedStudent.name);

      toast({
        title: `${selectedStudent.name} → ${newInstructor} 이관 예약 완료 ✓`,
        description: `${transferDateStr}부터 적용 (기존 세션 ${deleteIds.length}건 삭제, 신규 ${totalCreated}건 생성)`,
      });
      onTransferred();
      onOpenChange(false);
    } catch (e: unknown) {
      toast({ title: "이관 실패", description: e instanceof Error ? e.message : "오류 발생", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-[hsl(var(--navy))]" />
            강사 이관
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Student select — sorted ㄱ-ㅎ */}
          <div className="space-y-1.5">
            <Label className="text-xs">이관할 수강생</Label>
            <Select value={selectedStudentDbId} onValueChange={setSelectedStudentDbId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="수강생 선택" />
              </SelectTrigger>
              <SelectContent>
                {transferableStudents.map(s => (
                  <SelectItem key={s.dbId} value={s.dbId!}>
                    {s.name} ({s.instructor})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current instructor info */}
          {selectedStudent && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 space-y-1">
              <p>현재 강사: <span className="font-semibold text-foreground">{selectedStudent.instructor}</span></p>
              <p>레벨: <span className="font-semibold text-foreground">{selectedStudent.level}</span></p>
              {selectedStudent.schedules.length > 0 && (
                <p>현재 일정: <span className="font-semibold text-foreground">
                  {selectedStudent.schedules.map((s: any) => `${s.day} ${s.time}`).join(", ")}
                </span></p>
              )}
            </div>
          )}

          {/* New instructor select */}
          <div className="space-y-1.5">
            <Label className="text-xs">새 강사</Label>
            <Select value={newInstructor} onValueChange={setNewInstructor}>
              <SelectTrigger className={cn("h-9 text-sm", !selectedStudent && "opacity-50 pointer-events-none")}>
                <SelectValue placeholder={selectedStudent ? "새 강사 선택" : "수강생을 먼저 선택하세요"} />
              </SelectTrigger>
              <SelectContent>
                {availableInstructors.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transfer date */}
          <div className="space-y-1.5">
            <Label className="text-xs">이관일 (새 강사 시작일)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("h-9 w-full text-sm justify-start", !transferDate && "text-muted-foreground", !selectedStudent && "opacity-50 pointer-events-none")}
                >
                  <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                  {transferDate ? format(transferDate, "yyyy-MM-dd") : "날짜 선택"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={transferDate}
                  onSelect={setTransferDate}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Schedule change toggle */}
          {selectedStudent && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">수업 일정 변경</Label>
                <Switch checked={changeSchedule} onCheckedChange={setChangeSchedule} />
              </div>

              {changeSchedule && (
                <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                  {/* Current schedule slots */}
                  {newSchedules.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {newSchedules.map((slot, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-background border border-border rounded-md px-2 py-1">
                          {slot.day} {slot.time}
                          <button onClick={() => removeScheduleSlot(i)} className="text-muted-foreground hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Add slot */}
                  <div className="flex items-center gap-2">
                    <Select value={schedDay} onValueChange={setSchedDay}>
                      <SelectTrigger className="h-8 text-xs w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={schedTime} onValueChange={setSchedTime}>
                      <SelectTrigger className="h-8 text-xs w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="h-8 px-2" onClick={addScheduleSlot}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {selectedStudent && newInstructor && transferDate && (
            <div className="bg-[hsl(var(--navy)/0.05)] rounded-lg p-3 text-xs space-y-1 border border-[hsl(var(--navy)/0.1)]">
              <p className="font-semibold text-foreground">이관 요약</p>
              <p>• {selectedStudent.name}: {selectedStudent.instructor} → {newInstructor}</p>
              <p>• 이관일: {format(transferDate, "yyyy-MM-dd")}</p>
              {changeSchedule && newSchedules.length > 0 && (
                <p>• 새 일정: {newSchedules.map(s => `${s.day} ${s.time}`).join(", ")}</p>
              )}
              <p>• 이관일 이후 이전 강사의 미시작 세션은 삭제됩니다</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleTransfer}
            disabled={saving || !selectedStudent || !newInstructor || !transferDate}
            className="gap-1.5 bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            이관 실행
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
