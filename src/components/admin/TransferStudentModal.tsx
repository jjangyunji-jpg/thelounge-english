import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ArrowRightLeft, CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedStudentDbId("");
      setNewInstructor("");
      setTransferDate(undefined);
    }
  }, [open]);

  const selectedStudent = students.find(s => s.dbId === selectedStudentDbId);
  const availableInstructors = instructorNames.filter(n => n !== selectedStudent?.instructor);

  const handleTransfer = async () => {
    if (!selectedStudent?.dbId || !newInstructor || !transferDate) return;
    setSaving(true);

    try {
      const transferDateStr = format(transferDate, "yyyy-MM-dd");

      // 1. Set end_date on the old record
      const { error: updateError } = await supabase
        .from("instructor_students")
        .update({ end_date: transferDateStr } as any)
        .eq("id", selectedStudent.dbId);

      if (updateError) throw updateError;

      // 2. Look up the new instructor's ID
      const { data: instrData } = await supabase
        .from("instructors")
        .select("id, meet_link")
        .eq("name", newInstructor)
        .eq("active", true)
        .maybeSingle();

      if (!instrData) throw new Error("새 강사를 찾을 수 없습니다");

      // 3. Clone the student record for the new instructor
      const { error: insertError } = await supabase
        .from("instructor_students")
        .insert({
          student_name: selectedStudent.name,
          english_name: selectedStudent.englishName || null,
          instructor_id: instrData.id,
          instructor_name: newInstructor,
          level: selectedStudent.level,
          start_date: transferDateStr,
          schedules: selectedStudent.schedules.length > 0 ? JSON.stringify(selectedStudent.schedules) : null,
          meet_link: instrData.meet_link || selectedStudent.meetLink || null,
          learning_objective: selectedStudent.learningObjective || null,
          extra_lessons: selectedStudent.extraLessons,
          status: "active",
          student_type: selectedStudent.studentType,
          group_students: selectedStudent.groupStudents,
          google_sheet_url: selectedStudent.googleSheetUrl || null,
          reminder_enabled: true,
        } as any);

      if (insertError) throw insertError;

      // 4. Update future unstarted sessions after transfer date to new instructor
      await supabase
        .from("class_sessions")
        .update({ instructor_name: newInstructor })
        .eq("student_name", selectedStudent.name)
        .eq("instructor_name", selectedStudent.instructor)
        .is("started_at", null)
        .gte("scheduled_at", new Date(transferDateStr + "T00:00:00+09:00").toISOString());

      toast({ title: `${selectedStudent.name} → ${newInstructor} 이관 완료 ✓`, description: `${transferDateStr}부터 적용` });
      onTransferred();
      onOpenChange(false);
    } catch (e: unknown) {
      toast({ title: "이관 실패", description: e instanceof Error ? e.message : "오류 발생", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Only show active, non-corporate students
  const transferableStudents = students.filter(s => s.dbId);

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
          {/* Student select */}
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
            </div>
          )}

          {/* New instructor select — always visible */}
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
            <p className="text-[11px] text-muted-foreground">
              이전 강사 레코드에 종료일이 설정되고, 새 강사에 학생 레코드가 복제됩니다.
            </p>
          </div>

          {/* Summary */}
          {selectedStudent && newInstructor && transferDate && (
            <div className="bg-[hsl(var(--navy)/0.05)] rounded-lg p-3 text-xs space-y-1 border border-[hsl(var(--navy)/0.1)]">
              <p className="font-semibold text-foreground">이관 요약</p>
              <p>• {selectedStudent.name}: {selectedStudent.instructor} → {newInstructor}</p>
              <p>• 이관일: {format(transferDate, "yyyy-MM-dd")}</p>
              <p>• 이관일 이후 미시작 세션은 새 강사로 변경됩니다</p>
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
