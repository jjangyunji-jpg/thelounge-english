import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Users, AlertCircle, Video, Plus, LogOut,
  Calendar, Clock, ChevronRight, Check, X, Loader2,
  TrendingUp, Banknote, Coffee, FileText, ChevronLeft,
  GraduationCap, ClipboardCheck, Settings2, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Instructor {
  id: string;
  name: string;
  email: string;
  lesson_rate: number;
  meeting_rate: number;
  active: boolean;
}

interface StudentFull {
  id: string;
  student_name: string;
  level: string | null;
  schedules: string | null;
  meet_link: string | null;
  phone: string | null;
  status: string | null;
  lesson_goal: string | null;
  lesson_goal_count: number | null;
  extra_lessons: number | null;
  start_date: string | null;
  instructor_id: string;
  instructor_name: string | null;
}

interface ClassSession {
  id: string;
  scheduled_at: string;
  topic: string | null;
  level: string;
  student_name: string;
  instructor_name: string;
  meet_link: string | null;
  started_at: string | null;
  ended_at: string | null;
}

interface HomeworkAssignment {
  id: string;
  title: string;
  student_name: string;
}

interface HomeworkSubmission {
  id: string;
  assignment_id: string | null;
  status: string;
  student_name: string;
}

interface BusinessMeeting {
  id: string;
  instructor_id: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
}

interface SchedulePeriod {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
}
function msUntil(iso: string) { return new Date(iso).getTime() - Date.now(); }
function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// ── Big Calendar ──────────────────────────────────────────────────────────────
function BigCalendar({
  sessions,
  meetings,
  selectedDate,
  onSelectDate,
}: {
  sessions: ClassSession[];
  meetings: BusinessMeeting[];
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
}) {
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Group sessions by date
  const sessionsByDate = new Map<string, ClassSession[]>();
  sessions.forEach((s) => {
    const key = new Date(s.scheduled_at).toDateString();
    if (!sessionsByDate.has(key)) sessionsByDate.set(key, []);
    sessionsByDate.get(key)!.push(s);
  });
  const meetingDates = new Set(meetings.map((m) => new Date(m.scheduled_at).toDateString()));

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-base font-bold text-foreground min-w-[120px] text-center">{year}년 {month + 1}월</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <button onClick={() => setViewDate(new Date())} className="text-xs text-navy hover:underline font-medium">오늘</button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div key={d} className={cn("text-xs font-semibold py-2", i === 0 ? "text-destructive/70" : i === 6 ? "text-blue-400" : "text-muted-foreground")}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} className="aspect-square" />;
          const date = new Date(year, month, day);
          const dateStr = date.toDateString();
          const daySessions = sessionsByDate.get(dateStr) || [];
          const hasMeeting = meetingDates.has(dateStr);
          const todayFlag = dateStr === new Date().toDateString();
          const isSelected = selectedDate && dateStr === selectedDate.toDateString();
          const dayOfWeek = date.getDay();

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(date)}
              className={cn(
                "aspect-square flex flex-col items-center justify-start rounded-lg p-1 transition-all text-xs relative hover:bg-muted/50",
                todayFlag && "ring-2 ring-navy/50",
                isSelected && "bg-navy/10 ring-2 ring-navy",
              )}
            >
              <span className={cn(
                "text-[11px] font-medium",
                todayFlag ? "text-navy font-bold" : dayOfWeek === 0 ? "text-destructive/70" : dayOfWeek === 6 ? "text-blue-400" : "text-foreground",
              )}>
                {day}
              </span>
              {(daySessions.length > 0 || hasMeeting) && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {daySessions.slice(0, 3).map((s, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-navy" />
                  ))}
                  {daySessions.length > 3 && <span className="text-[8px] text-navy font-bold">+{daySessions.length - 3}</span>}
                  {hasMeeting && <div className="w-1.5 h-1.5 rounded-full bg-gold" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-navy" /> 수업
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-gold" /> 업무미팅
        </div>
      </div>
    </div>
  );
}

// ── Add Meeting Modal ──────────────────────────────────────────────────────────
function AddMeetingModal({
  instructorId,
  onClose,
  onAdded,
}: {
  instructorId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!date || !time) return;
    setSaving(true);
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase.from("business_meetings").insert({
      instructor_id: instructorId,
      scheduled_at: scheduledAt,
      duration_minutes: duration,
      notes: notes.trim() || null,
    });
    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "업무 미팅 추가됨 ✓" });
      onAdded();
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-foreground">업무 미팅 추가</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">날짜</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">시간</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">소요 시간 (분)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={15} step={15} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">메모 (선택)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="미팅 내용..." className="h-9 text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">취소</Button>
          <Button onClick={handleSave} disabled={saving || !date} className="flex-1 h-9 text-sm bg-navy hover:bg-navy-light text-primary-foreground gap-1.5">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 저장
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Student Edit Modal ─────────────────────────────────────────────────────────
function StudentEditModal({
  student,
  onClose,
  onSaved,
}: {
  student: StudentFull;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [level, setLevel] = useState(student.level || "B1");
  const [schedules, setSchedules] = useState(student.schedules || "");
  const [meetLink, setMeetLink] = useState(student.meet_link || "");
  const [phone, setPhone] = useState(student.phone || "");
  const [status, setStatus] = useState(student.status || "active");
  const [lessonGoal, setLessonGoal] = useState(student.lesson_goal || "");
  const [lessonGoalCount, setLessonGoalCount] = useState(student.lesson_goal_count || 0);
  const [extraLessons, setExtraLessons] = useState(student.extra_lessons || 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("instructor_students").update({
      level, schedules: schedules.trim() || null, meet_link: meetLink.trim() || null,
      phone: phone.trim() || null, status,
      lesson_goal: lessonGoal.trim() || null, lesson_goal_count: lessonGoalCount,
      extra_lessons: extraLessons,
    }).eq("id", student.id);
    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "학생 정보 수정 완료 ✓" });
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-foreground">{student.student_name} — 학생 정보 수정</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">레벨</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">상태</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">수강 중</SelectItem>
                  <SelectItem value="paused">휴강</SelectItem>
                  <SelectItem value="graduated">수료</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">수업 일정 (예: 월수금 19:00)</Label>
            <Input value={schedules} onChange={(e) => setSchedules(e.target.value)} placeholder="월수금 19:00" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Google Meet 링크</Label>
            <Input value={meetLink} onChange={(e) => setMeetLink(e.target.value)} placeholder="https://meet.google.com/..." className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">연락처</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">목표 수업 수</Label>
              <Input type="number" value={lessonGoalCount} onChange={(e) => setLessonGoalCount(Number(e.target.value))} min={0} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">보강 횟수</Label>
              <Input type="number" value={extraLessons} onChange={(e) => setExtraLessons(Number(e.target.value))} min={0} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">학습 목표</Label>
            <Input value={lessonGoal} onChange={(e) => setLessonGoal(e.target.value)} placeholder="예: TOEIC 900점" className="h-9 text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">취소</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 h-9 text-sm bg-navy hover:bg-navy-light text-primary-foreground gap-1.5">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 저장
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Session Reschedule Modal ──────────────────────────────────────────────────
function RescheduleModal({
  session,
  onClose,
  onSaved,
}: {
  session: ClassSession;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const orig = new Date(session.scheduled_at);
  const [date, setDate] = useState(orig.toISOString().slice(0, 10));
  const [time, setTime] = useState(orig.toTimeString().slice(0, 5));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const newScheduled = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase.from("class_sessions").update({ scheduled_at: newScheduled }).eq("id", session.id);
    if (error) {
      toast({ title: "변경 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "수업 일정이 변경되었습니다 ✓" });
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-foreground">수업 일정 변경</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{session.student_name} · {fmtDateTime(session.scheduled_at)}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">날짜</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">시간</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm">취소</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 h-9 text-sm bg-navy hover:bg-navy-light text-primary-foreground gap-1.5">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 변경
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function InstructorDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [students, setStudents] = useState<StudentFull[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [meetings, setMeetings] = useState<BusinessMeeting[]>([]);
  const [period, setPeriod] = useState<SchedulePeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "students">("dashboard");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [editStudent, setEditStudent] = useState<StudentFull | null>(null);
  const [rescheduleSession, setRescheduleSession] = useState<ClassSession | null>(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setUser({ email: user.email ?? "" });

    const { data: ins } = await supabase
      .from("instructors").select("*").eq("email", user.email).maybeSingle();

    if (!ins) {
      toast({ title: "강사 계정을 찾을 수 없습니다", variant: "destructive" });
      setLoading(false);
      return;
    }
    setInstructor(ins);
    await loadData(ins);
  };

  const loadData = useCallback(async (ins: Instructor) => {
    setLoading(true);
    const [studRes, sessRes, hwRes, subRes, meetRes, periodRes] = await Promise.all([
      supabase.from("instructor_students").select("*").eq("instructor_id", ins.id),
      supabase.from("class_sessions").select("*").eq("instructor_name", ins.name).order("scheduled_at", { ascending: false }),
      supabase.from("homework_assignments").select("id,title,student_name"),
      supabase.from("homework_submissions").select("id,assignment_id,status,student_name"),
      supabase.from("business_meetings").select("*").eq("instructor_id", ins.id).order("scheduled_at", { ascending: false }),
      supabase.from("schedule_periods").select("*").eq("is_active", true).maybeSingle(),
    ]);

    setStudents(studRes.data || []);
    setSessions(sessRes.data || []);
    setAssignments(hwRes.data || []);
    setSubmissions(subRes.data || []);
    setMeetings(meetRes.data || []);
    setPeriod(periodRes.data || null);
    setLoading(false);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <p className="font-semibold text-foreground">강사 계정을 찾을 수 없습니다</p>
          <p className="text-sm text-muted-foreground">{user?.email} — 관리자에게 문의하세요</p>
          <Button variant="outline" onClick={handleLogout}>로그아웃</Button>
        </div>
      </div>
    );
  }

  // ── Derived stats ──
  const myStudentNames = new Set(students.map((s) => s.student_name));
  const todaySessions = sessions.filter((s) => isToday(s.scheduled_at));
  const upcomingSessions = sessions.filter((s) => msUntil(s.scheduled_at) > 0)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const myAssignments = assignments.filter((a) => myStudentNames.has(a.student_name));
  const uncheckedHw = myAssignments.filter((a) => {
    const sub = submissions.find((s) => s.assignment_id === a.id);
    return sub && sub.status === "submitted";
  });

  // Period stats
  const start = period ? new Date(period.start_date) : null;
  const end = period ? new Date(period.end_date) : null;
  const periodSessions = sessions.filter((s) => {
    if (!start || !end) return false;
    const d = new Date(s.scheduled_at);
    return d >= start && d <= end;
  });
  const periodMeetings = meetings.filter((m) => {
    if (!start || !end) return false;
    const d = new Date(m.scheduled_at);
    return d >= start && d <= end;
  });
  const lessonHours = periodSessions.length;
  const meetingHours = +(periodMeetings.reduce((s, m) => s + m.duration_minutes, 0) / 60).toFixed(1);
  const totalAmount = lessonHours * instructor.lesson_rate + meetingHours * instructor.meeting_rate;

  // Selected date sessions
  const selectedDateStr = selectedDate?.toDateString();
  const selectedDaySessions = selectedDateStr
    ? sessions.filter((s) => new Date(s.scheduled_at).toDateString() === selectedDateStr)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    : [];

  // Per-student stats
  const getStudentStats = (studentName: string) => {
    const sSessions = sessions.filter((s) => s.student_name === studentName);
    const completedSessions = sSessions.filter((s) => new Date(s.scheduled_at) < new Date()).length;
    const sAssignments = assignments.filter((a) => a.student_name === studentName);
    const sSubmissions = submissions.filter((s) => s.student_name === studentName);
    const submittedCount = sAssignments.filter((a) => sSubmissions.some((s) => s.assignment_id === a.id)).length;
    const hwRate = sAssignments.length > 0 ? Math.round((submittedCount / sAssignments.length) * 100) : 0;
    return { totalSessions: sSessions.length, completedSessions, assignmentCount: sAssignments.length, submittedCount, hwRate };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center shadow-gold">
            <BookOpen className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">The Lounge English</p>
            <p className="text-[10px] text-muted-foreground">{instructor.name} · 강사</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowMeetingModal(true)}
            className="h-8 text-xs gap-1.5 bg-navy hover:bg-navy-light text-primary-foreground"
          >
            <Plus className="w-3 h-3" /> 업무 미팅
          </Button>
          <Button size="sm" variant="outline" onClick={handleLogout} className="h-8 text-xs gap-1.5 text-muted-foreground">
            <LogOut className="w-3 h-3" />
          </Button>
        </div>
      </header>

      {/* Tab Nav */}
      <div className="border-b border-border bg-card px-5">
        <div className="flex gap-0 max-w-5xl mx-auto">
          {[
            { id: "dashboard" as const, label: "대시보드", icon: CalendarDays },
            { id: "students" as const, label: "학생 관리", icon: Users },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn("flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === t.id
                  ? "border-navy text-navy"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ═══ DASHBOARD TAB ═══════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "dashboard" && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: "담당 학생", value: `${students.filter(s => s.status === "active").length}명`, icon: Users, color: "text-navy", bg: "bg-navy/10" },
                { label: "이번 기간 수업", value: `${lessonHours}회`, icon: BookOpen, color: "text-gold-dark", bg: "bg-gold/10" },
                { label: "미확인 숙제", value: `${uncheckedHw.length}건`, icon: ClipboardCheck, color: uncheckedHw.length > 0 ? "text-destructive" : "text-success", bg: uncheckedHw.length > 0 ? "bg-destructive/10" : "bg-success/10" },
                { label: "정산 예정", value: `₩${totalAmount.toLocaleString()}`, icon: Banknote, color: "text-success", bg: "bg-success/10" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-3.5 space-y-1.5">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", bg)}>
                    <Icon className={cn("w-3.5 h-3.5", color)} />
                  </div>
                  <p className={cn("text-base font-bold leading-tight", color)}>{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: Calendar */}
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-5">
                  <BigCalendar
                    sessions={sessions}
                    meetings={meetings}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                </div>

                {/* Selected date detail */}
                {selectedDate && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      {selectedDate.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })} 수업
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{selectedDaySessions.length}건</span>
                    </h3>
                    {selectedDaySessions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">예정된 수업이 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDaySessions.map((s) => (
                          <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                            <div className="text-center w-12 flex-shrink-0">
                              <p className="text-xs font-bold text-navy">{fmtTime(s.scheduled_at)}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{s.student_name}</p>
                              <p className="text-[11px] text-muted-foreground">{s.topic || s.level}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setRescheduleSession(s)}
                                className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-muted"
                                title="일정 변경"
                              >
                                <CalendarDays className="w-3.5 h-3.5" />
                              </button>
                              {s.meet_link && (
                                <a href={s.meet_link} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" className="h-6 text-[10px] gap-1 bg-navy hover:bg-navy-light text-primary-foreground px-2">
                                    <Video className="w-3 h-3" /> 입장
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT: Progress + Today + Homework */}
              <div className="space-y-4">
                {/* Today's sessions */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gold" />
                    오늘의 수업
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{todaySessions.length}건</span>
                  </h3>
                  {todaySessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">오늘 예정된 수업이 없습니다</p>
                  ) : (
                    <div className="space-y-2">
                      {todaySessions.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20">
                          <p className="text-xs font-bold text-navy w-12 text-center flex-shrink-0">{fmtTime(s.scheduled_at)}</p>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{s.student_name}</p>
                            <p className="text-[11px] text-muted-foreground">{s.topic || s.level}</p>
                          </div>
                          {s.meet_link && (
                            <a href={`/t/classroom?sessionId=${s.id}`}>
                              <Button size="sm" className="h-7 text-xs gap-1 bg-navy hover:bg-navy-light text-primary-foreground">
                                <Video className="w-3 h-3" /> 교실
                              </Button>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Student progress */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-navy" />
                    학생별 학습 현황
                  </h3>
                  <div className="space-y-2.5">
                    {students.filter(s => s.status === "active").map((st) => {
                      const stats = getStudentStats(st.student_name);
                      const goalCount = st.lesson_goal_count || 0;
                      const progressPct = goalCount > 0 ? Math.min(100, Math.round((stats.completedSessions / goalCount) * 100)) : 0;

                      return (
                        <div key={st.id} className="px-3 py-2.5 rounded-lg border border-border bg-muted/20 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center">
                                <span className="text-navy font-bold text-[10px]">{st.student_name.charAt(0)}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{st.student_name}</p>
                                <p className="text-[10px] text-muted-foreground">{st.level} · {st.schedules || "미정"}</p>
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{stats.completedSessions}/{goalCount || "∞"}회</span>
                          </div>
                          {/* Progress bar */}
                          {goalCount > 0 && (
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-navy transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>수업 {stats.completedSessions}회</span>
                            <span>숙제 {stats.submittedCount}/{stats.assignmentCount}건 ({stats.hwRate}%)</span>
                          </div>
                        </div>
                      );
                    })}
                    {students.filter(s => s.status === "active").length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">담당 학생이 없습니다</p>
                    )}
                  </div>
                </div>

                {/* Unchecked homework */}
                {uncheckedHw.length > 0 && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <h3 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      미확인 숙제
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{uncheckedHw.length}</span>
                    </h3>
                    <div className="space-y-1.5">
                      {uncheckedHw.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">{a.title}</p>
                            <p className="text-[10px] text-muted-foreground">{a.student_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ═══ STUDENTS TAB ════════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "students" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-navy" />
                담당 학생 관리
                <span className="text-xs px-2 py-0.5 rounded-full bg-navy/10 text-navy font-medium">{students.length}명</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {students.map((st) => {
                const stats = getStudentStats(st.student_name);
                const goalCount = st.lesson_goal_count || 0;
                const progressPct = goalCount > 0 ? Math.min(100, Math.round((stats.completedSessions / goalCount) * 100)) : 0;
                const statusLabel = st.status === "active" ? "수강 중" : st.status === "paused" ? "휴강" : "수료";
                const statusColor = st.status === "active" ? "bg-success/10 text-success" : st.status === "paused" ? "bg-gold/10 text-gold-dark" : "bg-muted text-muted-foreground";

                // Upcoming sessions for this student
                const studentUpcoming = sessions
                  .filter((s) => s.student_name === st.student_name && msUntil(s.scheduled_at) > 0)
                  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                  .slice(0, 3);

                return (
                  <div key={st.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    {/* Card header */}
                    <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center">
                          <span className="text-navy font-bold text-sm">{st.student_name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{st.student_name}</p>
                          <p className="text-[10px] text-muted-foreground">{st.level} · {st.schedules || "일정 미정"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColor)}>{statusLabel}</span>
                        <button
                          onClick={() => setEditStudent(st)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="학생 정보 수정"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Progress */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">수업 진도</span>
                          <span className="font-medium text-foreground">{stats.completedSessions}/{goalCount || "∞"}회 {goalCount > 0 ? `(${progressPct}%)` : ""}</span>
                        </div>
                        {goalCount > 0 && (
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-navy transition-all" style={{ width: `${progressPct}%` }} />
                          </div>
                        )}
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="py-1.5 rounded-lg bg-muted/30">
                          <p className="text-xs font-bold text-foreground">{stats.completedSessions}</p>
                          <p className="text-[9px] text-muted-foreground">완료 수업</p>
                        </div>
                        <div className="py-1.5 rounded-lg bg-muted/30">
                          <p className="text-xs font-bold text-foreground">{stats.hwRate}%</p>
                          <p className="text-[9px] text-muted-foreground">숙제 제출률</p>
                        </div>
                        <div className="py-1.5 rounded-lg bg-muted/30">
                          <p className="text-xs font-bold text-foreground">{st.extra_lessons || 0}</p>
                          <p className="text-[9px] text-muted-foreground">보강</p>
                        </div>
                      </div>

                      {/* Upcoming sessions */}
                      {studentUpcoming.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">예정 수업</p>
                          {studentUpcoming.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border">
                              <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-[11px] text-foreground flex-1">{fmtDateTime(s.scheduled_at)}</span>
                              <button
                                onClick={() => setRescheduleSession(s)}
                                className="text-[10px] text-navy hover:underline font-medium"
                              >
                                변경
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {students.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">담당 학생이 없습니다</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showMeetingModal && instructor && (
        <AddMeetingModal
          instructorId={instructor.id}
          onClose={() => setShowMeetingModal(false)}
          onAdded={() => loadData(instructor)}
        />
      )}
      {editStudent && (
        <StudentEditModal
          student={editStudent}
          onClose={() => setEditStudent(null)}
          onSaved={() => loadData(instructor)}
        />
      )}
      {rescheduleSession && (
        <RescheduleModal
          session={rescheduleSession}
          onClose={() => setRescheduleSession(null)}
          onSaved={() => loadData(instructor)}
        />
      )}
    </div>
  );
}
