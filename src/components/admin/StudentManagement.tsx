import { useState } from "react";
import { Plus, Search, Download, ChevronDown, ChevronUp, UserX, BookOpen } from "lucide-react";
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
type Level = "Beginner" | "Elementary" | "Intermediate" | "Upper-Intermediate" | "Advanced";

interface Student {
  id: number;
  name: string;
  phone: string;
  level: Level;
  startDate: string;
  instructor: string;
  status: StudentStatus;
  totalLessons: number;
  monthlyFee: number;
}

const mockStudents: Student[] = [
  { id: 1, name: "김민준", phone: "010-1111-2222", level: "Intermediate", startDate: "2025-09-01", instructor: "Sarah Kim", status: "active", totalLessons: 45, monthlyFee: 280000 },
  { id: 2, name: "이지은", phone: "010-2222-3333", level: "Advanced", startDate: "2025-07-15", instructor: "James Park", status: "active", totalLessons: 62, monthlyFee: 320000 },
  { id: 3, name: "박서연", phone: "010-3333-4444", level: "Beginner", startDate: "2026-01-05", instructor: "Sarah Kim", status: "active", totalLessons: 8, monthlyFee: 240000 },
  { id: 4, name: "최현우", phone: "010-4444-5555", level: "Intermediate", startDate: "2025-10-01", instructor: "James Park", status: "active", totalLessons: 38, monthlyFee: 280000 },
  { id: 5, name: "정다은", phone: "010-5555-6666", level: "Advanced", startDate: "2025-06-01", instructor: "James Park", status: "active", totalLessons: 70, monthlyFee: 320000 },
  { id: 6, name: "한소희", phone: "010-6666-7777", level: "Upper-Intermediate", startDate: "2025-08-20", instructor: "James Park", status: "active", totalLessons: 50, monthlyFee: 300000 },
  { id: 7, name: "이수민", phone: "010-7777-8888", level: "Elementary", startDate: "2025-11-01", instructor: "Emily Lee", status: "active", totalLessons: 22, monthlyFee: 260000 },
  { id: 8, name: "정우성", phone: "010-8888-9999", level: "Intermediate", startDate: "2025-09-15", instructor: "Emily Lee", status: "active", totalLessons: 40, monthlyFee: 280000 },
  { id: 9, name: "오지현", phone: "010-9999-0000", level: "Beginner", startDate: "2025-05-01", instructor: "Sarah Kim", status: "graduated", totalLessons: 60, monthlyFee: 240000 },
];

const levelColors: Record<Level, string> = {
  Beginner: "bg-muted text-muted-foreground",
  Elementary: "bg-blue-50 text-blue-700",
  Intermediate: "bg-gold/10 text-gold-dark",
  "Upper-Intermediate": "bg-orange-50 text-orange-700",
  Advanced: "bg-navy/10 text-navy",
};

const mockNotes = [
  { date: "2026-02-10", topic: "Business Email Writing", vocaCount: 12, hwStatus: "제출완료" },
  { date: "2026-02-07", topic: "Presentation Skills", vocaCount: 8, hwStatus: "제출완료" },
  { date: "2026-02-03", topic: "Idioms & Expressions", vocaCount: 15, hwStatus: "미제출" },
];

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "graduated">("active");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState<number | null>(null);

  const filtered = students.filter(
    (s) => s.status === tab && s.name.includes(search)
  );

  const graduate = (id: number) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "graduated" } : s))
    );
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
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-gold text-gold-dark hover:bg-gold/8"
          >
            <Download className="w-4 h-4" />
            이번달 수강생 리스트
          </Button>
          <Dialog>
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
                    <Input placeholder="홍길동" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">연락처</Label>
                    <Input placeholder="010-0000-0000" className="h-9" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">레벨</Label>
                    <Select>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Beginner", "Elementary", "Intermediate", "Upper-Intermediate", "Advanced"].map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">담당 강사</Label>
                    <Select>
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
                  <Input type="date" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">월 수강료 (원)</Label>
                  <Input type="number" placeholder="280000" className="h-9" />
                </div>
                <Button className="w-full bg-navy hover:bg-navy-light text-primary-foreground">등록하기</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            tab === "active"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          수강중 ({students.filter((s) => s.status === "active").length}명)
        </button>
        <button
          onClick={() => setTab("graduated")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            tab === "graduated"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          퇴원생 ({students.filter((s) => s.status === "graduated").length}명)
        </button>
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
        {filtered.map((student) => (
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
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{student.instructor} · {student.phone}</p>
              </div>
              <div className="hidden md:flex items-center gap-5 text-sm">
                <div className="text-center">
                  <p className="font-semibold text-foreground">{student.totalLessons}회</p>
                  <p className="text-xs text-muted-foreground">누적수업</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gold-dark">₩{student.monthlyFee.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">월수강료</p>
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
                {/* Lesson history preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-gold" />
                      최근 수업 이력
                    </h4>
                    <button
                      onClick={() => setShowHistory(showHistory === student.id ? null : student.id)}
                      className="text-xs text-navy hover:underline"
                    >
                      전체보기
                    </button>
                  </div>
                  <div className="space-y-2">
                    {mockNotes.slice(0, 3).map((note, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border text-sm">
                        <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{note.date}</span>
                        <span className="flex-1 text-foreground text-xs">{note.topic}</span>
                        <span className="text-xs text-muted-foreground">단어 {note.vocaCount}개</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${note.hwStatus === "제출완료" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                          숙제 {note.hwStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
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
                    <p className="text-xs text-warning-foreground font-medium">
                      ⚠️ 퇴원 처리된 수강생입니다. 3일 이내에 자료가 비공개 처리될 예정이오니 필요한 데이터를 저장해 주세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">검색 결과가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
