import { useState, useEffect } from "react";
import {
  BookOpen, Users, AlertCircle, Video, Plus, LogOut,
  Calendar, Clock, ChevronRight, Check, X, Loader2,
  TrendingUp, Banknote, Coffee, FileText, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Instructor {
  id: string;
  name: string;
  email: string;
  lesson_rate: number;
  meeting_rate: number;
  active: boolean;
}

interface StudentRecord {
  student_name: string;
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

// ── Mini Calendar ──────────────────────────────────────────────────────────────
function MiniCalendar({
  period,
  sessions,
  meetings,
}: {
  period: SchedulePeriod | null;
  sessions: ClassSession[];
  meetings: BusinessMeeting[];
}) {
  const [viewDate, setViewDate] = useState(new Date());

  if (!period) return <p className="text-sm text-muted-foreground">수업 기간이 설정되지 않았습니다</p>;

  const start = new Date(period.start_date);
  const end = new Date(period.end_date);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const sessionDates = new Set(sessions.map((s) => new Date(s.scheduled_at).toDateString()));
  const meetingDates = new Set(meetings.map((m) => new Date(m.scheduled_at).toDateString()));

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-3">
      {/* Period label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{period.label}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-navy/10 text-navy font-medium">
            {fmt(period.start_date)} ~ {fmt(period.end_date)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center">
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <span className="text-xs font-medium text-foreground px-2">{year}년 {month + 1}월</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} />;
          const date = new Date(year, month, day);
          const dateStr = date.toDateString();
          const inPeriod = date >= start && date <= end;
          const hasSession = sessionDates.has(dateStr);
          const hasMeeting = meetingDates.has(dateStr);
          const todayFlag = date.toDateString() === new Date().toDateString();

          return (
            <div key={idx} className={cn(
              "aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors relative",
              inPeriod ? "bg-navy/5" : "opacity-40",
              todayFlag ? "ring-1 ring-navy font-bold" : "",
            )}>
              <span className={cn("text-[11px]", todayFlag ? "text-navy font-bold" : "text-foreground")}>{day}</span>
              {(hasSession || hasMeeting) && (
                <div className="flex gap-0.5 mt-0.5">
                  {hasSession && <div className="w-1 h-1 rounded-full bg-navy" />}
                  {hasMeeting && <div className="w-1 h-1 rounded-full bg-gold" />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
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

// ── Settlement Row ─────────────────────────────────────────────────────────────
function SettlementRow({
  instructor,
  sessions,
  meetings,
  period,
  onViewLog,
}: {
  instructor: Instructor;
  sessions: ClassSession[];
  meetings: BusinessMeeting[];
  period: SchedulePeriod | null;
  onViewLog: (instructor: Instructor) => void;
}) {
  // Filter to period
  const start = period ? new Date(period.start_date) : null;
  const end = period ? new Date(period.end_date) : null;

  const periodSessions = sessions.filter((s) => {
    if (!start || !end) return true;
    const d = new Date(s.scheduled_at);
    return d >= start && d <= end;
  });

  const periodMeetings = meetings.filter((m) => {
    if (!start || !end) return true;
    const d = new Date(m.scheduled_at);
    return d >= start && d <= end;
  });

  // 1 session = 1 hour by default
  const lessonHours = periodSessions.length;
  const meetingHours = +(periodMeetings.reduce((s, m) => s + m.duration_minutes, 0) / 60).toFixed(1);
  const total = lessonHours * instructor.lesson_rate + meetingHours * instructor.meeting_rate;

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
      <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
        <span className="text-navy font-bold text-sm">{instructor.name.charAt(0)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">{instructor.name}</p>
        <p className="text-[11px] text-muted-foreground">수업 {instructor.lesson_rate.toLocaleString()}원/h · 미팅 {instructor.meeting_rate.toLocaleString()}원/h</p>
      </div>
      <div className="hidden sm:flex items-center gap-6 text-center text-sm">
        <div>
          <p className="font-semibold text-foreground">{lessonHours}h</p>
          <p className="text-[10px] text-muted-foreground">수업</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">{meetingHours}h</p>
          <p className="text-[10px] text-muted-foreground">미팅</p>
        </div>
        <div>
          <p className="font-semibold text-gold-dark">₩{total.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">합계</p>
        </div>
      </div>
      <button
        onClick={() => onViewLog(instructor)}
        className="text-xs text-navy font-medium flex items-center gap-1 hover:underline flex-shrink-0"
      >
        상세 <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Session Log Modal ──────────────────────────────────────────────────────────
function SessionLogModal({
  instructor,
  sessions,
  meetings,
  onClose,
}: {
  instructor: Instructor;
  sessions: ClassSession[];
  meetings: BusinessMeeting[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div>
            <p className="font-bold text-sm text-foreground">{instructor.name} — 수업 로그</p>
            <p className="text-[10px] text-muted-foreground">{sessions.length}회 수업 · {meetings.length}회 미팅</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Sessions */}
          {sessions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" /> 수업 ({sessions.length}회)
              </p>
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{s.student_name}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtDateTime(s.scheduled_at)}</p>
                    {s.topic && <p className="text-[11px] text-muted-foreground truncate">📝 {s.topic}</p>}
                  </div>
                  <span className="text-xs text-navy font-medium flex-shrink-0">
                    ₩{instructor.lesson_rate.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Meetings */}
          {meetings.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Coffee className="w-3 h-3" /> 업무 미팅 ({meetings.length}회)
              </p>
              {meetings.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20">
                  <Coffee className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{fmtDateTime(m.scheduled_at)}</p>
                    <p className="text-[11px] text-muted-foreground">{m.duration_minutes}분{m.notes ? ` · ${m.notes}` : ""}</p>
                  </div>
                  <span className="text-xs text-gold-dark font-medium flex-shrink-0">
                    ₩{Math.round((m.duration_minutes / 60) * instructor.meeting_rate).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
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
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [meetings, setMeetings] = useState<BusinessMeeting[]>([]);
  const [period, setPeriod] = useState<SchedulePeriod | null>(null);
  const [allInstructors, setAllInstructors] = useState<Instructor[]>([]);
  const [allSessions, setAllSessions] = useState<ClassSession[]>([]);
  const [allMeetings, setAllMeetings] = useState<BusinessMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [logInstructor, setLogInstructor] = useState<Instructor | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "settlement">("overview");

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setUser({ email: user.email ?? "" });

    // Find instructor record
    const { data: ins } = await supabase
      .from("instructors")
      .select("*")
      .eq("email", user.email)
      .maybeSingle();

    if (!ins) {
      toast({ title: "강사 계정을 찾을 수 없습니다", variant: "destructive" });
      setLoading(false);
      return;
    }
    setInstructor(ins);

    await loadData(ins);
  };

  const loadData = async (ins: Instructor) => {
    setLoading(true);
    const [studRes, sessRes, hwRes, subRes, meetRes, periodRes, allInsRes, allSessRes, allMeetRes] = await Promise.all([
      supabase.from("instructor_students").select("student_name").eq("instructor_id", ins.id),
      supabase.from("class_sessions").select("*").eq("instructor_name", ins.name).order("scheduled_at", { ascending: false }),
      supabase.from("homework_assignments").select("id,title,student_name"),
      supabase.from("homework_submissions").select("id,assignment_id,status,student_name"),
      supabase.from("business_meetings").select("*").eq("instructor_id", ins.id).order("scheduled_at", { ascending: false }),
      supabase.from("schedule_periods").select("*").eq("is_active", true).maybeSingle(),
      supabase.from("instructors").select("*").eq("active", true),
      supabase.from("class_sessions").select("*").order("scheduled_at", { ascending: false }),
      supabase.from("business_meetings").select("*"),
    ]);

    setStudents(studRes.data || []);
    setSessions(sessRes.data || []);
    setAssignments(hwRes.data || []);
    setSubmissions(subRes.data || []);
    setMeetings(meetRes.data || []);
    setPeriod(periodRes.data || null);
    setAllInstructors(allInsRes.data || []);
    setAllSessions(allSessRes.data || []);
    setAllMeetings(allMeetRes.data || []);
    setLoading(false);
  };

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
  const todaySessions = sessions.filter((s) => isToday(s.scheduled_at));
  const upcomingSessions = sessions.filter((s) => msUntil(s.scheduled_at) > 0)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const myStudentNames = new Set(students.map((s) => s.student_name));
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
            <p className="text-[10px] text-muted-foreground">{instructor.name}</p>
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
        <div className="flex gap-0 max-w-3xl mx-auto">
          {[{ id: "overview", label: "내 현황" }, { id: "settlement", label: "정산 대시보드" }].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={cn("px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === t.id
                  ? "border-navy text-navy"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "이번 기간 수업", value: `${lessonHours}회`, icon: BookOpen, color: "text-navy", bg: "bg-navy/10" },
                { label: "업무 미팅", value: `${meetingHours}h`, icon: Coffee, color: "text-gold-dark", bg: "bg-gold/10" },
                { label: "정산 예정액", value: `₩${totalAmount.toLocaleString()}`, icon: Banknote, color: "text-success", bg: "bg-success/10" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", bg)}>
                    <Icon className={cn("w-4 h-4", color)} />
                  </div>
                  <p className={cn("text-lg font-bold leading-tight", color)}>{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* Calendar */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">📅 수업 캘린더</h2>
              <MiniCalendar period={period} sessions={sessions} meetings={meetings} />
            </div>

            {/* Today */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">오늘의 수업
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{todaySessions.length}건</span>
              </h2>
              {todaySessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">오늘 예정된 수업이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {todaySessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border bg-muted/20">
                      <div className="text-center w-12 flex-shrink-0">
                        <p className="text-xs font-bold text-navy">{fmtTime(s.scheduled_at)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{s.student_name}</p>
                        <p className="text-[11px] text-muted-foreground">{s.topic || s.level}</p>
                      </div>
                      {s.meet_link && (
                        <a href={s.meet_link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" className="h-7 text-xs gap-1 bg-navy hover:bg-navy-light text-primary-foreground">
                            <Video className="w-3 h-3" /> 입장
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unchecked homework */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">미확인 숙제
                {uncheckedHw.length > 0 && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{uncheckedHw.length}</span>
                )}
              </h2>
              {uncheckedHw.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-success">
                  <Check className="w-4 h-4" /> 모든 숙제를 확인했습니다
                </div>
              ) : (
                <div className="space-y-2">
                  {uncheckedHw.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-destructive/20 bg-destructive/5">
                      <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{a.title}</p>
                        <p className="text-[11px] text-muted-foreground">{a.student_name}</p>
                      </div>
                      <a href="/admin">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          확인 <ChevronRight className="w-3 h-3" />
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Students */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">담당 학생
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{students.length}명</span>
              </h2>
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground">담당 학생이 없습니다</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {students.map((s) => (
                    <div key={s.student_name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/30 text-sm font-medium text-foreground">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      {s.student_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── SETTLEMENT TAB ── */}
        {activeTab === "settlement" && (
          <>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">정산 현황</h2>
                  {period && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{period.label} ({fmt(period.start_date)} ~ {fmt(period.end_date)})</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-gold" />
                </div>
              </div>

              {/* Total */}
              <div className="grid grid-cols-3 gap-3">
                {(() => {
                  const totalLessonH = allInstructors.reduce((sum, ins) => {
                    const s = allSessions.filter((sess) => {
                      const inPeriod = start && end && new Date(sess.scheduled_at) >= start && new Date(sess.scheduled_at) <= end;
                      return sess.instructor_name === ins.name && inPeriod;
                    }).length;
                    return sum + s;
                  }, 0);
                  const totalMeetH = allMeetings.reduce((sum, m) => {
                    const inPeriod = start && end && new Date(m.scheduled_at) >= start && new Date(m.scheduled_at) <= end;
                    return sum + (inPeriod ? m.duration_minutes / 60 : 0);
                  }, 0);
                  const totalAmt = allInstructors.reduce((sum, ins) => {
                    const s = allSessions.filter((sess) => {
                      const inPeriod = start && end && new Date(sess.scheduled_at) >= start && new Date(sess.scheduled_at) <= end;
                      return sess.instructor_name === ins.name && inPeriod;
                    }).length * ins.lesson_rate;
                    const m = allMeetings.filter((meet) => {
                      const matchIns = allInstructors.find((i) => i.id === meet.instructor_id)?.name === ins.name;
                      const inPeriod = start && end && new Date(meet.scheduled_at) >= start && new Date(meet.scheduled_at) <= end;
                      return matchIns && inPeriod;
                    }).reduce((ms, meet) => ms + (meet.duration_minutes / 60) * ins.meeting_rate, 0);
                    return sum + s + m;
                  }, 0);
                  return [
                    { label: "전체 수업 시간", value: `${totalLessonH}h`, color: "text-navy" },
                    { label: "전체 미팅 시간", value: `${totalMeetH.toFixed(1)}h`, color: "text-gold-dark" },
                    { label: "지급 예정 합계", value: `₩${Math.round(totalAmt).toLocaleString()}`, color: "text-success" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center p-3 rounded-xl bg-muted/30 border border-border">
                      <p className={cn("font-bold text-base", color)}>{value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ));
                })()}
              </div>

              {/* Per-instructor rows */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">강사별 내역</p>
                {allInstructors.map((ins) => {
                  const insSessions = allSessions.filter((s) => s.instructor_name === ins.name);
                  const insMeetings = allMeetings.filter((m) => m.instructor_id === ins.id);
                  return (
                    <SettlementRow
                      key={ins.id}
                      instructor={ins}
                      sessions={insSessions}
                      meetings={insMeetings}
                      period={period}
                      onViewLog={setLogInstructor}
                    />
                  );
                })}
              </div>
            </div>
          </>
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
      {logInstructor && (
        <SessionLogModal
          instructor={logInstructor}
          sessions={allSessions.filter((s) => s.instructor_name === logInstructor.name)}
          meetings={allMeetings.filter((m) => m.instructor_id === logInstructor.id)}
          onClose={() => setLogInstructor(null)}
        />
      )}
    </div>
  );
}
