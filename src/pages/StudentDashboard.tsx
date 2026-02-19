import { useState, useEffect, useRef } from "react";
import {
  BookOpen, CheckSquare, Trophy, Calendar, Video,
  ChevronDown, ChevronUp, Clock, Check, X, Volume2,
  Loader2, Square, RotateCcw, MessageSquare, PenLine,
  Mic, Brain, ExternalLink, Star, TrendingUp, AlertCircle,
  BanIcon, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
const STUDENTS = ["김민준", "이서연", "박지호"];
const CURRENT_STUDENT = "김민준";

interface HolidayNotice {
  id: string;
  title: string;
  date_start: string;
  date_end: string;
  reason: string | null;
  notify_students: boolean;
}

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
function formatDateKo(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS_KO[d.getDay()]})`;
}

type HwType = "writing" | "reading" | "speaking" | "memorizing";

interface ClassSession {
  id: string;
  scheduled_at: string;
  topic: string | null;
  level: string;
  meet_link: string | null;
  instructor_name: string;
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

// ── Helpers ────────────────────────────────────────────────────────────────────
const HW_META: Record<HwType, { label: string; icon: React.ElementType; color: string }> = {
  writing:    { label: "쓰기",   icon: PenLine,  color: "text-navy" },
  reading:    { label: "읽기",   icon: BookOpen, color: "text-gold-dark" },
  speaking:   { label: "말하기", icon: Mic,      color: "text-success" },
  memorizing: { label: "외우기", icon: Brain,    color: "text-purple-500" },
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

function RelativeTime({ iso }: { iso: string }) {
  const ms = msUntil(iso);
  const abs = Math.abs(ms);
  const past = ms < 0;
  const h = Math.floor(abs / 3600000);
  const d = Math.floor(abs / 86400000);
  if (abs < 3600000) return <span className={past ? "text-muted-foreground" : "text-destructive font-semibold"}>{past ? `${Math.floor(abs / 60000)}분 전` : `${Math.floor(abs / 60000)}분 후`}</span>;
  if (abs < 86400000) return <span className={past ? "text-muted-foreground" : "text-gold-dark font-semibold"}>{past ? `${h}시간 전` : `${h}시간 후`}</span>;
  return <span className="text-muted-foreground">{past ? `${d}일 전` : `${d}일 후`}</span>;
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

// ── Section Card ───────────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, count, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-navy/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-navy" />
        </div>
        <span className="font-semibold text-sm text-foreground flex-1 text-left">{title}</span>
        {count !== undefined && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{count}</span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </div>
  );
}

// ── Student Selector ───────────────────────────────────────────────────────────
function StudentSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {STUDENTS.map((s) => (
        <button key={s} onClick={() => onChange(s)}
          className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
            value === s
              ? "bg-navy text-primary-foreground border-navy"
              : "bg-card text-muted-foreground border-border hover:border-navy/40"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { toast } = useToast();
  const [student, setStudent] = useState(CURRENT_STUDENT);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [vocabWords, setVocabWords] = useState<VocabWord[]>([]);
  const [testHistory, setTestHistory] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<HolidayNotice[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("dismissed_holiday_ids") || "[]"); } catch { return []; }
  });

  const visibleHolidays = holidays.filter(
    (h) => h.notify_students && !dismissedIds.includes(h.id)
  );
  const [popupIndex, setPopupIndex] = useState(0);
  const currentPopup = visibleHolidays[popupIndex] ?? null;

  const dismissPopup = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    localStorage.setItem("dismissed_holiday_ids", JSON.stringify(next));
    setPopupIndex((i) => i); // stay, next one will show
  };

  useEffect(() => {
    loadAll(student);
    loadHolidays();
  }, [student]);

  const loadHolidays = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("holiday_notices")
      .select("id,title,date_start,date_end,reason,notify_students")
      .gte("date_end", today)
      .order("date_start", { ascending: true });
    setHolidays(data || []);
  };

  const loadAll = async (name: string) => {
    setLoading(true);
    const [sessRes, hwRes, subRes, vocRes, testRes] = await Promise.all([
      supabase.from("class_sessions").select("id,scheduled_at,topic,level,meet_link,instructor_name")
        .eq("student_name", name).order("scheduled_at", { ascending: false }).limit(5),
      supabase.from("homework_assignments").select("id,title,description,type,due_at,is_preset")
        .eq("student_name", name).order("created_at", { ascending: false }),
      supabase.from("homework_submissions").select("id,assignment_id,status,text_content,audio_url,instructor_note,reviewed_at")
        .eq("student_name", name),
      supabase.from("vocabulary_words").select("id,english_word,korean_meaning,part_of_speech,audio_url,week_label")
        .eq("student_name", name).order("week_label", { ascending: false }).order("created_at", { ascending: true }),
      supabase.from("vocabulary_tests").select("id,week_label,type,score,total,completed_at")
        .eq("student_name", name).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(10),
    ]);
    setSessions(sessRes.data || []);
    setAssignments(hwRes.data || []);
    setSubmissions(subRes.data || []);
    setVocabWords(vocRes.data || []);
    setTestHistory(testRes.data || []);
    setLoading(false);
  };

  const getSubmission = (aId: string) => submissions.find((s) => s.assignment_id === aId);

  // ── Derived stats ──
  const nextSession = sessions.find((s) => msUntil(s.scheduled_at) > 0);
  const lastSession = sessions.find((s) => msUntil(s.scheduled_at) <= 0);
  const pendingHw = assignments.filter((a) => {
    const sub = getSubmission(a.id);
    return !sub || sub.status === "pending";
  });
  const reviewedHw = assignments.filter((a) => getSubmission(a.id)?.status === "reviewed");
  const submittedHw = assignments.filter((a) => getSubmission(a.id)?.status === "submitted");

  // Group vocab by week
  const vocabByWeek = vocabWords.reduce<Record<string, VocabWord[]>>((acc, w) => {
    if (!acc[w.week_label]) acc[w.week_label] = [];
    acc[w.week_label].push(w);
    return acc;
  }, {});
  const vocabWeeks = Object.keys(vocabByWeek).sort((a, b) => b.localeCompare(a));

  // Latest test score
  const latestTest = testHistory[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Holiday Popup ── */}
      {currentPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
            {/* Top stripe */}
            <div className="h-1.5 bg-destructive w-full" />
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <BanIcon className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide mb-0.5">휴강 공지</p>
                  <p className="font-bold text-foreground text-base leading-snug">{currentPopup.title}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground font-medium">
                    {currentPopup.date_start === currentPopup.date_end
                      ? formatDateKo(currentPopup.date_start)
                      : `${formatDateKo(currentPopup.date_start)} ~ ${formatDateKo(currentPopup.date_end)}`}
                  </span>
                </div>
                {currentPopup.reason && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Bell className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{currentPopup.reason}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                해당 기간에는 수업이 진행되지 않습니다. 문의사항이 있으시면 담당 강사에게 연락해 주세요.
              </p>
              <Button
                className="w-full h-10 bg-navy hover:bg-navy-light text-primary-foreground font-semibold"
                onClick={() => dismissPopup(currentPopup.id)}
              >
                확인했습니다
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
            <Star className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">학생 대시보드</p>
            <p className="text-[10px] text-muted-foreground">{student}</p>
          </div>
        </div>
        <StudentSelector value={student} onChange={setStudent} />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── Summary Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "미제출 숙제",
              value: pendingHw.length,
              icon: CheckSquare,
              color: pendingHw.length > 0 ? "text-destructive" : "text-success",
              bg: pendingHw.length > 0 ? "bg-destructive/10" : "bg-success/10",
            },
            {
              label: "이번 주 단어",
              value: vocabWeeks[0] ? (vocabByWeek[vocabWeeks[0]]?.length ?? 0) : 0,
              icon: BookOpen,
              color: "text-navy",
              bg: "bg-navy/10",
            },
            {
              label: "최근 테스트",
              value: latestTest ? `${latestTest.score}/${latestTest.total}` : "-",
              icon: Trophy,
              color: latestTest && latestTest.score != null && latestTest.total != null && latestTest.score / latestTest.total >= 0.8 ? "text-success" : "text-gold-dark",
              bg: "bg-gold/10",
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", bg)}>
                <Icon className={cn("w-4 h-4", color)} />
              </div>
              <p className={cn("text-xl font-bold", color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Next Class ── */}
        <SectionCard title="다음 수업" icon={Calendar}>
          {nextSession ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{nextSession.topic || "수업"}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(nextSession.scheduled_at)}</p>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <RelativeTime iso={nextSession.scheduled_at} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{nextSession.level}</span>
                  {nextSession.meet_link && (
                    <a href={nextSession.meet_link} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="h-8 text-xs gap-1.5 bg-navy hover:bg-navy-light text-primary-foreground">
                        <Video className="w-3 h-3" /> 수업 입장
                      </Button>
                    </a>
                  )}
                </div>
              </div>
              {/* 48h warning */}
              {msUntil(nextSession.scheduled_at) <= 48 * 3600 * 1000 && pendingHw.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                  <p className="text-xs text-destructive">수업 48시간 전 — 미제출 숙제 {pendingHw.length}개 남아있습니다</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">예정된 수업이 없습니다</p>
          )}
        </SectionCard>

        {/* ── Homework ── */}
        <SectionCard title="숙제" icon={CheckSquare} count={assignments.length}>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">배정된 숙제가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => {
                const sub = getSubmission(a.id);
                const status = sub?.status || "pending";
                const meta = HW_META[a.type as HwType];
                const Icon = meta?.icon ?? CheckSquare;
                return (
                  <div key={a.id} className={cn(
                    "rounded-xl border p-3.5 space-y-2 transition-all",
                    status === "reviewed" ? "border-success/30 bg-success/5"
                      : status === "submitted" ? "border-gold/30 bg-gold/5"
                      : "border-border bg-muted/20"
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", meta?.color)} />
                        <span className="text-sm font-medium text-foreground">{a.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {status === "reviewed" && <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium"><Check className="w-2.5 h-2.5" />검토됨</span>}
                        {status === "submitted" && <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gold/15 text-gold-dark font-medium"><Clock className="w-2.5 h-2.5" />제출됨</span>}
                        {status === "pending" && <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium"><X className="w-2.5 h-2.5" />미제출</span>}
                      </div>
                    </div>
                    {a.due_at && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> 마감: {fmtDate(a.due_at)}
                      </p>
                    )}
                    {sub?.instructor_note && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-success/8 border border-success/20">
                        <MessageSquare className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-foreground">{sub.instructor_note}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ── Vocabulary ── */}
        <SectionCard title="단어장" icon={BookOpen} count={vocabWords.length}>
          {vocabWords.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 단어가 없습니다</p>
          ) : (
            <div className="space-y-4">
              {vocabWeeks.map((week) => {
                const words = vocabByWeek[week];
                return (
                  <WeekVocabGroup key={week} week={week} words={words} />
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ── Test History ── */}
        <SectionCard title="테스트 이력" icon={Trophy} count={testHistory.length} defaultOpen={false}>
          {testHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">완료된 테스트가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {testHistory.map((t) => {
                const pct = t.total ? Math.round(((t.score ?? 0) / t.total) * 100) : 0;
                return (
                  <div key={t.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border bg-muted/20">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                      pct >= 80 ? "bg-success/15 text-success" : pct >= 60 ? "bg-gold/15 text-gold-dark" : "bg-destructive/10 text-destructive"
                    )}>
                      {pct}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{fmtWeek(t.week_label)}</p>
                      <p className="text-[11px] text-muted-foreground">{t.score}/{t.total}점 · 텍스트</p>
                    </div>
                    {t.completed_at && (
                      <p className="text-[10px] text-muted-foreground flex-shrink-0">{fmtDate(t.completed_at)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ── Past Sessions ── */}
        <SectionCard title="수업 이력" icon={TrendingUp} count={sessions.filter(s => msUntil(s.scheduled_at) <= 0).length} defaultOpen={false}>
          {sessions.filter(s => msUntil(s.scheduled_at) <= 0).length === 0 ? (
            <p className="text-sm text-muted-foreground">수업 이력이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {sessions.filter(s => msUntil(s.scheduled_at) <= 0).map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border bg-muted/20">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.topic || "수업"}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtDateTime(s.scheduled_at)} · {s.level}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

      </main>
    </div>
  );
}

// ── Week Vocab Group ───────────────────────────────────────────────────────────
function WeekVocabGroup({ week, words }: { week: string; words: VocabWord[] }) {
  const [open, setOpen] = useState(true);

  const fmtWeekLabel = (label: string) =>
    label.replace(/(\d{4})-W(\d{2})/, (_, y, w) => `${y}년 ${parseInt(w)}주차`);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full group"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{fmtWeekLabel(week)}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{words.length}개</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-1.5">
          {words.map((w) => (
            <div key={w.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
              <TTSButton word={w} />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-foreground">{w.english_word}</span>
                {w.part_of_speech && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{w.part_of_speech}</span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{w.korean_meaning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
