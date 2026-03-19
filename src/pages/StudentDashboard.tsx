import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import FeedbackSurveyModal from "@/components/classroom/FeedbackSurveyModal";

import WeeklyTasksSection from "@/components/dashboard/WeeklyTasksSection";
import HomeworkSubmitModal from "@/components/dashboard/HomeworkSubmitModal";
import HomeworkFeedbackModal from "@/components/dashboard/HomeworkFeedbackModal";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BookOpen, Trophy, Calendar, Video, Clock, Check,
  Volume2, Loader2, Square, PenLine, Mic, Brain,
  AlertCircle, BanIcon, Bell, ChevronLeft,
  ChevronRight, Coffee, CalendarDays, TrendingUp, FileText,
  RotateCcw, X, Activity, CreditCard, Heart, Paperclip, Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import BugReportModal from "@/components/dashboard/BugReportModal";
import MakeupRequestModal from "@/components/dashboard/MakeupRequestModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_KO_TO_NUM: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

function formatDateKo(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS_KO[d.getDay()]})`;
}

interface ScheduleSlot { day: string; time: string; }

// 반복 일정으로부터 날짜 배열 생성 (startDate부터 monthsAhead개월 후까지)
function generateRecurringDates(schedules: ScheduleSlot[], startDate: string, monthsAhead = 3): Date[] {
  if (!schedules || schedules.length === 0) return [];
  const start = startDate ? new Date(startDate + "T00:00:00") : new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + monthsAhead);

  const dates: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const dayNum = cursor.getDay();
    for (const slot of schedules) {
      const slotDay = DAY_KO_TO_NUM[slot.day];
      if (slotDay === dayNum) {
        const [h, m] = slot.time.split(":").map(Number);
        const d = new Date(cursor);
        d.setHours(h, m, 0, 0);
        dates.push(d);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

interface HolidayNotice {
  id: string;
  title: string;
  date_start: string;
  date_end: string;
  reason: string | null;
  notify_students: boolean;
}

interface PauseRecord {
  id: string;
  pause_start: string;
  pause_end: string | null;
}

interface StudentRecord {
  schedules: ScheduleSlot[];
  start_date: string | null;
  level: string | null;
  instructor_name: string | null;
  instructor_display_name: string | null;
  pauses: PauseRecord[];
  student_type: string;
  group_students: string[];
}

interface SchedulePeriod {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface ClassSession {
  id: string;
  scheduled_at: string;
  topic: string | null;
  level: string;
  meet_link: string | null;
  instructor_name: string;
  started_at: string | null;
  ended_at: string | null;
  reschedule_origin_dates?: string[];
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  type: string;
  due_at: string | null;
  is_preset: boolean;
  session_id: string | null;
}

interface Submission {
  id: string;
  assignment_id: string | null;
  status: string;
  text_content: string | null;
  audio_url: string | null;
  file_url: string | null;
  instructor_note: string | null;
  reviewed_at: string | null;
  ai_correction: any | null;
  submitted_at?: string | null;
}

interface VocabWord {
  id: string;
  english_word: string;
  korean_meaning: string;
  part_of_speech: string | null;
  audio_url: string | null;
  week_label: string;
  created_at: string;
}

interface TestRecord {
  id: string;
  week_label: string | null;
  type: string;
  score: number | null;
  total: number | null;
  completed_at: string | null;
}

type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file" | "watching";
const HW_META: Record<HwType, { label: string; icon: React.ElementType; color: string }> = {
  writing:    { label: "쓰기",       icon: PenLine,    color: "text-amber-600" },
  reading:    { label: "읽기",       icon: BookOpen,   color: "text-orange-500" },
  speaking:   { label: "말하기",     icon: Mic,        color: "text-rose-500" },
  memorizing: { label: "외우기",     icon: Brain,      color: "text-violet-500" },
  file:       { label: "파일올리기", icon: Paperclip,  color: "text-blue-500" },
  watching:   { label: "시청하기",   icon: Monitor,    color: "text-rose-500" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
}
function fmtWeek(label: string | null) {
  if (!label) return "-";
  const m = label.match(/(\d{4})-W(\d{2})/);
  if (!m) return label;
  const year = parseInt(m[1]);
  const week = parseInt(m[2]);
  // Get the Monday of the ISO week
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const month = monday.getMonth() + 1;
  // Week of month: how many Mondays have passed in this month
  const firstOfMonth = new Date(monday.getFullYear(), monday.getMonth(), 1);
  const weekOfMonth = Math.ceil((monday.getDate() + firstOfMonth.getDay()) / 7);
  return `${month}월 ${weekOfMonth}주차`;
}
function msUntil(iso: string) { return new Date(iso).getTime() - Date.now(); }
function timeUntilLabel(iso: string) {
  const ms = msUntil(iso);
  if (ms <= 0) return "진행 중";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}일 후`;
  if (h > 0) return `${h}시간 후`;
  return "곧 시작";
}

// ── TTS Button ─────────────────────────────────────────────────────────────────
function TTSButton({ word }: { word: VocabWord }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = async () => {
    if (playing) { audioRef.current?.pause(); setPlaying(false); return; }
    if (word.audio_url) {
      const a = new Audio(word.audio_url);
      audioRef.current = a;
      a.onended = () => setPlaying(false);
      a.play(); setPlaying(true); return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tts-cache", {
        body: { word: word.english_word, wordId: word.id },
      });
      if (error || !data?.audio_url) throw new Error();
      word.audio_url = data.audio_url;
      const a = new Audio(data.audio_url);
      audioRef.current = a;
      a.onended = () => setPlaying(false);
      a.play(); setPlaying(true);
    } finally { setLoading(false); }
  };

  return (
    <button onClick={play} disabled={loading}
      className="w-6 h-6 rounded-full bg-navy/10 hover:bg-navy/20 flex items-center justify-center transition-colors flex-shrink-0"
    >
      {loading ? <Loader2 className="w-3 h-3 text-navy animate-spin" />
        : playing ? <Square className="w-2.5 h-2.5 text-navy fill-navy" />
        : <Volume2 className="w-3 h-3 text-navy" />}
    </button>
  );
}

// ── Mini Calendar ──────────────────────────────────────────────────────────────
function MiniCalendar({ allCalendarDates, holidays, selectedPeriod, allPeriods, onPeriodChange }: {
  allCalendarDates: Set<string>;
  holidays: HolidayNotice[];
  selectedPeriod: SchedulePeriod | null;
  allPeriods: SchedulePeriod[];
  onPeriodChange: (id: string) => void;
}) {
  const today = new Date();

  const primaryYear = selectedPeriod ? new Date(selectedPeriod.start_date + "T00:00:00").getFullYear() : today.getFullYear();
  const primaryMonth = selectedPeriod ? new Date(selectedPeriod.start_date + "T00:00:00").getMonth() : today.getMonth();

  const holidayRanges = holidays.map(h => ({
    start: new Date(h.date_start + "T00:00:00"),
    end: new Date(h.date_end + "T23:59:59"),
  }));

  const isInPeriod = (d: Date) => {
    if (!selectedPeriod) return false;
    const ps = new Date(selectedPeriod.start_date + "T00:00:00");
    const pe = new Date(selectedPeriod.end_date + "T23:59:59");
    return d >= ps && d <= pe;
  };

  const isHoliday = (d: Date) =>
    holidayRanges.some(r => d >= r.start && d <= r.end);
  

  // Build cells: from period start's week Sunday to period end's week Saturday
  const periodStart = selectedPeriod
    ? new Date(selectedPeriod.start_date + "T00:00:00")
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const periodEnd = selectedPeriod
    ? new Date(selectedPeriod.end_date + "T00:00:00")
    : new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Week's Sunday for period start
  const gridStart = new Date(periodStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  // Week's Saturday for period end
  const gridEnd = new Date(periodEnd);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const cells: { day: number; month: number; year: number }[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    cells.push({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear() });
  }

  // Header label
  const pStartMonth = periodStart.getMonth();
  const pEndMonth = periodEnd.getMonth();
  const pStartYear = periodStart.getFullYear();
  const pEndYear = periodEnd.getFullYear();
  const periodLabel = selectedPeriod?.label || (pStartMonth === pEndMonth && pStartYear === pEndYear
    ? `${pStartYear}년 ${pStartMonth + 1}월`
    : `${pStartYear}년 ${pStartMonth + 1}월 ~ ${pEndYear}년 ${pEndMonth + 1}월`);

  const periodIdx = allPeriods.findIndex(p => p.id === selectedPeriod?.id);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => periodIdx > 0 && onPeriodChange(allPeriods[periodIdx - 1].id)}
            disabled={periodIdx <= 0}
            className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="font-bold text-foreground text-sm min-w-[90px] text-center">{periodLabel}</span>
          <button
            onClick={() => periodIdx < allPeriods.length - 1 && onPeriodChange(allPeriods[periodIdx + 1].id)}
            disabled={periodIdx >= allPeriods.length - 1}
            className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div key={d} className={cn(
              "text-[10px] font-semibold pb-1",
              i === 0 ? "text-destructive/70" : "text-muted-foreground"
            )}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {cells.map((cell, idx) => {
            const date = new Date(cell.year, cell.month, cell.day);
            const isOutsidePeriodMonth = cell.month !== pStartMonth || cell.year !== pStartYear;
            const holiday = isHoliday(date);
            const inPeriod = isInPeriod(date);
            const session = inPeriod && allCalendarDates.has(date.toDateString());
            const todayMark = today.getFullYear() === cell.year && today.getMonth() === cell.month && today.getDate() === cell.day;
            const isOff = holiday;
            return (
              <div key={idx} className={cn(
                "relative aspect-square flex flex-col items-center justify-center rounded-md text-[11px] font-medium transition-all",
                todayMark ? "bg-navy text-primary-foreground font-bold shadow-sm"
                  : session && !isOff ? "bg-gold/15 text-gold-dark font-semibold"
                  : holiday ? "text-muted-foreground/30"
                  : inPeriod ? "text-foreground hover:bg-muted/50"
                  : "text-muted-foreground/40 hover:bg-muted/30",
              )}>
                {isOutsidePeriodMonth ? `${cell.month + 1}/${cell.day}` : cell.day}
                {session && !todayMark && !isOff && (
                  <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-gold" />
                )}
                {holiday && !todayMark && (
                  <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-muted-foreground/30" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gold" />수업일</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-navy" />오늘</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive/50" />휴강</div>
      </div>
    </div>
  );
}

// ── Right Panel Section ────────────────────────────────────────────────────────
function RSection({ title, icon: Icon, children, badge }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  badge?: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-gold" />
          <span className="text-xs font-semibold text-foreground">{title}</span>
        </div>
        {badge !== undefined && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy/10 text-navy font-semibold">{badge}</span>
        )}
      </div>
      <div className="p-3">
        {children}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [allSessions, setAllSessions] = useState<ClassSession[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [vocabWords, setVocabWords] = useState<VocabWord[]>([]);
  const [testHistory, setTestHistory] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<HolidayNotice[]>([]);
  const [studentRecord, setStudentRecord] = useState<StudentRecord | null>(null);
  const [schedulePeriods, setSchedulePeriods] = useState<SchedulePeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("dismissed_holiday_ids") || "[]"); } catch { return []; }
  });
  const [testHistoryOpen, setTestHistoryOpen] = useState(false);
  const [classHistoryOpen, setClassHistoryOpen] = useState(false);
  const [hwOpen, setHwOpen] = useState(false);
  const [vocabListOpen, setVocabListOpen] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showMakeup, setShowMakeup] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentReminder, setShowPaymentReminder] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"select" | "receipt" | "attendance">("select");
  const [receiptType, setReceiptType] = useState<"phone" | "business">("phone");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [recurringReceipt, setRecurringReceipt] = useState(false);
  const [recurringAttendance, setRecurringAttendance] = useState(false);
  const [attendancePeriodType, setAttendancePeriodType] = useState<"month" | "custom">("month");
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [attendanceCustomStart, setAttendanceCustomStart] = useState("");
  const [attendanceCustomEnd, setAttendanceCustomEnd] = useState("");
  const [vocabStudyOpen] = useState(false); // kept for potential future use
  const [hwModalAssignment, setHwModalAssignment] = useState<Assignment | null>(null);
  const [hwCompletingId, setHwCompletingId] = useState<string | null>(null);
  const [hwFeedback, setHwFeedback] = useState<{ assignment: Assignment; submission: Submission } | null>(null);

  // Feedback survey state
  const [feedbackNeeded, setFeedbackNeeded] = useState<{
    periodId: string;
    periodLabel: string;
    instructorName: string;
  } | null>(null);


  // ── 인증: auth 세션 → student_name 로드, 없으면 URL 파라미터 폴백 ──
  const [authStudent, setAuthStudent] = useState<string | null>(null);
  const [authNickname, setAuthNickname] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [searchParams] = useSearchParams();
  const urlStudent = searchParams.get("name");
  const urlStudentName = searchParams.get("student_name");

  // Instructor view mode: when student_name param is provided by an instructor
  const [isInstructorView, setIsInstructorView] = useState(false);
  const [viewingStudentName, setViewingStudentName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Check if this is an instructor viewing a student's dashboard
        if (urlStudentName) {
          // Verify the user is an instructor
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role, approved")
            .eq("user_id", session.user.id);
          const isInstructor = roles?.some(r => r.approved && (r.role === "instructor" || r.role === "admin" || r.role === "manager"));

          if (isInstructor) {
            setIsInstructorView(true);
            setViewingStudentName(urlStudentName);
            setAuthLoading(false);
            return;
          }
        }

        // Check if student has a linked instructor_students record
        const { data: linkedRecord } = await supabase
          .from("instructor_students")
          .select("student_name")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (linkedRecord) {
          // Use the student_name from instructor_students (the linked record)
          setAuthStudent(linkedRecord.student_name);
          // Get nickname from student_profiles
          const { data: profile } = await supabase
            .from("student_profiles")
            .select("nickname")
            .eq("user_id", session.user.id)
            .maybeSingle();
          setAuthNickname(profile?.nickname || null);
        } else {
          // Check if profile exists at all
          const { data: profile } = await supabase
            .from("student_profiles")
            .select("student_name, nickname")
            .eq("user_id", session.user.id)
            .maybeSingle();
          if (!profile) {
            navigate("/student-setup");
            return;
          }
          // Profile exists but no linked instructor_students record → 준비 중
          setAuthNickname(profile.nickname || null);
          setNotLinked(true);
        }
      }
      setAuthLoading(false);
    });
  }, [urlStudentName]);

  // instructor view > auth 학생명 > URL 파라미터 > 기본값 순 우선순위
  const student = viewingStudentName || authStudent || urlStudent || "정유리";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const visibleHolidays = holidays.filter(h => h.notify_students && !dismissedIds.includes(h.id) && h.date_end >= todayStr);
  const currentPopup = visibleHolidays[0] ?? null;

  const dismissPopup = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    localStorage.setItem("dismissed_holiday_ids", JSON.stringify(next));
  };

  useEffect(() => {
    if (!authLoading) loadAll();
  }, [authLoading, student]);

  const loadAll = async () => {
    setLoading(true);
    const [sessRes, allSessRes, groupSessRes, groupAllSessRes, hwRes, subRes, vocRes, testRes, studentRes, periodsRes, holidaysRes] = await Promise.all([
      supabase.from("class_sessions").select("id,scheduled_at,topic,level,meet_link,instructor_name,started_at,ended_at,reschedule_origin_dates")
        .eq("student_name", student).order("scheduled_at", { ascending: false }).limit(20),
      supabase.from("class_sessions").select("id,scheduled_at,topic,level,meet_link,instructor_name,started_at,ended_at,reschedule_origin_dates")
        .eq("student_name", student).order("scheduled_at", { ascending: true }),
      // Group sessions: where student is in group_students array
      supabase.from("class_sessions").select("id,scheduled_at,topic,level,meet_link,instructor_name,started_at,ended_at,reschedule_origin_dates")
        .contains("group_students", [student]).order("scheduled_at", { ascending: false }).limit(20),
      supabase.from("class_sessions").select("id,scheduled_at,topic,level,meet_link,instructor_name,started_at,ended_at,reschedule_origin_dates")
        .contains("group_students", [student]).order("scheduled_at", { ascending: true }),
      supabase.from("homework_assignments").select("id,title,description,type,due_at,is_preset,session_id,preset_origin_id")
        .eq("student_name", student).order("created_at", { ascending: false }),
      supabase.from("homework_submissions").select("id,assignment_id,status,text_content,audio_url,file_url,instructor_note,reviewed_at,ai_correction,submitted_at")
        .eq("student_name", student),
      supabase.from("vocabulary_words").select("id,english_word,korean_meaning,part_of_speech,audio_url,week_label,created_at")
        .eq("student_name", student).gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()).order("week_label", { ascending: false }).order("created_at", { ascending: true }),
      supabase.from("vocabulary_tests").select("id,week_label,type,score,total,completed_at")
        .eq("student_name", student).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(20),
      supabase.from("instructor_students").select("id,schedules,start_date,level,instructor_name,instructor_id,student_type,group_students")
        .eq("student_name", student).maybeSingle(),
      // 어드민 수업 기간 설정
      supabase.from("schedule_periods").select("id,label,start_date,end_date,is_active").order("start_date", { ascending: true }),
      // 휴강 공지 (팝업용은 미래만, 캘린더용은 전체)
      supabase.from("holiday_notices").select("id,title,date_start,date_end,reason,notify_students").order("date_start", { ascending: true }),
    ]);

    // Merge direct + group sessions, deduplicate by id
    const mergeAndDedup = (direct: any[], group: any[]) => {
      const map = new Map<string, any>();
      for (const s of direct) map.set(s.id, s);
      for (const s of group) map.set(s.id, s);
      return Array.from(map.values());
    };
    let visibleRecentSessions = mergeAndDedup(sessRes.data || [], groupSessRes.data || [])
      .sort((a: any, b: any) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()).slice(0, 20);
    let visibleAllSessions = mergeAndDedup(allSessRes.data || [], groupAllSessRes.data || [])
      .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    setAssignments(hwRes.data || []);
    setSubmissions(subRes.data || []);
    setVocabWords(vocRes.data || []);
    setTestHistory(testRes.data || []);
    setSchedulePeriods(periodsRes.data || []);

    // Auto-select current period
    const isCorporate = ((studentRes.data as any)?.student_type || 'regular') === 'corporate';
    if (!selectedPeriodId) {
      if (isCorporate) {
        // For corporate students, auto-select current month
        const todayYm = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()).slice(0, 7);
        setSelectedPeriodId(`corp-${todayYm}`);
      } else if (periodsRes.data?.length) {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
        const current = periodsRes.data.find((p: SchedulePeriod) => p.start_date <= today && p.end_date >= today);
        setSelectedPeriodId(current?.id || periodsRes.data[periodsRes.data.length - 1].id);
      }
    }

    // 캘린더용은 전체 휴강, 팝업 필터링은 visibleHolidays에서 처리
    setHolidays(holidaysRes.data || []);

    if (studentRes.data) {
      let schedules: ScheduleSlot[] = [];
      try {
        const raw = studentRes.data.schedules;
        schedules = typeof raw === "string" ? JSON.parse(raw) : (raw as ScheduleSlot[]) || [];
      } catch { schedules = []; }

      // Fetch instructor display_name
      let instrDisplayName: string | null = null;
      if (studentRes.data.instructor_id) {
        const { data: insData } = await supabase
          .from("instructors")
          .select("user_id")
          .eq("id", studentRes.data.instructor_id)
          .maybeSingle();
        if (insData?.user_id) {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("display_name")
            .eq("user_id", insData.user_id)
            .eq("role", "instructor")
            .maybeSingle();
          instrDisplayName = roleData?.display_name || null;
        }
      }

      // Load pauses from student_pauses table
      let pauses: PauseRecord[] = [];
      if (studentRes.data?.id) {
        const { data: pauseData } = await supabase
          .from("student_pauses")
          .select("id,pause_start,pause_end")
          .eq("student_id", studentRes.data.id)
          .order("pause_start", { ascending: true });
        pauses = pauseData || [];
      }

      setStudentRecord({
        schedules,
        start_date: studentRes.data.start_date,
        level: studentRes.data.level,
        instructor_name: studentRes.data.instructor_name,
        instructor_display_name: instrDisplayName,
        pauses,
        student_type: (studentRes.data as any).student_type || 'regular',
        group_students: Array.isArray((studentRes.data as any).group_students) ? (studentRes.data as any).group_students : [],
      });

      const isSessionVisible = (scheduledAt: string) => {
        const d = scheduledAt.slice(0, 10);
        const isCorporate = ((studentRes.data as any)?.student_type || 'regular') === 'corporate';
        if (!isCorporate && studentRes.data.start_date && d < studentRes.data.start_date) return false;
        if (pauses.some((p) => d >= p.pause_start && (!p.pause_end || d <= p.pause_end))) return false;
        return true;
      };

      visibleRecentSessions = visibleRecentSessions.filter((s) => isSessionVisible(s.scheduled_at));
      visibleAllSessions = visibleAllSessions.filter((s) => isSessionVisible(s.scheduled_at));
    }

    setSessions(visibleRecentSessions);
    setAllSessions(visibleAllSessions);
    setLoading(false);

    // ── 결제 미완료 팝업 체크 ──
    // 수업 완료 후 다음 접속 시 결제가 안된 학생에게 팝업 표시
    const isCorporateStudent = ((studentRes.data as any)?.student_type || 'regular') === 'corporate';
    if (!isCorporateStudent) {
      const nowKst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
      const currentMonth = nowKst.slice(0, 7); // YYYY-MM
      // 이번 달에 완료된 수업이 있는지 확인
      const completedThisMonth = visibleAllSessions.filter(s => {
        if (!s.ended_at) return false;
        const sessionDate = new Date(s.scheduled_at);
        const sessionMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(sessionDate).slice(0, 7);
        return sessionMonth === currentMonth;
      });
      if (completedThisMonth.length >= 1) {
        // month 컬럼에는 period ID 또는 YYYY-MM 형식이 저장될 수 있으므로 둘 다 확인
        const activePeriod = (periodsRes.data || []).find((p: SchedulePeriod) => {
          const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
          return p.start_date <= today && p.end_date >= today;
        });
        const monthCandidates = [currentMonth];
        if (activePeriod) monthCandidates.push(activePeriod.id);

        const { data: paymentConfs } = await supabase
          .from("payment_confirmations")
          .select("id,confirmed")
          .eq("student_name", student)
          .in("month", monthCandidates);

        const paymentConf = paymentConfs?.find(c => c.confirmed) || paymentConfs?.[0] || null;
        
        if (!paymentConf || !paymentConf.confirmed) {
          const dismissedKey = `payment_reminder_dismissed_${student}_${currentMonth}`;
          if (!localStorage.getItem(dismissedKey)) {
            setShowPaymentReminder(true);
          }
        }
      }
    }

    // ── 피드백 설문조사 체크 ──
    // 현재 기간의 마지막 세션(4주차)이 종료되었는지 확인
    const periods = periodsRes.data || [];
    const todayDate = new Date();
    const allStudentSessions = visibleAllSessions;
    const studentRec = studentRes.data;
    const instrName = studentRec?.instructor_name;

    for (const period of periods) {
      const periodEnd = new Date(period.end_date + "T23:59:59");

      if (instrName) {
        // 이 기간의 세션 필터링
        const periodSessions = allStudentSessions.filter(s => {
          const sDate = new Date(s.scheduled_at);
          const pStart = new Date(period.start_date + "T00:00:00");
          return sDate >= pStart && sDate <= periodEnd;
        });
        if (periodSessions.length === 0) continue;

        // 마지막 수업의 scheduled_at이 현재 시각보다 과거인지 확인
        const lastSession = periodSessions[periodSessions.length - 1]; // ascending order
        const lastSessionTime = new Date(lastSession.scheduled_at);
        // 수업 시간 + 1시간 후부터 피드백 팝업 표시
        const feedbackAvailableAfter = new Date(lastSessionTime.getTime() + 60 * 60 * 1000);
        const lastSessionPassed = todayDate >= feedbackAvailableAfter;

        if (lastSessionPassed || todayDate > periodEnd) {
          // 이미 피드백을 제출했는지 확인
          const { data: existingFeedback } = await supabase
            .from("class_feedback")
            .select("id")
            .eq("student_name", student)
            .eq("period_id", period.id)
            .maybeSingle();

          if (!existingFeedback) {
            setFeedbackNeeded({
              periodId: period.id,
              periodLabel: period.label,
              instructorName: instrName,
            });
            break;
          }
        }
      }
    }

  };

  const getSubmission = (aId: string) => {
    const matched = submissions.filter(s => s.assignment_id === aId);
    if (matched.length === 0) return undefined;
    return [...matched].sort((a, b) => {
      const aTs = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bTs = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return bTs - aTs;
    })[0];
  };

  const handleQuickComplete = async (assignment: Assignment) => {
    setHwCompletingId(assignment.id);
    try {
      const existing = getSubmission(assignment.id);
      if (existing) {
        const { data, error } = await supabase
          .from("homework_submissions")
          .update({ status: "submitted", submitted_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        if (data) setSubmissions(prev => prev.map(s => s.id === data.id ? data : s));
      } else {
        const { data, error } = await supabase
          .from("homework_submissions")
          .insert({ assignment_id: assignment.id, student_name: student, status: "submitted" })
          .select()
          .single();
        if (error) throw error;
        if (data) setSubmissions(prev => [...prev, data]);
      }
    } catch {
      // silent fail
    } finally {
      setHwCompletingId(null);
    }
  };

  // ── 반복 일정에서 가상 세션 날짜 생성 ──
  const recurringDates = studentRecord
    ? generateRecurringDates(studentRecord.schedules, studentRecord.start_date || "", 3)
    : [];

  // 실제 class_sessions에 이미 있는 날짜 (YYYY-MM-DD)
  const existingSessionDates = new Set(
    allSessions.map(s => new Date(s.scheduled_at).toDateString())
  );

  // 일정 변경으로 인해 원래 날짜에서 이동된 날짜들 (이 날짜들은 가상 반복 일정에서 제외)
  const rescheduledOriginDateStrings = new Set<string>();
  for (const s of allSessions) {
    if (Array.isArray(s.reschedule_origin_dates)) {
      for (const originDate of s.reschedule_origin_dates) {
        if (originDate) {
          const d = new Date(originDate + "T00:00:00");
          rescheduledOriginDateStrings.add(d.toDateString());
        }
      }
    }
  }

  const toLocalDateKey = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // 반복 일정 중 아직 class_session에 없는 것들 (가상 upcoming)
  const virtualUpcoming = recurringDates.filter(
    d => d.getTime() > Date.now() && !existingSessionDates.has(d.toDateString()) &&
      !rescheduledOriginDateStrings.has(d.toDateString()) &&
      !(studentRecord?.pauses?.some(p => {
        const dateKey = toLocalDateKey(d);
        return dateKey >= p.pause_start && (!p.pause_end || dateKey <= p.pause_end);
      }))
  );

  // 다음 수업: 실제 세션 또는 반복 일정 중 가장 빠른 것
  // 다음 수업 또는 현재 진행 중인 수업 (수업 시간 후 2시간까지 포함)
  const nextSessionFromDB = sessions
    .filter(s => msUntil(s.scheduled_at) > -2 * 60 * 60 * 1000) // include sessions up to 2h past
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
  const nextVirtual = virtualUpcoming[0] ?? null;

  const nextClassDate: Date | null = (() => {
    const dbTime = nextSessionFromDB ? new Date(nextSessionFromDB.scheduled_at).getTime() : Infinity;
    const virtTime = nextVirtual ? nextVirtual.getTime() : Infinity;
    if (dbTime === Infinity && virtTime === Infinity) return null;
    return dbTime <= virtTime ? new Date(nextSessionFromDB!.scheduled_at) : nextVirtual;
  })();
  const nextClassIsVirtual = nextClassDate && nextVirtual && nextClassDate.getTime() === nextVirtual.getTime();

  // 수업일수: 지난 실제 세션 + 반복 일정에서 시작일 ~ 오늘까지 지나간 날 (중복 제거)
  const pastSessions = sessions.filter(s => msUntil(s.scheduled_at) <= 0);
  const pastRecurring = recurringDates.filter(
    d => d.getTime() <= Date.now() && !existingSessionDates.has(d.toDateString())
  );
  const totalClassDays = pastSessions.length + pastRecurring.length;

  // 휴강 날짜 집합
  const holidayDateStrings = new Set<string>();
  holidays.forEach(h => {
    const cur = new Date(h.date_start + "T00:00:00");
    const end = new Date(h.date_end + "T23:59:59");
    while (cur <= end) {
      holidayDateStrings.add(cur.toDateString());
      cur.setDate(cur.getDate() + 1);
    }
  });

  // 휴강 기간에 해당하는 날짜인지 체크하는 헬퍼
  const isDateInPause = (dateStr: string) => {
    if (!studentRecord?.pauses || studentRecord.pauses.length === 0) return false;
    const d = dateStr.slice(0, 10);
    return studentRecord.pauses.some(p => d >= p.pause_start && (!p.pause_end || d <= p.pause_end));
  };

  // 캘린더용: 실제 세션 + 반복일정 모두 표시 (휴강일 및 휴강 기간 제외)
  const allCalendarDates = new Set([
    ...allSessions
      .filter((s) => {
        const d = new Date(s.scheduled_at);
        const dateKey = s.scheduled_at.slice(0, 10);
        return !holidayDateStrings.has(d.toDateString()) && !isDateInPause(dateKey);
      })
      .map((s) => new Date(s.scheduled_at).toDateString()),
    ...recurringDates
      .filter((d) => {
        const dateKey = toLocalDateKey(d);
        return !holidayDateStrings.has(d.toDateString()) && !isDateInPause(dateKey) && !rescheduledOriginDateStrings.has(d.toDateString());
      })
      .map((d) => d.toDateString()),
  ]);

  // ── Generate monthly periods for corporate students ──
  const corporateMonthlyPeriods: SchedulePeriod[] = (() => {
    if (studentRecord?.student_type !== "corporate") return [];
    // Determine range from allSessions or fallback to current month
    const months = new Set<string>();
    const nowKst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
    months.add(nowKst.slice(0, 7)); // current month always included
    for (const s of allSessions) {
      const d = new Date(s.scheduled_at);
      const kst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
      months.add(kst.slice(0, 7));
    }
    return [...months].sort().map(ym => {
      const [y, m] = ym.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return {
        id: `corp-${ym}`,
        label: ym,
        start_date: `${ym}-01`,
        end_date: `${ym}-${String(lastDay).padStart(2, "0")}`,
        is_active: false,
      } as SchedulePeriod;
    });
  })();

  const effectivePeriods = studentRecord?.student_type === "corporate" ? corporateMonthlyPeriods : schedulePeriods;

  // ── Period-based filtering ──
  const selectedPeriod = effectivePeriods.find(p => p.id === selectedPeriodId) || null;
  const periodStart = selectedPeriod ? new Date(selectedPeriod.start_date + "T00:00:00") : null;
  const periodEnd = selectedPeriod ? new Date(selectedPeriod.end_date + "T23:59:59") : null;

  const isBeforeStartDate = (dateStr: string) => {
    if (!studentRecord?.start_date) return false;
    if (studentRecord.student_type === "corporate") return false;
    const d = dateStr.slice(0, 10);
    return d < studentRecord.start_date;
  };

  // Helper: check if a date falls within any pause period
  const isInPausePeriod = (dateStr: string) => {
    if (!studentRecord?.pauses || studentRecord.pauses.length === 0) return false;
    const d = dateStr.slice(0, 10);
    return studentRecord.pauses.some(p => d >= p.pause_start && (!p.pause_end || d <= p.pause_end));
  };

  const periodSessions = selectedPeriod
    ? allSessions.filter(s => {
        const d = new Date(s.scheduled_at);
        return d >= periodStart! && d <= periodEnd! && !isInPausePeriod(s.scheduled_at) && !isBeforeStartDate(s.scheduled_at);
      })
    : allSessions.filter(s => !isInPausePeriod(s.scheduled_at) && !isBeforeStartDate(s.scheduled_at));

  const periodSessionIds = new Set(periodSessions.map(s => s.id));

  const periodAssignments = (selectedPeriod
    ? assignments.filter(a => a.is_preset || !a.session_id || periodSessionIds.has(a.session_id))
    : assignments
  ).filter(a => !(a.is_preset && a.type === "memorizing"));

  const periodVocabWords = selectedPeriod
    ? vocabWords.filter(w => {
        const d = new Date(w.created_at);
        return d >= periodStart! && d <= periodEnd!;
      })
    : vocabWords;

  const periodTestHistory = selectedPeriod
    ? testHistory.filter(t => {
        if (!t.completed_at) return false;
        const d = new Date(t.completed_at);
        return d >= periodStart! && d <= periodEnd!;
      })
    : testHistory;

  // Period navigation helpers
  const sortedPeriods = [...effectivePeriods]
    .filter(p => studentRecord?.student_type === "corporate" || !studentRecord?.start_date || p.end_date >= studentRecord.start_date)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const currentPeriodIdx = sortedPeriods.findIndex(p => p.id === selectedPeriodId);
  const canGoPrev = currentPeriodIdx > 0;
  const canGoNext = currentPeriodIdx < sortedPeriods.length - 1;
  const periodLabel = selectedPeriod?.label
    ? (() => {
        const m = selectedPeriod.label.match(/(\d{4})-(\d{2})/);
        return m ? `${m[1]}년 ${parseInt(m[2])}월` : selectedPeriod.label;
      })()
    : "";
  const periodDateRange = selectedPeriod
    ? `${selectedPeriod.start_date.replace(/-/g, ".")} ~ ${selectedPeriod.end_date.replace(/-/g, ".")}`
    : "";

  // ── Derived stats (period-scoped) ──
  const now = new Date();
  const latestPastSession = sessions
    .filter(s => new Date(s.scheduled_at) <= now)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0] ?? null;
  const latestSessionAssignments = latestPastSession
    ? periodAssignments.filter(a => a.session_id === latestPastSession.id)
    : [];
  const latestSessionPendingHw = latestSessionAssignments.filter(a => { const sub = getSubmission(a.id); return !sub || sub.status === "pending"; });
  const pendingHw = periodAssignments.filter(a => { const sub = getSubmission(a.id); return !sub || sub.status === "pending"; });
  const submittedHw = periodAssignments.filter(a => { const sub = getSubmission(a.id); return sub && sub.status !== "pending"; });
  const latestTest = periodTestHistory[0];
  const avgScore = periodTestHistory.length > 0
    ? Math.round(periodTestHistory.reduce((acc, t) => acc + (t.total ? (t.score ?? 0) / t.total : 0), 0) / periodTestHistory.length * 100)
    : null;

  // 함께한 시간 (개월) - 휴강 기간 제외
  const monthsWithUs = (() => {
    if (!studentRecord?.start_date) return 0;
    const start = new Date(studentRecord.start_date + "T00:00:00");
    const now = new Date();
    let diff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    // 모든 휴강 기간의 개월 수 합산 차감
    if (studentRecord?.pauses) {
      for (const p of studentRecord.pauses) {
        if (!p.pause_end) continue;
        const ps = new Date(p.pause_start + "T00:00:00");
        const pe = new Date(p.pause_end + "T00:00:00");
        const pauseMonths = (pe.getFullYear() - ps.getFullYear()) * 12 + (pe.getMonth() - ps.getMonth());
        diff = Math.max(0, diff - Math.max(0, pauseMonths));
      }
    }
    return Math.max(1, diff);
  })();

  // 이번달 수업 횟수 (현재 기간 기준, scheduled_at <= now 인 수업 / 전체 기간 수업)
  const thisMonthStats = (() => {
    if (!selectedPeriod) return { completed: 0, total: 0 };
    const now = new Date();
    const total = periodSessions.length;
    const completed = periodSessions.filter(s => new Date(s.scheduled_at) <= now).length;
    return { completed, total };
  })();

  // 이번주 숙제: 현재 날짜 기준 직전 수업(scheduled_at <= now)의 숙제
  const latestSessionHwStats = (() => {
    const now = new Date();
    // 날짜 내림차순으로 정렬된 sessions에서 현재 이전 세션 찾기
    const pastSess = [...allSessions]
      .filter(s => new Date(s.scheduled_at) <= now)
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    const latestSession = pastSess[0];
    if (!latestSession) return { submitted: 0, total: 0, pending: 0 };
    const sessionHw = assignments.filter(a => (a.session_id === latestSession.id || a.is_preset) && !(a.is_preset && a.type === "memorizing"));
    const submitted = sessionHw.filter(a => {
      const sub = getSubmission(a.id);
      return sub && sub.status !== "pending";
    }).length;
    return { submitted, total: sessionHw.length, pending: sessionHw.length - submitted };
  })();

  // 결제 버튼은 항상 활성화
  const paymentAvailable = true;

  const vocabByWeek = periodVocabWords.reduce<Record<string, VocabWord[]>>((acc, w) => {
    if (!acc[w.week_label]) acc[w.week_label] = [];
    acc[w.week_label].push(w);
    return acc;
  }, {});
  const vocabWeeks = Object.keys(vocabByWeek).sort((a, b) => b.localeCompare(a));

  // 가장 최근 완료된 세션과 해당 주차 단어
  const latestCompletedSession = sessions.find(s => s.ended_at);
  const latestSessionWeek = vocabWeeks.length > 0 ? vocabWeeks[0] : null;
  const latestSessionWords = latestSessionWeek ? (vocabByWeek[latestSessionWeek] || []) : [];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center animate-pulse">
            <Coffee className="w-5 h-5 text-gold" />
          </div>
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (notLinked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center shadow-gold mx-auto">
            <BookOpen className="w-8 h-8 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">수업 준비 중</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {authNickname || "학생"}님의 수업을 준비하고 있습니다.<br />
              담당 강사가 배정되면 대시보드가 활성화됩니다.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-gold" />
              <span>강사 배정 및 수업 설정 대기 중</span>
            </div>
            <p className="text-xs text-muted-foreground">
              준비가 완료되면 자동으로 대시보드에 접속할 수 있습니다.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 text-xs"
            onClick={handleLogout}
          >
            로그아웃
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-background">
      {/* ── Instructor View Banner ── */}
      {isInstructorView && (
        <div className="bg-navy text-primary-foreground px-4 py-2 flex items-center justify-between text-sm sticky top-0 z-40">
          <span className="font-medium">👀 {student} 학생의 대시보드를 보고 있습니다</span>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1"
            onClick={() => navigate("/t/dashboard")}
          >
            <ChevronLeft className="w-3 h-3" />
            돌아가기
          </Button>
        </div>
      )}
      {/* ── Holiday Popup ── */}
      {currentPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card rounded-xl shadow-2xl border border-border overflow-hidden">
            <div className="h-1 bg-gold w-full" />
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <BanIcon className="w-4 h-4 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gold uppercase tracking-widest mb-0.5">휴강 공지</p>
                  <p className="font-bold text-foreground text-sm">{currentPopup.title}</p>
                </div>
                <button onClick={() => dismissPopup(currentPopup.id)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-foreground font-medium">
                  <Calendar className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                  {currentPopup.date_start === currentPopup.date_end
                    ? formatDateKo(currentPopup.date_start)
                    : `${formatDateKo(currentPopup.date_start)} ~ ${formatDateKo(currentPopup.date_end)}`}
                </div>
                {currentPopup.reason && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Bell className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>{currentPopup.reason}</span>
                  </div>
                )}
              </div>
              <button
                className="w-full py-2.5 rounded-lg bg-navy text-primary-foreground font-bold text-sm transition-colors hover:bg-navy-light"
                onClick={() => dismissPopup(currentPopup.id)}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback Survey Popup ── */}
      {feedbackNeeded && (
        <FeedbackSurveyModal
          studentName={student}
          instructorName={feedbackNeeded.instructorName}
          periodId={feedbackNeeded.periodId}
          periodLabel={feedbackNeeded.periodLabel}
          onComplete={() => setFeedbackNeeded(null)}
        />
      )}

      {/* ── Payment Reminder Popup ── */}
      {showPaymentReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-xl border border-border w-[340px] mx-4 overflow-hidden">
            <div className="px-5 pt-5 pb-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto">
                <CreditCard className="w-6 h-6 text-gold" />
              </div>
              <h3 className="text-sm font-bold text-foreground">수업료 결제 안내</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                수업이 시작되었지만 아직 이번 달 수업료가<br />결제되지 않았습니다. 결제를 진행해 주세요.
              </p>
            </div>
            <div className="px-5 pb-5 flex flex-col gap-2">
              <Button
                size="sm"
                className="w-full bg-gold hover:bg-gold/90 text-foreground font-semibold"
                onClick={() => {
                  const nowKst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
                  const currentMonth = nowKst.slice(0, 7);
                  localStorage.setItem(`payment_reminder_dismissed_${student}_${currentMonth}`, "1");
                  setShowPaymentReminder(false);
                  setShowPaymentModal(true);
                }}
              >
                결제하기
              </Button>
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                onClick={() => {
                  const nowKst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
                  const currentMonth = nowKst.slice(0, 7);
                  localStorage.setItem(`payment_reminder_dismissed_${student}_${currentMonth}`, "1");
                  setShowPaymentReminder(false);
                }}
              >
                나중에 할게요
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bug Report Modal */}
      <BugReportModal
        open={showBugReport}
        onClose={() => setShowBugReport(false)}
        userName={student}
        role="student"
      />

      {/* Makeup Request Modal */}
      {showMakeup && studentRecord?.instructor_name && (
        <MakeupRequestModal
          studentName={student}
          instructorName={studentRecord.instructor_name}
          groupStudents={studentRecord.group_students}
          onClose={() => setShowMakeup(false)}
        />
      )}

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowPaymentModal(false); setPaymentStep("select"); setReceiptNumber(""); }}>
          <div className="bg-card rounded-xl shadow-xl border border-border w-[360px] mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">
                {paymentStep === "select" ? "결제 방법 선택" : paymentStep === "receipt" ? "현금영수증 정보" : "출석증 요청"}
              </h3>
              <button onClick={() => { setShowPaymentModal(false); setPaymentStep("select"); setReceiptNumber(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {paymentStep === "select" ? (
              <div className="p-5 space-y-3">
                <button
                  onClick={() => setPaymentStep("receipt")}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">계좌이체</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">카카오뱅크 3333-08-1365286</p>
                    <p className="text-[11px] text-muted-foreground">더라운지영어원격학원 (장리원)</p>
                  </div>
                </button>
                <a
                  href="https://smartstore.naver.com/thelounge_english/products/11688767366"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { setShowPaymentModal(false); setPaymentStep("select"); }}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                    <Monitor className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">스토어 결제</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">네이버 스마트스토어에서 결제</p>
                  </div>
                </a>
                <button
                  onClick={() => setPaymentStep("attendance")}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-navy" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">기업제출용 증빙자료 요청하기</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">기업에 제출할 출석증/수강증을 요청합니다</p>
                  </div>
                </button>
              </div>
            ) : paymentStep === "receipt" ? (
              <div className="p-5 space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 border border-border flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground">입금 계좌</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">카카오뱅크 3333-08-1365286</p>
                    <p className="text-[11px] text-muted-foreground">더라운지영어원격학원 (장리원)</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("카카오뱅크 3333-08-1365286 더라운지영어원격학원 (장리원)");
                      toast({ title: "계좌번호가 복사되었습니다" });
                    }}
                    className="shrink-0 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                  >
                    복사
                  </button>
                </div>

                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">현금영수증 발급 유형</p>
                  <div className="flex gap-2">
                    {([["phone", "휴대폰번호"], ["business", "사업자번호"]] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setReceiptType(val)}
                        className={cn("flex-1 py-2 text-xs font-medium rounded-lg border transition-colors",
                          receiptType === val
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    {receiptType === "phone" ? "휴대폰번호" : "사업자등록번호"}
                  </label>
                  <input
                    type="text"
                    value={receiptNumber}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      let formatted = raw;
                      if (receiptType === "phone") {
                        if (raw.length <= 3) formatted = raw;
                        else if (raw.length <= 7) formatted = raw.slice(0, 3) + "-" + raw.slice(3);
                        else formatted = raw.slice(0, 3) + "-" + raw.slice(3, 7) + "-" + raw.slice(7, 11);
                      } else {
                        if (raw.length <= 3) formatted = raw;
                        else if (raw.length <= 5) formatted = raw.slice(0, 3) + "-" + raw.slice(3);
                        else formatted = raw.slice(0, 3) + "-" + raw.slice(3, 5) + "-" + raw.slice(5, 10);
                      }
                      setReceiptNumber(formatted);
                    }}
                    placeholder={receiptType === "phone" ? "010-0000-0000" : "000-00-00000"}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <button
                    onClick={() => setRecurringReceipt(!recurringReceipt)}
                    className={cn("w-9 h-5 rounded-full transition-colors relative shrink-0",
                      recurringReceipt ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  >
                    <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      recurringReceipt ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </button>
                  <div>
                    <p className="text-xs font-semibold text-foreground">매달 자동 발급</p>
                    <p className="text-[10px] text-muted-foreground">매달 별도 요청 없이 현금영수증이 발급됩니다</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setPaymentStep("select"); setReceiptNumber(""); }}
                    className="flex-1 py-2.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    이전
                  </button>
                  <button
                    disabled={!receiptNumber.trim()}
                    onClick={async () => {
                      if (!receiptNumber.trim()) return;
                      const { error } = await supabase.from("cash_receipts" as any).upsert(
                        { student_name: student, receipt_type: receiptType, receipt_number: receiptNumber.trim(), recurring: recurringReceipt, updated_at: new Date().toISOString() } as any,
                        { onConflict: "student_name" } as any
                      );
                      if (error) {
                        toast({ title: "저장 실패", description: error.message, variant: "destructive" });
                      } else {
                        toast({ title: recurringReceipt ? "매달 자동 발급으로 저장되었습니다" : "현금영수증 정보가 저장되었습니다" });
                        setShowPaymentModal(false);
                        setPaymentStep("select");
                        setReceiptNumber("");
                      }
                    }}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
                  >
                    저장하기
                  </button>
                </div>
              </div>
            ) : (
              /* Attendance Certificate Request */
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground">학생명</label>
                  <input
                    type="text"
                    value={student}
                    disabled
                    className="mt-1 w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">출석 기간</p>
                  <div className="flex gap-2 mb-3">
                    {([["month", "월 1일 ~ 말일"], ["custom", "수업 시작일 ~ 종료일"]] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setAttendancePeriodType(val)}
                        className={cn("flex-1 py-2 text-[11px] font-medium rounded-lg border transition-colors",
                          attendancePeriodType === val
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {attendancePeriodType === "month" && (
                    <input
                      type="month"
                      value={attendanceMonth}
                      onChange={e => setAttendanceMonth(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  )}
                  {attendancePeriodType === "custom" && (
                    <p className="text-[11px] text-muted-foreground px-1">등록된 수업 시작일과 종료일 기준으로 발급됩니다.</p>
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <button
                    onClick={() => setRecurringAttendance(!recurringAttendance)}
                    className={cn("w-9 h-5 rounded-full transition-colors relative shrink-0",
                      recurringAttendance ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  >
                    <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      recurringAttendance ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </button>
                  <div>
                    <p className="text-xs font-semibold text-foreground">매달 자동 요청</p>
                    <p className="text-[10px] text-muted-foreground">매달 별도 요청 없이 출석증이 발급됩니다</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setPaymentStep("select")}
                    className="flex-1 py-2.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    이전
                  </button>
                  <button
                    onClick={async () => {
                      let periodStr = "";
                      if (attendancePeriodType === "month") {
                        const [y, m] = attendanceMonth.split("-").map(Number);
                        const lastDay = new Date(y, m, 0).getDate();
                        periodStr = `${y}년 ${m}월 1일 ~ ${y}년 ${m}월 ${lastDay}일`;
                      } else {
                        periodStr = "수업 시작일 ~ 수업 종료일";
                      }
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        toast({ title: "로그인이 필요합니다", variant: "destructive" });
                        return;
                      }
                      // Save recurring attendance preference
                      if (recurringAttendance) {
                        await supabase.from("cash_receipts" as any).upsert(
                          { student_name: student, recurring_attendance: true, updated_at: new Date().toISOString() } as any,
                          { onConflict: "student_name" } as any
                        );
                      }
                      const { error } = await supabase.from("support_requests").insert({
                        user_id: user.id,
                        user_name: student,
                        role: "student",
                        category: "attendance",
                        title: recurringAttendance ? "출석증 매달 자동 요청" : "출석증 요청",
                        description: `학생명: ${student}\n출석 기간: ${periodStr}${recurringAttendance ? "\n⚡ 매달 자동 발급 요청" : ""}`,
                      });
                      if (error) {
                        toast({ title: "요청 실패", description: error.message, variant: "destructive" });
                      } else {
                        toast({ title: recurringAttendance ? "매달 자동 발급으로 설정되었습니다" : "출석증 요청이 접수되었습니다", description: "관리자 확인 후 발급됩니다." });
                        setShowPaymentModal(false);
                        setPaymentStep("select");
                      }
                    }}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
                  >
                    요청하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border px-3 sm:px-5 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm flex-shrink-0">
              <Coffee className="w-4 h-4 text-gold" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground text-sm leading-none truncate">더라운지영어</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{authNickname || student} 님</p>
            </div>
          </div>
          {authStudent && (
            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <a
                href="https://daily-diary-lounge.lovable.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold text-primary-foreground bg-gold hover:bg-gold/90 transition-colors whitespace-nowrap shadow-sm animate-pulse hover:animate-none"
              >
                📝 다이어리 라운지
              </a>
              <button
                onClick={async () => {
                  try {
                    const { exportStudentGuidePdf } = await import("@/lib/exportStudentGuide");
                    await exportStudentGuidePdf();
                  } catch (e) {
                    console.error("PDF export error:", e);
                  }
                }}
                className="px-1.5 sm:px-2 py-1.5 rounded-lg text-[11px] sm:text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                가이드
              </button>
              <button
                onClick={() => setShowBugReport(true)}
                className="px-1.5 sm:px-2 py-1.5 rounded-lg text-[11px] sm:text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap"
                title="버그 신고 / 개선 제안"
              >
                제안
              </button>
              <button
                onClick={() => navigate("/my/profile")}
                className="px-1.5 sm:px-2 py-1.5 rounded-lg text-[11px] sm:text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                MY
              </button>
              <button
                onClick={handleLogout}
                className="px-1.5 sm:px-2 py-1.5 rounded-lg text-[11px] sm:text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Period Navigation ── */}
      {schedulePeriods.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="flex items-center justify-center gap-3">
            <button
              disabled={!canGoPrev}
              onClick={() => canGoPrev && setSelectedPeriodId(sortedPeriods[currentPeriodIdx - 1].id)}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{periodLabel}</p>
              <p className="text-[10px] text-muted-foreground">{periodDateRange}</p>
            </div>
            <button
              disabled={!canGoNext}
              onClick={() => canGoNext && setSelectedPeriodId(sortedPeriods[currentPeriodIdx + 1].id)}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* ── 2-Column Layout ── */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-5 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 sm:gap-5">

        {/* ══════════════════ LEFT COLUMN ══════════════════ */}
        <div className="space-y-4">

          {/* Calendar Card */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border bg-muted/30">
              <Calendar className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-semibold text-foreground">수업 캘린더</span>
            </div>
            <div className="p-3">
              <MiniCalendar allCalendarDates={allCalendarDates} holidays={holidays} selectedPeriod={selectedPeriod} allPeriods={sortedPeriods} onPeriodChange={setSelectedPeriodId} />
            </div>
            {/* Upcoming next session inside calendar */}
            {nextClassDate && (
              <div className="px-3 pb-3">
                <div className="rounded-md bg-navy/5 border border-navy/10 px-3 py-2 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-navy flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {nextClassIsVirtual ? "정기 수업" : (nextSessionFromDB?.topic || "다음 수업")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{fmtDateTime(nextClassDate.toISOString())}</p>
                  </div>
                  <span className="text-[10px] font-bold text-navy flex-shrink-0">{timeUntilLabel(nextClassDate.toISOString())}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border bg-muted/30">
              <Activity className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-semibold text-foreground">바로가기</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {/* 수업 입장하기 */}
              {(() => {
                const canEnter = nextClassDate && (
                  (nextClassDate.getTime() - Date.now()) <= 2 * 60 * 60 * 1000 // 2시간 전부터
                );
                return (
                  <button
                    onClick={() => {
                      if (!canEnter) return;
                      if (nextSessionFromDB?.meet_link) {
                        window.open(nextSessionFromDB.meet_link, "_blank");
                      } else if (nextSessionFromDB?.id) {
                        navigate(`/my/classroom?sessionId=${nextSessionFromDB.id}&role=student`);
                      } else {
                        navigate("/my/classroom?role=student");
                      }
                    }}
                    disabled={!canEnter}
                    className={cn(
                      "rounded-lg p-3 flex flex-col items-start gap-2 text-left transition-all active:scale-[0.98]",
                      canEnter
                        ? "bg-navy text-primary-foreground hover:opacity-90"
                        : "bg-navy/40 text-primary-foreground/50 cursor-not-allowed"
                    )}
                  >
                    <div className="w-7 h-7 rounded-md flex items-center justify-center bg-white/15">
                      <Video className="w-4 h-4 text-gold" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-none">수업 입장하기</p>
                      <p className="text-[10px] mt-0.5 opacity-60">
                        {!nextClassDate ? "예정 없음" : canEnter ? "입장 가능" : timeUntilLabel(nextClassDate.toISOString())}
                      </p>
                    </div>
                  </button>
                );
              })()}
              {/* 수업 노트 */}
              <button
                onClick={() => navigate(`/my/classnote?name=${encodeURIComponent(student)}&sidebar=open`)}
                className="rounded-lg p-3 flex flex-col items-start gap-2 text-left transition-all hover:opacity-90 active:scale-[0.98] bg-muted/50 border border-border hover:bg-muted"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-card">
                  <FileText className="w-4 h-4 text-navy" />
                </div>
                <div>
                  <p className="text-xs font-bold leading-none text-foreground">수업 노트</p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground">이전 노트 보기</p>
                </div>
              </button>
              {/* 보강 신청하기 */}
              <button
                onClick={() => setShowMakeup(true)}
                className="rounded-lg p-3 flex flex-col items-start gap-2 text-left transition-all hover:opacity-90 active:scale-[0.98] bg-muted/50 border border-border hover:bg-muted"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-card">
                  <RotateCcw className="w-4 h-4 text-navy" />
                </div>
                <div>
                  <p className="text-xs font-bold leading-none text-foreground">보강 신청하기</p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground">수업 48시간 전까지 가능</p>
                </div>
              </button>
              {/* 수업료 결제하기 — corporate 학생은 비활성화 */}
              {studentRecord?.student_type === 'corporate' ? (
              <div className="relative group">
                <button
                  disabled
                  className="w-full rounded-lg p-3 flex flex-col items-start gap-2 text-left bg-muted/30 border border-border opacity-50 cursor-not-allowed"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center bg-card">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-none text-muted-foreground">수업료 결제하기</p>
                    <p className="text-[10px] mt-0.5 text-muted-foreground">기업 수업은 해당되지 않습니다</p>
                  </div>
                </button>
              </div>
              ) : (
              <button
                  onClick={() => setShowPaymentModal(true)}
                  className="w-full rounded-lg p-3 flex flex-col items-start gap-2 text-left transition-all hover:opacity-90 active:scale-[0.98] bg-gold/10 border border-gold/30 hover:bg-gold/20"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center bg-card">
                    <CreditCard className="w-4 h-4 text-gold" />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-none text-foreground">수업료 결제하기</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════ RIGHT COLUMN ══════════════════ */}
        <div className="space-y-4">

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              {
                icon: Heart,
                label: "함께한 시간",
                value: `${monthsWithUs}개월`,
                sub: studentRecord?.start_date ? `${new Date(studentRecord.start_date + "T00:00:00").getFullYear()}.${String(new Date(studentRecord.start_date + "T00:00:00").getMonth() + 1).padStart(2, "0")} ~` : "",
              },
              {
                icon: CalendarDays,
                label: "이번달 수업",
                value: `${thisMonthStats.completed}/${thisMonthStats.total}`,
                sub: thisMonthStats.completed >= thisMonthStats.total && thisMonthStats.total > 0 ? "수업 완료!" : "수업 완료",
              },
              {
                icon: BookOpen,
                label: "이번주 숙제",
                value: `${latestSessionHwStats.submitted}/${latestSessionHwStats.total}`,
                sub: latestSessionHwStats.pending === 0 ? "모두 완료!" : `${latestSessionHwStats.pending}개 남음`,
                alert: latestSessionHwStats.pending > 0,
              },
              {
                icon: Trophy,
                label: "단어 테스트 평균 점수",
                value: avgScore !== null ? `${avgScore}%` : "-",
                sub: `${periodTestHistory.length}회 테스트`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "rounded-lg border bg-card p-3 shadow-sm",
                  stat.alert ? "border-destructive/30" : "border-border"
                )}
              >
                <stat.icon className={cn("w-4 h-4 mb-2", stat.alert ? "text-destructive" : "text-gold")} />
                <p className={cn("text-lg sm:text-xl font-black leading-none", stat.alert ? "text-destructive" : "text-foreground")}>{stat.value}</p>
                <p className="text-[10px] font-semibold text-foreground mt-1">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Next Class */}
          <RSection title="다음 수업" icon={Clock}>
            {nextClassDate ? (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-bold text-foreground text-sm">
                      {nextClassIsVirtual ? "정기 수업" : (nextSessionFromDB?.topic || "수업")}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(nextClassDate.toISOString())}</p>
                    <p className="text-xs text-muted-foreground">
                      담당: {studentRecord?.instructor_name || nextSessionFromDB?.instructor_name || "-"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-navy/10 text-navy font-bold">
                      {studentRecord?.level || nextSessionFromDB?.level || "-"}
                    </span>
                    <span className="text-[10px] font-bold text-gold">{timeUntilLabel(nextClassDate.toISOString())}</span>
                  </div>
                </div>
                {latestSessionAssignments.length > 0 && latestSessionPendingHw.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-destructive/8 border border-destructive/20">
                    <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                    <p className="text-[11px] text-destructive">미제출 숙제 {latestSessionPendingHw.length}개 남아있어요</p>
                  </div>
                )}
                {latestSessionAssignments.length > 0 && latestSessionPendingHw.length === 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[hsl(var(--success)/0.08)] border border-[hsl(var(--success)/0.2)]">
                    <Check className="w-3 h-3 text-[hsl(var(--success))] flex-shrink-0" />
                    <p className="text-[11px] text-[hsl(var(--success))]">모든 숙제를 완료했어요 🎉</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">예정된 수업이 없습니다</p>
            )}
          </RSection>

          {/* Weekly Tasks */}
          <WeeklyTasksSection
            assignments={assignments}
            submissions={submissions}
            sessions={allSessions}
            studentName={student}
            vocabWords={vocabWords}
            testHistory={testHistory}
            onSubmissionUpdate={(sub) => {
              setSubmissions(prev => {
                const idx = prev.findIndex(s => s.id === sub.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = sub;
                  return next;
                }
                return [...prev, sub];
              });
            }}
          />

          {/* Homework */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setHwOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs font-semibold text-foreground">숙제 현황</span>
                {pendingHw.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold">{pendingHw.length}미제출</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{periodAssignments.length}개 전체</span>
            </button>
            {hwOpen && (
              <div className="divide-y divide-border/50">
                {periodAssignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">이 기간에 배정된 숙제가 없습니다</p>
                ) : (
                  periodAssignments.slice(0, 5).map((a) => {
                    const sub = getSubmission(a.id);
                    const status = sub?.status || "pending";
                    const meta = HW_META[a.type as HwType];
                    const Icon = meta?.icon ?? Brain;
                    // Derive week label relative to period start
                    const linkedSession = a.session_id ? allSessions.find(s => s.id === a.session_id) : null;
                    const weekPrefix = linkedSession?.scheduled_at && periodStart
                      ? (() => {
                          const d = new Date(linkedSession.scheduled_at);
                          const week = Math.floor((d.getTime() - periodStart.getTime()) / (7 * 86400000)) + 1;
                          return `${week}주차`;
                        })()
                      : null;
                    const isQuickType = a.type === "memorizing" || a.type === "speaking";
                    const isPending = status === "pending";
                    return (
                      <div key={a.id} className="flex items-center gap-2.5 px-3 py-2.5">
                        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
                          status === "reviewed" ? "bg-success/10" : status === "submitted" ? "bg-gold/10" : "bg-muted"
                        )}>
                          <Icon className={cn("w-3.5 h-3.5", meta?.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {weekPrefix && <span className="text-muted-foreground font-medium mr-1">[{weekPrefix}]</span>}
                            {a.title}
                          </p>
                          {a.due_at && <p className="text-[10px] text-muted-foreground">마감: {fmtDate(a.due_at)}</p>}
                        </div>
                        {status === "reviewed" && sub && (
                          <button
                            onClick={() => setHwFeedback({ assignment: a, submission: sub })}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] font-semibold flex-shrink-0 hover:bg-[hsl(var(--success)/0.2)] transition-colors cursor-pointer"
                          >검토됨 →</button>
                        )}
                        {status === "submitted" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold-dark font-semibold flex-shrink-0">제출됨</span>
                        )}
                        {isPending && isQuickType && (
                          <button
                            onClick={() => handleQuickComplete(a)}
                            disabled={hwCompletingId === a.id}
                            className="text-[10px] font-bold text-navy hover:text-navy-light transition-colors px-2 py-1 rounded-md bg-navy/5 hover:bg-navy/10 flex-shrink-0"
                          >
                            {hwCompletingId === a.id ? "..." : "완료"}
                          </button>
                        )}
                        {isPending && !isQuickType && (
                          <button
                            onClick={() => setHwModalAssignment(a)}
                            className="text-[10px] font-bold text-navy hover:text-navy-light transition-colors px-2 py-1 rounded-md bg-navy/5 hover:bg-navy/10 flex-shrink-0"
                          >
                            제출하기
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
                {periodAssignments.length > 5 && (
                  <button
                    onClick={() => navigate("/my/classnote")}
                    className="w-full text-center text-[11px] text-muted-foreground py-2 hover:text-foreground transition-colors"
                  >
                    +{periodAssignments.length - 5}개 더보기
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Vocab - 최근 3개월 단어 리스트 */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <div
              className="w-full flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30"
            >
              <button
                onClick={() => setVocabListOpen(v => !v)}
                className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
              >
                <BookOpen className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs font-semibold text-foreground">이달의 단어장</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy/10 text-navy font-semibold">{periodVocabWords.length}개</span>
              </button>
              <button
                onClick={() => navigate(`/my/vocabulary?name=${encodeURIComponent(student)}`)}
                className="text-[10px] text-navy font-semibold hover:underline transition-colors"
              >
                전체 단어장 & 테스트 →
              </button>
            </div>
            {vocabListOpen && (
              <div className="max-h-80 overflow-y-auto">
                {vocabWeeks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">등록된 단어가 없습니다</p>
                ) : (
                  vocabWeeks.map(week => (
                    <div key={week}>
                      <div className="px-3 py-1.5 bg-muted/20 border-b border-border/50">
                        <span className="text-[10px] font-bold text-muted-foreground">{fmtWeek(week)}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">({vocabByWeek[week].length}단어)</span>
                      </div>
                      <div className="divide-y divide-border/30">
                        {vocabByWeek[week].map(w => (
                          <div key={w.id} className="flex items-center gap-2.5 px-3 py-2">
                            <TTSButton word={w} />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold text-foreground">{w.english_word}</span>
                              {w.part_of_speech && (
                                <span className="text-[10px] text-muted-foreground ml-1">({w.part_of_speech})</span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{w.korean_meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setTestHistoryOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs font-semibold text-foreground">단어 테스트 이력</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{testHistory.length}회</span>
            </button>
            {testHistoryOpen && (
              <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
                {testHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">완료된 테스트가 없습니다</p>
                ) : (
                  testHistory.map((t) => {
                    const pct = t.total ? Math.round(((t.score ?? 0) / t.total) * 100) : 0;
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 font-black text-xs",
                          pct >= 80 ? "bg-success/10 text-success"
                            : pct >= 60 ? "bg-gold/10 text-gold-dark"
                            : "bg-destructive/10 text-destructive"
                        )}>
                          {pct}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{fmtWeek(t.week_label)}</p>
                          <p className="text-[10px] text-muted-foreground">{t.score}/{t.total}점</p>
                        </div>
                        {t.completed_at && (
                          <p className="text-[10px] text-muted-foreground flex-shrink-0">{fmtDate(t.completed_at)}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Class History */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setClassHistoryOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs font-semibold text-foreground">수업 이력</span>
              </div>
              <span className="text-[10px] text-muted-foreground">총 {totalClassDays}회</span>
            </button>
            {classHistoryOpen && (
              <div className="divide-y divide-border/50 max-h-48 overflow-y-auto">
                {pastSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">수업 이력이 없습니다</p>
                ) : (
                  pastSessions.slice(0, 10).map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-2.5 px-3 py-2">
                      <span className="text-[10px] font-bold text-muted-foreground w-6 flex-shrink-0">#{totalClassDays - idx}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{s.topic || "수업"}</p>
                        <p className="text-[10px] text-muted-foreground">{fmtDate(s.scheduled_at)}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{s.level}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </div>
        {/* ════════════════════════════════════════════════ */}
      </div>
    </div>

    {hwModalAssignment && (
      <HomeworkSubmitModal
        assignment={hwModalAssignment}
        submission={getSubmission(hwModalAssignment.id) ?? null}
        studentName={student}
        onClose={() => setHwModalAssignment(null)}
        onSubmitted={(sub) => {
          setSubmissions(prev => {
            const idx = prev.findIndex(s => s.id === sub.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = sub; return next; }
            return [...prev, sub];
          });
          setHwModalAssignment(null);
        }}
      />
    )}
    {hwFeedback && (
      <HomeworkFeedbackModal
        assignmentTitle={hwFeedback.assignment.title}
        assignmentType={hwFeedback.assignment.type}
        textContent={hwFeedback.submission.text_content}
        audioUrl={hwFeedback.submission.audio_url}
        fileUrl={hwFeedback.submission.file_url}
        instructorNote={hwFeedback.submission.instructor_note}
        reviewedAt={hwFeedback.submission.reviewed_at}
        aiCorrection={hwFeedback.submission.ai_correction}
        onClose={() => setHwFeedback(null)}
      />
    )}
    </>
  );
}
