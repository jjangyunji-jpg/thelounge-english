import { useState, useEffect } from "react";
import { Plus, Search, Download, ChevronDown, ChevronUp, UserX, BookOpen, Edit2, RefreshCw, Trash2, Target, Check, X, Bell, BellOff, Video, ExternalLink, Link2, PenLine, Mic, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type StudentStatus = "active" | "graduated";
type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type HwType = "writing" | "reading" | "speaking" | "memorizing";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const BASE_LESSONS = 4;
const LESSON_PRICE = 50000;
const BASE_FEE = BASE_LESSONS * LESSON_PRICE;

const HW_TYPE_META: Record<HwType, { label: string; icon: React.ElementType; color: string; hint: string }> = {
  writing:    { label: "쓰기",   icon: PenLine,  color: "text-[hsl(var(--navy))]",      hint: "텍스트 작성 필수" },
  reading:    { label: "읽기",   icon: BookOpen, color: "text-[hsl(var(--gold-dark))]", hint: "녹음 필수" },
  speaking:   { label: "말하기", icon: Mic,      color: "text-[hsl(var(--success))]",   hint: "녹음 필수 / 텍스트 선택" },
  memorizing: { label: "외우기", icon: Brain,    color: "text-purple-500",              hint: "녹음 필수 (대화문 등)" },
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

interface Student {
  id: number;
  name: string;
  phone: string;
  level: Level;
  startDate: string;
  instructor: string;
  status: StudentStatus;
  totalLessons: number;
  extraLessons: number;
  presetHomework: PresetHomework[];
  lessonGoal: string;
  lessonGoalCount: number;
  lessonHistory: LessonHistory[];
  reminderEnabled: boolean;
  meetLink: string;
}

const calcMonthlyFee = (extra: number) => BASE_FEE + extra * LESSON_PRICE;

const mockStudents: Student[] = [
  { id: 1, name: "김민준", phone: "010-1111-2222", level: "B1", startDate: "2025-09-01", instructor: "Sarah Kim", status: "active", totalLessons: 45, extraLessons: 1, presetHomework: [], lessonGoal: "시제 연습하기", lessonGoalCount: 3, lessonHistory: [{ date: "2026-02-10", topic: "시제 연습하기 3", vocaCount: 12, hwStatus: "제출완료" }, { date: "2026-02-07", topic: "시제 연습하기 2", vocaCount: 8, hwStatus: "제출완료" }, { date: "2026-02-03", topic: "시제 연습하기 1", vocaCount: 15, hwStatus: "미제출" }], reminderEnabled: true, meetLink: "https://meet.google.com/abc-defg-hij" },
  { id: 2, name: "이지은", phone: "010-2222-3333", level: "C1", startDate: "2025-07-15", instructor: "James Park", status: "active", totalLessons: 62, extraLessons: 2, presetHomework: [], lessonGoal: "비즈니스 영어 이메일", lessonGoalCount: 2, lessonHistory: [{ date: "2026-02-10", topic: "비즈니스 영어 이메일 2", vocaCount: 10, hwStatus: "제출완료" }, { date: "2026-02-05", topic: "비즈니스 영어 이메일 1", vocaCount: 9, hwStatus: "제출완료" }], reminderEnabled: true, meetLink: "https://meet.google.com/xyz-uvwx-yzab" },
  { id: 3, name: "박서연", phone: "010-3333-4444", level: "A1", startDate: "2026-01-05", instructor: "Sarah Kim", status: "active", totalLessons: 8, extraLessons: 0, presetHomework: [], lessonGoal: "", lessonGoalCount: 0, lessonHistory: [], reminderEnabled: true, meetLink: "" },
  { id: 4, name: "최현우", phone: "010-4444-5555", level: "B1", startDate: "2025-10-01", instructor: "James Park", status: "active", totalLessons: 38, extraLessons: 0, presetHomework: [], lessonGoal: "발음 교정", lessonGoalCount: 1, lessonHistory: [{ date: "2026-02-08", topic: "발음 교정 1", vocaCount: 6, hwStatus: "제출완료" }], reminderEnabled: false, meetLink: "" },
  { id: 5, name: "정다은", phone: "010-5555-6666", level: "C2", startDate: "2025-06-01", instructor: "James Park", status: "active", totalLessons: 70, extraLessons: 1, presetHomework: [], lessonGoal: "", lessonGoalCount: 0, lessonHistory: [], reminderEnabled: true, meetLink: "https://meet.google.com/pqr-stuv-wxyz" },
  { id: 6, name: "한소희", phone: "010-6666-7777", level: "B2", startDate: "2025-08-20", instructor: "James Park", status: "active", totalLessons: 50, extraLessons: 0, presetHomework: [], lessonGoal: "프레젠테이션 표현", lessonGoalCount: 4, lessonHistory: [{ date: "2026-02-09", topic: "프레젠테이션 표현 4", vocaCount: 11, hwStatus: "제출완료" }, { date: "2026-02-04", topic: "프레젠테이션 표현 3", vocaCount: 7, hwStatus: "미제출" }], reminderEnabled: true, meetLink: "" },
  { id: 7, name: "이수민", phone: "010-7777-8888", level: "A2", startDate: "2025-11-01", instructor: "Emily Lee", status: "active", totalLessons: 22, extraLessons: 0, presetHomework: [], lessonGoal: "", lessonGoalCount: 0, lessonHistory: [], reminderEnabled: true, meetLink: "" },
  { id: 8, name: "정우성", phone: "010-8888-9999", level: "B1", startDate: "2025-09-15", instructor: "Emily Lee", status: "active", totalLessons: 40, extraLessons: 2, presetHomework: [], lessonGoal: "관용표현 습득", lessonGoalCount: 2, lessonHistory: [{ date: "2026-02-11", topic: "관용표현 습득 2", vocaCount: 14, hwStatus: "제출완료" }, { date: "2026-02-06", topic: "관용표현 습득 1", vocaCount: 13, hwStatus: "제출완료" }], reminderEnabled: true, meetLink: "" },
  { id: 9, name: "오지현", phone: "010-9999-0000", level: "A2", startDate: "2025-05-01", instructor: "Sarah Kim", status: "graduated", totalLessons: 60, extraLessons: 0, presetHomework: [], lessonGoal: "", lessonGoalCount: 0, lessonHistory: [], reminderEnabled: false, meetLink: "" },
];

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
  phone: string;
  level: Level | "";
  instructor: string;
  startDate: string;
  extraLessons: number;
}

export default function StudentManagement() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "graduated">("active");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
  const [editGoal, setEditGoal] = useState("");
  const [editInstructor, setEditInstructor] = useState("");

  // Meet link editing
  const [editingMeetId, setEditingMeetId] = useState<number | null>(null);
  const [meetLinkInput, setMeetLinkInput] = useState("");

  // New student form
  const [newStudent, setNewStudent] = useState<NewStudent>({
    name: "", phone: "", level: "", instructor: "", startDate: "", extraLessons: 0,
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

  const graduate = (id: number) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status: "graduated" } : s)));
  };

  const startInlineEdit = (s: Student) => {
    setEditingStudentId(s.id);
    setEditLevel(s.level);
    setEditExtra(s.extraLessons);
    setEditGoal(s.lessonGoal);
    setEditInstructor(s.instructor);
  };

  const saveInlineEdit = (id: number) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const goalChanged = editGoal.trim() !== s.lessonGoal;
        return {
          ...s,
          level: editLevel as Level,
          extraLessons: editExtra,
          instructor: editInstructor,
          lessonGoal: editGoal.trim(),
          lessonGoalCount: goalChanged ? 0 : s.lessonGoalCount,
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

  const saveMeetLink = (studentId: number) => {
    const url = meetLinkInput.trim();
    if (url && !url.startsWith("http")) return;
    setStudents((prev) =>
      prev.map((s) => s.id === studentId ? { ...s, meetLink: url } : s)
    );
    setEditingMeetId(null);
    setMeetLinkInput("");
  };

  const deleteMeetLink = (studentId: number) => {
    setStudents((prev) =>
      prev.map((s) => s.id === studentId ? { ...s, meetLink: "" } : s)
    );
  };

  const registerStudent = () => {
    if (!newStudent.name || !newStudent.level || !newStudent.instructor) return;
    const s: Student = {
      id: Date.now(),
      name: newStudent.name,
      phone: newStudent.phone,
      level: newStudent.level as Level,
      startDate: newStudent.startDate,
      instructor: newStudent.instructor,
      status: "active",
      totalLessons: 0,
      extraLessons: newStudent.extraLessons,
      presetHomework: [],
      lessonGoal: "",
      lessonGoalCount: 0,
      lessonHistory: [],
      reminderEnabled: true,
      meetLink: "",
    };
    setStudents((prev) => [s, ...prev]);
    setNewStudent({ name: "", phone: "", level: "", instructor: "", startDate: "", extraLessons: 0 });
    setDialogOpen(false);
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
                      placeholder="홍길동"
                      className="h-9"
                      value={newStudent.name}
                      onChange={(e) => setNewStudent((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">연락처</Label>
                    <Input
                      placeholder="010-0000-0000"
                      className="h-9"
                      value={newStudent.phone}
                      onChange={(e) => setNewStudent((p) => ({ ...p, phone: e.target.value }))}
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
                        {["Sarah Kim", "James Park", "Emily Lee"].map((t) => (
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
                  disabled={!newStudent.name || !newStudent.level || !newStudent.instructor}
                >
                  등록하기
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
                    <p className="font-semibold text-foreground text-sm">{student.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColors[student.level]}`}>
                      {student.level}
                    </span>
                    {student.extraLessons > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gold/15 text-gold-dark font-medium">
                        +{student.extraLessons}회
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{student.instructor} · {student.phone}</p>
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
                              {["Sarah Kim", "James Park", "Emily Lee"].map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Target className="w-3 h-3" /> 수업 목표
                          </Label>
                          <Input
                            value={editGoal}
                            onChange={(e) => setEditGoal(e.target.value)}
                            placeholder="예: 시제 연습하기"
                            className="h-8 text-sm"
                          />
                          {editGoal.trim() !== student.lessonGoal && editGoal.trim() && (
                            <p className="text-xs text-warning">⚠️ 목표 변경 시 수업 이력 카운트가 0에서 다시 시작됩니다</p>
                          )}
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
                          <p className="text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" />수업 목표</p>
                          <p className="font-semibold text-foreground mt-0.5 truncate">
                            {student.lessonGoal ? `${student.lessonGoal} (${student.lessonGoalCount}회차)` : <span className="text-muted-foreground font-normal">미설정</span>}
                          </p>
                        </div>
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
                        {student.lessonGoal && (
                          <span className="text-xs font-normal text-muted-foreground">— 현재 목표: {student.lessonGoal}</span>
                        )}
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
                            수업 후 48시간 · 다음 수업 전 48시간 — 총 2회 자동 발송
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
                      <div className="mt-2.5 flex gap-2 flex-wrap">
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
                    )}
                  </div>

                  {tab === "active" && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => graduate(student.id)}
                      >
                        <UserX className="w-3 h-3" />
                        퇴원 처리
                      </Button>
                    </div>
                  )}

                  {tab === "graduated" && (
                    <div className="p-3 rounded-lg bg-warning/8 border border-warning/20">
                      <p className="text-xs font-medium" style={{ color: "hsl(38 75% 42%)" }}>
                        ⚠️ 퇴원 처리된 수강생입니다. 3일 이내에 자료가 비공개 처리될 예정이오니 필요한 데이터를 저장해 주세요.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">검색 결과가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
