import { useState, useEffect } from "react";
import { Check, X, Loader2, UserCheck, Clock, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

interface PendingUser {
  id: string;
  user_id: string;
  role: string;
  display_name: string | null;
  approved: boolean;
}

type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const DAYS_OF_WEEK = ["월", "화", "수", "목", "금", "토", "일"];
const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  return `${h.toString().padStart(2, "0")}:00`;
});

interface ScheduleSlot { day: string; time: string; }

interface StudentSetupForm {
  phone: string;
  level: Level | "";
  instructor: string;
  startDate: string;
  extraLessons: number;
  schedules: ScheduleSlot[];
}

const initialSetupForm: StudentSetupForm = {
  phone: "", level: "B1", instructor: "", startDate: "", extraLessons: 0, schedules: [],
};

interface InstructorSetupForm {
  phone: string;
  joinDate: string;
  gender: string;
  age: string;
  education: string;
  bioNotes: string;
}

const initialInstructorForm: InstructorSetupForm = {
  phone: "", joinDate: "", gender: "", age: "", education: "", bioNotes: "",
};

interface Props {
  onNavigate?: (tab: string) => void;
}

export default function UserApproval({ onNavigate }: Props) {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [approved, setApproved] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  // Student setup dialog
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupUser, setSetupUser] = useState<PendingUser | null>(null);
  const [setupForm, setSetupForm] = useState<StudentSetupForm>(initialSetupForm);
  const [instructorNames, setInstructorNames] = useState<string[]>([]);
  const [savingSetup, setSavingSetup] = useState(false);

  // Instructor setup dialog
  const [instrDialogOpen, setInstrDialogOpen] = useState(false);
  const [instrUser, setInstrUser] = useState<PendingUser | null>(null);
  const [instrForm, setInstrForm] = useState<InstructorSetupForm>(initialInstructorForm);
  const [savingInstr, setSavingInstr] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("id, user_id, role, display_name, approved")
      .in("role", ["student", "instructor"])
      .order("id", { ascending: false });

    const all = (data || []) as PendingUser[];
    setPending(all.filter(u => !u.approved));
    setApproved(all.filter(u => u.approved));
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase
      .from("instructors")
      .select("name")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setInstructorNames((data || []).map(i => i.name)));
  }, []);

  const handleApprove = async (user: PendingUser) => {
    setActing(user.id);
    const { error } = await supabase
      .from("user_roles")
      .update({ approved: true })
      .eq("id", user.id);

    if (error) {
      toast({ title: "승인 실패", description: error.message, variant: "destructive" });
      setActing(null);
      return;
    }

    toast({ title: `${user.display_name || "사용자"} 승인 완료 ✓` });
    setActing(null);

    if (user.role === "student") {
      setSetupUser(user);
      setSetupForm(initialSetupForm);
      setSetupDialogOpen(true);
    } else if (user.role === "instructor") {
      setInstrUser(user);
      setInstrForm(initialInstructorForm);
      setInstrDialogOpen(true);
    }

    load();
  };

  const handleReject = async (user: PendingUser) => {
    setActing(user.id);
    const { error } = await supabase.functions.invoke("delete-user", {
      body: { userId: user.user_id },
    });
    if (error) {
      toast({ title: "거절 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${user.display_name || "사용자"} 거절 완료` });
      load();
    }
    setActing(null);
  };

  const handleSaveStudentSetup = async () => {
    if (!setupUser || !setupForm.level || !setupForm.instructor) {
      toast({ title: "레벨과 담당 강사를 선택해주세요.", variant: "destructive" });
      return;
    }
    setSavingSetup(true);

    // Find instructor_id
    const { data: instrData } = await supabase
      .from("instructors")
      .select("id")
      .eq("name", setupForm.instructor)
      .eq("active", true)
      .maybeSingle();

    const { error } = await supabase
      .from("instructor_students")
      .insert({
        student_name: setupUser.display_name || "Unknown",
        instructor_id: instrData?.id ?? "00000000-0000-0000-0000-000000000000",
        instructor_name: setupForm.instructor,
        phone: setupForm.phone || null,
        level: setupForm.level,
        start_date: setupForm.startDate || null,
        extra_lessons: setupForm.extraLessons,
        schedules: setupForm.schedules.length > 0 ? JSON.stringify(setupForm.schedules) : null,
        status: "active",
      });

    setSavingSetup(false);

    if (error) {
      toast({ title: "수강생 등록 실패", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: `${setupUser.display_name} 수강생 정보 등록 완료 ✓` });
    setSetupDialogOpen(false);
    setSetupUser(null);

    // Auto-generate sessions for active periods
    autoGenerateSessions();

    onNavigate?.("students");
  };

  const handleSaveInstructorSetup = async () => {
    if (!instrUser) return;
    setSavingInstr(true);

    // Find the instructor record by user_id
    const { data: instrData } = await supabase
      .from("instructors")
      .select("id")
      .eq("user_id", instrUser.user_id)
      .maybeSingle();

    if (instrData) {
      const { error } = await supabase
        .from("instructors")
        .update({
          phone: instrForm.phone || null,
          join_date: instrForm.joinDate || null,
          gender: instrForm.gender || null,
          age: instrForm.age ? parseInt(instrForm.age) : null,
          education: instrForm.education || null,
          bio_notes: instrForm.bioNotes || null,
        })
        .eq("id", instrData.id);

      if (error) {
        toast({ title: "강사 정보 저장 실패", description: error.message, variant: "destructive" });
        setSavingInstr(false);
        return;
      }
    }

    toast({ title: `${instrUser.display_name} 강사 정보 등록 완료 ✓` });
    setInstrDialogOpen(false);
    setInstrUser(null);
    setSavingInstr(false);
    onNavigate?.("instructors");
  };

  const roleLabel = (r: string) => r === "student" ? "학생" : r === "instructor" ? "강사" : r;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">가입 승인 관리</h1>
        <p className="text-muted-foreground text-sm mt-1">회원가입 요청을 승인하거나 거절합니다</p>
      </div>

      {/* Pending */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold" />
            승인 대기 ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">대기 중인 요청이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {pending.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm text-foreground">{u.display_name || "이름 없음"}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {roleLabel(u.role)}
                    </Badge>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={() => handleReject(u)}
                      disabled={acting === u.id}
                    >
                      {acting === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      거절
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.9)] text-primary-foreground"
                      onClick={() => handleApprove(u)}
                      disabled={acting === u.id}
                    >
                      {acting === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      승인
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved - Collapsible */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[hsl(var(--success))]" />
                승인 완료 ({approved.length})
              </CardTitle>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {approved.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">승인된 사용자가 없습니다</p>
              ) : (
                <div className="space-y-1.5">
                  {approved.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <p className="font-medium text-sm text-foreground">{u.display_name || "이름 없음"}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {roleLabel(u.role)}
                        </Badge>
                      </div>
                      <Badge className="bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] text-[10px]">승인됨</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Student Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setSetupDialogOpen(false);
          setSetupUser(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>수강생 기본 정보 설정</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{setupUser?.display_name}</span> 님의 수업 정보를 설정합니다.
          </p>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">레벨</Label>
                <Select
                  value={setupForm.level}
                  onValueChange={(v) => setSetupForm(p => ({ ...p, level: v as Level }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">담당 강사</Label>
                <Select
                  value={setupForm.instructor}
                  onValueChange={(v) => setSetupForm(p => ({ ...p, instructor: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {instructorNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">연락처</Label>
                <Input
                  placeholder="010-0000-0000"
                  className="h-9"
                  value={setupForm.phone}
                  onChange={(e) => setSetupForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">수업 시작일</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={setupForm.startDate}
                  onChange={(e) => setSetupForm(p => ({ ...p, startDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Schedules */}
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
                    setSetupForm(p => ({
                      ...p,
                      schedules: [...p.schedules, { day: "월", time: "10:00" }],
                    }))
                  }
                >
                  <Plus className="w-3 h-3" /> 추가
                </button>
              </div>
              {setupForm.schedules.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">수업 일정을 추가하세요</p>
              ) : (
                <div className="space-y-2">
                  {setupForm.schedules.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select
                        value={slot.day}
                        onValueChange={(v) =>
                          setSetupForm(p => ({
                            ...p,
                            schedules: p.schedules.map((s, i) => i === idx ? { ...s, day: v } : s),
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 w-20 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map(d => <SelectItem key={d} value={d}>{d}요일</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select
                        value={slot.time}
                        onValueChange={(v) =>
                          setSetupForm(p => ({
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
                          setSetupForm(p => ({
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

            <Button
              className="w-full gap-2 bg-navy hover:bg-navy-light text-primary-foreground"
              disabled={savingSetup || !setupForm.level || !setupForm.instructor}
              onClick={handleSaveStudentSetup}
            >
              {savingSetup && <Loader2 className="w-4 h-4 animate-spin" />}
              저장 후 수강생 관리로 이동
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instructor Setup Dialog */}
      <Dialog open={instrDialogOpen} onOpenChange={(open) => {
        if (!open) { setInstrDialogOpen(false); setInstrUser(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>강사 기본 정보 설정</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{instrUser?.display_name}</span> 님의 정보를 설정합니다.
          </p>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">연락처</Label>
                <Input
                  placeholder="010-0000-0000"
                  className="h-9"
                  value={instrForm.phone}
                  onChange={(e) => setInstrForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">입사일</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={instrForm.joinDate}
                  onChange={(e) => setInstrForm(p => ({ ...p, joinDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">성별</Label>
                <Select
                  value={instrForm.gender}
                  onValueChange={(v) => setInstrForm(p => ({ ...p, gender: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="남">남</SelectItem>
                    <SelectItem value="여">여</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">나이</Label>
                <Input
                  type="number"
                  placeholder="30"
                  className="h-9"
                  value={instrForm.age}
                  onChange={(e) => setInstrForm(p => ({ ...p, age: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">최종학력</Label>
                <Select
                  value={instrForm.education}
                  onValueChange={(v) => setInstrForm(p => ({ ...p, education: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="고졸">고졸</SelectItem>
                    <SelectItem value="전문대졸">전문대졸</SelectItem>
                    <SelectItem value="대졸">대졸</SelectItem>
                    <SelectItem value="석사">석사</SelectItem>
                    <SelectItem value="박사">박사</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">비고</Label>
              <Input
                placeholder="특이사항을 입력하세요"
                className="h-9"
                value={instrForm.bioNotes}
                onChange={(e) => setInstrForm(p => ({ ...p, bioNotes: e.target.value }))}
              />
            </div>

            <Button
              className="w-full gap-2 bg-navy hover:bg-navy-light text-primary-foreground"
              disabled={savingInstr}
              onClick={handleSaveInstructorSetup}
            >
              {savingInstr && <Loader2 className="w-4 h-4 animate-spin" />}
              저장 후 강사 관리로 이동
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
