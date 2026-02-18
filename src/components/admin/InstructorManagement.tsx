import { useState } from "react";
import { Download, Plus, ChevronDown, ChevronUp, Edit2, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Instructor {
  id: number;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  lessonRate: number;
  meetingRate: number;
  students: string[];
  lessonsThisMonth: number;
  meetingsThisMonth: number;
}

const mockInstructors: Instructor[] = [
  {
    id: 1,
    name: "Sarah Kim",
    email: "sarah.kim@loungeenglish.com",
    phone: "010-1234-5678",
    active: true,
    lessonRate: 30000,
    meetingRate: 20000,
    students: ["김민준", "박서연", "오지현"],
    lessonsThisMonth: 28,
    meetingsThisMonth: 4,
  },
  {
    id: 2,
    name: "James Park",
    email: "james.park@loungeenglish.com",
    phone: "010-2345-6789",
    active: true,
    lessonRate: 35000,
    meetingRate: 25000,
    students: ["이지은", "최현우", "정다은", "한소희"],
    lessonsThisMonth: 32,
    meetingsThisMonth: 3,
  },
  {
    id: 3,
    name: "Emily Lee",
    email: "emily.lee@loungeenglish.com",
    phone: "010-3456-7890",
    active: true,
    lessonRate: 28000,
    meetingRate: 18000,
    students: ["이수민", "정우성"],
    lessonsThisMonth: 18,
    meetingsThisMonth: 2,
  },
  {
    id: 4,
    name: "Michael Choi",
    email: "michael.choi@loungeenglish.com",
    phone: "010-4567-8901",
    active: false,
    lessonRate: 30000,
    meetingRate: 20000,
    students: [],
    lessonsThisMonth: 0,
    meetingsThisMonth: 0,
  },
];

export default function InstructorManagement() {
  const [instructors, setInstructors] = useState<Instructor[]>(mockInstructors);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRates, setEditRates] = useState({ lessonRate: 0, meetingRate: 0 });

  const toggleActive = (id: number) => {
    setInstructors((prev) =>
      prev.map((ins) => (ins.id === id ? { ...ins, active: !ins.active } : ins))
    );
  };

  const startEdit = (ins: Instructor) => {
    setEditingId(ins.id);
    setEditRates({ lessonRate: ins.lessonRate, meetingRate: ins.meetingRate });
  };

  const saveEdit = (id: number) => {
    setInstructors((prev) =>
      prev.map((ins) => (ins.id === id ? { ...ins, ...editRates } : ins))
    );
    setEditingId(null);
  };

  const totalPayment = (ins: Instructor) =>
    ins.lessonRate * ins.lessonsThisMonth + ins.meetingRate * ins.meetingsThisMonth;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">강사 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">담당 강사 프로필 및 정산 설정</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-gold text-gold-dark hover:bg-gold/8"
          >
            <Download className="w-4 h-4" />
            노무사 전달자료 다운받기
          </Button>
          <Button size="sm" className="gap-2 bg-navy hover:bg-navy-light text-primary-foreground">
            <Plus className="w-4 h-4" />
            강사 추가
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="shadow-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-navy">{instructors.filter((i) => i.active).length}명</p>
            <p className="text-xs text-muted-foreground mt-1">활성 강사</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gold-dark">
              {instructors.reduce((sum, i) => sum + i.lessonsThisMonth, 0)}회
            </p>
            <p className="text-xs text-muted-foreground mt-1">이번달 수업</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">
              ₩{instructors.reduce((sum, i) => sum + totalPayment(i), 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">이번달 정산 합계</p>
          </CardContent>
        </Card>
      </div>

      {/* Instructor List */}
      <div className="space-y-3">
        {instructors.map((ins) => (
          <Card key={ins.id} className="shadow-card border-border overflow-hidden">
            {/* Main row */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedId(expandedId === ins.id ? null : ins.id)}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                <span className="text-navy font-bold text-sm">
                  {ins.name.charAt(0)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{ins.name}</p>
                  <span className={ins.active ? "status-active" : "status-inactive"}>
                    {ins.active ? "활성" : "비활성"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{ins.email}</p>
              </div>

              <div className="hidden md:flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="font-semibold text-foreground">{ins.lessonsThisMonth}회</p>
                  <p className="text-xs text-muted-foreground">수업</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">{ins.students.length}명</p>
                  <p className="text-xs text-muted-foreground">담당학생</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gold-dark">₩{totalPayment(ins).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">정산액</p>
                </div>
              </div>

              {expandedId === ins.id ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>

            {/* Expanded details */}
            {expandedId === ins.id && (
              <div className="border-t border-border bg-muted/20 p-4 space-y-4">
                {/* Rate settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-card border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3">💰 시급 설정</h4>
                    {editingId === ins.id ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">수업 시급 (원/시간)</Label>
                          <Input
                            type="number"
                            value={editRates.lessonRate}
                            onChange={(e) =>
                              setEditRates((r) => ({ ...r, lessonRate: Number(e.target.value) }))
                            }
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">미팅 시급 (원/시간)</Label>
                          <Input
                            type="number"
                            value={editRates.meetingRate}
                            onChange={(e) =>
                              setEditRates((r) => ({ ...r, meetingRate: Number(e.target.value) }))
                            }
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(ins.id)} className="bg-navy text-primary-foreground hover:bg-navy-light h-7 text-xs">
                            저장
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-7 text-xs">
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">수업 시급</span>
                          <span className="text-sm font-semibold text-foreground">₩{ins.lessonRate.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">미팅 시급</span>
                          <span className="text-sm font-semibold text-foreground">₩{ins.meetingRate.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-border">
                          <span className="text-xs font-medium text-muted-foreground">이번달 총액</span>
                          <span className="text-sm font-bold text-gold-dark">₩{totalPayment(ins).toLocaleString()}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 h-7 text-xs gap-1.5"
                          onClick={() => startEdit(ins)}
                        >
                          <Edit2 className="w-3 h-3" /> 수정
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Students */}
                  <div className="p-4 rounded-lg bg-card border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3">👨‍🎓 담당 수강생</h4>
                    {ins.students.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {ins.students.map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">담당 수강생 없음</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => toggleActive(ins.id)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {ins.active ? (
                      <ToggleRight className="w-5 h-5 text-success" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                    )}
                    {ins.active ? "활성 상태 (비활성으로 전환)" : "비활성 상태 (활성으로 전환)"}
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs border-gold text-gold-dark hover:bg-gold/8"
                  >
                    <Download className="w-3 h-3" />
                    개인 정산서
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
