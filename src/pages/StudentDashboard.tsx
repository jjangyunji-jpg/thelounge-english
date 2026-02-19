import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Trophy, Calendar, Video, Clock, Check, X,
  Volume2, Loader2, Square, MessageSquare, PenLine, Mic, Brain,
  Star, TrendingUp, AlertCircle, BanIcon, Bell, ChevronLeft,
  ChevronRight, Coffee, CalendarDays, Activity, FileText,
  RotateCcw, Home, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateKo(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS_KO[d.getDay()]})`;
}

interface HolidayNotice {
  id: string;
  title: string;
  date_start: string;
  date_end: string;
  reason: string | null;
  notify_students: boolean;
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
      className="w-7 h-7 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center transition-colors flex-shrink-0"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 text-amber-700 animate-spin" />
        : playing ? <Square className="w-3 h-3 text-amber-700 fill-amber-700" />
        : <Volume2 className="w-3.5 h-3.5 text-amber-700" />}
    </button>
  );
}

// ── Mini Calendar ──────────────────────────────────────────────────────────────
function MiniCalendar({ sessions, holidays }: { sessions: ClassSession[]; holidays: HolidayNotice[] }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const sessionDates = new Set(
    sessions.map(s => {
      const d = new Date(s.scheduled_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  const holidayRanges = holidays.map(h => ({
    start: new Date(h.date_start + "T00:00:00"),
    end: new Date(h.date_end + "T23:59:59"),
  }));
  const tuesdayHoliday = true; // 매주 화요일 정기휴일

  const isHoliday = (d: Date) => {
    if (tuesdayHoliday && d.getDay() === 2) return true;
    return holidayRanges.some(r => d >= r.start && d <= r.end);
  };
  const hasSession = (day: number) => {
    return sessionDates.has(`${year}-${month}-${day}`);
  };
  const isToday = (day: number) => {
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const prev = () => setViewDate(new Date(year, month - 1, 1));
  const next = () => setViewDate(new Date(year, month + 1, 1));

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 flex items-center justify-center transition-colors">
          <ChevronLeft className="w-4 h-4 text-amber-700" />
        </button>
        <span className="font-bold text-amber-900 text-sm">{year}년 {month + 1}월</span>
        <button onClick={next} className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 flex items-center justify-center transition-colors">
          <ChevronRight className="w-4 h-4 text-amber-700" />
        </button>
      </div>
      {/* Day labels */}
      <div className="grid grid-cols-7 text-center">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div key={d} className={cn("text-[10px] font-semibold pb-1", i === 0 ? "text-rose-400" : i === 2 ? "text-amber-400" : "text-amber-700/60")}>{d}</div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const date = new Date(year, month, day);
          const holiday = isHoliday(date);
          const session = hasSession(day);
          const todayMark = isToday(day);
          return (
            <div key={idx} className={cn(
              "relative aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all",
              todayMark ? "bg-amber-500 text-white font-bold shadow-md"
                : session ? "bg-orange-100 text-orange-800 font-semibold"
                : holiday ? "bg-rose-50 text-rose-300"
                : "text-amber-900 hover:bg-amber-50",
            )}>
              {day}
              {session && !todayMark && (
                <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-orange-500" />
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-amber-700/70 pt-1">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-400" />수업일</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-200" />휴일/화요일</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" />오늘</div>
      </div>
    </div>
  );
}

// ── Quick Action Card ─────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, sublabel, onClick, variant = "default" }: {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  onClick: () => void;
  variant?: "primary" | "default" | "soft";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl p-4 flex flex-col items-start gap-2 text-left transition-all active:scale-[0.98] shadow-sm",
        variant === "primary" && "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-orange-200",
        variant === "soft" && "bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100",
        variant === "default" && "bg-white border border-amber-100 text-amber-900 hover:border-amber-300 hover:bg-amber-50",
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center",
        variant === "primary" ? "bg-white/20" : "bg-amber-100",
      )}>
        <Icon className={cn("w-5 h-5", variant === "primary" ? "text-white" : "text-amber-600")} />
      </div>
      <div>
        <p className={cn("text-sm font-bold", variant === "primary" ? "text-white" : "text-amber-900")}>{label}</p>
        {sublabel && <p className={cn("text-[11px] mt-0.5", variant === "primary" ? "text-white/75" : "text-amber-600")}>{sublabel}</p>}
      </div>
    </button>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, action }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-amber-600" />
          <h2 className="font-bold text-amber-900 text-sm">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "amber" }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: "amber" | "orange" | "rose" | "green";
}) {
  const colors = {
    amber: "bg-amber-50 border-amber-200 text-amber-600",
    orange: "bg-orange-50 border-orange-200 text-orange-600",
    rose: "bg-rose-50 border-rose-200 text-rose-500",
    green: "bg-emerald-50 border-emerald-200 text-emerald-600",
  };
  return (
    <div className={cn("rounded-2xl border p-4 space-y-2", colors[color])}>
      <Icon className="w-5 h-5" />
      <p className="text-2xl font-black text-amber-900">{value}</p>
      <div>
        <p className="text-[11px] font-semibold text-amber-800">{label}</p>
        {sub && <p className="text-[10px] text-amber-600/70 mt-0.5">{sub}</p>}
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
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("dismissed_holiday_ids") || "[]"); } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState<"home" | "calendar" | "vocab" | "history">("home");

  // Detect student from URL or use default
  const student = "김민준"; // TODO: auth 연동 시 실제 사용자 이름으로 교체

  const visibleHolidays = holidays.filter(h => h.notify_students && !dismissedIds.includes(h.id));
  const currentPopup = visibleHolidays[0] ?? null;

  const dismissPopup = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    localStorage.setItem("dismissed_holiday_ids", JSON.stringify(next));
  };

  useEffect(() => {
    loadAll();
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("holiday_notices")
      .select("id,title,date_start,date_end,reason,notify_students")
      .gte("date_end", today)
      .order("date_start", { ascending: true });
    setHolidays(data || []);
  };

  const loadAll = async () => {
    setLoading(true);
    const [sessRes, allSessRes, hwRes, subRes, vocRes, testRes] = await Promise.all([
      supabase.from("class_sessions").select("id,scheduled_at,topic,level,meet_link,instructor_name,started_at,ended_at")
        .eq("student_name", student).order("scheduled_at", { ascending: false }).limit(10),
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
    ]);
    setSessions(sessRes.data || []);
    setAllSessions(allSessRes.data || []);
    setAssignments(hwRes.data || []);
    setSubmissions(subRes.data || []);
    setVocabWords(vocRes.data || []);
    setTestHistory(testRes.data || []);
    setLoading(false);
  };

  const getSubmission = (aId: string) => submissions.find(s => s.assignment_id === aId);

  // ── Derived stats ──
  const pastSessions = sessions.filter(s => msUntil(s.scheduled_at) <= 0);
  const nextSession = sessions.find(s => msUntil(s.scheduled_at) > 0);
  const pendingHw = assignments.filter(a => { const sub = getSubmission(a.id); return !sub || sub.status === "pending"; });
  const latestTest = testHistory[0];
  const avgScore = testHistory.length > 0
    ? Math.round(testHistory.reduce((acc, t) => acc + (t.total ? (t.score ?? 0) / t.total : 0), 0) / testHistory.length * 100)
    : null;

  // Class days from first session
  const firstSession = allSessions[0];
  const totalClassDays = pastSessions.length;

  // Vocab by week
  const vocabByWeek = vocabWords.reduce<Record<string, VocabWord[]>>((acc, w) => {
    if (!acc[w.week_label]) acc[w.week_label] = [];
    acc[w.week_label].push(w);
    return acc;
  }, {});
  const vocabWeeks = Object.keys(vocabByWeek).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fffbeb, #fff7ed)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center animate-pulse">
            <Coffee className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-sm text-amber-600 font-medium">대시보드 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #fffbeb 0%, #fff7ed 50%, #fef3c7 100%)" }}>
      {/* ── Holiday Popup ── */}
      {currentPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500 w-full" />
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <BanIcon className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">휴강 공지</p>
                  <p className="font-bold text-gray-800 text-base leading-snug">{currentPopup.title}</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 space-y-2">
                <div className="flex items-center gap-2 text-sm text-amber-800 font-medium">
                  <Calendar className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  {currentPopup.date_start === currentPopup.date_end
                    ? formatDateKo(currentPopup.date_start)
                    : `${formatDateKo(currentPopup.date_start)} ~ ${formatDateKo(currentPopup.date_end)}`}
                </div>
                {currentPopup.reason && (
                  <div className="flex items-start gap-2 text-xs text-amber-600">
                    <Bell className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{currentPopup.reason}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400">해당 기간에는 수업이 진행되지 않습니다.</p>
              <button
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-lg shadow-amber-200 active:scale-[0.98] transition-transform"
                onClick={() => dismissPopup(currentPopup.id)}
              >
                확인했습니다 ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between"
        style={{ background: "rgba(255,251,235,0.85)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-black text-amber-900 text-sm leading-none">더라운지영어</p>
            <p className="text-[10px] text-amber-500 mt-0.5">{student} 님</p>
          </div>
        </div>
        {nextSession?.meet_link && (
          <a href={nextSession.meet_link} target="_blank" rel="noopener noreferrer">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-md shadow-amber-200 active:scale-[0.97] transition-transform">
              <Video className="w-3.5 h-3.5" /> 수업 입장
            </button>
          </a>
        )}
      </header>

      {/* ── Main ── */}
      <main className="max-w-lg mx-auto px-4 pb-28 space-y-6">

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            icon={Video}
            label="수업 입장하기"
            sublabel={nextSession ? fmtDateTime(nextSession.scheduled_at) : "예정된 수업 없음"}
            variant="primary"
            onClick={() => navigate("/classroom")}
          />
          <QuickAction
            icon={RotateCcw}
            label="보강 신청하기"
            sublabel="보강 일정 조율"
            variant="soft"
            onClick={() => navigate("/makeup")}
          />
          <QuickAction
            icon={FileText}
            label="수업 노트"
            sublabel="수업 내용 정리"
            variant="default"
            onClick={() => navigate("/classnote")}
          />
          <QuickAction
            icon={BookOpen}
            label="단어 공부"
            sublabel={`총 ${vocabWords.length}개 단어`}
            variant="default"
            onClick={() => setActiveTab("vocab")}
          />
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={CalendarDays}
            label="수업일수"
            value={totalClassDays}
            sub={firstSession ? `${fmtDate(firstSession.scheduled_at)} 시작` : "아직 없음"}
            color="amber"
          />
          <StatCard
            icon={Activity}
            label="미제출 숙제"
            value={pendingHw.length}
            sub={pendingHw.length === 0 ? "모두 완료!" : `${pendingHw.length}개 남음`}
            color={pendingHw.length > 0 ? "rose" : "green"}
          />
          <StatCard
            icon={Trophy}
            label="평균 점수"
            value={avgScore !== null ? `${avgScore}%` : "-"}
            sub={`총 ${testHistory.length}회`}
            color="orange"
          />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 bg-amber-100 rounded-2xl">
          {[
            { id: "home", label: "홈" },
            { id: "calendar", label: "캘린더" },
            { id: "vocab", label: "단어장" },
            { id: "history", label: "이력" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                activeTab === tab.id
                  ? "bg-white text-amber-700 shadow-sm"
                  : "text-amber-600/70 hover:text-amber-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Home Tab ── */}
        {activeTab === "home" && (
          <div className="space-y-5">
            {/* Next Class */}
            <Section title="다음 수업" icon={Clock}>
              {nextSession ? (
                <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-bold text-amber-900">{nextSession.topic || "수업"}</p>
                      <p className="text-xs text-amber-600">{fmtDateTime(nextSession.scheduled_at)}</p>
                      <p className="text-xs text-amber-500">담당: {nextSession.instructor_name}</p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-bold flex-shrink-0">{nextSession.level}</span>
                  </div>
                  {msUntil(nextSession.scheduled_at) <= 48 * 3600 * 1000 && pendingHw.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <p className="text-xs text-rose-500">수업 전 미제출 숙제 {pendingHw.length}개 남아있어요</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-amber-100 p-5 text-center">
                  <p className="text-sm text-amber-400">예정된 수업이 없습니다</p>
                </div>
              )}
            </Section>

            {/* Homework */}
            <Section title="숙제 현황" icon={Brain} action={
              <span className="text-[10px] text-amber-500 font-medium">{assignments.length}개 전체</span>
            }>
              {assignments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-amber-100 p-5 text-center">
                  <p className="text-sm text-amber-400">배정된 숙제가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignments.slice(0, 4).map((a) => {
                    const sub = getSubmission(a.id);
                    const status = sub?.status || "pending";
                    const meta = HW_META[a.type as HwType];
                    const Icon = meta?.icon ?? Brain;
                    return (
                      <div key={a.id} className={cn(
                        "bg-white rounded-2xl border p-3.5 flex items-center gap-3",
                        status === "reviewed" ? "border-emerald-200"
                          : status === "submitted" ? "border-amber-200"
                          : "border-amber-100"
                      )}>
                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                          status === "reviewed" ? "bg-emerald-50" : status === "submitted" ? "bg-amber-50" : "bg-gray-50"
                        )}>
                          <Icon className={cn("w-4 h-4", meta?.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-amber-900 truncate">{a.title}</p>
                          {a.due_at && <p className="text-[11px] text-amber-500">마감: {fmtDate(a.due_at)}</p>}
                        </div>
                        {status === "reviewed" && <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold flex-shrink-0">검토됨</span>}
                        {status === "submitted" && <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-bold flex-shrink-0">제출됨</span>}
                        {status === "pending" && <span className="text-[10px] px-2 py-1 rounded-full bg-rose-50 text-rose-400 font-bold flex-shrink-0">미제출</span>}
                      </div>
                    );
                  })}
                  {assignments.length > 4 && (
                    <p className="text-center text-xs text-amber-400 pt-1">+{assignments.length - 4}개 더보기</p>
                  )}
                </div>
              )}
            </Section>

            {/* Recent test */}
            {latestTest && (
              <Section title="최근 테스트 결과" icon={Trophy}>
                <div className="bg-white rounded-2xl border border-amber-100 p-4 flex items-center gap-4">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 font-black",
                    latestTest.total && (latestTest.score ?? 0) / latestTest.total >= 0.8
                      ? "bg-emerald-100 text-emerald-700"
                      : latestTest.total && (latestTest.score ?? 0) / latestTest.total >= 0.6
                      ? "bg-amber-100 text-amber-700"
                      : "bg-rose-50 text-rose-500"
                  )}>
                    <span className="text-xl">{latestTest.score}</span>
                    <span className="text-[10px] opacity-70">/{latestTest.total}</span>
                  </div>
                  <div>
                    <p className="font-bold text-amber-900">{fmtWeek(latestTest.week_label)}</p>
                    <p className="text-xs text-amber-500 mt-0.5">
                      {latestTest.total ? Math.round(((latestTest.score ?? 0) / latestTest.total) * 100) : 0}% 정답률
                    </p>
                    {latestTest.completed_at && (
                      <p className="text-[10px] text-amber-400 mt-1">{fmtDate(latestTest.completed_at)}</p>
                    )}
                  </div>
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ── Calendar Tab ── */}
        {activeTab === "calendar" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
              <MiniCalendar sessions={allSessions} holidays={holidays} />
            </div>
            {/* Upcoming sessions */}
            <Section title="예정 수업" icon={CalendarDays}>
              {sessions.filter(s => msUntil(s.scheduled_at) > 0).length === 0 ? (
                <div className="bg-white rounded-2xl border border-amber-100 p-5 text-center">
                  <p className="text-sm text-amber-400">예정된 수업이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.filter(s => msUntil(s.scheduled_at) > 0).map(s => (
                    <div key={s.id} className="bg-white rounded-2xl border border-amber-100 p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-amber-600">{new Date(s.scheduled_at).getMonth() + 1}월</span>
                        <span className="text-sm font-black text-amber-900">{new Date(s.scheduled_at).getDate()}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-amber-900 text-sm">{s.topic || "수업"}</p>
                        <p className="text-[11px] text-amber-500">{new Date(s.scheduled_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · {s.level}</p>
                      </div>
                      {s.meet_link && (
                        <a href={s.meet_link} target="_blank" rel="noopener noreferrer">
                          <button className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
                            <Video className="w-4 h-4 text-orange-500" />
                          </button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ── Vocab Tab ── */}
        {activeTab === "vocab" && (
          <div className="space-y-4">
            {vocabWords.length === 0 ? (
              <div className="bg-white rounded-2xl border border-amber-100 p-8 text-center">
                <BookOpen className="w-8 h-8 text-amber-300 mx-auto mb-2" />
                <p className="text-sm text-amber-400">등록된 단어가 없습니다</p>
              </div>
            ) : (
              vocabWeeks.map(week => {
                const words = vocabByWeek[week];
                return (
                  <div key={week} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-amber-700">{fmtWeek(week)}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">{words.length}개</span>
                    </div>
                    <div className="space-y-1.5">
                      {words.map(w => (
                        <div key={w.id} className="bg-white rounded-xl border border-amber-100 px-4 py-3 flex items-center gap-3">
                          <TTSButton word={w} />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-amber-900 text-sm">{w.english_word}</span>
                            {w.part_of_speech && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">{w.part_of_speech}</span>
                            )}
                          </div>
                          <span className="text-sm text-amber-600">{w.korean_meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === "history" && (
          <div className="space-y-5">
            {/* Test history */}
            <Section title="테스트 이력" icon={Trophy} action={
              <span className="text-[10px] text-amber-500">{testHistory.length}회</span>
            }>
              {testHistory.length === 0 ? (
                <div className="bg-white rounded-2xl border border-amber-100 p-5 text-center">
                  <p className="text-sm text-amber-400">완료된 테스트가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {testHistory.map(t => {
                    const pct = t.total ? Math.round(((t.score ?? 0) / t.total) * 100) : 0;
                    return (
                      <div key={t.id} className="bg-white rounded-2xl border border-amber-100 p-4 flex items-center gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-black text-xs",
                          pct >= 80 ? "bg-emerald-100 text-emerald-700"
                            : pct >= 60 ? "bg-amber-100 text-amber-700"
                            : "bg-rose-50 text-rose-500"
                        )}>
                          {pct}%
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-amber-900 text-sm">{fmtWeek(t.week_label)}</p>
                          <p className="text-[11px] text-amber-500">{t.score}/{t.total}점</p>
                        </div>
                        {t.completed_at && (
                          <p className="text-[10px] text-amber-400">{fmtDate(t.completed_at)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Session history */}
            <Section title="수업 이력" icon={TrendingUp} action={
              <span className="text-[10px] text-amber-500">총 {totalClassDays}회</span>
            }>
              {pastSessions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-amber-100 p-5 text-center">
                  <p className="text-sm text-amber-400">수업 이력이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pastSessions.map((s, idx) => (
                    <div key={s.id} className="bg-white rounded-2xl border border-amber-100 p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-black text-amber-500">#{totalClassDays - idx}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-amber-900 text-sm truncate">{s.topic || "수업"}</p>
                        <p className="text-[11px] text-amber-500">{fmtDateTime(s.scheduled_at)} · {s.level}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-4 pt-2"
        style={{ background: "linear-gradient(to top, rgba(255,251,235,0.98) 80%, transparent)" }}
      >
        <div className="max-w-lg mx-auto bg-white rounded-2xl border border-amber-100 shadow-xl shadow-amber-100/50 flex">
          {[
            { id: "home", label: "홈", icon: Home },
            { id: "calendar", label: "캘린더", icon: Calendar },
            { id: "vocab", label: "단어장", icon: BookOpen },
            { id: "history", label: "이력", icon: TrendingUp },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as typeof activeTab)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl transition-all",
                activeTab === item.id ? "text-amber-600" : "text-amber-300"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
