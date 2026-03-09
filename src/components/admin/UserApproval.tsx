import { useState, useEffect } from "react";
import { Check, X, Loader2, UserCheck, Clock, Plus, ChevronDown, Link2, Unlink } from "lucide-react";
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

interface UnlinkedStudent {
  id: string;
  student_name: string;
  instructor_name: string | null;
  level: string | null;
}

interface UnlinkedInstructor {
  id: string;
  name: string;
  email: string;
  position: string;
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

  // Map user_id → linked student_name for approved students
  const [linkedMap, setLinkedMap] = useState<Record<string, string>>({});

  // Map user_id → linked instructor name for approved instructors
  const [linkedInstrMap, setLinkedInstrMap] = useState<Record<string, string>>({});

  // Student linking dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUser, setLinkUser] = useState<PendingUser | null>(null);
  const [unlinkedStudents, setUnlinkedStudents] = useState<UnlinkedStudent[]>([]);
  const [allStudents, setAllStudents] = useState<UnlinkedStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [savingLink, setSavingLink] = useState(false);
  const [isRelink, setIsRelink] = useState(false);

  // Instructor linking dialog
  const [instrLinkDialogOpen, setInstrLinkDialogOpen] = useState(false);
  const [instrLinkUser, setInstrLinkUser] = useState<PendingUser | null>(null);
  const [unlinkedInstructors, setUnlinkedInstructors] = useState<UnlinkedInstructor[]>([]);
  const [allInstructors, setAllInstructors] = useState<UnlinkedInstructor[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>("");
  const [savingInstrLink, setSavingInstrLink] = useState(false);
  const [isInstrRelink, setIsInstrRelink] = useState(false);

  // Student setup dialog (for creating new record)
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupUser, setSetupUser] = useState<PendingUser | null>(null);
  const [setupForm, setSetupForm] = useState<StudentSetupForm>(initialSetupForm);
  const [instructorNames, setInstructorNames] = useState<string[]>([]);
  const [savingSetup, setSavingSetup] = useState(false);

  // Instructor setup dialog (for additional info after linking)
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

    // Load linked student names for approved students
    const approvedStudents = all.filter(u => u.approved && u.role === "student");
    if (approvedStudents.length > 0) {
      const { data: links } = await supabase
        .from("instructor_students")
        .select("user_id, student_name")
        .in("user_id", approvedStudents.map(u => u.user_id));
      const map: Record<string, string> = {};
      (links || []).forEach(l => { if (l.user_id) map[l.user_id] = l.student_name; });
      setLinkedMap(map);
    }

    // Load linked instructor names for approved instructors
    const approvedInstructors = all.filter(u => u.approved && u.role === "instructor");
    if (approvedInstructors.length > 0) {
      const { data: instrLinks } = await supabase
        .from("instructors")
        .select("user_id, name")
        .in("user_id", approvedInstructors.map(u => u.user_id));
      const instrMap: Record<string, string> = {};
      (instrLinks || []).forEach(l => { if (l.user_id) instrMap[l.user_id] = l.name; });
      setLinkedInstrMap(instrMap);
    }

    setLoading(false);
  };

  const loadUnlinkedInstructors = async () => {
    const { data } = await supabase
      .from("instructors")
      .select("id, name, email, position")
      .is("user_id", null)
      .eq("active", true)
      .order("name");
    setUnlinkedInstructors((data || []) as UnlinkedInstructor[]);
  };

  const loadAllInstructors = async () => {
    const { data } = await supabase
      .from("instructors")
      .select("id, name, email, position")
      .eq("active", true)
      .order("name");
    setAllInstructors((data || []) as UnlinkedInstructor[]);
  };

  const loadUnlinkedStudents = async () => {
    const { data } = await supabase
      .from("instructor_students")
      .select("id, student_name, instructor_name, level")
      .is("user_id", null)
      .eq("status", "active")
      .order("student_name");
    setUnlinkedStudents((data || []) as UnlinkedStudent[]);
  };

  const loadAllStudents = async () => {
    const { data } = await supabase
      .from("instructor_students")
      .select("id, student_name, instructor_name, level")
      .eq("status", "active")
      .order("student_name");
    setAllStudents((data || []) as UnlinkedStudent[]);
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
      // Show linking dialog with unlinked students
      setIsRelink(false);
      await loadUnlinkedStudents();
      setLinkUser(user);
      setSelectedStudentId("");
      setLinkDialogOpen(true);
    } else if (user.role === "instructor") {
      // Show instructor linking dialog
      setIsInstrRelink(false);
      await loadUnlinkedInstructors();
      setInstrLinkUser(user);
      setSelectedInstructorId("");
      setInstrLinkDialogOpen(true);
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

  // Link student account to existing instructor_students record
  const handleLinkStudent = async () => {
    if (!linkUser || !selectedStudentId) return;
    setSavingLink(true);

    // If relinking, clear previous link first
    if (isRelink) {
      await supabase
        .from("instructor_students")
        .update({ user_id: null })
        .eq("user_id", linkUser.user_id);
    }

    // Update instructor_students.user_id
    const { error } = await supabase
      .from("instructor_students")
      .update({ user_id: linkUser.user_id })
      .eq("id", selectedStudentId);

    if (error) {
      toast({ title: "연결 실패", description: error.message, variant: "destructive" });
      setSavingLink(false);
      return;
    }

    // Also update student_profiles.student_name to match the linked record
    const linked = (isRelink ? allStudents : unlinkedStudents).find(s => s.id === selectedStudentId);
    if (linked) {
      await supabase
        .from("student_profiles")
        .update({ student_name: linked.student_name })
        .eq("user_id", linkUser.user_id);
    }

    toast({ title: `${linkUser.display_name} → ${linked?.student_name} 연결 ${isRelink ? "변경" : ""} 완료 ✓` });
    setLinkDialogOpen(false);
    setLinkUser(null);
    setSavingLink(false);

    if (!isRelink) autoGenerateSessions();
    load();
  };

  // Open new student setup (fallback when no existing record)
  const handleCreateNew = () => {
    setLinkDialogOpen(false);
    if (linkUser) {
      setSetupUser(linkUser);
      setSetupForm(initialSetupForm);
      setSetupDialogOpen(true);
    }
  };

  // Link instructor account to existing instructors record
  const handleLinkInstructor = async () => {
    if (!instrLinkUser || !selectedInstructorId) return;
    setSavingInstrLink(true);

    // If relinking, clear previous link first
    if (isInstrRelink) {
      await supabase
        .from("instructors")
        .update({ user_id: null })
        .eq("user_id", instrLinkUser.user_id);
    }

    // Get the instructor record to extract bio_notes (may contain english name)
    const { data: instrRecord } = await supabase
      .from("instructors")
      .select("bio_notes")
      .eq("id", selectedInstructorId)
      .maybeSingle();

    // Extract english name from bio_notes if present
    const bioNotes = instrRecord?.bio_notes || "";
    const engNameMatch = bioNotes.match(/^영어이름: (.+)$/);
    const englishName = engNameMatch ? engNameMatch[1] : null;

    // Update instructors.user_id and email from auth
    const { error } = await supabase
      .from("instructors")
      .update({
        user_id: instrLinkUser.user_id,
        // Clean up bio_notes if it was only the english name
        ...(engNameMatch ? { bio_notes: null } : {}),
      })
      .eq("id", selectedInstructorId);

    if (error) {
      toast({ title: "연결 실패", description: error.message, variant: "destructive" });
      setSavingInstrLink(false);
      return;
    }

    // Set user_roles.display_name to english name if available
    if (englishName) {
      await supabase
        .from("user_roles")
        .update({ display_name: englishName })
        .eq("user_id", instrLinkUser.user_id)
        .eq("role", "instructor");
    }

    const linked = (isInstrRelink ? allInstructors : unlinkedInstructors).find(i => i.id === selectedInstructorId);
    toast({ title: `${instrLinkUser.display_name} → ${linked?.name} 연결 ${isInstrRelink ? "변경" : ""} 완료 ✓` });
    setInstrLinkDialogOpen(false);
    setInstrLinkUser(null);
    setSavingInstrLink(false);

    // Optionally show additional info dialog
    if (!isInstrRelink && linked) {
      setInstrUser(instrLinkUser);
      setInstrForm(initialInstructorForm);
      setInstrDialogOpen(true);
    }

    load();
  };

  const handleSaveStudentSetup = async () => {
    if (!setupUser || !setupForm.level || !setupForm.instructor) {
      toast({ title: "레벨과 담당 강사를 선택해주세요.", variant: "destructive" });
      return;
    }
    setSavingSetup(true);

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
        user_id: setupUser.user_id,
      });

    setSavingSetup(false);

    if (error) {
      toast({ title: "수강생 등록 실패", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: `${setupUser.display_name} 수강생 정보 등록 완료 ✓` });
    setSetupDialogOpen(false);
    setSetupUser(null);

    autoGenerateSessions();
    onNavigate?.("students");
  };

  const handleSaveInstructorSetup = async () => {
    if (!instrUser) return;
    setSavingInstr(true);

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
            <CardContent className="space-y-5">
              {approved.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">승인된 사용자가 없습니다</p>
              ) : (
                <>
                  {/* 강사 섹션 */}
                  {(() => {
                    const approvedInstructors = approved.filter(u => u.role === "instructor");
                    return approvedInstructors.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">강사 ({approvedInstructors.length})</p>
                        <div className="space-y-1.5">
                          {approvedInstructors.map(u => {
                            const linkedName = linkedInstrMap[u.user_id] || null;
                            return (
                              <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                                <div className="flex items-center gap-3">
                                  <p className="font-medium text-sm text-foreground">{u.display_name || "이름 없음"}</p>
                                  <Badge variant="outline" className="text-[10px]">{roleLabel(u.role)}</Badge>
                                  {linkedName && (
                                    <span className="text-[10px] text-muted-foreground">
                                      → {linkedName}
                                    </span>
                                  )}
                                  {!linkedName && (
                                    <span className="text-[10px] text-destructive">미연결</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {linkedName && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-[10px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                                      onClick={async () => {
                                        if (!confirm(`${u.display_name} 님의 강사 연결을 해제하시겠습니까?`)) return;
                                        await supabase
                                          .from("instructors")
                                          .update({ user_id: null })
                                          .eq("user_id", u.user_id);
                                        toast({ title: `${u.display_name} 연결 해제 완료` });
                                        load();
                                      }}
                                    >
                                      <Unlink className="w-3 h-3" />
                                      해제
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[10px] gap-1 border-navy/30 text-navy hover:bg-navy/10"
                                    onClick={async () => {
                                      setIsInstrRelink(!!linkedName);
                                      await Promise.all([loadUnlinkedInstructors(), loadAllInstructors()]);
                                      setInstrLinkUser(u);
                                      setSelectedInstructorId("");
                                      setInstrLinkDialogOpen(true);
                                    }}
                                  >
                                    <Link2 className="w-3 h-3" />
                                    {linkedName ? "연결 수정" : "연결"}
                                  </Button>
                                  <Badge className="bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] text-[10px]">승인됨</Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* 학생 섹션 */}
                  {(() => {
                    const approvedStudents = approved.filter(u => u.role === "student");
                    return approvedStudents.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">학생 ({approvedStudents.length})</p>
                        <div className="space-y-1.5">
                          {approvedStudents.map(u => {
                    const linkedName = linkedMap[u.user_id] || null;
                    return (
                      <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <p className="font-medium text-sm text-foreground">{u.display_name || "이름 없음"}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {roleLabel(u.role)}
                          </Badge>
                          {linkedName && (
                            <span className="text-[10px] text-muted-foreground">
                              → {linkedName}
                            </span>
                          )}
                          {!linkedName && (
                            <span className="text-[10px] text-destructive">미연결</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {linkedName && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={async () => {
                                if (!confirm(`${u.display_name} 님의 연결을 해제하시겠습니까?`)) return;
                                await supabase
                                  .from("instructor_students")
                                  .update({ user_id: null })
                                  .eq("user_id", u.user_id);
                                toast({ title: `${u.display_name} 연결 해제 완료` });
                                load();
                              }}
                            >
                              <Unlink className="w-3 h-3" />
                              해제
                            </Button>
                          )}
                          {u.role === "student" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] gap-1 border-navy/30 text-navy hover:bg-navy/10"
                              onClick={async () => {
                                setIsRelink(!!linkedName);
                                await Promise.all([loadUnlinkedStudents(), loadAllStudents()]);
                                setLinkUser(u);
                                setSelectedStudentId("");
                                setLinkDialogOpen(true);
                              }}
                            >
                              <Link2 className="w-3 h-3" />
                              {linkedName ? "연결 수정" : "연결"}
                            </Button>
                          )}
                          <Badge className="bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] text-[10px]">승인됨</Badge>
                        </div>
                      </div>
                    );
                          })}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Student Linking Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => {
        if (!open) { setLinkDialogOpen(false); setLinkUser(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              {isRelink ? "수강생 계정 연결 수정" : "수강생 계정 연결"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{linkUser?.display_name}</span> 님의 계정을
            {isRelink ? " 다른 수강생 레코드로 변경합니다." : " 기존 수강생 레코드에 연결합니다."}
          </p>
          <div className="space-y-4 pt-2">
            {(() => {
              const studentList = isRelink ? allStudents : unlinkedStudents;
              return studentList.length > 0 ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRelink ? "수강생 선택 (전체)" : "기존 수강생 선택"}</Label>
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="수강생을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {studentList.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.student_name}
                            {s.instructor_name ? ` (담당: ${s.instructor_name})` : ""}
                            {s.level ? ` · ${s.level}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full gap-2 bg-navy hover:bg-navy-light text-primary-foreground"
                    disabled={savingLink || !selectedStudentId}
                    onClick={handleLinkStudent}
                  >
                    {savingLink && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Link2 className="w-4 h-4" />
                    {isRelink ? "연결 변경" : "연결하기"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  연결 가능한 수강생 레코드가 없습니다.
                </p>
              );
            })()}

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">또는</span></div>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2 text-xs"
              onClick={handleCreateNew}
            >
              <Plus className="w-3.5 h-3.5" />
              새 수강생 레코드 생성
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instructor Linking Dialog */}
      <Dialog open={instrLinkDialogOpen} onOpenChange={(open) => {
        if (!open) { setInstrLinkDialogOpen(false); setInstrLinkUser(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              {isInstrRelink ? "강사 계정 연결 수정" : "강사 계정 연결"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{instrLinkUser?.display_name}</span> 님의 계정을
            {isInstrRelink ? " 다른 강사 레코드로 변경합니다." : " 기존 강사 레코드에 연결합니다."}
          </p>
          <div className="space-y-4 pt-2">
            {(() => {
              const instrList = isInstrRelink ? allInstructors : unlinkedInstructors;
              return instrList.length > 0 ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isInstrRelink ? "강사 선택 (전체)" : "기존 강사 선택"}</Label>
                    <Select value={selectedInstructorId} onValueChange={setSelectedInstructorId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="강사를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {instrList.map(i => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name} ({i.email}) · {i.position}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full gap-2 bg-navy hover:bg-navy-light text-primary-foreground"
                    disabled={savingInstrLink || !selectedInstructorId}
                    onClick={handleLinkInstructor}
                  >
                    {savingInstrLink && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Link2 className="w-4 h-4" />
                    {isInstrRelink ? "연결 변경" : "연결하기"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  연결 가능한 강사 레코드가 없습니다. 강사 관리에서 먼저 강사를 추가해주세요.
                </p>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>


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
