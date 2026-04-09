import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Download, ChevronDown, ChevronUp, UserX, BookOpen, Edit2, RefreshCw, Trash2, Target, Check, X, Bell, BellOff, Video, ExternalLink, Link2, PenLine, Mic, Brain, Clock, Mail, Loader2, FileText, Paperclip, Monitor, Pause, Play, Users, ArrowRightLeft, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { formatStudentName } from "@/lib/formatStudentName";
import { cn, todayKSTString } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import CorporateReportPreviewModal from "./CorporateReportPreviewModal";
import { useToast } from "@/hooks/use-toast";
import { autoGenerateSessions } from "@/lib/autoGenerateSessions";
import TransferStudentModal from "./TransferStudentModal";

type StudentStatus = "active" | "graduated";
type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file" | "watching";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LESSON_PRICE = 50000;

/** Calculate base monthly lessons from schedule slots */
const calcBaseLessons = (schedules: ScheduleSlot[]): number => {
  if (schedules.length === 0) return 4; // default
  return schedules.reduce((sum, slot) => {
    const freq = slot.frequency || "weekly";
    return sum + (freq === "weekly" ? 4 : 2);
  }, 0);
};

const calcMonthlyFee = (baseLessons: number, extra: number) => (baseLessons + extra) * LESSON_PRICE;

const HW_TYPE_META: Record<HwType, { label: string; icon: React.ElementType; color: string; hint: string }> = {
  writing:    { label: "쓰기",       icon: PenLine,    color: "text-[hsl(var(--navy))]",      hint: "텍스트 작성 필수" },
  reading:    { label: "읽기",       icon: BookOpen,   color: "text-[hsl(var(--gold-dark))]", hint: "녹음 필수" },
  speaking:   { label: "말하기",     icon: Mic,        color: "text-[hsl(var(--success))]",   hint: "녹음 필수 / 텍스트 선택" },
  memorizing: { label: "외우기",     icon: Brain,      color: "text-purple-500",              hint: "녹음 필수 (대화문 등)" },
  file:       { label: "파일올리기", icon: Paperclip,  color: "text-blue-500",                hint: "파일 첨부 필수" },
  watching:   { label: "시청하기",   icon: Monitor,    color: "text-rose-500",                hint: "시청 후 체크" },
};

export interface PresetHomework {
  id: string;       // DB UUID
  type: HwType;
  title: string;
  description: string;
}

interface LessonHistory {
  date: string;
  topic: string;
  vocaCount: number;
  hwStatus: string;
}

const DAYS_OF_WEEK = ["월", "화", "수", "목", "금", "토", "일"];
const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  return `${h.toString().padStart(2, "0")}:00`;
});

type Frequency = "weekly" | "biweekly" | "monthly2";

const FREQ_LABELS: Record<Frequency, string> = {
  weekly: "매주",
  biweekly: "격주",
  monthly2: "월2회",
};

interface ScheduleSlot {
  day: string;
  time: string;
  frequency?: Frequency;
}

interface PauseRecord {
  id: string;
  pause_start: string;
  pause_end: string | null;
  reason: string | null;
}

interface TransferRecord {
  fromInstructor: string;
  toInstructor: string;
  transferDate: string; // end_date of old record
  oldSchedules: string;
  newSchedules: string;
}

interface Student {
  id: number;
  dbId?: string; // UUID from DB
  name: string;
  englishName: string;
  level: Level;
  startDate: string;
  endDate: string;
  instructor: string;
  status: StudentStatus;
  totalLessons: number;
  extraLessons: number;
  presetHomework: PresetHomework[];
  lessonGoal: string;
  learningObjective: string;
  lessonHistory: LessonHistory[];
  reminderEnabled: boolean;
  meetLink: string;
  schedules: ScheduleSlot[];
  withdrawalReason?: string;
  pauses: PauseRecord[];
  studentType: string;
  groupStudents: string[];
  googleSheetUrl?: string;
  transferHistory?: TransferRecord[];
  transferDate?: string;
  transferStatus?: string;
}

// removed old calcMonthlyFee - now using the one at module level

const levelColors: Record<Level, string> = {
  A1: "bg-muted text-muted-foreground",
  A2: "bg-blue-50 text-blue-700",
  B1: "bg-gold/10 text-gold-dark",
  B2: "bg-orange-50 text-orange-700",
  C1: "bg-navy/10 text-navy",
  C2: "bg-navy/20 text-navy font-bold",
};
// New student form state
interface NewStudent {
  name: string;
  englishName: string;
  level: Level | "";
  instructor: string;
  startDate: string;
  extraLessons: number;
  schedules: ScheduleSlot[];
  studentType: string;
  learningObjective: string;
  googleSheetUrl: string;
  meetLink: string;
}

// Pause form sub-component
function PauseForm({ onSave }: { onSave: (start: string, end: string) => Promise<void> }) {
  const [pauseStartDate, setPauseStartDate] = useState<Date>();
  const [pauseEndDate, setPauseEndDate] = useState<Date>();
  const [saving, setSaving] = useState(false);
  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">시작일</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-8 w-full text-xs justify-start", !pauseStartDate && "text-muted-foreground")}>
                <CalendarIcon className="w-3 h-3 mr-1.5" />
                {pauseStartDate ? format(pauseStartDate, "yyyy-MM-dd") : "선택"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={pauseStartDate} onSelect={setPauseStartDate} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">종료일</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-8 w-full text-xs justify-start", !pauseEndDate && "text-muted-foreground")}>
                <CalendarIcon className="w-3 h-3 mr-1.5" />
                {pauseEndDate ? format(pauseEndDate, "yyyy-MM-dd") : "선택"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={pauseEndDate} onSelect={setPauseEndDate} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <Button
        size="sm"
        disabled={!pauseStartDate || !pauseEndDate || saving}
        className="h-7 text-xs w-full bg-warning/90 hover:bg-warning text-warning-foreground"
        onClick={async () => {
          if (!pauseStartDate || !pauseEndDate) return;
          setSaving(true);
          await onSave(format(pauseStartDate, "yyyy-MM-dd"), format(pauseEndDate, "yyyy-MM-dd"));
          setPauseStartDate(undefined);
          setPauseEndDate(undefined);
          setSaving(false);
        }}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
        휴강 추가
      </Button>
    </div>
  );
}

export default function StudentManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [instructorNames, setInstructorNames] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "graduated">("active");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStudentName, setInviteStudentName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [reportPreview, setReportPreview] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const handleInviteStudent = async () => {
    if (!inviteEmail.trim() || !inviteStudentName.trim()) return;
    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke("invite-student", {
        body: { email: inviteEmail.trim(), studentName: inviteStudentName.trim() },
      });
      if (error) throw error;
      toast({ title: `${inviteStudentName} 님께 초대 메일 발송 완료 ✓`, description: inviteEmail });
      setInviteEmail("");
      setInviteStudentName("");
      setInviteDialogOpen(false);
    } catch (e: unknown) {
      toast({ title: "초대 실패", description: e instanceof Error ? e.message : "오류", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  useEffect(() => {

    // Load instructors
    supabase
      .from("instructors")
      .select("name")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setInstructorNames((data || []).map((i) => i.name)));

    // Load students from DB
    loadStudentsFromDB();
  }, []);

  const loadStudentsFromDB = async () => {
    const { data, error } = await supabase
      .from("instructor_students")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) { console.error("학생 로드 오류:", error); return; }

    const dbStudents: Student[] = (data || []).map((row: any) => ({
      id: row.id_num ?? (row.student_name + row.created_at).hashCode?.() ?? Math.random(),
      dbId: row.id,
      name: row.student_name,
      englishName: row.english_name || "",
      
      level: (row.level as Level) || "B1",
      startDate: row.start_date || "",
      instructor: row.instructor_name || "",
      status: (row.status as StudentStatus) || "active",
      totalLessons: row.total_lessons || 0,
      extraLessons: row.extra_lessons || 0,
      presetHomework: [],
      lessonGoal: row.lesson_goal || "",
      learningObjective: row.learning_objective || "",
      lessonHistory: [],
      reminderEnabled: row.reminder_enabled ?? true,
      meetLink: row.meet_link || "",
      schedules: row.schedules ? JSON.parse(row.schedules) : [],
      withdrawalReason: row.withdrawal_reason || "",
      pauses: [],
      studentType: row.student_type || "regular",
      groupStudents: row.group_students || [],
      googleSheetUrl: (row as any).google_sheet_url || "",
    }));

    // Build transfer history: group all records by student_name
    const recordsByName: Record<string, any[]> = {};
    (data || []).forEach((row: any) => {
      const name = row.student_name;
      if (!recordsByName[name]) recordsByName[name] = [];
      recordsByName[name].push(row);
    });

    // For each student, find previous records (those with end_date) to build transfer history
    const enriched = dbStudents.map((student) => {
      const allRecords = recordsByName[student.name] || [];
      if (allRecords.length <= 1) return student;

      // Sort by start_date ascending to build chronological history
      const sorted = [...allRecords].sort((a, b) => 
        (a.start_date || "").localeCompare(b.start_date || "")
      );

      const transfers: TransferRecord[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const prev = sorted[i];
        const next = sorted[i + 1];
        // Only count as transfer if the old record has an end_date and different instructor
        if (prev.end_date && prev.instructor_name !== next.instructor_name) {
          const formatSchedule = (s: string | null) => {
            if (!s) return "미설정";
            try {
              const slots = JSON.parse(s);
              if (!Array.isArray(slots) || slots.length === 0) return "미설정";
              return slots.map((sl: any) => `${sl.day} ${sl.time}`).join(", ");
            } catch { return "미설정"; }
          };
          transfers.push({
            fromInstructor: prev.instructor_name || "미지정",
            toInstructor: next.instructor_name || "미지정",
            transferDate: prev.end_date,
            oldSchedules: formatSchedule(prev.schedules),
            newSchedules: formatSchedule(next.schedules),
          });
        }
      }

      return transfers.length > 0 ? { ...student, transferHistory: transfers } : student;
    });

    setStudents(enriched);

    // Load pauses for all students
    if (data && data.length > 0) {
      const studentIds = data.map((r: any) => r.id);
      const { data: pauseData } = await supabase
        .from("student_pauses")
        .select("*")
        .in("student_id", studentIds)
        .order("pause_start", { ascending: true });
      if (pauseData) {
        const pauseMap: Record<string, PauseRecord[]> = {};
        pauseData.forEach((p: any) => {
          if (!pauseMap[p.student_id]) pauseMap[p.student_id] = [];
          pauseMap[p.student_id].push({ id: p.id, pause_start: p.pause_start, pause_end: p.pause_end, reason: p.reason });
        });
        setStudents(prev => prev.map(s => ({
          ...s,
          pauses: s.dbId ? (pauseMap[s.dbId] || []) : [],
        })));
      }
    }
  };

  const [cancellingTransfer, setCancellingTransfer] = useState(false);

  const handleCancelTransfer = async (studentName: string, transfer: TransferRecord) => {
    setCancellingTransfer(true);
    try {
      // 1. Find the old inactive record (fromInstructor with end_date = transferDate)
      const { data: oldRecords, error: oldErr } = await supabase
        .from("instructor_students")
        .select("id")
        .eq("student_name", studentName)
        .eq("instructor_name", transfer.fromInstructor)
        .eq("end_date", transfer.transferDate)
        .eq("status", "inactive")
        .limit(1);
      if (oldErr) throw oldErr;
      if (!oldRecords || oldRecords.length === 0) throw new Error("이전 강사 레코드를 찾을 수 없습니다");

      // 2. Find the new active record (toInstructor, active)
      const { data: newRecords, error: newErr } = await supabase
        .from("instructor_students")
        .select("id")
        .eq("student_name", studentName)
        .eq("instructor_name", transfer.toInstructor)
        .eq("status", "active")
        .limit(1);
      if (newErr) throw newErr;
      if (!newRecords || newRecords.length === 0) throw new Error("새 강사 레코드를 찾을 수 없습니다");

      // 3. Reactivate old record
      const { error: reactivateErr } = await supabase
        .from("instructor_students")
        .update({ status: "active", end_date: null } as any)
        .eq("id", oldRecords[0].id);
      if (reactivateErr) throw reactivateErr;

      // 4. Delete unstarted sessions for the new instructor (no notes)
      const { data: newSessions } = await supabase
        .from("class_sessions")
        .select("id, notes")
        .eq("student_name", studentName)
        .eq("instructor_name", transfer.toInstructor)
        .is("started_at", null);
      const deleteSessionIds = (newSessions || [])
        .filter(s => !s.notes || s.notes === "")
        .map(s => s.id);
      if (deleteSessionIds.length > 0) {
        await supabase.from("class_sessions").delete().in("id", deleteSessionIds);
      }

      // 5. Delete the new instructor_students record
      const { error: deleteErr } = await supabase
        .from("instructor_students")
        .delete()
        .eq("id", newRecords[0].id);
      if (deleteErr) throw deleteErr;

      toast({
        title: `${studentName} 이관 취소 완료 ✓`,
        description: `${transfer.fromInstructor} 강사로 복원되었습니다 (미시작 세션 ${deleteSessionIds.length}건 삭제)`,
      });
      loadStudentsFromDB();
    } catch (e: unknown) {
      toast({ title: "이관 취소 실패", description: e instanceof Error ? e.message : "오류 발생", variant: "destructive" });
    } finally {
      setCancellingTransfer(false);
    }
  };

  // preset homework per student (DB 연동): studentId -> presets
  const [presetMap, setPresetMap] = useState<Record<number, PresetHomework[]>>({});
  const [loadingPresets, setLoadingPresets] = useState<Record<number, boolean>>({});

  // 새 정기 숙제 추가 폼
  const [addingPresetFor, setAddingPresetFor] = useState<number | null>(null);
  const [newPresetType, setNewPresetType] = useState<HwType>("writing");
  const [newPresetTitle, setNewPresetTitle] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  // 정기 숙제 수정 상태
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetType, setEditPresetType] = useState<HwType>("writing");
  const [editPresetTitle, setEditPresetTitle] = useState("");
  const [editPresetDesc, setEditPresetDesc] = useState("");
  const [savingEditPreset, setSavingEditPreset] = useState(false);

  // Inline editing state
   const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
   const [editLevel, setEditLevel] = useState<Level | "">("");
   const [editExtra, setEditExtra] = useState(0);
   const [editObjectives, setEditObjectives] = useState<string[]>([]);
   const [editNewObjective, setEditNewObjective] = useState("");
   const [editInstructor, setEditInstructor] = useState("");
   const [editStartDate, setEditStartDate] = useState<Date | undefined>(undefined);
   const [editSchedules, setEditSchedules] = useState<ScheduleSlot[]>([]);
   const [editSchedDay, setEditSchedDay] = useState("월");
   const [editSchedTime, setEditSchedTime] = useState("09:00");
    const [editSchedFreq, setEditSchedFreq] = useState<Frequency>("weekly");
    const [editGroupStudents, setEditGroupStudents] = useState<string[]>([]);

  // Meet link editing
  const [editingMeetId, setEditingMeetId] = useState<number | null>(null);
  const [meetLinkInput, setMeetLinkInput] = useState("");

  // Google Sheet link editing
  const [editingSheetId, setEditingSheetId] = useState<number | null>(null);
  const [sheetLinkInput, setSheetLinkInput] = useState("");

  // New student form
  const [newStudent, setNewStudent] = useState<NewStudent>({
    name: "", englishName: "", level: "", instructor: "", startDate: "", extraLessons: 0, schedules: [], studentType: "regular", learningObjective: "", googleSheetUrl: "", meetLink: "",
  });

  const filtered = students.filter(
    (s) => s.status === tab && s.studentType !== "corporate" && s.name.includes(search)
  );
  const filteredCorporate = students.filter(
    (s) => s.status === tab && s.studentType === "corporate" && s.name.includes(search)
  );

  // 학생의 정기 숙제 DB 로드
  const loadPresets = async (studentId: number, studentName: string) => {
    setLoadingPresets((p) => ({ ...p, [studentId]: true }));
    const { data } = await supabase
      .from("homework_assignments")
      .select("*")
      .eq("student_name", studentName)
      .eq("is_preset", true)
      .order("created_at", { ascending: true });
    setPresetMap((p) => ({
      ...p,
      [studentId]: (data || []).map((d) => ({
        id: d.id,
        type: d.type as HwType,
        title: d.title,
        description: d.description || "",
      })),
    }));
    setLoadingPresets((p) => ({ ...p, [studentId]: false }));
  };

  const handleExpandStudent = (studentId: number, studentName: string) => {
    if (expandedId === studentId) {
      setExpandedId(null);
    } else {
      setExpandedId(studentId);
      if (!presetMap[studentId]) loadPresets(studentId, studentName);
    }
  };

  const addPresetHw = async (studentId: number, studentName: string) => {
    if (!newPresetTitle.trim()) return;
    setSavingPreset(true);
    const { data, error } = await supabase.from("homework_assignments").insert({
      student_name: studentName,
      title: newPresetTitle.trim(),
      description: newPresetDesc.trim() || null,
      type: newPresetType,
      is_preset: true,
    }).select().single();

    if (!error && data) {
      const newItem: PresetHomework = {
        id: data.id,
        type: newPresetType,
        title: newPresetTitle.trim(),
        description: newPresetDesc.trim(),
      };
      setPresetMap((p) => ({ ...p, [studentId]: [...(p[studentId] || []), newItem] }));
      toast({ title: "정기 숙제 추가 완료 ✓" });
    }
    setNewPresetTitle(""); setNewPresetDesc(""); setNewPresetType("writing");
    setAddingPresetFor(null); setSavingPreset(false);
  };

  const removePresetHw = async (studentId: number, hwId: string) => {
    await supabase.from("homework_assignments").delete().eq("id", hwId);
    setPresetMap((p) => ({ ...p, [studentId]: (p[studentId] || []).filter((h) => h.id !== hwId) }));
  };

  const startEditPreset = (hw: PresetHomework) => {
    setEditingPresetId(hw.id);
    setEditPresetType(hw.type);
    setEditPresetTitle(hw.title);
    setEditPresetDesc(hw.description);
    setAddingPresetFor(null);
  };

  const cancelEditPreset = () => {
    setEditingPresetId(null);
    setEditPresetTitle(""); setEditPresetDesc("");
  };

  const saveEditPreset = async (studentId: number) => {
    if (!editPresetTitle.trim() || !editingPresetId) return;
    setSavingEditPreset(true);
    const { error } = await supabase
      .from("homework_assignments")
      .update({ type: editPresetType, title: editPresetTitle.trim(), description: editPresetDesc.trim() || null })
      .eq("id", editingPresetId);
    if (!error) {
      setPresetMap((p) => ({
        ...p,
        [studentId]: (p[studentId] || []).map((h) =>
          h.id === editingPresetId
            ? { ...h, type: editPresetType, title: editPresetTitle.trim(), description: editPresetDesc.trim() }
            : h
        ),
      }));
      toast({ title: "정기 숙제 수정 완료 ✓" });
    }
    setSavingEditPreset(false);
    cancelEditPreset();
  };

  // Withdrawal dialog state
  const [withdrawTarget, setWithdrawTarget] = useState<Student | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawDate, setWithdrawDate] = useState<Date | undefined>(undefined);
  const [withdrawing, setWithdrawing] = useState(false);

  // Schedule change effective-date dialog state
  const [schedChangeTarget, setSchedChangeTarget] = useState<{ studentId: number; studentName: string; dbId: string; newSchedules: ScheduleSlot[]; instructorName: string } | null>(null);
  const [schedEffectiveDate, setSchedEffectiveDate] = useState<Date | undefined>(undefined);
  const [schedChangeSaving, setSchedChangeSaving] = useState(false);

  const graduate = async () => {
    if (!withdrawTarget || !withdrawDate) return;
    setWithdrawing(true);

    const withdrawDateStr = format(withdrawDate, "yyyy-MM-dd");

    if (withdrawTarget.dbId) {
      await supabase.from("instructor_students").update({
        status: "inactive",
        withdrawal_reason: withdrawReason.trim() || null,
        end_date: withdrawDateStr,
      }).eq("id", withdrawTarget.dbId);
    }

    // Delete unstarted sessions with no notes AFTER the withdrawal date
    // Use KST date for comparison: sessions on or after the day after withdrawDate
    const cutoffDate = new Date(withdrawDate);
    cutoffDate.setDate(cutoffDate.getDate() + 1);
    const cutoffISO = cutoffDate.toISOString().slice(0, 10) + "T00:00:00+09:00";

    const { data: futureSessions } = await supabase
      .from("class_sessions")
      .select("id, started_at, notes, scheduled_at")
      .eq("student_name", withdrawTarget.name)
      .is("started_at", null)
      .gte("scheduled_at", cutoffISO);

    const deletableIds = (futureSessions || [])
      .filter(s => !s.notes || s.notes === "")
      .map(s => s.id);

    if (deletableIds.length > 0) {
      await supabase.from("class_sessions").delete().in("id", deletableIds);
    }

    setStudents((prev) => prev.map((s) => (s.id === withdrawTarget.id ? { ...s, status: "graduated", withdrawalReason: withdrawReason.trim() } : s)));
    toast({ title: `${withdrawTarget.name} 퇴원 처리 완료`, description: `퇴원일: ${withdrawDateStr} / 삭제된 수업: ${deletableIds.length}건` });
    setWithdrawing(false);
    setWithdrawTarget(null);
    setWithdrawReason("");
    setWithdrawDate(undefined);
  };

  const [editEnglishName, setEditEnglishName] = useState("");
  const [editStudentType, setEditStudentType] = useState<"regular" | "corporate">("regular");
  const [editGoogleSheetUrl, setEditGoogleSheetUrl] = useState("");

  const startInlineEdit = (s: Student) => {
    setEditingStudentId(s.id);
    setEditLevel(s.level);
    setEditExtra(s.extraLessons);
    // Parse learning_objective as JSON array
    try {
      const parsed = JSON.parse(s.learningObjective || "[]");
      setEditObjectives(Array.isArray(parsed) ? parsed.filter((x: string) => x && x.trim()) : s.learningObjective.trim() ? [s.learningObjective.trim()] : []);
    } catch { setEditObjectives(s.learningObjective.trim() ? [s.learningObjective.trim()] : []); }
    setEditNewObjective("");
    setEditInstructor(s.instructor);
    setEditEnglishName(s.englishName);
    setEditStartDate(s.startDate ? new Date(s.startDate + "T00:00:00") : undefined);
    setEditSchedules([...s.schedules]);
    setEditStudentType(s.studentType as "regular" | "corporate");
    setEditGroupStudents([...s.groupStudents]);
    setEditSchedDay("월");
    setEditSchedTime("09:00");
    setEditGoogleSheetUrl(s.googleSheetUrl || "");
  };

  const saveInlineEdit = async (id: number) => {
    const student = students.find(s => s.id === id);
    if (student?.dbId) {
      const isInstructorChanged = !!editInstructor && editInstructor !== student.instructor;

      // Look up instructor_id when instructor name changes
      let newInstructorId: string | null = null;
      if (isInstructorChanged) {
        const { data: instrData } = await supabase
          .from("instructors")
          .select("id")
          .eq("name", editInstructor)
          .eq("active", true)
          .maybeSingle();
        newInstructorId = instrData?.id ?? null;
      }

      const updatePayload: Record<string, any> = {
        level: editLevel,
        extra_lessons: editExtra,
        instructor_name: editInstructor,
        learning_objective: editObjectives.length > 0 ? JSON.stringify(editObjectives) : null,
        english_name: editEnglishName.trim() || null,
        start_date: editStartDate ? format(editStartDate, "yyyy-MM-dd") : null,
        schedules: editSchedules.length > 0 ? JSON.stringify(editSchedules) : null,
        student_type: editStudentType,
        group_students: editGroupStudents,
        google_sheet_url: editGoogleSheetUrl.trim() || null,
      };
      if (newInstructorId) {
        updatePayload.instructor_id = newInstructorId;
      }

      await supabase.from("instructor_students").update(updatePayload).eq("id", student.dbId);

      // Detect schedule change
      const oldSchedStr = JSON.stringify(student.schedules);
      const newSchedStr = JSON.stringify(editSchedules);
      const isScheduleChanged = oldSchedStr !== newSchedStr;

      // Keep future, not-yet-started sessions in sync with reassigned instructor
      if (isInstructorChanged && !isScheduleChanged) {
        await supabase
          .from("class_sessions")
          .update({ instructor_name: editInstructor })
          .eq("student_name", student.name)
          .is("started_at", null)
          .gte("scheduled_at", new Date().toISOString());
      }

      // If schedule changed: show effective date dialog
      if (isScheduleChanged) {
        setSchedChangeTarget({
          studentId: id,
          studentName: student.name,
          dbId: student.dbId,
          newSchedules: [...editSchedules],
          instructorName: editInstructor,
        });
        setSchedEffectiveDate(new Date());
      }
    }
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          level: editLevel as Level,
          extraLessons: editExtra,
          instructor: editInstructor,
          learningObjective: editObjectives.length > 0 ? JSON.stringify(editObjectives) : "",
          englishName: editEnglishName.trim(),
          startDate: editStartDate ? format(editStartDate, "yyyy-MM-dd") : "",
          schedules: [...editSchedules],
          studentType: editStudentType,
          groupStudents: [...editGroupStudents],
          googleSheetUrl: editGoogleSheetUrl.trim(),
        };
      })
    );
    setEditingStudentId(null);
  };

  const toggleReminder = (studentId: number) => {
    setStudents((prev) =>
      prev.map((s) => s.id === studentId ? { ...s, reminderEnabled: !s.reminderEnabled } : s)
    );
  };

  const confirmScheduleChange = async () => {
    if (!schedChangeTarget || !schedEffectiveDate) return;
    setSchedChangeSaving(true);
    const cutoff = format(schedEffectiveDate, "yyyy-MM-dd") + "T00:00:00+09:00";
    const studentName = schedChangeTarget.studentName;

    // 1. Fetch all unstarted sessions for this student to identify deletable ones
    const { data: futureSessions } = await supabase
      .from("class_sessions")
      .select("id, scheduled_at, started_at, notes, topic, reschedule_origin_dates, ended_at")
      .eq("student_name", studentName)
      .is("started_at", null)
      .is("notes", null)
      .is("ended_at", null)
      .gte("scheduled_at", cutoff);

    // 2. Filter: protect rescheduled sessions (they have reschedule_origin_dates)
    const deletableIds = (futureSessions || [])
      .filter(s => {
        const origins = Array.isArray(s.reschedule_origin_dates) ? s.reschedule_origin_dates : [];
        return origins.length === 0; // Only delete non-rescheduled sessions
      })
      .map(s => s.id);

    if (deletableIds.length > 0) {
      // Clear topics first (trigger prevents deleting sessions with topic)
      await supabase
        .from("class_sessions")
        .update({ topic: null })
        .in("id", deletableIds);

      // Delete
      await supabase
        .from("class_sessions")
        .delete()
        .in("id", deletableIds);
    }

    // 3. Regenerate sessions only from effective date onward
    const result = await autoGenerateSessions(
      format(schedEffectiveDate, "yyyy-MM-dd"),
      studentName
    );
    toast({
      title: "수업 일정이 재생성되었습니다 ✓",
      description: `${format(schedEffectiveDate, "yyyy-MM-dd")}부터 적용 · ${result.totalCreated}개 세션 생성`,
    });
    setSchedChangeSaving(false);
    setSchedChangeTarget(null);
  };

  const saveMeetLink = async (studentId: number) => {
    const url = meetLinkInput.trim();
    if (url && !url.startsWith("http")) return;
    const student = students.find(s => s.id === studentId);
    if (student?.dbId) {
      const { error } = await supabase.from("instructor_students").update({ meet_link: url || null }).eq("id", student.dbId);
      if (error) { toast({ title: "저장 실패", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Meet 링크가 저장됐습니다 ✓" });
    }
    setStudents((prev) =>
      prev.map((s) => s.id === studentId ? { ...s, meetLink: url } : s)
    );
    setEditingMeetId(null);
    setMeetLinkInput("");
  };

  const deleteMeetLink = async (studentId: number) => {
    const student = students.find(s => s.id === studentId);
    if (student?.dbId) {
      await supabase.from("instructor_students").update({ meet_link: null }).eq("id", student.dbId);
    }
    setStudents((prev) =>
      prev.map((s) => s.id === studentId ? { ...s, meetLink: "" } : s)
    );
  };

  const [savingStudent, setSavingStudent] = useState(false);

  const registerStudent = async () => {
    if (!newStudent.name || !newStudent.level || !newStudent.instructor) return;
    setSavingStudent(true);

    // Find instructor_id
    const { data: instrData } = await supabase
      .from("instructors")
      .select("id")
      .eq("name", newStudent.instructor)
      .eq("active", true)
      .maybeSingle();

    const { data, error } = await supabase
      .from("instructor_students")
      .insert({
        student_name: newStudent.name,
        english_name: newStudent.englishName.trim() || null,
        instructor_id: instrData?.id ?? null,
        level: newStudent.level,
        start_date: newStudent.startDate || null,
        instructor_name: newStudent.instructor,
        extra_lessons: newStudent.extraLessons,
        schedules: newStudent.schedules.length > 0 ? JSON.stringify(newStudent.schedules) : null,
        status: "active",
        student_type: newStudent.studentType,
        learning_objective: newStudent.learningObjective.trim() || null,
        google_sheet_url: newStudent.googleSheetUrl.trim() || null,
        meet_link: newStudent.meetLink.trim() || null,
      } as any)
      .select()
      .single();

    setSavingStudent(false);

    if (error) {
      toast({ title: "등록 실패", description: error.message, variant: "destructive" });
      return;
    }

    const s: Student = {
      pauses: [],
      id: Date.now(),
      dbId: data.id,
      name: newStudent.name,
      englishName: newStudent.englishName,
      
      level: newStudent.level as Level,
      startDate: newStudent.startDate,
      instructor: newStudent.instructor,
      status: "active",
      totalLessons: 0,
      extraLessons: newStudent.extraLessons,
      presetHomework: [],
      lessonGoal: "",
      learningObjective: newStudent.learningObjective,
      lessonHistory: [],
      reminderEnabled: true,
      meetLink: newStudent.meetLink,
      schedules: newStudent.schedules,
      studentType: newStudent.studentType,
      groupStudents: [],
      googleSheetUrl: newStudent.googleSheetUrl,
    };
    setStudents((prev) => [s, ...prev]);
    setNewStudent({ name: "", englishName: "", level: "", instructor: "", startDate: "", extraLessons: 0, schedules: [], studentType: "regular", learningObjective: "", googleSheetUrl: "", meetLink: "" });
    setDialogOpen(false);
    toast({ title: `${newStudent.name} 수강생 등록 완료 ✓` });

    // Create default preset homework (vocab test)
    supabase.from("homework_assignments").select("id").eq("student_name", newStudent.name).eq("is_preset", true).eq("title", "단어 테스트 1회 이상 참여하기").then(({ data: existing }) => {
      if (!existing || existing.length === 0) {
        supabase.from("homework_assignments").insert({
          student_name: newStudent.name,
          title: "단어 테스트 1회 이상 참여하기",
          type: "memorizing",
          is_preset: true,
        }).then(() => {});
      }
    });

    // Auto-generate sessions for active periods
    autoGenerateSessions();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">수강생 관리</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">수강생 등록 및 학습 이력 관리</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2 border-gold text-gold-dark hover:bg-gold/8">
            <Download className="w-4 h-4" />
            이번달 수강생 리스트
          </Button>
          <Button variant="outline" size="sm" className="gap-2 border-[hsl(var(--navy)/0.5)] text-[hsl(var(--navy))] hover:bg-[hsl(var(--navy)/0.08)]" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="w-4 h-4" />
            강사 이관
          </Button>
          {/* 학생 초대 다이얼로그 */}
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-[hsl(var(--success)/0.6)] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.08)]">
                <Mail className="w-4 h-4" />
                계정 초대
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>학생 계정 초대</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-xs text-muted-foreground">
                  학생 이메일로 초대 메일을 발송합니다.<br />
                  학생이 링크를 클릭하면 닉네임·비밀번호를 설정하고 대시보드에 로그인할 수 있습니다.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">등록된 학생 이름 (정확히 입력)</Label>
                  <Input
                    placeholder="예: 정유리"
                    value={inviteStudentName}
                    onChange={(e) => setInviteStudentName(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">학생 이메일</Label>
                  <Input
                    type="email"
                    placeholder="student@email.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Button
                  className="w-full gap-2 bg-navy hover:bg-navy-light text-primary-foreground"
                  disabled={!inviteEmail.trim() || !inviteStudentName.trim() || inviting}
                  onClick={handleInviteStudent}
                >
                  {inviting ? <><Loader2 className="w-4 h-4 animate-spin" />발송 중...</> : <><Mail className="w-4 h-4" />초대 메일 발송</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 bg-navy hover:bg-navy-light text-primary-foreground">
                <Plus className="w-4 h-4" />
                신규 등록
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>신규 수강생 등록</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">이름</Label>
                    <Input
                      placeholder="조은순"
                      className="h-9"
                      value={newStudent.name}
                      onChange={(e) => setNewStudent((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">영어이름</Label>
                    <Input
                      placeholder="Joy"
                      className="h-9"
                      value={newStudent.englishName}
                      onChange={(e) => setNewStudent((p) => ({ ...p, englishName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">레벨</Label>
                    <Select
                      value={newStudent.level}
                      onValueChange={(v) => setNewStudent((p) => ({ ...p, level: v as Level }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">담당 강사</Label>
                    <Select
                      value={newStudent.instructor}
                      onValueChange={(v) => setNewStudent((p) => ({ ...p, instructor: v }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {instructorNames.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">수업 시작일</Label>
                  <Input
                    type="date"
                    className="h-9"
                    value={newStudent.startDate}
                    onChange={(e) => setNewStudent((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </div>

                {/* 수업 유형 */}
                <div className="space-y-1.5">
                  <Label className="text-xs">수업 유형</Label>
                  <Select
                    value={newStudent.studentType}
                    onValueChange={(v) => setNewStudent((p) => ({ ...p, studentType: v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">정기 (개인)</SelectItem>
                      <SelectItem value="corporate">기업 수업 (비정기)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 최종 학습 목표 */}
                <div className="space-y-1.5">
                  <Label className="text-xs">최종 학습 목표</Label>
                  <Textarea
                    placeholder="예: 비즈니스 영어 회화 능력 향상"
                    className="min-h-[60px] text-sm"
                    value={newStudent.learningObjective}
                    onChange={(e) => setNewStudent((p) => ({ ...p, learningObjective: e.target.value }))}
                  />
                </div>

                {/* 구글 미트 링크 */}
                <div className="space-y-1.5">
                  <Label className="text-xs">구글 미트 링크</Label>
                  <Input
                    placeholder="meet.google.com/xxx-xxxx-xxx"
                    className="h-9"
                    value={newStudent.meetLink}
                    onFocus={() => { if (!newStudent.meetLink) setNewStudent((p) => ({ ...p, meetLink: "https://" })); }}
                    onChange={(e) => setNewStudent((p) => ({ ...p, meetLink: e.target.value }))}
                  />
                </div>

                {/* 구글시트 URL */}
                <div className="space-y-1.5">
                  <Label className="text-xs">구글시트 URL</Label>
                  <Input
                    placeholder="https://docs.google.com/spreadsheets/..."
                    className="h-9"
                    value={newStudent.googleSheetUrl}
                    onChange={(e) => setNewStudent((p) => ({ ...p, googleSheetUrl: e.target.value }))}
                  />
                </div>

                {/* 수업 일정 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      수업 일정
                    </Label>
                    <button
                      type="button"
                      className="text-xs text-navy hover:underline flex items-center gap-1"
                      onClick={() =>
                        setNewStudent((p) => ({
                          ...p,
                          schedules: [...p.schedules, { day: "월", time: "10:00" }],
                        }))
                      }
                    >
                      <Plus className="w-3 h-3" /> 추가
                    </button>
                  </div>
                  {newStudent.schedules.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">수업 일정을 추가하세요</p>
                  ) : (
                    <div className="space-y-2">
                      {newStudent.schedules.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Select
                            value={slot.day}
                            onValueChange={(v) =>
                              setNewStudent((p) => ({
                                ...p,
                                schedules: p.schedules.map((s, i) => i === idx ? { ...s, day: v } : s),
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 w-20 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map((d) => (
                                <SelectItem key={d} value={d}>{d}요일</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={slot.time}
                            onValueChange={(v) =>
                              setNewStudent((p) => ({
                                ...p,
                                schedules: p.schedules.map((s, i) => i === idx ? { ...s, time: v } : s),
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 w-[72px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {HOURS.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={slot.frequency || "weekly"}
                            onValueChange={(v) =>
                              setNewStudent((p) => ({
                                ...p,
                                schedules: p.schedules.map((s, i) => i === idx ? { ...s, frequency: v as Frequency } : s),
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 w-[72px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(FREQ_LABELS) as Frequency[]).map((f) => (
                                <SelectItem key={f} value={f}>{FREQ_LABELS[f]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setNewStudent((p) => ({
                                ...p,
                                schedules: p.schedules.filter((_, i) => i !== idx),
                              }))
                            }
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fee calculator */}
                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                  {(() => {
                    const baseLessons = calcBaseLessons(newStudent.schedules);
                    const baseFee = baseLessons * LESSON_PRICE;
                    return <>
                  <p className="text-xs font-semibold text-foreground">💰 이번달 수강료 계산</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>기본 수업 ({baseLessons}회 × ₩{LESSON_PRICE.toLocaleString()})</span>
                    <span className="font-medium text-foreground">₩{baseFee.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground flex-1">추가 수업 횟수</span>
                    <Input
                      type="number"
                      min={0}
                      value={newStudent.extraLessons}
                      onChange={(e) =>
                        setNewStudent((p) => ({ ...p, extraLessons: Math.max(0, Number(e.target.value)) }))
                      }
                      className="h-7 w-16 text-sm text-center"
                    />
                    <span className="text-xs text-muted-foreground">회</span>
                  </div>
                  {newStudent.extraLessons > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>추가 수업료 ({newStudent.extraLessons}회 × ₩{LESSON_PRICE.toLocaleString()})</span>
                      <span className="font-medium text-foreground">+₩{(newStudent.extraLessons * LESSON_PRICE).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <span className="text-xs font-semibold text-foreground">이번달 총 수강료</span>
                    <span className="text-sm font-bold text-gold-dark">
                      ₩{calcMonthlyFee(baseLessons, newStudent.extraLessons).toLocaleString()}
                    </span>
                  </div>
                  </>;
                  })()}
                </div>

                <Button
                  className="w-full bg-navy hover:bg-navy-light text-primary-foreground"
                  onClick={registerStudent}
                  disabled={!newStudent.name || !newStudent.level || !newStudent.instructor || savingStudent}
                >
                  {savingStudent ? "등록 중..." : "등록하기"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {(["active", "graduated"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "active" ? "수강중" : "퇴원생"} ({students.filter((s) => s.status === t && s.studentType !== "corporate").length}명)
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="수강생 이름 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Student list grouped by instructor */}
      <div className="space-y-5">
        {(() => {
          // Group by instructor, sort instructor names ㄱ→ㅎ
          const grouped: Record<string, Student[]> = {};
          filtered.forEach((s) => {
            const key = s.instructor || "미지정";
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(s);
          });
          // Sort each group's students by name ㄱ→ㅎ
          Object.values(grouped).forEach((arr) =>
            arr.sort((a, b) => a.name.localeCompare(b.name, "ko"))
          );
          const sortedKeys = Object.keys(grouped).sort((a, b) =>
            a === "미지정" ? 1 : b === "미지정" ? -1 : a.localeCompare(b, "ko")
          );
          return sortedKeys.map((instrName) => (
            <div key={instrName}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  👩‍🏫 {instrName}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({grouped[instrName].length}명)
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
              <div className="space-y-2">
          {grouped[instrName].map((student) => {
          const baseLessons = calcBaseLessons(student.schedules);
          const monthlyFee = calcMonthlyFee(baseLessons, student.extraLessons);
          const isEditing = editingStudentId === student.id;

          return (
            <Card key={student.id} className="shadow-card border-border overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => handleExpandStudent(student.id, student.name)}
              >
                <div className="w-9 h-9 rounded-full bg-navy/8 flex items-center justify-center flex-shrink-0">
                  <span className="text-navy font-bold text-sm">{student.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground text-sm">{formatStudentName(student.name, student.englishName)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColors[student.level]}`}>
                      {student.level}
                    </span>
                    {student.studentType === "corporate" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">기업</span>
                    )}
                    {student.extraLessons > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gold/15 text-gold-dark font-medium">
                        +{student.extraLessons}회
                      </span>
                    )}
                    {student.pauses.length > 0 && (() => {
                      const now = todayKSTString();
                      const activePause = student.pauses.find(p => now >= p.pause_start && (!p.pause_end || now <= p.pause_end));
                      const futurePause = student.pauses.find(p => now < p.pause_start);
                      return activePause ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium flex items-center gap-0.5">
                          <Pause className="w-3 h-3" /> 휴강중
                        </span>
                      ) : futurePause ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                          휴강 예정
                        </span>
                      ) : null;
                    })()}
                    {student.transferHistory && student.transferHistory.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-medium flex items-center gap-0.5">
                        <ArrowRightLeft className="w-3 h-3" /> 이관
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">담당 강사 : {student.instructor || "미지정"}</p>
                </div>
                <div className="hidden md:flex items-center gap-5 text-sm">
                  <div className="text-center">
                    <p className="font-semibold text-foreground">{student.totalLessons}회</p>
                    <p className="text-xs text-muted-foreground">누적수업</p>
                  </div>
                  <div className="text-center">
                    {student.studentType === "corporate" ? (
                      <>
                        <p className="font-semibold text-blue-600">회당 정산</p>
                        <p className="text-xs text-muted-foreground">기업 수업</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-gold-dark">₩{monthlyFee.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">이번달 수강료</p>
                      </>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">시작일</p>
                    <p className="text-xs font-medium text-foreground">{student.startDate}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px] gap-1 border-[hsl(var(--navy))]/30 text-[hsl(var(--navy))] hover:bg-[hsl(var(--navy))]/8 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/t/student-dashboard?student_name=${encodeURIComponent(student.name)}`);
                  }}
                >
                  <ExternalLink className="w-3 h-3" />
                  대시보드
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px] gap-1 border-gold/40 text-gold-dark hover:bg-gold/8 flex-shrink-0"
                  disabled={!student.googleSheetUrl}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (student.googleSheetUrl) {
                      const url = student.googleSheetUrl.startsWith("http") ? student.googleSheetUrl : `https://${student.googleSheetUrl}`;
                      window.open(url, "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  <FileText className="w-3 h-3" />
                  학생일지
                </Button>
                {expandedId === student.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>

              {expandedId === student.id && (
                <div className="border-t border-border bg-muted/20 p-4 space-y-4">

                  {/* Meet Link */}
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-navy" />
                        Google Meet 링크
                      </h4>
                      {!editingMeetId && (
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); setEditingMeetId(student.id); setMeetLinkInput(student.meetLink || "https://"); }}
                        >
                          <Edit2 className="w-3 h-3" />
                          {student.meetLink ? "수정" : "추가"}
                        </Button>
                      )}
                    </div>

                    {editingMeetId === student.id ? (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex-1 relative">
                          <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            value={meetLinkInput}
                            onChange={(e) => setMeetLinkInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveMeetLink(student.id); if (e.key === "Escape") { setEditingMeetId(null); setMeetLinkInput(""); } }}
                            placeholder="https://meet.google.com/xxx-xxxx-xxx"
                            className="h-8 text-xs pl-8"
                            autoFocus
                          />
                        </div>
                        <Button size="sm" className="h-8 px-3 text-xs bg-navy hover:bg-navy-light text-primary-foreground" onClick={() => saveMeetLink(student.id)}>
                          저장
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => { setEditingMeetId(null); setMeetLinkInput(""); }}>
                          취소
                        </Button>
                      </div>
                    ) : student.meetLink ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={student.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md bg-navy/5 border border-navy/15 text-navy text-xs font-medium hover:bg-navy/10 transition-colors truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Video className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{student.meetLink}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0 ml-auto" />
                        </a>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMeetLink(student.id); }}
                          className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">링크가 설정되지 않았습니다</p>
                    )}
                  </div>

                  {/* Google Sheet (학생일지) Link */}
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-navy" />
                        학생일지 링크
                      </h4>
                      {editingSheetId !== student.id && (
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); setEditingSheetId(student.id); setSheetLinkInput(student.googleSheetUrl || "https://"); }}
                        >
                          <Edit2 className="w-3 h-3" />
                          {student.googleSheetUrl ? "수정" : "추가"}
                        </Button>
                      )}
                    </div>

                    {editingSheetId === student.id ? (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex-1 relative">
                          <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            value={sheetLinkInput}
                            onChange={(e) => setSheetLinkInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const url = sheetLinkInput.trim();
                                if (url && !url.startsWith("http")) return;
                                const st = students.find(s => s.id === student.id);
                                if (st?.dbId) {
                                  supabase.from("instructor_students").update({ google_sheet_url: url || null } as any).eq("id", st.dbId).then(({ error }) => {
                                    if (error) { toast({ title: "저장 실패", description: error.message, variant: "destructive" }); return; }
                                    toast({ title: "학생일지 링크가 저장됐습니다 ✓" });
                                    setStudents(prev => prev.map(s => s.id === student.id ? { ...s, googleSheetUrl: url } : s));
                                    setEditingSheetId(null); setSheetLinkInput("");
                                  });
                                }
                              }
                              if (e.key === "Escape") { setEditingSheetId(null); setSheetLinkInput(""); }
                            }}
                            placeholder="https://docs.google.com/spreadsheets/..."
                            className="h-8 text-xs pl-8"
                            autoFocus
                          />
                        </div>
                        <Button size="sm" className="h-8 px-3 text-xs bg-navy hover:bg-navy-light text-primary-foreground" onClick={async () => {
                          const url = sheetLinkInput.trim();
                          if (url && !url.startsWith("http")) return;
                          const st = students.find(s => s.id === student.id);
                          if (st?.dbId) {
                            const { error } = await supabase.from("instructor_students").update({ google_sheet_url: url || null } as any).eq("id", st.dbId);
                            if (error) { toast({ title: "저장 실패", description: error.message, variant: "destructive" }); return; }
                            toast({ title: "학생일지 링크가 저장됐습니다 ✓" });
                            setStudents(prev => prev.map(s => s.id === student.id ? { ...s, googleSheetUrl: url } : s));
                          }
                          setEditingSheetId(null); setSheetLinkInput("");
                        }}>
                          저장
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => { setEditingSheetId(null); setSheetLinkInput(""); }}>
                          취소
                        </Button>
                      </div>
                    ) : student.googleSheetUrl ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={student.googleSheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md bg-navy/5 border border-navy/15 text-navy text-xs font-medium hover:bg-navy/10 transition-colors truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{student.googleSheetUrl}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0 ml-auto" />
                        </a>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const st = students.find(s => s.id === student.id);
                            if (st?.dbId) {
                              await supabase.from("instructor_students").update({ google_sheet_url: null } as any).eq("id", st.dbId);
                            }
                            setStudents(prev => prev.map(s => s.id === student.id ? { ...s, googleSheetUrl: "" } : s));
                            toast({ title: "학생일지 링크 삭제 완료 ✓" });
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">링크가 설정되지 않았습니다</p>
                    )}
                  </div>

                  {/* Transfer History (이관 이력) */}
                  {student.transferHistory && student.transferHistory.length > 0 && (
                    <div className="p-3 rounded-lg bg-card border border-border space-y-2">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-navy" />
                        강사 이관 이력
                      </h4>
                      <div className="space-y-2">
                        {student.transferHistory.map((t, idx) => {
                          const isLatest = idx === student.transferHistory!.length - 1;
                          return (
                          <div key={idx} className="p-2.5 rounded-md bg-muted/40 border border-border space-y-1.5">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-foreground">{t.fromInstructor}</span>
                              <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium text-foreground">{t.toInstructor}</span>
                              <span className="text-muted-foreground ml-auto">{t.transferDate}</span>
                            </div>
                            <div className="flex items-start gap-4 text-[11px] text-muted-foreground">
                              <div>
                                <span className="text-muted-foreground/70">이전:</span>{" "}
                                <span>{t.oldSchedules}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground/70">변경:</span>{" "}
                                <span>{t.newSchedules}</span>
                              </div>
                            </div>
                            {isLatest && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                                    disabled={cancellingTransfer}
                                  >
                                    <Undo2 className="w-3 h-3" />
                                    이관 취소
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>이관 취소 확인</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {student.name} 수강생의 이관을 취소하시겠습니까?
                                      <br />• {t.toInstructor} → {t.fromInstructor} 강사로 복원됩니다
                                      <br />• 새 강사의 미시작 세션이 삭제됩니다
                                      <br />• 이미 진행된 수업은 유지됩니다
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleCancelTransfer(student.name, t)}
                                    >
                                      이관 취소 실행
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pause (휴강) Section */}
                  <div className="p-3 rounded-lg bg-card border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Pause className="w-3.5 h-3.5 text-warning" />
                        휴강 관리
                      </h4>
                    </div>
                    {/* Existing pauses list */}
                    {student.pauses.length > 0 && (
                      <div className="space-y-1.5">
                        {student.pauses.map((p) => {
                          const now = todayKSTString();
                          const isActive = now >= p.pause_start && (!p.pause_end || now <= p.pause_end);
                          return (
                            <div key={p.id} className={cn(
                              "flex items-center justify-between gap-2 p-2 rounded-md border text-xs",
                              isActive ? "bg-warning/10 border-warning/30" : "bg-muted/30 border-border"
                            )}>
                              <div className="flex items-center gap-2">
                                <Pause className={cn("w-3 h-3 flex-shrink-0", isActive ? "text-warning" : "text-muted-foreground")} />
                                <span className={cn("font-medium", isActive ? "text-warning" : "text-muted-foreground")}>
                                  {p.pause_start} ~ {p.pause_end || "미정"}
                                </span>
                                {isActive && <Badge variant="outline" className="text-[9px] h-4 bg-warning/10 text-warning border-warning/30">진행중</Badge>}
                              </div>
                              <button
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await supabase.from("student_pauses").delete().eq("id", p.id);
                                  setStudents(prev => prev.map(s => s.id === student.id
                                    ? { ...s, pauses: s.pauses.filter(pp => pp.id !== p.id) }
                                    : s
                                  ));
                                  toast({ title: "휴강 기록 삭제 완료 ✓" });
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Add new pause */}
                    <PauseForm
                      onSave={async (start, end) => {
                        if (!student.dbId) return;
                        const { data: newPause } = await supabase.from("student_pauses").insert({
                          student_id: student.dbId,
                          pause_start: start,
                          pause_end: end,
                        }).select().single();
                        if (newPause) {
                          setStudents(prev => prev.map(s => s.id === student.id
                            ? { ...s, pauses: [...s.pauses, { id: newPause.id, pause_start: start, pause_end: end, reason: null }] }
                            : s
                          ));
                        }

                        // Delete unstarted sessions within the pause period
                        const pauseStart = new Date(start + "T00:00:00+09:00");
                        const pauseEnd = new Date(end + "T23:59:59+09:00");
                        const { data: overlapping } = await supabase
                          .from("class_sessions")
                          .select("id, scheduled_at, started_at, notes, reschedule_origin_dates")
                          .eq("student_name", student.name)
                          .gte("scheduled_at", pauseStart.toISOString())
                          .lte("scheduled_at", pauseEnd.toISOString());

                        const deletableIds = (overlapping || [])
                          .filter(s => !s.started_at && (!s.notes || s.notes === ""))
                          .map(s => s.id);

                        if (deletableIds.length > 0) {
                          await supabase.from("class_sessions").delete().in("id", deletableIds);
                        }

                        toast({
                          title: `${student.name} 휴강 추가 완료 ✓`,
                          description: `${start} ~ ${end}${deletableIds.length > 0 ? ` (${deletableIds.length}개 세션 삭제)` : ""}`,
                        });
                      }}
                    />
                  </div>

                  {/* Inline edit: level + extra lessons */}
                  <div className="p-3 rounded-lg bg-card border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">수강 정보 수정</p>
                      {!isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); startInlineEdit(student); }}
                        >
                          <Edit2 className="w-3 h-3" /> 수정
                        </Button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">영어이름</Label>
                          <Input
                            value={editEnglishName}
                            onChange={(e) => setEditEnglishName(e.target.value)}
                            placeholder="Joy"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">수강생 유형</Label>
                          <Select value={editStudentType} onValueChange={(v) => setEditStudentType(v as "regular" | "corporate")}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="regular">정규</SelectItem>
                              <SelectItem value="corporate">기업 (비정기)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">레벨</Label>
                            <Select value={editLevel} onValueChange={(v) => setEditLevel(v as Level)}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LEVELS.map((l) => (
                                  <SelectItem key={l} value={l}>{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">이번달 추가 수업 횟수</Label>
                            <Input
                              type="number"
                              min={0}
                              value={editExtra}
                              onChange={(e) => setEditExtra(Math.max(0, Number(e.target.value)))}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">담당 강사</Label>
                          <Select value={editInstructor} onValueChange={setEditInstructor}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {instructorNames.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" /> 수업 시작일
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("h-8 w-full text-sm justify-start", !editStartDate && "text-muted-foreground")}>
                                <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                                {editStartDate ? format(editStartDate, "yyyy-MM-dd") : "선택"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={editStartDate} onSelect={setEditStartDate} className={cn("p-3 pointer-events-auto")} />
                            </PopoverContent>
                          </Popover>
                        </div>
                        {/* Schedule editing */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 수업 일정
                          </Label>
                          {editSchedules.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {editSchedules.map((slot, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-navy/8 text-navy font-medium">
                                  {slot.day}요일 {slot.time} {slot.frequency && slot.frequency !== "weekly" ? `(${FREQ_LABELS[slot.frequency]})` : ""}
                                  <button type="button" onClick={() => setEditSchedules(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-1">
                            <Select value={editSchedDay} onValueChange={setEditSchedDay}>
                              <SelectTrigger className="h-7 text-xs w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DAYS_OF_WEEK.map((d) => (
                                  <SelectItem key={d} value={d}>{d}요일</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={editSchedTime} onValueChange={setEditSchedTime}>
                              <SelectTrigger className="h-7 text-xs w-[72px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {HOURS.map((h) => (
                                  <SelectItem key={h} value={h}>{h}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={editSchedFreq} onValueChange={(v) => setEditSchedFreq(v as Frequency)}>
                              <SelectTrigger className="h-7 text-xs w-[72px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(FREQ_LABELS) as Frequency[]).map((f) => (
                                  <SelectItem key={f} value={f}>{FREQ_LABELS[f]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2"
                              onClick={() => {
                                const exists = editSchedules.some(s => s.day === editSchedDay && s.time === editSchedTime);
                                if (!exists) {
                                  setEditSchedules(prev => [...prev, { day: editSchedDay, time: editSchedTime, frequency: editSchedFreq }]);
                                }
                              }}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Target className="w-3 h-3" /> 등록 계기 / 최종 목표
                          </Label>
                          {editObjectives.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {editObjectives.map((obj, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-foreground">
                                  {obj}
                                  <button type="button" onClick={() => setEditObjectives(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-1">
                            <Input
                              value={editNewObjective}
                              onChange={(e) => setEditNewObjective(e.target.value)}
                              placeholder="예: 해외여행 시 자유로운 대화"
                              className="h-7 text-xs"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editNewObjective.trim()) {
                                  e.preventDefault();
                                  setEditObjectives(prev => [...prev, editNewObjective.trim()]);
                                  setEditNewObjective("");
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2"
                              disabled={!editNewObjective.trim()}
                              onClick={() => { setEditObjectives(prev => [...prev, editNewObjective.trim()]); setEditNewObjective(""); }}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {/* Group students */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" /> 그룹 수강생
                          </Label>
                          {editGroupStudents.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {editGroupStudents.map((name, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/50 text-foreground">
                                  {name}
                                  <button type="button" onClick={() => setEditGroupStudents(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <Select
                            value=""
                            onValueChange={(v) => {
                              if (v && !editGroupStudents.includes(v)) {
                                setEditGroupStudents(prev => [...prev, v]);
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="수강생 추가..." />
                            </SelectTrigger>
                            <SelectContent>
                              {students
                                .filter(s => s.status === "active" && s.name !== students.find(st => st.id === editingStudentId)?.name && !editGroupStudents.includes(s.name))
                                .sort((a, b) => a.name.localeCompare(b.name, "ko"))
                                .map(s => (
                                  <SelectItem key={s.dbId || s.name} value={s.name}>{s.name}</SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                        {/* Fee preview */}
                        {(() => {
                          const editBaseLessons = calcBaseLessons(editSchedules);
                          return <div className="p-2 rounded bg-muted/40 text-xs flex items-center justify-between">
                          <span className="text-muted-foreground">
                            기본 {editBaseLessons}회 + 추가 {editExtra}회 = {editBaseLessons + editExtra}회
                          </span>
                          <span className="font-bold text-gold-dark">₩{calcMonthlyFee(editBaseLessons, editExtra).toLocaleString()}</span>
                        </div>;
                        })()}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-navy hover:bg-navy-light text-primary-foreground"
                            onClick={() => saveInlineEdit(student.id)}
                          >
                            저장
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setEditingStudentId(null)}
                          >
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">레벨</p>
                            <p className="font-semibold text-foreground mt-0.5">{student.level}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">담당 강사</p>
                            <p className="font-semibold text-foreground mt-0.5">{student.instructor}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">이번달 수업</p>
                            <p className="font-semibold text-foreground mt-0.5">
                              {baseLessons}회 {student.extraLessons > 0 && <span className="text-gold-dark">+{student.extraLessons}회</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">이번달 수강료</p>
                            {student.studentType === "corporate" ? (
                              <p className="font-bold text-blue-600 mt-0.5">회당 정산 (기업)</p>
                            ) : (
                              <p className="font-bold text-gold-dark mt-0.5">₩{monthlyFee.toLocaleString()}</p>
                            )}
                          </div>
                          {student.studentType === "corporate" && (
                            <div>
                              <p className="text-muted-foreground">수업 보고서</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-1 h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                                disabled={reportLoading === student.name}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setReportLoading(student.name);
                                  try {
                                    const { prepareReportData } = await import("@/lib/exportCorporateReportPdf");
                                    const _now = new Date();
                                    const _y = _now.getFullYear();
                                    const _m = _now.getMonth();
                                    const _startDate = `${_y}-${String(_m + 1).padStart(2, "0")}-01`;
                                    const _lastDay = new Date(_y, _m + 1, 0).getDate();
                                    const _endDate = `${_y}-${String(_m + 1).padStart(2, "0")}-${String(_lastDay).padStart(2, "0")}`;
                                    const _label = `${_y}년 ${_m + 1}월`;
                                    const { data: sessData } = await supabase
                                      .from("class_sessions")
                                      .select("scheduled_at,student_name,topic,notes,level,ended_at,group_students")
                                      .eq("student_name", student.name)
                                      .gte("scheduled_at", _startDate + "T00:00:00+09:00")
                                      .lte("scheduled_at", _endDate + "T23:59:59+09:00")
                                      .order("scheduled_at");
                                    let objs: string[] = [];
                                    try { objs = JSON.parse(student.learningObjective || "[]"); } catch { objs = student.learningObjective ? [student.learningObjective] : []; }
                                    const groupStudents = (sessData || []).find(s => s.group_students && s.group_students.length > 0)?.group_students || [];
                                    const previewData = await prepareReportData(
                                      sessData || [],
                                      { studentName: student.name, instructorName: student.instructor, learningObjective: objs.join(", "), groupStudents },
                                      { label: _label, start_date: _startDate, end_date: _endDate },
                                    );
                                    setReportPreview(previewData);
                                  } catch (err) {
                                    toast({ title: "보고서 생성 실패", variant: "destructive" });
                                  } finally {
                                    setReportLoading(null);
                                  }
                                }}
                              >
                                {reportLoading === student.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                {reportLoading === student.name ? "AI 생성 중..." : "보고서 다운로드"}
                              </Button>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground">시작일</p>
                            <p className="font-semibold text-foreground mt-0.5">{student.startDate || <span className="text-muted-foreground font-normal">미설정</span>}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" />등록 계기 / 최종 목표</p>
                            {(() => {
                              let objs: string[] = [];
                              try { const p = JSON.parse(student.learningObjective || "[]"); objs = Array.isArray(p) ? p : student.learningObjective ? [student.learningObjective] : []; } catch { objs = student.learningObjective ? [student.learningObjective] : []; }
                              return objs.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {objs.map((o, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground font-medium">{o}</span>)}
                                </div>
                              ) : <p className="text-muted-foreground font-normal mt-0.5">미설정</p>;
                            })()}
                          </div>
                        </div>
                        {student.schedules.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                              <Clock className="w-3 h-3" />수업 일정
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {student.schedules.map((slot, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-navy/8 text-navy font-medium">
                                  {slot.day}요일 {slot.time} {slot.frequency && slot.frequency !== "weekly" ? `(${FREQ_LABELS[slot.frequency]})` : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Preset Homework */}
                  <div className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-gold" />
                        정기 숙제 설정
                        <span className="text-xs font-normal text-muted-foreground">— 클래스룸에 자동으로 반영됩니다</span>
                      </h4>
                    </div>

                    {/* Preset list */}
                    <div className="space-y-2 mb-3">
                      {loadingPresets[student.id] ? (
                        <p className="text-xs text-muted-foreground py-1">불러오는 중...</p>
                      ) : (presetMap[student.id] || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">설정된 정기 숙제가 없습니다</p>
                      ) : (
                        (presetMap[student.id] || []).map((hw) => {
                          const meta = HW_TYPE_META[hw.type];
                          const Icon = meta?.icon;
                          const isEditingThis = editingPresetId === hw.id;

                          if (isEditingThis) {
                            return (
                              <div key={hw.id} className="border border-[hsl(var(--gold)/0.5)] rounded-lg p-3 space-y-2.5 bg-[hsl(var(--gold)/0.04)]" onClick={(e) => e.stopPropagation()}>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(Object.keys(HW_TYPE_META) as HwType[]).map((t) => {
                                    const m = HW_TYPE_META[t];
                                    const TIcon = m.icon;
                                    return (
                                      <button key={t} onClick={() => setEditPresetType(t)}
                                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                                          editPresetType === t
                                            ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.10)] text-foreground"
                                            : "border-border bg-card text-muted-foreground hover:border-[hsl(var(--gold)/0.4)]"
                                        }`}
                                      >
                                        <TIcon className={`w-3.5 h-3.5 flex-shrink-0 ${editPresetType === t ? m.color : ""}`} />
                                        {m.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                <p className="text-[10px] text-muted-foreground">{HW_TYPE_META[editPresetType].hint}</p>
                                <Input value={editPresetTitle} onChange={(e) => setEditPresetTitle(e.target.value)} placeholder="숙제 제목 (필수)" className="h-8 text-xs" autoFocus />
                                <Input value={editPresetDesc} onChange={(e) => setEditPresetDesc(e.target.value)} placeholder="상세 설명 (선택)" className="h-8 text-xs" />
                                <div className="flex gap-1.5">
                                  <Button size="sm" disabled={!editPresetTitle.trim() || savingEditPreset}
                                    className="flex-1 h-8 text-xs bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground"
                                    onClick={(e) => { e.stopPropagation(); saveEditPreset(student.id); }}
                                  >
                                    <Check className="w-3 h-3 mr-1" />{savingEditPreset ? "저장 중..." : "저장"}
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); cancelEditPreset(); }}>취소</Button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={hw.id} className="rounded-md border border-border bg-muted/20 px-3 py-2 group flex items-start gap-2.5">
                              {Icon && <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${meta.color}`} />}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-medium text-foreground">{hw.title}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-medium ${meta?.color}`}>
                                    {meta?.label}
                                  </span>
                                </div>
                                {hw.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{hw.description}</p>
                                )}
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5">{meta?.hint}</p>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                                <button onClick={(e) => { e.stopPropagation(); startEditPreset(hw); }} className="text-muted-foreground hover:text-foreground">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); removePresetHw(student.id, hw.id); }} className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Add preset form */}
                    {addingPresetFor === student.id ? (
                      <div className="border border-[hsl(var(--gold)/0.4)] rounded-lg p-3 space-y-2.5 bg-[hsl(var(--gold)/0.04)]" onClick={(e) => e.stopPropagation()}>
                        {/* Type selector */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {(Object.keys(HW_TYPE_META) as HwType[]).map((t) => {
                            const m = HW_TYPE_META[t];
                            const Icon = m.icon;
                            return (
                              <button
                                key={t}
                                onClick={() => setNewPresetType(t)}
                                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                                  newPresetType === t
                                    ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.10)] text-foreground"
                                    : "border-border bg-card text-muted-foreground hover:border-[hsl(var(--gold)/0.4)]"
                                }`}
                              >
                                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${newPresetType === t ? m.color : ""}`} />
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{HW_TYPE_META[newPresetType].hint}</p>
                        <Input
                          value={newPresetTitle}
                          onChange={(e) => setNewPresetTitle(e.target.value)}
                          placeholder="숙제 제목 (필수)"
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <Input
                          value={newPresetDesc}
                          onChange={(e) => setNewPresetDesc(e.target.value)}
                          placeholder="상세 설명 (선택)"
                          className="h-8 text-xs"
                        />
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            disabled={!newPresetTitle.trim() || savingPreset}
                            className="flex-1 h-8 text-xs bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground"
                            onClick={(e) => { e.stopPropagation(); addPresetHw(student.id, student.name); }}
                          >
                            {savingPreset ? "저장 중..." : "추가"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); setAddingPresetFor(null); setNewPresetTitle(""); setNewPresetDesc(""); }}>
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 border-dashed"
                        onClick={(e) => { e.stopPropagation(); setAddingPresetFor(student.id); setNewPresetType("writing"); setNewPresetTitle(""); setNewPresetDesc(""); }}
                      >
                        <Plus className="w-3 h-3" />
                        정기 숙제 추가
                      </Button>
                    )}
                </div>

                  {/* Lesson history preview */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-gold" />
                        최근 수업 이력
                        {(() => {
                          let objs: string[] = [];
                          try { const p = JSON.parse(student.learningObjective || "[]"); objs = Array.isArray(p) ? p : student.learningObjective ? [student.learningObjective] : []; } catch { objs = student.learningObjective ? [student.learningObjective] : []; }
                          return objs.length > 0 ? <span className="text-xs font-normal text-muted-foreground">— 최종 목표: {objs.join(", ")}</span> : null;
                        })()}
                      </h4>
                      <button
                        onClick={() => setShowHistory(showHistory === student.id ? null : student.id)}
                        className="text-xs text-navy hover:underline"
                      >
                        전체보기
                      </button>
                    </div>
                    {student.lessonHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">수업 이력이 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        {(showHistory === student.id ? student.lessonHistory : student.lessonHistory.slice(0, 3)).map((note, i) => (
                          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border">
                            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{note.date}</span>
                            <span className="flex-1 text-foreground text-xs font-medium">{note.topic}</span>
                            <span className="text-xs text-muted-foreground">단어 {note.vocaCount}개</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${note.hwStatus === "제출완료" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                              숙제 {note.hwStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Homework Reminder */}
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {student.reminderEnabled
                          ? <Bell className="w-3.5 h-3.5 text-gold" />
                          : <BellOff className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                        <div>
                          <p className="text-xs font-semibold text-foreground">숙제 미제출 리마인더</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            수업 후 48시간 · 다음 수업 전 48시간 — 총 2회 자동 발송 (수강생 + 담당 강사)
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleReminder(student.id); }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          student.reminderEnabled ? "bg-gold" : "bg-muted-foreground/30"
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform ${
                          student.reminderEnabled ? "translate-x-4" : "translate-x-1"
                        }`} />
                      </button>
                    </div>
                    {student.reminderEnabled && (
                      <div className="mt-2.5 space-y-2">
                        <div className="flex gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20 text-xs text-gold-dark">
                            <Bell className="w-3 h-3" />
                            <span>1차: 수업 후 48시간</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20 text-xs text-gold-dark">
                            <Bell className="w-3 h-3" />
                            <span>2차: 다음 수업 전 48시간</span>
                          </div>
                          <span className="text-xs text-muted-foreground self-center">※ 미제출 시에만 발송</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-navy/10 border border-navy/20 text-xs text-navy">
                            <Mail className="w-3 h-3" />
                            <span>수강생: 숙제 제출 안내</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-navy/10 border border-navy/20 text-xs text-navy">
                            <Mail className="w-3 h-3" />
                            <span>강사: 해당 학생 미제출 알림 · 연락 요청</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {tab === "active" && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => { setWithdrawTarget(student); setWithdrawReason(""); }}
                      >
                        <UserX className="w-3 h-3" />
                        퇴원 처리
                      </Button>
                    </div>
                  )}

                  {tab === "graduated" && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        ℹ️ 퇴원 처리된 수강생입니다. 수업 노트, 단어장 등 기존 데이터는 그대로 보관됩니다.
                      </p>
                      {student.withdrawalReason && (
                        <p className="text-xs text-muted-foreground">
                          📝 사유: {student.withdrawalReason}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 text-[hsl(var(--navy))] border-[hsl(var(--navy))]/30 hover:bg-[hsl(var(--navy))]/10"
                        onClick={async () => {
                          if (!student.dbId) return;
                          const { error } = await supabase.from("instructor_students").update({
                            status: "active",
                            withdrawal_reason: null,
                          }).eq("id", student.dbId);
                          if (error) {
                            toast({ title: "재등록 실패", description: error.message, variant: "destructive" });
                          } else {
                            setStudents((prev) => prev.map((s) => s.id === student.id ? { ...s, status: "active" as StudentStatus, withdrawalReason: "" } : s));
                            toast({ title: `${student.name} 재등록 완료 ✓`, description: "일정(스케줄)을 다시 설정한 후 세션을 생성해주세요." });
                          }
                        }}
                      >
                        <Play className="w-3 h-3" />
                        재등록 (수강 재개)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
              </div>
            </div>
          ));
        })()}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm font-medium">{tab === "active" ? "수강중인 수강생이 없습니다" : "퇴원생이 없습니다"}</p>
            {tab === "active" && <p className="text-xs mt-1">신규 등록 버튼을 눌러 수강생을 추가하세요.</p>}
          </div>
        )}
      </div>

      {/* Corporate student section */}
      {filteredCorporate.length > 0 && (
        <div className="space-y-5 mt-8">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
              🏢 기업 수강생
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              {filteredCorporate.length}명
            </span>
            <div className="flex-1 border-t border-border" />
          </div>
          {(() => {
            const grouped: Record<string, Student[]> = {};
            filteredCorporate.forEach((s) => {
              const key = s.instructor || "미지정";
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(s);
            });
            Object.values(grouped).forEach((arr) =>
              arr.sort((a, b) => a.name.localeCompare(b.name, "ko"))
            );
            const sortedKeys = Object.keys(grouped).sort((a, b) =>
              a === "미지정" ? 1 : b === "미지정" ? -1 : a.localeCompare(b, "ko")
            );
            return sortedKeys.map((instrName) => (
              <div key={`corp-${instrName}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    👩‍🏫 {instrName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({grouped[instrName].length}명)
                  </span>
                  <div className="flex-1 border-t border-border" />
                </div>
                <div className="space-y-2">
                  {grouped[instrName].map((student) => {
                    const isEditing = editingStudentId === student.id;
                    return (
                      <Card key={student.id} className="shadow-card border-border overflow-hidden">
                        <div
                          className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => handleExpandStudent(student.id, student.name)}
                        >
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-700 font-bold text-sm">{student.name.charAt(0)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground text-sm">{formatStudentName(student.name, student.englishName)}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColors[student.level]}`}>
                                {student.level}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">기업</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {student.instructor} · {student.startDate || "시작일 미정"}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px] gap-1 border-[hsl(var(--navy))]/30 text-[hsl(var(--navy))] hover:bg-[hsl(var(--navy))]/8 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/t/student-dashboard?student_name=${encodeURIComponent(student.name)}`);
                            }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            대시보드
                          </Button>
                      {expandedId === student.id ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>

                        {expandedId === student.id && (
                          <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                            {/* Inline edit: level + extra lessons */}
                            <div className="p-3 rounded-lg bg-card border border-border space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-foreground">수강 정보 수정</p>
                                {!isEditing && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                    onClick={(e) => { e.stopPropagation(); startInlineEdit(student); }}
                                  >
                                    <Edit2 className="w-3 h-3" /> 수정
                                  </Button>
                                )}
                              </div>

                              {isEditing ? (
                                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">영어이름</Label>
                                    <Input
                                      value={editEnglishName}
                                      onChange={(e) => setEditEnglishName(e.target.value)}
                                      placeholder="Joy"
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">수강생 유형</Label>
                                    <Select value={editStudentType} onValueChange={(v) => setEditStudentType(v as "regular" | "corporate")}>
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="regular">정규</SelectItem>
                                        <SelectItem value="corporate">기업 (비정기)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">레벨</Label>
                                      <Select value={editLevel} onValueChange={(v) => setEditLevel(v as Level)}>
                                        <SelectTrigger className="h-8 text-sm">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {LEVELS.map((l) => (
                                            <SelectItem key={l} value={l}>{l}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">추가 수업 횟수</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={editExtra}
                                        onChange={(e) => setEditExtra(Math.max(0, Number(e.target.value)))}
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">담당 강사</Label>
                                    <Select value={editInstructor} onValueChange={setEditInstructor}>
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {instructorNames.map((t) => (
                                          <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                      <CalendarIcon className="w-3 h-3" /> 수업 시작일
                                    </Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("h-8 w-full text-sm justify-start", !editStartDate && "text-muted-foreground")}>
                                          <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                                          {editStartDate ? format(editStartDate, "yyyy-MM-dd") : "선택"}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={editStartDate} onSelect={setEditStartDate} className={cn("p-3 pointer-events-auto")} />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  {/* Schedule editing */}
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> 수업 일정
                                    </Label>
                                    {editSchedules.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {editSchedules.map((slot, i) => (
                                          <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-navy/8 text-navy font-medium">
                                            {slot.day}요일 {slot.time} {slot.frequency && slot.frequency !== "weekly" ? `(${FREQ_LABELS[slot.frequency]})` : ""}
                                            <button type="button" onClick={() => setEditSchedules(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                                              <X className="w-3 h-3" />
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex gap-1">
                                      <Select value={editSchedDay} onValueChange={setEditSchedDay}>
                                        <SelectTrigger className="h-7 text-xs w-20">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {DAYS_OF_WEEK.map((d) => (
                                            <SelectItem key={d} value={d}>{d}요일</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Select value={editSchedTime} onValueChange={setEditSchedTime}>
                                        <SelectTrigger className="h-7 text-xs w-[72px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {HOURS.map((h) => (
                                            <SelectItem key={h} value={h}>{h}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Select value={editSchedFreq} onValueChange={(v) => setEditSchedFreq(v as Frequency)}>
                                        <SelectTrigger className="h-7 text-xs w-[72px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(Object.keys(FREQ_LABELS) as Frequency[]).map((f) => (
                                            <SelectItem key={f} value={f}>{FREQ_LABELS[f]}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs px-2"
                                        onClick={() => {
                                          const exists = editSchedules.some(s => s.day === editSchedDay && s.time === editSchedTime);
                                          if (!exists) {
                                            setEditSchedules(prev => [...prev, { day: editSchedDay, time: editSchedTime, frequency: editSchedFreq }]);
                                          }
                                        }}
                                      >
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Target className="w-3 h-3" /> 등록 계기 / 최종 목표
                                    </Label>
                                    {editObjectives.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {editObjectives.map((obj, i) => (
                                          <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-foreground">
                                            {obj}
                                            <button type="button" onClick={() => setEditObjectives(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                                              <X className="w-3 h-3" />
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex gap-1">
                                      <Input
                                        value={editNewObjective}
                                        onChange={(e) => setEditNewObjective(e.target.value)}
                                        placeholder="예: 해외여행 시 자유로운 대화"
                                        className="h-7 text-xs"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && editNewObjective.trim()) {
                                            e.preventDefault();
                                            setEditObjectives(prev => [...prev, editNewObjective.trim()]);
                                            setEditNewObjective("");
                                          }
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs px-2"
                                        disabled={!editNewObjective.trim()}
                                        onClick={() => { setEditObjectives(prev => [...prev, editNewObjective.trim()]); setEditNewObjective(""); }}
                                      >
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  {/* Group students */}
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Users className="w-3 h-3" /> 그룹 수강생
                                    </Label>
                                    {editGroupStudents.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {editGroupStudents.map((name, i) => (
                                          <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/50 text-foreground">
                                            {name}
                                            <button type="button" onClick={() => setEditGroupStudents(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                                              <X className="w-3 h-3" />
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    <Select
                                      value=""
                                      onValueChange={(v) => {
                                        if (v && !editGroupStudents.includes(v)) {
                                          setEditGroupStudents(prev => [...prev, v]);
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue placeholder="수강생 추가..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {students
                                          .filter(s => s.status === "active" && s.name !== student.name && !editGroupStudents.includes(s.name))
                                          .sort((a, b) => a.name.localeCompare(b.name, "ko"))
                                          .map(s => (
                                            <SelectItem key={s.dbId || s.name} value={s.name}>{s.name}</SelectItem>
                                          ))
                                        }
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {/* Google Sheet URL */}
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Link2 className="w-3 h-3" /> 학생일지 링크
                                    </Label>
                                    <Input
                                      value={editGoogleSheetUrl}
                                      onChange={(e) => setEditGoogleSheetUrl(e.target.value)}
                                      placeholder="https://docs.google.com/spreadsheets/..."
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs bg-navy hover:bg-navy-light text-primary-foreground"
                                      onClick={() => saveInlineEdit(student.id)}
                                    >
                                      저장
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => setEditingStudentId(null)}
                                    >
                                      취소
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                      <p className="text-muted-foreground">레벨</p>
                                      <p className="font-semibold text-foreground mt-0.5">{student.level}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">담당 강사</p>
                                      <p className="font-semibold text-foreground mt-0.5">{student.instructor}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">시작일</p>
                                      <p className="font-semibold text-foreground mt-0.5">{student.startDate || <span className="text-muted-foreground font-normal">미설정</span>}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">수업 보고서</p>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-1 h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                                        disabled={reportLoading === student.name}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setReportLoading(student.name);
                                          try {
                                            const { prepareReportData } = await import("@/lib/exportCorporateReportPdf");
                                            const _now = new Date();
                                            const _y = _now.getFullYear();
                                            const _m = _now.getMonth();
                                            const _startDate = `${_y}-${String(_m + 1).padStart(2, "0")}-01`;
                                            const _lastDay = new Date(_y, _m + 1, 0).getDate();
                                            const _endDate = `${_y}-${String(_m + 1).padStart(2, "0")}-${String(_lastDay).padStart(2, "0")}`;
                                            const _label = `${_y}년 ${_m + 1}월`;
                                            const { data: sessData } = await supabase
                                              .from("class_sessions")
                                              .select("scheduled_at,student_name,topic,notes,level,ended_at,group_students")
                                              .eq("student_name", student.name)
                                              .gte("scheduled_at", _startDate + "T00:00:00+09:00")
                                              .lte("scheduled_at", _endDate + "T23:59:59+09:00")
                                              .order("scheduled_at");
                                            let objs: string[] = [];
                                            try { objs = JSON.parse(student.learningObjective || "[]"); } catch { objs = student.learningObjective ? [student.learningObjective] : []; }
                                            const groupStudents = (sessData || []).find(s => s.group_students && s.group_students.length > 0)?.group_students || [];
                                            const previewData = await prepareReportData(
                                              sessData || [],
                                              { studentName: student.name, instructorName: student.instructor, learningObjective: objs.join(", "), groupStudents },
                                              { label: _label, start_date: _startDate, end_date: _endDate },
                                            );
                                            setReportPreview(previewData);
                                          } catch (err) {
                                            toast({ title: "보고서 생성 실패", variant: "destructive" });
                                          } finally {
                                            setReportLoading(null);
                                          }
                                        }}
                                      >
                                        {reportLoading === student.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                        {reportLoading === student.name ? "AI 생성 중..." : "보고서 다운로드"}
                                      </Button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" />등록 계기 / 최종 목표</p>
                                    {(() => {
                                      let objs: string[] = [];
                                      try { const p = JSON.parse(student.learningObjective || "[]"); objs = Array.isArray(p) ? p : student.learningObjective ? [student.learningObjective] : []; } catch { objs = student.learningObjective ? [student.learningObjective] : []; }
                                      return objs.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {objs.map((o, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground font-medium">{o}</span>)}
                                        </div>
                                      ) : <p className="text-xs text-muted-foreground font-normal mt-0.5">미설정</p>;
                                    })()}
                                  </div>
                                  {student.schedules.length > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                        <Clock className="w-3 h-3" />수업 일정
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {student.schedules.map((slot, i) => (
                                          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-navy/8 text-navy font-medium">
                                            {slot.day}요일 {slot.time} {slot.frequency && slot.frequency !== "weekly" ? `(${FREQ_LABELS[slot.frequency]})` : ""}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {student.groupStudents.length > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                        <Users className="w-3 h-3" />그룹 수강생
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {student.groupStudents.map((name, i) => (
                                          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-accent/50 text-foreground font-medium">{name}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {student.googleSheetUrl && (
                                    <div>
                                      <a href={student.googleSheetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                        <ExternalLink className="w-3 h-3" /> Google Sheet 열기
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Meet link */}
                            <div className="p-3 rounded-lg bg-card border border-border">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Video className="w-3.5 h-3.5 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs font-semibold text-foreground">수업 링크</p>
                                    {student.meetLink ? (
                                      <a href={student.meetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block max-w-[200px]">
                                        {student.meetLink}
                                      </a>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">미설정</p>
                                    )}
                                  </div>
                                </div>
                                {editingMeetId === student.id ? (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Input
                                      value={meetLinkInput}
                                      onChange={(e) => setMeetLinkInput(e.target.value)}
                                      placeholder="https://meet.google.com/..."
                                      className="h-7 text-xs w-48"
                                    />
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveMeetLink(student.id)}>
                                      <Check className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingMeetId(null)}>
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                    onClick={(e) => { e.stopPropagation(); setEditingMeetId(student.id); setMeetLinkInput(student.meetLink); }}>
                                    <Edit2 className="w-3 h-3" /> 수정
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Withdraw button */}
                            {tab === "active" && (
                              <div className="flex items-center justify-end gap-2 pt-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                                  onClick={() => { setWithdrawTarget(student); setWithdrawReason(""); }}
                                >
                                  <UserX className="w-3 h-3" />
                                  퇴원 처리
                                </Button>
                              </div>
                            )}

                            {tab === "graduated" && (
                              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                  ℹ️ 퇴원 처리된 수강생입니다.
                                </p>
                                {student.withdrawalReason && (
                                  <p className="text-xs text-muted-foreground">📝 사유: {student.withdrawalReason}</p>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1.5 text-[hsl(var(--navy))] border-[hsl(var(--navy))]/30 hover:bg-[hsl(var(--navy))]/10"
                                  onClick={async () => {
                                    if (!student.dbId) return;
                                    const { error } = await supabase.from("instructor_students").update({
                                      status: "active",
                                      withdrawal_reason: null,
                                    }).eq("id", student.dbId);
                                    if (error) {
                                      toast({ title: "재등록 실패", description: error.message, variant: "destructive" });
                                    } else {
                                      setStudents((prev) => prev.map((s) => s.id === student.id ? { ...s, status: "active" as StudentStatus, withdrawalReason: "" } : s));
                                      toast({ title: `${student.name} 재등록 완료 ✓` });
                                    }
                                  }}
                                >
                                  <Play className="w-3 h-3" />
                                  재등록 (수강 재개)
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Withdrawal reason dialog */}
      <Dialog open={!!withdrawTarget} onOpenChange={(open) => { if (!open) setWithdrawTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-destructive" />
              퇴원 처리
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{withdrawTarget?.name}</span> 님을 퇴원 처리합니다.
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">퇴원 예정일 <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-9 w-full text-sm justify-start", !withdrawDate && "text-muted-foreground")}>
                    <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                    {withdrawDate ? format(withdrawDate, "yyyy-MM-dd") : "퇴원 예정일 선택"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={withdrawDate} onSelect={setWithdrawDate} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">퇴원일 이후의 미진행 수업 세션은 자동 삭제됩니다.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">퇴원 사유 (선택)</Label>
              <Textarea
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="퇴원 사유를 입력하세요..."
                className="h-20 text-sm resize-none"
                maxLength={500}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { setWithdrawTarget(null); setWithdrawDate(undefined); setWithdrawReason(""); }}>취소</Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={graduate}
              disabled={withdrawing || !withdrawDate}
              className="gap-1.5"
            >
              {withdrawing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              퇴원 처리
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule change effective date dialog */}
      <Dialog open={!!schedChangeTarget} onOpenChange={(open) => { if (!open && !schedChangeSaving) setSchedChangeTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[hsl(var(--navy))]" />
              일정 변경 적용일
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{schedChangeTarget?.studentName}</span> 님의 수업 일정이 변경되었습니다.
            변경된 일정을 언제부터 적용할까요?
          </p>
          <div className="space-y-2">
            <Label className="text-xs">적용 시작일</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-9 w-full text-sm justify-start", !schedEffectiveDate && "text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                  {schedEffectiveDate ? format(schedEffectiveDate, "yyyy-MM-dd") : "날짜 선택"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={schedEffectiveDate} onSelect={setSchedEffectiveDate} />
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground">
              선택한 날짜 이후의 미시작 세션이 삭제되고 새 일정으로 재생성됩니다.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSchedChangeTarget(null)} disabled={schedChangeSaving}>취소</Button>
            <Button
              size="sm"
              onClick={confirmScheduleChange}
              disabled={schedChangeSaving || !schedEffectiveDate}
              className="gap-1.5 bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground"
            >
              {schedChangeSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              적용하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Corporate Report Preview Modal */}
      {reportPreview && (
        <CorporateReportPreviewModal
          data={reportPreview}
          onClose={() => setReportPreview(null)}
          onDownload={async (finalData) => {
            const { exportCorporateReportPdf } = await import("@/lib/exportCorporateReportPdf");
            await exportCorporateReportPdf(finalData);
            toast({ title: "수업 보고서 다운로드 완료 ✓" });
            setReportPreview(null);
          }}
        />
      )}
      {/* Transfer Student Modal */}
      <TransferStudentModal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        students={students.filter(s => s.status === "active")}
        instructorNames={instructorNames}
        onTransferred={loadStudentsFromDB}
      />
    </div>
  );
}
