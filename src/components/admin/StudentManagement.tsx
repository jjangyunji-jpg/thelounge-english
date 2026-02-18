import { useState } from "react";
import { Plus, Search, Download, ChevronDown, ChevronUp, UserX, BookOpen, Edit2, RefreshCw, Trash2, Target, Check, X } from "lucide-react";
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

type StudentStatus = "active" | "graduated";
type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const BASE_LESSONS = 4;
const LESSON_PRICE = 50000;
const BASE_FEE = BASE_LESSONS * LESSON_PRICE;

export interface PresetHomework {
  id: number;
  content: string;
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
}

const calcMonthlyFee = (extra: number) => BASE_FEE + extra * LESSON_PRICE;

const mockStudents: Student[] = [
  { id: 1, name: "김민준", phone: "010-1111-2222", level: "B1", startDate: "2025-09-01", instructor: "Sarah Kim", status: "active", totalLessons: 45, extraLessons: 1, presetHomework: [{ id: 1, content: "일기 쓰기 2회 (10문장 이상)" }, { id: 2, content: "교재 Unit 3 복습" }], lessonGoal: "시제 연습하기", lessonGoalCount: 3, lessonHistory: [{ date: "2026-02-10", topic: "시제 연습하기 3", vocaCount: 12, hwStatus: "제출완료" }, { date: "2026-02-07", topic: "시제 연습하기 2", vocaCount: 8, hwStatus: "제출완료" }, { date: "2026-02-03", topic: "시제 연습하기 1", vocaCount: 15, hwStatus: "미제출" }] },
  { id: 2, name: "이지은", phone: "010-2222-3333", level: "C1", startDate: "2025-07-15", instructor: "James Park", status: "active", totalLessons: 62, extraLessons: 2, presetHomework: [{ id: 1, content: "에세이 초안 작성 (300단어 이상)" }], lessonGoal: "비즈니스 영어 이메일", lessonGoalCount: 2, lessonHistory: [{ date: "2026-02-10", topic: "비즈니스 영어 이메일 2", vocaCount: 10, hwStatus: "제출완료" }, { date: "2026-02-05", topic: "비즈니스 영어 이메일 1", vocaCount: 9, hwStatus: "제출완료" }] },
  { id: 3, name: "박서연", phone: "010-3333-4444", level: "A1", startDate: "2026-01-05", instructor: "Sarah Kim", status: "active", totalLessons: 8, extraLessons: 0, presetHomework: [], lessonGoal: "", lessonGoalCount: 0, lessonHistory: [] },
  { id: 4, name: "최현우", phone: "010-4444-5555", level: "B1", startDate: "2025-10-01", instructor: "James Park", status: "active", totalLessons: 38, extraLessons: 0, presetHomework: [{ id: 1, content: "단어 20개 암기 후 예문 작성" }], lessonGoal: "발음 교정", lessonGoalCount: 1, lessonHistory: [{ date: "2026-02-08", topic: "발음 교정 1", vocaCount: 6, hwStatus: "제출완료" }] },
  { id: 5, name: "정다은", phone: "010-5555-6666", level: "C2", startDate: "2025-06-01", instructor: "James Park", status: "active", totalLessons: 70, extraLessons: 1, presetHomework: [], lessonGoal: "", lessonGoalCount: 0, lessonHistory: [] },
  { id: 6, name: "한소희", phone: "010-6666-7777", level: "B2", startDate: "2025-08-20", instructor: "James Park", status: "active", totalLessons: 50, extraLessons: 0, presetHomework: [{ id: 1, content: "뉴스 기사 읽기 + 요약 작성" }], lessonGoal: "프레젠테이션 표현", lessonGoalCount: 4, lessonHistory: [{ date: "2026-02-09", topic: "프레젠테이션 표현 4", vocaCount: 11, hwStatus: "제출완료" }, { date: "2026-02-04", topic: "프레젠테이션 표현 3", vocaCount: 7, hwStatus: "미제출" }] },
  { id: 7, name: "이수민", phone: "010-7777-8888", level: "A2", startDate: "2025-11-01", instructor: "Emily Lee", status: "active", totalLessons: 22, extraLessons: 0, presetHomework: [], lessonGoal: "", lessonGoalCount: 0, lessonHistory: [] },
  { id: 8, name: "정우성", phone: "010-8888-9999", level: "B1", startDate: "2025-09-15", instructor: "Emily Lee", status: "active", totalLessons: 40, extraLessons: 2, presetHomework: [{ id: 1, content: "일기 쓰기 3회 (5문장 이상)" }], lessonGoal: "관용표현 습득", lessonGoalCount: 2, lessonHistory: [{ date: "2026-02-11", topic: "관용표현 습득 2", vocaCount: 14, hwStatus: "제출완료" }, { date: "2026-02-06", topic: "관용표현 습득 1", vocaCount: 13, hwStatus: "제출완료" }] },
  { id: 9, name: "오지현", phone: "010-9999-0000", level: "A2", startDate: "2025-05-01", instructor: "Sarah Kim", status: "graduated", totalLessons: 60, extraLessons: 0, presetHomework: [], lessonGoal: "", lessonGoalCount: 0, lessonHistory: [] },
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
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "graduated">("active");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Inline editing state
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [editLevel, setEditLevel] = useState<Level | "">("");
  const [editExtra, setEditExtra] = useState(0);
  const [editGoal, setEditGoal] = useState("");

  // Preset homework editing
  const [editingPresetId, setEditingPresetId] = useState<number | null>(null);
  const [presetInput, setPresetInput] = useState("");
  // Inline editing a preset item
  const [editingHwItemId, setEditingHwItemId] = useState<number | null>(null);
  const [editingHwContent, setEditingHwContent] = useState("");

  // New student form
  const [newStudent, setNewStudent] = useState<NewStudent>({
    name: "", phone: "", level: "", instructor: "", startDate: "", extraLessons: 0,
  });

  const filtered = students.filter(
    (s) => s.status === tab && s.name.includes(search)
  );

  const graduate = (id: number) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status: "graduated" } : s)));
  };

  const startInlineEdit = (s: Student) => {
    setEditingStudentId(s.id);
    setEditLevel(s.level);
    setEditExtra(s.extraLessons);
    setEditGoal(s.lessonGoal);
  };

  const saveInlineEdit = (id: number) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        // If goal changed, reset count and update history topic prefix
        const goalChanged = editGoal.trim() !== s.lessonGoal;
        return {
          ...s,
          level: editLevel as Level,
          extraLessons: editExtra,
          lessonGoal: editGoal.trim(),
          lessonGoalCount: goalChanged ? 0 : s.lessonGoalCount,
        };
      })
    );
    setEditingStudentId(null);
  };

  const addPresetHw = (studentId: number) => {
    if (!presetInput.trim()) return;
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, presetHomework: [...s.presetHomework, { id: Date.now(), content: presetInput }] }
          : s
      )
    );
    setPresetInput("");
  };

  const removePresetHw = (studentId: number, hwId: number) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, presetHomework: s.presetHomework.filter((h) => h.id !== hwId) }
          : s
      )
    );
  };

  const startEditHwItem = (hw: { id: number; content: string }) => {
    setEditingHwItemId(hw.id);
    setEditingHwContent(hw.content);
  };

  const saveEditHwItem = (studentId: number, hwId: number) => {
    if (!editingHwContent.trim()) return;
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, presetHomework: s.presetHomework.map((h) => h.id === hwId ? { ...h, content: editingHwContent } : h) }
          : s
      )
    );
    setEditingHwItemId(null);
    setEditingHwContent("");
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
                onClick={() => setExpandedId(expandedId === student.id ? null : student.id)}
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
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">레벨</p>
                          <p className="font-semibold text-foreground mt-0.5">{student.level}</p>
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
                        <span className="text-xs font-normal text-muted-foreground">— 수업 시작 시 자동으로 채워집니다</span>
                      </h4>
                    </div>

                    {/* Preset list */}
                    <div className="space-y-2 mb-3">
                      {student.presetHomework.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">설정된 정기 숙제가 없습니다</p>
                      ) : (
                        student.presetHomework.map((hw) => (
                          <div key={hw.id} className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 group">
                            {editingHwItemId === hw.id ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  value={editingHwContent}
                                  onChange={(e) => setEditingHwContent(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") saveEditHwItem(student.id, hw.id); if (e.key === "Escape") setEditingHwItemId(null); }}
                                  className="h-7 text-xs flex-1"
                                  autoFocus
                                />
                                <button onClick={() => saveEditHwItem(student.id, hw.id)} className="text-success hover:opacity-80">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setEditingHwItemId(null)} className="text-muted-foreground hover:text-foreground">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                                <span className="flex-1 text-sm text-foreground">{hw.content}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); startEditHwItem(hw); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); removePresetHw(student.id, hw.id); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add preset input */}
                    {editingPresetId === student.id ? (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={presetInput}
                          onChange={(e) => setPresetInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { addPresetHw(student.id); } if (e.key === "Escape") setEditingPresetId(null); }}
                          placeholder="예: 일기 쓰기 2회 (10문장 이상)"
                          className="h-8 text-xs flex-1"
                          autoFocus
                        />
                        <Button size="sm" className="h-8 px-3 text-xs bg-navy hover:bg-navy-light text-primary-foreground" onClick={() => addPresetHw(student.id)}>
                          추가
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => { setEditingPresetId(null); setPresetInput(""); }}>
                          취소
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 border-dashed"
                        onClick={(e) => { e.stopPropagation(); setEditingPresetId(student.id); setPresetInput(""); }}
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
