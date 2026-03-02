import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Download, ChevronDown, ChevronUp, UserX, BookOpen, Edit2, RefreshCw, Trash2, Target, Check, X, Bell, BellOff, Video, ExternalLink, Link2, PenLine, Mic, Brain, Clock, Mail, Loader2, FileText, Paperclip, Monitor, Pause, Play } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { formatStudentName } from "@/lib/formatStudentName";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { autoGenerateSessions } from "@/lib/autoGenerateSessions";

type StudentStatus = "active" | "graduated";
type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file" | "watching";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const BASE_LESSONS = 4;
const LESSON_PRICE = 50000;
const BASE_FEE = BASE_LESSONS * LESSON_PRICE;

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

interface ScheduleSlot {
  day: string;
  time: string;
}

interface PauseRecord {
  id: string;
  pause_start: string;
  pause_end: string | null;
  reason: string | null;
}

interface Student {
  id: number;
  dbId?: string; // UUID from DB
  name: string;
  englishName: string;
  level: Level;
  startDate: string;
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
}

const calcMonthlyFee = (extra: number) => BASE_FEE + extra * LESSON_PRICE;

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
    }));
    setStudents(dbStudents);

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

  // Meet link editing
  const [editingMeetId, setEditingMeetId] = useState<number | null>(null);
  const [meetLinkInput, setMeetLinkInput] = useState("");

  // New student form
  const [newStudent, setNewStudent] = useState<NewStudent>({
    name: "", englishName: "", level: "", instructor: "", startDate: "", extraLessons: 0, schedules: [],
  });

  const filtered = students.filter(
    (s) => s.status === tab && s.name.includes(search)
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
  const [withdrawing, setWithdrawing] = useState(false);

  const graduate = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    if (withdrawTarget.dbId) {
      await supabase.from("instructor_students").update({
        status: "inactive",
        withdrawal_reason: withdrawReason.trim() || null,
      }).eq("id", withdrawTarget.dbId);
    }
    setStudents((prev) => prev.map((s) => (s.id === withdrawTarget.id ? { ...s, status: "graduated", withdrawalReason: withdrawReason.trim() } : s)));
    toast({ title: `${withdrawTarget.name} 퇴원 처리 완료` });
    setWithdrawing(false);
    setWithdrawTarget(null);
    setWithdrawReason("");
  };

  const [editEnglishName, setEditEnglishName] = useState("");

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
    setEditSchedDay("월");
    setEditSchedTime("09:00");
  };

  const saveInlineEdit = async (id: number) => {
    const student = students.find(s => s.id === id);
    if (student?.dbId) {
      await supabase.from("instructor_students").update({
        level: editLevel,
        extra_lessons: editExtra,
        instructor_name: editInstructor,
        learning_objective: editObjectives.length > 0 ? JSON.stringify(editObjectives) : null,
        english_name: editEnglishName.trim() || null,
        start_date: editStartDate ? format(editStartDate, "yyyy-MM-dd") : null,
        schedules: editSchedules.length > 0 ? JSON.stringify(editSchedules) : null,
      }).eq("id", student.dbId);
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
      })
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
      learningObjective: "",
      lessonHistory: [],
      reminderEnabled: true,
      meetLink: "",
      schedules: newStudent.schedules,
    };
    setStudents((prev) => [s, ...prev]);
    setNewStudent({ name: "", englishName: "", level: "", instructor: "", startDate: "", extraLessons: 0, schedules: [] });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">수강생 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">수강생 등록 및 학습 이력 관리</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-gold text-gold-dark hover:bg-gold/8">
            <Download className="w-4 h-4" />
            이번달 수강생 리스트
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
                            <SelectTrigger className="h-8 flex-1 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {HOURS.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
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
                  <p className="text-xs font-semibold text-foreground">💰 이번달 수강료 계산</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>기본 수업 ({BASE_LESSONS}회 × ₩{LESSON_PRICE.toLocaleString()})</span>
                    <span className="font-medium text-foreground">₩{BASE_FEE.toLocaleString()}</span>
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
                      ₩{calcMonthlyFee(newStudent.extraLessons).toLocaleString()}
                    </span>
                  </div>
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
            {t === "active" ? "수강중" : "퇴원생"} ({students.filter((s) => s.status === t).length}명)
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

      {/* Student list */}
      <div className="space-y-2">
        {filtered.map((student) => {
          const monthlyFee = calcMonthlyFee(student.extraLessons);
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
                    {student.extraLessons > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gold/15 text-gold-dark font-medium">
                        +{student.extraLessons}회
                      </span>
                    )}
                    {student.pauses.length > 0 && (() => {
                      const now = new Date().toISOString().slice(0, 10);
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
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">담당 강사 : {student.instructor || "미지정"}</p>
                </div>
                <div className="hidden md:flex items-center gap-5 text-sm">
                  <div className="text-center">
                    <p className="font-semibold text-foreground">{student.totalLessons}회</p>
                    <p className="text-xs text-muted-foreground">누적수업</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gold-dark">₩{monthlyFee.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">이번달 수강료</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">시작일</p>
                    <p className="text-xs font-medium text-foreground">{student.startDate}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px] gap-1 border-gold/40 text-gold-dark hover:bg-gold/8 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/my/classnote?name=${encodeURIComponent(student.name)}`);
                  }}
                >
                  <FileText className="w-3 h-3" />
                  수업노트
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
                          onClick={(e) => { e.stopPropagation(); setEditingMeetId(student.id); setMeetLinkInput(student.meetLink); }}
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
                          const now = new Date().toISOString().slice(0, 10);
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
                        toast({ title: `${student.name} 휴강 추가 완료 ✓`, description: `${start} ~ ${end}` });
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
                                  {slot.day}요일 {slot.time}
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
                              <SelectTrigger className="h-7 text-xs w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {HOURS.map((h) => (
                                  <SelectItem key={h} value={h}>{h}</SelectItem>
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
                                  setEditSchedules(prev => [...prev, { day: editSchedDay, time: editSchedTime }]);
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
                        {/* Fee preview */}
                        <div className="p-2 rounded bg-muted/40 text-xs flex items-center justify-between">
                          <span className="text-muted-foreground">
                            기본 {BASE_LESSONS}회 + 추가 {editExtra}회 = {BASE_LESSONS + editExtra}회
                          </span>
                          <span className="font-bold text-gold-dark">₩{calcMonthlyFee(editExtra).toLocaleString()}</span>
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
                              {BASE_LESSONS}회 {student.extraLessons > 0 && <span className="text-gold-dark">+{student.extraLessons}회</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">이번달 수강료</p>
                            <p className="font-bold text-gold-dark mt-0.5">₩{monthlyFee.toLocaleString()}</p>
                          </div>
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
                                  {slot.day}요일 {slot.time}
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
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs font-medium text-muted-foreground">
                        ℹ️ 퇴원 처리된 수강생입니다. 수업 노트, 단어장 등 기존 데이터는 그대로 보관됩니다.
                      </p>
                      {student.withdrawalReason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📝 사유: {student.withdrawalReason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm font-medium">{tab === "active" ? "수강중인 수강생이 없습니다" : "퇴원생이 없습니다"}</p>
            {tab === "active" && <p className="text-xs mt-1">신규 등록 버튼을 눌러 수강생을 추가하세요.</p>}
          </div>
        )}
      </div>

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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setWithdrawTarget(null)}>취소</Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={graduate}
              disabled={withdrawing}
              className="gap-1.5"
            >
              {withdrawing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              퇴원 처리
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
