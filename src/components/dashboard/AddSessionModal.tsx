import { useState } from "react";
import { X, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StudentOption {
  student_name: string;
  level: string | null;
  meet_link: string | null;
  instructor_name: string | null;
}

interface AddSessionModalProps {
  students: StudentOption[];
  instructorName: string;
  defaultDate?: string;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddSessionModal({
  students,
  instructorName,
  defaultDate,
  onClose,
  onAdded,
}: AddSessionModalProps) {
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState("");
  const [date, setDate] = useState(defaultDate || "");
  const [time, setTime] = useState("10:00");
  const [saving, setSaving] = useState(false);

  const student = students.find((s) => s.student_name === selectedStudent);

  const handleSave = async () => {
    if (!selectedStudent || !date || !time) return;
    setSaving(true);

    const scheduledAt = new Date(`${date}T${time}:00+09:00`).toISOString();

    // Check duplicate
    const dayStart = new Date(`${date}T00:00:00+09:00`).toISOString();
    const dayEnd = new Date(`${date}T23:59:59+09:00`).toISOString();
    const { data: existing } = await supabase
      .from("class_sessions")
      .select("id")
      .eq("student_name", selectedStudent)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);

    if (existing && existing.length > 0) {
      toast({
        title: "추가 실패",
        description: `${selectedStudent}의 ${date} 수업이 이미 존재합니다.`,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    // Get group_students from instructor_students if it exists
    const { data: isData } = await supabase
      .from("instructor_students")
      .select("group_students")
      .eq("student_name", selectedStudent)
      .maybeSingle();

    const groupStudents = (isData as any)?.group_students || [];

    const { error } = await supabase.from("class_sessions").insert({
      student_name: selectedStudent,
      instructor_name: student?.instructor_name || instructorName,
      level: student?.level || "B1",
      scheduled_at: scheduledAt,
      meet_link: student?.meet_link || null,
      group_students: groupStudents,
    } as any);

    if (error) {
      toast({ title: "추가 실패", description: error.message, variant: "destructive" });
    } else {
      // Mark matching available slot as booked
      const slotTime = `${time}:00`;
      await supabase
        .from("instructor_available_slots")
        .update({ status: "booked" })
        .eq("slot_date", date)
        .eq("slot_time", slotTime)
        .eq("status", "open");

      toast({ title: "수업이 추가되었습니다 ✓" });
      onAdded();
      onClose();
    }
    setSaving(false);
  };

  // Sort students: active first, then alphabetically
  const sortedStudents = [...students].sort((a, b) =>
    a.student_name.localeCompare(b.student_name, "ko")
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-navy" /> 수업 추가
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">학생 / 그룹</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="학생을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {sortedStudents.map((s) => (
                  <SelectItem key={s.student_name} value={s.student_name}>
                    {s.student_name} {s.level ? `(${s.level})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">날짜</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">시간</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedStudent || !date}
            className="flex-1 h-9 text-sm bg-navy hover:bg-navy-light text-primary-foreground gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 추가
          </Button>
        </div>
      </div>
    </div>
  );
}
