import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Trophy, Calendar, Video, Clock, Check,
  Volume2, Loader2, Square, PenLine, Mic, Brain,
  AlertCircle, BanIcon, Bell, ChevronLeft,
  ChevronRight, Coffee, CalendarDays, TrendingUp, FileText,
  RotateCcw, X, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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

interface StudentRecord {
  schedules: ScheduleSlot[];
  start_date: string | null;
  level: string | null;
  instructor_name: string | null;
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
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  type: string;
  due_at: string | null;
  is_preset: boolean;
}

interface Submission {
  id: string;
  assignment_id: string | null;
  status: string;
  text_content: string | null;
  audio_url: string | null;
  instructor_note: string | null;
  reviewed_at: string | null;
}

interface VocabWord {
  id: string;
  english_word: string;
  korean_meaning: string;
  part_of_speech: string | null;
  audio_url: string | null;
  week_label: string;
}

interface TestRecord {
  id: string;
  week_label: string | null;
  type: string;
  score: number | null;
  total: number | null;
  completed_at: string | null;
}

type HwType = "writing" | "reading" | "speaking" | "memorizing";
const HW_META: Record<HwType, { label: string; icon: React.ElementType; color: string }> = {
  writing:    { label: "쓰기",   icon: PenLine,  color: "text-amber-600" },
  reading:    { label: "읽기",   icon: BookOpen, color: "text-orange-500" },
  speaking:   { label: "말하기", icon: Mic,      color: "text-rose-500" },
  memorizing: { label: "외우기", icon: Brain,    color: "text-violet-500" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtWeek(label: string | null) {
  if (!label) return "-";
  return label.replace(/(\d{4})-W(\d{2})/, (_, y, w) => `${y}년 ${parseInt(w)}주차`);
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
function MiniCalendar({ allCalendarDates, holidays, schedulePeriods }: {
  allCalendarDates: Set<string>;
  holidays: HolidayNotice[];
  schedulePeriods: SchedulePeriod[];
}) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const holidayRanges = holidays.map(h => ({
    start: new Date(h.date_start + "T00:00:00"),
    end: new Date(h.date_end + "T23:59:59"),
  }));

  // 현재 보이는 달에 해당하는 수업 기간
  const activePeriods = schedulePeriods.filter(p => {
    const ps = new Date(p.start_date + "T00:00:00");
    const pe = new Date(p.end_date + "T23:59:59");
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
    return ps <= monthEnd && pe >= monthStart;
  });

  const isInPeriod = (d: Date) =>
    activePeriods.some(p => {
      const ps = new Date(p.start_date + "T00:00:00");
      const pe = new Date(p.end_date + "T23:59:59");
      return d >= ps && d <= pe;
    });

  const isHoliday = (d: Date) =>
    holidayRanges.some(r => d >= r.start && d <= r.end);

  // 화요일(day 2) 정기 휴무
  const isTuesdayOff = (d: Date) => d.getDay() === 2;

  const hasSession = (day: number) => {
    const d = new Date(year, month, day);
    return allCalendarDates.has(d.toDateString());
  };
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const prev = () => setViewDate(new Date(year, month - 1, 1));
  const next = () => setViewDate(new Date(year, month + 1, 1));

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  // 이번 달 기간 범위 표시 텍스트
  const periodLabel = activePeriods.length > 0
    ? activePeriods.map(p => {
        const ps = new Date(p.start_date + "T00:00:00");
        const pe = new Date(p.end_date + "T00:00:00");
        return `${p.label} (${ps.getMonth()+1}/${ps.getDate()} ~ ${pe.getMonth()+1}/${pe.getDate()})`;
      }).join(", ")
    : null;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <button onClick={prev} className="w-6 h-6 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors">
          <ChevronLeft className="w-3.5 h-3.5 text-foreground" />
        </button>
        <span className="font-bold text-foreground text-sm">{year}년 {month + 1}월</span>
        <button onClick={next} className="w-6 h-6 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors">
          <ChevronRight className="w-3.5 h-3.5 text-foreground" />
        </button>
      </div>
      {/* Period label */}
      {periodLabel && (
        <p className="text-[9px] text-navy/70 font-medium text-center">{periodLabel}</p>
      )}
      {/* Day labels */}
      <div className="grid grid-cols-7 text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div key={d} className={cn(
            "text-[10px] font-semibold pb-1",
            i === 0 ? "text-destructive/70" : i === 2 ? "text-muted-foreground/40" : "text-muted-foreground"
          )}>{d}</div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const date = new Date(year, month, day);
          const holiday = isHoliday(date);
          const tuesdayOff = isTuesdayOff(date);
          const inPeriod = isInPeriod(date);
          const session = hasSession(day);
          const todayMark = isToday(day);
          const isOff = holiday || tuesdayOff;
          return (
            <div key={idx} className={cn(
              "relative aspect-square flex flex-col items-center justify-center rounded-md text-[11px] font-medium transition-all",
              todayMark ? "bg-navy text-primary-foreground font-bold shadow-sm"
                : session && !isOff ? "bg-gold/15 text-gold-dark font-semibold"
                : holiday ? "bg-destructive/8 text-destructive/50"
                : tuesdayOff ? "text-muted-foreground/30"
                : inPeriod ? "text-foreground hover:bg-muted/50"
                : "text-muted-foreground/40 hover:bg-muted/30",
            )}>
              {day}
              {session && !todayMark && !isOff && (
                <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-gold" />
              )}
              {holiday && !todayMark && (
                <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-destructive/50" />
              )}
            </div>
          );
        })}
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
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("dismissed_holiday_ids") || "[]"); } catch { return []; }
  });
  const [vocabOpen, setVocabOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hwOpen, setHwOpen] = useState(true);

  const searchParams = new URLSearchParams(window.location.search);
  const student = searchParams.get("name") || "정유리";

  const visibleHolidays = holidays.filter(h => h.notify_students && !dismissedIds.includes(h.id));
  const currentPopup = visibleHolidays[0] ?? null;

  const dismissPopup = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    localStorage.setItem("dismissed_holiday_ids", JSON.stringify(next));
  };

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [sessRes, allSessRes, hwRes, subRes, vocRes, testRes, studentRes, periodsRes, holidaysRes] = await Promise.all([
      supabase.from("class_sessions").select("id,scheduled_at,topic,level,meet_link,instructor_name,started_at,ended_at")
        .eq("student_name", student).order("scheduled_at", { ascending: false }).limit(20),
      supabase.from("class_sessions").select("id,scheduled_at,topic,level,meet_link,instructor_name,started_at,ended_at")
        .eq("student_name", student).order("scheduled_at", { ascending: true }),
      supabase.from("homework_assignments").select("id,title,description,type,due_at,is_preset")
        .eq("student_name", student).order("created_at", { ascending: false }),
      supabase.from("homework_submissions").select("id,assignment_id,status,text_content,audio_url,instructor_note,reviewed_at")
        .eq("student_name", student),
      supabase.from("vocabulary_words").select("id,english_word,korean_meaning,part_of_speech,audio_url,week_label")
        .eq("student_name", student).order("week_label", { ascending: false }).order("created_at", { ascending: true }),
      supabase.from("vocabulary_tests").select("id,week_label,type,score,total,completed_at")
        .eq("student_name", student).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(20),
      supabase.from("instructor_students").select("schedules,start_date,level,instructor_name")
        .eq("student_name", student).maybeSingle(),
      // 어드민 수업 기간 설정
      supabase.from("schedule_periods").select("id,label,start_date,end_date,is_active").order("start_date", { ascending: true }),
      // 휴강 공지 (팝업용은 미래만, 캘린더용은 전체)
      supabase.from("holiday_notices").select("id,title,date_start,date_end,reason,notify_students").order("date_start", { ascending: true }),
    ]);

    setSessions(sessRes.data || []);
    setAllSessions(allSessRes.data || []);
    setAssignments(hwRes.data || []);
    setSubmissions(subRes.data || []);
    setVocabWords(vocRes.data || []);
    setTestHistory(testRes.data || []);
    setSchedulePeriods(periodsRes.data || []);

    // 팝업은 미래 휴강만 (date_end >= today)
    const todayStr = new Date().toISOString().slice(0, 10);
    setHolidays((holidaysRes.data || []).filter((h: HolidayNotice) => h.date_end >= todayStr));

    if (studentRes.data) {
      let schedules: ScheduleSlot[] = [];
      try {
        const raw = studentRes.data.schedules;
        schedules = typeof raw === "string" ? JSON.parse(raw) : (raw as ScheduleSlot[]) || [];
      } catch { schedules = []; }
      setStudentRecord({
        schedules,
        start_date: studentRes.data.start_date,
        level: studentRes.data.level,
        instructor_name: studentRes.data.instructor_name,
      });
    }

    setLoading(false);
  };

  const getSubmission = (aId: string) => submissions.find(s => s.assignment_id === aId);

  // ── 반복 일정에서 가상 세션 날짜 생성 ──
  const recurringDates = studentRecord
    ? generateRecurringDates(studentRecord.schedules, studentRecord.start_date || "", 3)
    : [];

  // 실제 class_sessions에 이미 있는 날짜 (YYYY-MM-DD)
  const existingSessionDates = new Set(
    allSessions.map(s => new Date(s.scheduled_at).toDateString())
  );

  // 반복 일정 중 아직 class_session에 없는 것들 (가상 upcoming)
  const virtualUpcoming = recurringDates.filter(
    d => d.getTime() > Date.now() && !existingSessionDates.has(d.toDateString())
  );

  // 다음 수업: 실제 세션 또는 반복 일정 중 가장 빠른 것
  const nextSessionFromDB = sessions
    .filter(s => msUntil(s.scheduled_at) > 0)
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

  // 캘린더용: 실제 세션 + 반복일정 모두 표시
  const allCalendarDates = new Set([
    ...allSessions.map(s => new Date(s.scheduled_at).toDateString()),
    ...recurringDates.map(d => d.toDateString()),
  ]);

  // ── Derived stats ──
  const pendingHw = assignments.filter(a => { const sub = getSubmission(a.id); return !sub || sub.status === "pending"; });
  const latestTest = testHistory[0];
  const avgScore = testHistory.length > 0
    ? Math.round(testHistory.reduce((acc, t) => acc + (t.total ? (t.score ?? 0) / t.total : 0), 0) / testHistory.length * 100)
    : null;

  const vocabByWeek = vocabWords.reduce<Record<string, VocabWord[]>>((acc, w) => {
    if (!acc[w.week_label]) acc[w.week_label] = [];
    acc[w.week_label].push(w);
    return acc;
  }, {});
  const vocabWeeks = Object.keys(vocabByWeek).sort((a, b) => b.localeCompare(a));

  if (loading) {
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

  return (
    <div className="min-h-screen bg-background">
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

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center shadow-sm">
            <Coffee className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm leading-none">더라운지영어</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{student} 님</p>
          </div>
        </div>
        {nextSessionFromDB?.meet_link && (
          <a href={nextSessionFromDB.meet_link} target="_blank" rel="noopener noreferrer">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-primary-foreground text-xs font-bold shadow-sm hover:bg-navy-light transition-colors">
              <Video className="w-3.5 h-3.5" /> 수업 입장
            </button>
          </a>
        )}
      </header>

      {/* ── 2-Column Layout ── */}
      <div className="max-w-6xl mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

        {/* ══════════════════ LEFT COLUMN ══════════════════ */}
        <div className="space-y-4">

          {/* Calendar Card */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border bg-muted/30">
              <Calendar className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-semibold text-foreground">수업 캘린더</span>
            </div>
            <div className="p-3">
              <MiniCalendar allCalendarDates={allCalendarDates} holidays={holidays} schedulePeriods={schedulePeriods} />
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
              {/* 수업 입장하기 - full width primary */}
              <button
                onClick={() => nextSessionFromDB?.meet_link ? window.open(nextSessionFromDB.meet_link, "_blank") : navigate("/classroom")}
                className="col-span-2 rounded-lg p-3 flex flex-col items-start gap-2 text-left transition-all hover:opacity-90 active:scale-[0.98] bg-navy text-primary-foreground"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-white/15">
                  <Video className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <p className="text-xs font-bold leading-none text-primary-foreground">수업 입장하기</p>
                  <p className="text-[10px] mt-0.5 text-primary-foreground/60">{nextClassDate ? timeUntilLabel(nextClassDate.toISOString()) : "예정 없음"}</p>
                </div>
              </button>
              {/* 보강 신청하기 */}
              <button
                onClick={() => navigate("/makeup")}
                className="rounded-lg p-3 flex flex-col items-start gap-2 text-left transition-all hover:opacity-90 active:scale-[0.98] bg-muted/50 border border-border hover:bg-muted"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-card">
                  <RotateCcw className="w-4 h-4 text-navy" />
                </div>
                <div>
                  <p className="text-xs font-bold leading-none text-foreground">보강 신청하기</p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground">일정 조율</p>
                </div>
              </button>
              {/* 수업 노트 */}
              <button
                onClick={() => navigate(`/classnote?name=${encodeURIComponent(student)}`)}
                className="rounded-lg p-3 flex flex-col items-start gap-2 text-left transition-all hover:opacity-90 active:scale-[0.98] bg-muted/50 border border-border hover:bg-muted"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-card">
                  <FileText className="w-4 h-4 text-navy" />
                </div>
                <div>
                  <p className="text-xs font-bold leading-none text-foreground">수업 노트</p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground">노트 & 피드백</p>
                </div>
              </button>
              {/* 단어 시험보기 */}
              <button
                onClick={() => setVocabOpen(true)}
                className="rounded-lg p-3 flex flex-col items-start gap-2 text-left transition-all hover:opacity-90 active:scale-[0.98] bg-muted/50 border border-border hover:bg-muted"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-card">
                  <Trophy className="w-4 h-4 text-navy" />
                </div>
                <div>
                  <p className="text-xs font-bold leading-none text-foreground">단어 시험보기</p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground">{vocabWords.length}개 단어</p>
                </div>
              </button>
              {/* 숙제 제출하러가기 */}
              <button
                onClick={() => navigate(`/classnote?name=${encodeURIComponent(student)}&tab=homework`)}
                className="rounded-lg p-3 flex flex-col items-start gap-2 text-left transition-all hover:opacity-90 active:scale-[0.98] bg-muted/50 border border-border hover:bg-muted"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-card">
                  <PenLine className="w-4 h-4 text-navy" />
                </div>
                <div>
                  <p className="text-xs font-bold leading-none text-foreground">숙제 제출하러가기</p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground">
                    {pendingHw.length > 0 ? `${pendingHw.length}개 미제출` : "모두 완료!"}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════ RIGHT COLUMN ══════════════════ */}
        <div className="space-y-4">

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                icon: CalendarDays,
                label: "수업일수",
                value: totalClassDays,
                sub: "누적 수업",
              },
              {
                icon: AlertCircle,
                label: "미제출 숙제",
                value: pendingHw.length,
                sub: pendingHw.length === 0 ? "모두 완료!" : `${pendingHw.length}개 남음`,
                alert: pendingHw.length > 0,
              },
              {
                icon: Trophy,
                label: "평균 점수",
                value: avgScore !== null ? `${avgScore}%` : "-",
                sub: `${testHistory.length}회 테스트`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "rounded-lg border bg-card p-4 shadow-sm",
                  stat.alert ? "border-destructive/30" : "border-border"
                )}
              >
                <stat.icon className={cn("w-4 h-4 mb-2", stat.alert ? "text-destructive" : "text-gold")} />
                <p className={cn("text-2xl font-black leading-none", stat.alert ? "text-destructive" : "text-foreground")}>{stat.value}</p>
                <p className="text-[11px] font-semibold text-foreground mt-1">{stat.label}</p>
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
                {!nextClassIsVirtual && nextSessionFromDB?.meet_link && (
                  <a href={nextSessionFromDB.meet_link} target="_blank" rel="noopener noreferrer" className="block">
                    <button className="w-full py-2 rounded-md bg-navy text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-navy-light transition-colors">
                      <Video className="w-3.5 h-3.5" /> 수업 입장하기
                    </button>
                  </a>
                )}
                {(nextClassDate.getTime() - Date.now()) <= 48 * 3600 * 1000 && pendingHw.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-destructive/8 border border-destructive/20">
                    <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                    <p className="text-[11px] text-destructive">미제출 숙제 {pendingHw.length}개 남아있어요</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">예정된 수업이 없습니다</p>
            )}
          </RSection>

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
              <span className="text-[10px] text-muted-foreground">{assignments.length}개 전체</span>
            </button>
            {hwOpen && (
              <div className="divide-y divide-border/50">
                {assignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">배정된 숙제가 없습니다</p>
                ) : (
                  assignments.slice(0, 5).map((a) => {
                    const sub = getSubmission(a.id);
                    const status = sub?.status || "pending";
                    const meta = HW_META[a.type as HwType];
                    const Icon = meta?.icon ?? Brain;
                    return (
                      <div key={a.id} className="flex items-center gap-2.5 px-3 py-2.5">
                        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
                          status === "reviewed" ? "bg-success/10" : status === "submitted" ? "bg-gold/10" : "bg-muted"
                        )}>
                          <Icon className={cn("w-3.5 h-3.5", meta?.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{a.title}</p>
                          {a.due_at && <p className="text-[10px] text-muted-foreground">마감: {fmtDate(a.due_at)}</p>}
                        </div>
                        {status === "reviewed" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-semibold flex-shrink-0">검토됨</span>
                        )}
                        {status === "submitted" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold-dark font-semibold flex-shrink-0">제출됨</span>
                        )}
                        {status === "pending" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold flex-shrink-0">미제출</span>
                        )}
                      </div>
                    );
                  })
                )}
                {assignments.length > 5 && (
                  <button
                    onClick={() => navigate("/classnote")}
                    className="w-full text-center text-[11px] text-muted-foreground py-2 hover:text-foreground transition-colors"
                  >
                    +{assignments.length - 5}개 더보기
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Vocab Panel */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setVocabOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs font-semibold text-foreground">단어장</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy/10 text-navy font-semibold">{vocabWords.length}개</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{vocabOpen ? "접기" : "펼치기"}</span>
            </button>
            {vocabOpen && (
              <div className="divide-y divide-border/50 max-h-72 overflow-y-auto">
                {vocabWords.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">등록된 단어가 없습니다</p>
                ) : (
                  vocabWeeks.map(week => (
                    <div key={week}>
                      <div className="px-3 py-1.5 bg-muted/30">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{fmtWeek(week)}</span>
                      </div>
                      {vocabByWeek[week].map(w => (
                        <div key={w.id} className="flex items-center gap-2 px-3 py-2">
                          <TTSButton word={w} />
                          <span className="font-semibold text-xs text-foreground flex-1">{w.english_word}</span>
                          {w.part_of_speech && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground hidden sm:inline">{w.part_of_speech}</span>
                          )}
                          <span className="text-[11px] text-muted-foreground flex-shrink-0">{w.korean_meaning}</span>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Test History */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setHistoryOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs font-semibold text-foreground">이력</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{testHistory.length}회 테스트</span>
            </button>
            {historyOpen && (
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
            {/* Session history mini */}
            <div className="border-t border-border">
              <div className="px-3 py-2 bg-muted/20">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Check className="w-3 h-3" /> 수업 이력 · 총 {totalClassDays}회
                </p>
              </div>
              <div className="divide-y divide-border/50 max-h-40 overflow-y-auto">
                {pastSessions.slice(0, 5).map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2.5 px-3 py-2">
                    <span className="text-[10px] font-bold text-muted-foreground w-6 flex-shrink-0">#{totalClassDays - idx}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{s.topic || "수업"}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtDate(s.scheduled_at)}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{s.level}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
        {/* ════════════════════════════════════════════════ */}
      </div>
    </div>
  );
}
