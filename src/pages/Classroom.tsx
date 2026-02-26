import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Video, VideoOff, Clock, FileText, CheckSquare,
  Sparkles, ExternalLink, ChevronDown, ChevronUp,
  Plus, ArrowLeft, Wifi, WifiOff,
  PenLine, BookOpen, Mic, Brain, X, Pencil, Check, Edit3, BookMarked,
  Bold, Heading1, Heading2, Heading3, Minus, Table2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import InstructorSTTPanel from "@/components/classroom/InstructorSTTPanel";
import WordLookupPanel from "@/components/classroom/WordLookupPanel";
import StudentVocabPanel from "@/components/classroom/StudentVocabPanel";
import StudentHomeworkPanel from "@/components/classroom/StudentHomeworkPanel";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ClassState = "pre" | "ready" | "active" | "ended";
type Role = "instructor" | "student";
type HwType = "writing" | "reading" | "speaking" | "memorizing";

interface HomeworkItem {
  id: string;
  type: HwType;
  title: string;
  description: string;
  isPreset: boolean;
  saved: boolean;
}

const HW_TYPE_META: Record<HwType, { label: string; icon: React.ElementType; color: string; hint: string }> = {
  writing:    { label: "쓰기",   icon: PenLine,  color: "text-[hsl(var(--navy))]",      hint: "텍스트 작성 필수" },
  reading:    { label: "읽기",   icon: BookOpen, color: "text-[hsl(var(--gold-dark))]", hint: "녹음 선택" },
  speaking:   { label: "말하기", icon: Mic,      color: "text-[hsl(var(--success))]",   hint: "녹음 필수 / 텍스트 선택" },
  memorizing: { label: "외우기", icon: Brain,    color: "text-purple-500",              hint: "녹음 선택 (대화문 등)" },
};

function getWeekLabel(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function formatDate(date = new Date()) {
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

interface SessionData {
  sessionId: string;
  studentName: string;
  instructorName: string;
  level: string;
  scheduledAt: Date;
  meetLink: string;
  topic: string;
}

const DEFAULT_SESSION: SessionData = {
  sessionId: "",
  studentName: "",
  instructorName: "Reina",
  level: "B1",
  scheduledAt: new Date(),
  meetLink: "",
  topic: "",
};

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Classroom() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const urlSessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<SessionData>(DEFAULT_SESSION);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);

  // Load session from DB if sessionId provided
  useEffect(() => {
    const loadSession = async () => {
      let sessionData: any = null;
      if (!urlSessionId) {
        // Try to get student_name from auth session for filtering
        let studentNameFilter: string | null = null;
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (authSession) {
          const { data: profile } = await supabase
            .from("student_profiles")
            .select("student_name")
            .eq("user_id", authSession.user.id)
            .maybeSingle();
          if (profile?.student_name) studentNameFilter = profile.student_name;
        }

        let query = supabase
          .from("class_sessions")
          .select("id,student_name,instructor_name,level,scheduled_at,meet_link,topic")
          .order("scheduled_at", { ascending: false })
          .limit(1);
        if (studentNameFilter) {
          query = query.eq("student_name", studentNameFilter);
        }
        const { data } = await query.maybeSingle();
        sessionData = data;
      } else {
        const { data } = await supabase
          .from("class_sessions")
          .select("id,student_name,instructor_name,level,scheduled_at,meet_link,topic")
          .eq("id", urlSessionId)
          .single();
        sessionData = data;
      }
      if (sessionData) {
        setSession({
          sessionId: sessionData.id,
          studentName: sessionData.student_name,
          instructorName: sessionData.instructor_name,
          level: sessionData.level,
          scheduledAt: new Date(sessionData.scheduled_at),
          meetLink: sessionData.meet_link || "",
          topic: sessionData.topic || "",
        });
        const { count } = await supabase
          .from("class_sessions")
          .select("id", { count: "exact", head: true })
          .eq("student_name", sessionData.student_name)
          .lte("scheduled_at", sessionData.scheduled_at);
        setSessionNumber(count ?? null);
      }
      setSessionLoading(false);
    };
    loadSession();
  }, [urlSessionId]);

  const urlRole = searchParams.get("role") as Role | null;
  const [role, setRole] = useState<Role>(urlRole === "student" ? "student" : "instructor");
  const [classState, setClassState] = useState<ClassState>("ready");
  const [meetConnected, setMeetConnected] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [notes, setNotes] = useState("");
  const [notesEditMode, setNotesEditMode] = useState(true);
  const [hwList, setHwList] = useState<HomeworkItem[]>([]);
  const [hwOpen, setHwOpen] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [sessionTopic, setSessionTopic] = useState("");
  const [generatingObjectives, setGeneratingObjectives] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  const applyFormat = useCallback((type: "bold" | "h1" | "h2" | "h3" | "hr" | "table") => {
    const el = notesRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = notes.slice(start, end);
    let newText = notes;
    let newStart = start;
    let newEnd = end;

    if (type === "bold") {
      const replacement = `**${selected || "텍스트"}**`;
      newText = notes.slice(0, start) + replacement + notes.slice(end);
      newStart = start + 2;
      newEnd = newStart + (selected || "텍스트").length;
    } else if (type === "h1" || type === "h2" || type === "h3") {
      const prefix = type === "h1" ? "# " : type === "h2" ? "## " : "### ";
      const lineStart = notes.lastIndexOf("\n", start - 1) + 1;
      newText = notes.slice(0, lineStart) + prefix + notes.slice(lineStart);
      newStart = start + prefix.length;
      newEnd = end + prefix.length;
    } else if (type === "hr") {
      const ins = "\n\n---\n\n";
      newText = notes.slice(0, end) + ins + notes.slice(end);
      newStart = newEnd = end + ins.length;
    } else if (type === "table") {
      const ins = "\n\n| 열1 | 열2 | 열3 |\n| --- | --- | --- |\n| 내용 | 내용 | 내용 |\n\n";
      newText = notes.slice(0, end) + ins + notes.slice(end);
      newStart = newEnd = end + ins.length;
    }

    setNotes(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(newStart, newEnd);
    }, 0);
  }, [notes]);

  const [addingHw, setAddingHw] = useState(false);
  const [newHwType, setNewHwType] = useState<HwType>("writing");
  const [newHwTitle, setNewHwTitle] = useState("");
  const [newHwDesc, setNewHwDesc] = useState("");
  const [savingHw, setSavingHw] = useState(false);

  const [editingHwId, setEditingHwId] = useState<string | null>(null);
  const [editHwType, setEditHwType] = useState<HwType>("writing");
  const [editHwTitle, setEditHwTitle] = useState("");
  const [editHwDesc, setEditHwDesc] = useState("");
  const [savingEditHw, setSavingEditHw] = useState(false);

  useEffect(() => {
    if (sessionLoading || !session.sessionId) return;
    const loadData = async () => {
      const { data: sessionData } = await supabase
        .from("class_sessions").select("notes").eq("id", session.sessionId).single();
      if (sessionData?.notes) setNotes(sessionData.notes);

      const { data } = await supabase
        .from("homework_assignments").select("*")
        .eq("student_name", session.studentName)
        .or(`session_id.eq.${session.sessionId},is_preset.eq.true`)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        setHwList(data.map((d) => ({
          id: d.id, type: d.type as HwType, title: d.title,
          description: d.description || "", isPreset: true, saved: true,
        })));
      }
      setSessionTopic(session.topic);
    };
    loadData();
  }, [session.sessionId, sessionLoading]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (classState === "active") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [classState]);

  const msUntilClass = session.scheduledAt.getTime() - now;

  const handleStartClass = () => {
    setClassState("active");
    if (session.meetLink) window.open(session.meetLink, "_blank", "noopener,noreferrer");
    setMeetConnected(true);
  };

  const handleEndClass = () => { setClassState("ended"); setMeetConnected(false); };
  const handleJoinMeet = () => { if (session.meetLink) window.open(session.meetLink, "_blank", "noopener,noreferrer"); setMeetConnected(true); };

  const handleSave = async () => {
    if (!notes.trim()) return;
    const { error } = await supabase.from("class_sessions")
      .update({ notes: notes.trim() }).eq("id", session.sessionId);
    if (error) { toast({ title: "저장 실패", description: error.message, variant: "destructive" }); return; }
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
    toast({ title: "노트가 저장됐습니다 ✓" });

    setGeneratingObjectives(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-objectives", {
        body: { notes: notes.trim(), topic: session.topic },
      });
      if (!fnError && data?.objectives?.length > 0) {
        setObjectives(data.objectives);
        if (data.topic) setSessionTopic(data.topic);
      }
    } catch { /* silent */ } finally { setGeneratingObjectives(false); }
  };

  const handleExtractVocab = async () => {
    if (!notes.trim()) return;
    setExtracting(true);
    const weekLabel = getWeekLabel();
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-vocab`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ notes, studentName: session.studentName, weekLabel, sessionId: session.sessionId }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "추출 실패", description: data.error ?? "오류", variant: "destructive" }); return; }
      if (data.inserted === 0) {
        toast({ title: data.message ?? "새로운 단어가 없습니다.", description: "이미 단어장에 추가된 단어들입니다." });
      } else {
        toast({ title: `단어 ${data.inserted}개 추출 완료 ✓`, description: `${weekLabel} 단어장에 추가됐습니다.` });
        setExtracted(true);
      }
    } catch { toast({ title: "네트워크 오류", description: "다시 시도해주세요.", variant: "destructive" }); }
    finally { setExtracting(false); }
  };

  const handleAddHw = async () => {
    if (!newHwTitle.trim()) return;
    setSavingHw(true);
    const { data, error } = await supabase.from("homework_assignments").insert({
      student_name: session.studentName, title: newHwTitle.trim(),
      description: newHwDesc.trim() || null, type: newHwType, is_preset: false,
    }).select().single();
    if (!error && data) {
      setHwList((prev) => [...prev, { id: data.id, type: newHwType, title: newHwTitle.trim(), description: newHwDesc.trim(), isPreset: false, saved: true }]);
      toast({ title: "숙제가 추가됐습니다 ✓" });
    }
    setNewHwTitle(""); setNewHwDesc(""); setNewHwType("writing");
    setAddingHw(false); setSavingHw(false);
  };

  const removeHw = async (id: string) => {
    await supabase.from("homework_assignments").delete().eq("id", id);
    setHwList((prev) => prev.filter((h) => h.id !== id));
  };

  const startEditHw = (hw: HomeworkItem) => { setEditingHwId(hw.id); setEditHwType(hw.type); setEditHwTitle(hw.title); setEditHwDesc(hw.description); setAddingHw(false); };
  const cancelEditHw = () => { setEditingHwId(null); setEditHwTitle(""); setEditHwDesc(""); };

  const handleSaveEditHw = async () => {
    if (!editHwTitle.trim() || !editingHwId) return;
    setSavingEditHw(true);
    const { error } = await supabase.from("homework_assignments")
      .update({ type: editHwType, title: editHwTitle.trim(), description: editHwDesc.trim() || null })
      .eq("id", editingHwId);
    if (!error) {
      setHwList((prev) => prev.map((h) => h.id === editingHwId ? { ...h, type: editHwType, title: editHwTitle.trim(), description: editHwDesc.trim() } : h));
      toast({ title: "숙제가 수정됐습니다 ✓" });
    }
    setSavingEditHw(false);
    cancelEditHw();
  };

  const isDisabled = classState === "pre";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header className="sidebar-gradient text-sidebar-foreground px-4 py-3 flex items-center gap-4 shadow-lg">
        <a href={urlRole === "student" ? "/my/dashboard" : "/"} className="flex items-center gap-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{urlRole === "student" ? "돌아가기" : "어드민"}</span>
        </a>
        <div className="w-px h-5 bg-sidebar-border" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sidebar-accent-foreground text-sm">{session.studentName}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground font-medium">{session.level}</span>
            {sessionNumber && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gold/20 text-gold font-bold">{sessionNumber}주차</span>
            )}
            <span className="text-sidebar-foreground/60 text-xs hidden sm:inline">with {session.instructorName}</span>
            {sessionTopic && <span className="text-gold text-xs hidden md:inline">· {sessionTopic}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {objectives.map((obj, i) => (
              <span key={i} className="text-sidebar-foreground/60 text-xs hidden lg:inline">
                <span className="text-gold/70 font-medium">{i + 1}.</span> {obj}
                {i < objectives.length - 1 && <span className="text-sidebar-foreground/30 mx-1.5">|</span>}
              </span>
            ))}
            {objectives.length === 0 && (
              <span className="text-sidebar-foreground/40 text-xs hidden lg:inline italic">
                {generatingObjectives ? "수업목표 생성 중..." : "노트 저장 시 수업목표가 자동 생성됩니다"}
              </span>
            )}
            <span className="text-sidebar-foreground/40 text-xs font-mono hidden sm:inline">
              · {formatDate()} {formatTime(session.scheduledAt)}
            </span>
          </div>
        </div>

        <div className="flex gap-1 p-0.5 bg-sidebar-accent rounded-lg">
          {(["instructor", "student"] as Role[]).map((r) => {
            const isLocked = urlRole === "student" && r === "instructor";
            return (
              <button key={r} onClick={() => !isLocked && setRole(r)}
                disabled={isLocked}
                className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  role === r ? "bg-gold text-accent-foreground" : "text-sidebar-foreground hover:text-sidebar-accent-foreground",
                  isLocked && "opacity-40 cursor-not-allowed")}
              >
                {r === "instructor" ? "강사" : "학생"}
              </button>
            );
          })}
        </div>

        {meetConnected && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/20 border border-success/30">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-success hidden sm:inline">Meet 연결됨</span>
          </div>
        )}

        {classState === "active" && (
          <div className="flex items-center gap-1.5 text-gold font-mono text-sm font-bold">
            <Clock className="w-4 h-4" />{formatDuration(elapsed)}
          </div>
        )}

        {classState === "pre" && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-sidebar-foreground/60">
              수업까지 <span className="text-gold font-mono font-bold">{formatCountdown(msUntilClass)}</span>
            </div>
            <Button size="sm" disabled className="h-8 text-xs bg-sidebar-accent/50 text-sidebar-foreground/40 cursor-not-allowed">
              수업 시작 (10분 전 활성)
            </Button>
          </div>
        )}

        {classState === "ready" && (
          <Button size="sm" onClick={handleStartClass}
            className="h-8 text-xs gold-gradient text-accent-foreground font-bold shadow-gold hover:opacity-90 gap-1.5"
          >
            <Video className="w-3.5 h-3.5" />수업 시작
          </Button>
        )}

        {classState === "active" && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleJoinMeet}
              className="h-8 text-xs border-gold/50 text-gold hover:bg-gold/10 gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Meet 재접속</span>
            </Button>
            {role === "instructor" && (
              <Button size="sm" onClick={handleEndClass}
                className="h-8 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
              >
                <VideoOff className="w-3.5 h-3.5" />수업 종료
              </Button>
            )}
          </div>
        )}

        {classState === "ended" && (
          <span className="text-xs text-sidebar-foreground/60">수업 종료 · {formatDuration(elapsed)}</span>
        )}
      </header>

      {/* ── MEET STATUS BANNER ───────────────────────────────────────────── */}
      {classState === "ready" && (
        <div className="bg-gold/5 border-b border-gold/20 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <WifiOff className="w-4 h-4 text-gold-dark" />
            <span className="text-gold-dark font-medium text-sm">수업 시작 버튼을 누르면 Google Meet가 자동으로 열립니다</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono hidden md:inline">{session.meetLink}</span>
        </div>
      )}

      {classState === "active" && meetConnected && (
        <div className="bg-success/8 border-b border-success/20 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-success" />
            <span className="text-success font-medium text-sm">Google Meet 수업 진행 중</span>
            <span className="text-xs text-muted-foreground hidden md:inline">— Meet는 새 탭에 열려 있습니다.</span>
          </div>
          <button onClick={handleJoinMeet} className="flex items-center gap-1.5 text-xs text-success hover:underline">
            <ExternalLink className="w-3 h-3" />
            <span className="hidden md:inline">{session.meetLink}</span>
            <span className="md:hidden">Meet 재접속</span>
          </button>
        </div>
      )}

      {/* ── ENDED BANNER ────────────────────────────────────────────────── */}
      {classState === "ended" && (
        <div className="bg-muted/60 border-b border-border px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm text-muted-foreground">
            수업이 종료되었습니다. 총 수업 시간: <span className="font-bold text-foreground">{formatDuration(elapsed)}</span>
          </span>
          <Button size="sm" onClick={handleExtractVocab} disabled={extracting || extracted || !notes.trim()}
            className="gap-2 bg-navy hover:bg-navy-light text-primary-foreground text-xs h-8"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {extracting ? "AI 단어 추출 중..." : extracted ? "단어 추출 완료 ✓" : "수업 노트에서 단어 추출"}
          </Button>
        </div>
      )}

      {/* ── PRE-CLASS OVERLAY ─────────────────────────────────────────────── */}
      {classState === "pre" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-navy/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-navy" />
            </div>
            <p className="text-lg font-bold text-foreground">수업 준비 중</p>
            <p className="text-muted-foreground text-sm mt-1">수업 시작 10분 전부터 입장할 수 있습니다</p>
            <p className="text-4xl font-mono font-bold text-gold mt-4">{formatCountdown(msUntilClass)}</p>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      {classState !== "pre" && (
        <div className="flex-1 flex gap-5 px-4 py-5 max-w-7xl w-full mx-auto">

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          {role === "student" ? (
            <div className="flex-1 flex flex-col gap-5 min-w-0">
              {/* 수업 노트 (읽기 전용) */}
              <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/30">
                  <FileText className="w-4 h-4 text-gold" />
                  <span className="font-semibold text-sm text-foreground">수업 노트</span>
                </div>
                <Textarea
                  value={notes}
                  readOnly
                  placeholder="강사가 수업 노트를 작성하면 여기에 표시됩니다."
                  className="h-[420px] resize-none text-sm leading-relaxed border-0 focus-visible:ring-0 bg-transparent p-4 rounded-none overflow-y-auto cursor-default text-muted-foreground"
                />
              </div>
              {/* 숙제 */}
              <StudentHomeworkPanel studentName={session.studentName} sessionId={session.sessionId} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-5 min-w-0">

              {/* ── NOTES ─────────────────────────────────────────────── */}
              <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gold" />
                    <span className="font-semibold text-sm text-foreground">수업 노트</span>
                    {classState === "active" && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={handleExtractVocab}
                      disabled={isDisabled || extracting || !notes.trim()}
                      className={cn("h-7 text-xs gap-1.5 transition-all border-navy/30 text-navy hover:bg-navy/10", extracted && "border-success/40 text-success")}
                    >
                      <BookMarked className="w-3 h-3" />
                      {extracting ? "추출 중..." : extracted ? "단어 추출됨 ✓" : "단어 추출"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setNotesEditMode((v) => !v)} disabled={isDisabled}
                      className={cn("h-7 text-xs gap-1.5 transition-all",
                        notesEditMode ? "border-gold/50 text-gold hover:bg-gold/10" : "border-muted-foreground/30 text-muted-foreground hover:bg-muted")}
                    >
                      {notesEditMode ? <><Edit3 className="w-3 h-3" />편집 중</> : <><Pencil className="w-3 h-3" />편집</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleSave} disabled={isDisabled || !notes.trim()}
                      className={cn("h-7 text-xs gap-1.5 transition-all", saveFlash && "border-success text-success")}
                    >
                      <BookMarked className="w-3 h-3" style={{ display: "none" }} />
                      {saveFlash ? "저장됨 ✓" : "저장"}
                    </Button>
                  </div>
                </div>
                {/* ── Formatting toolbar ── */}
                {notesEditMode && !isDisabled && (
                  <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border bg-muted/20 flex-wrap">
                    {([
                      { type: "bold" as const, icon: Bold, label: "굵게 (Ctrl+B)" },
                      { type: "h1" as const, icon: Heading1, label: "제목 1" },
                      { type: "h2" as const, icon: Heading2, label: "제목 2" },
                      { type: "h3" as const, icon: Heading3, label: "제목 3" },
                      { type: "hr" as const, icon: Minus, label: "구분선" },
                      { type: "table" as const, icon: Table2, label: "표 삽입" },
                    ] as const).map(({ type, icon: Icon, label }) => (
                      <button
                        key={type}
                        title={label}
                        onMouseDown={(e) => { e.preventDefault(); applyFormat(type); }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                    <span className="ml-auto text-[10px] text-muted-foreground/50 hidden sm:inline">Ctrl+B 굵게</span>
                  </div>
                )}
                <Textarea
                  ref={notesRef}
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.ctrlKey && e.key === "b") { e.preventDefault(); applyFormat("bold"); }
                  }}
                  placeholder={`수업 내용을 자유롭게 타이핑하세요.\n\nToday's topic: ${session.topic}\n\n- Key expressions:\n- Grammar points:\n- Notes:`}
                  disabled={isDisabled} readOnly={!notesEditMode}
                  className={cn("h-[420px] resize-none text-sm leading-relaxed border-0 focus-visible:ring-0 bg-transparent p-4 rounded-none overflow-y-auto",
                    !notesEditMode && "cursor-default text-muted-foreground")}
                />
                {classState === "active" && (
                  <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center gap-3">
                    <Button size="sm" onClick={handleExtractVocab} disabled={extracting || !notes.trim()}
                      className="gap-2 bg-navy hover:bg-navy-light text-primary-foreground text-xs h-7"
                    >
                      <Sparkles className="w-3 h-3" />
                      {extracting ? "추출 중..." : "단어 미리 추출"}
                    </Button>
                    <span className="text-xs text-muted-foreground">노트에서 단어를 AI로 바로 추출할 수 있습니다</span>
                  </div>
                )}
              </div>

              {/* ── HOMEWORK (강사용 관리) ────────────────────────────── */}
              <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                <button onClick={() => setHwOpen(!hwOpen)}
                  className="w-full px-4 py-3 bg-muted/30 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-gold" />
                    <span className="font-semibold text-sm text-foreground">숙제</span>
                    <span className="text-xs bg-gold/15 text-gold-dark px-1.5 py-0.5 rounded-full font-medium">{hwList.length}건</span>
                  </div>
                  {hwOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {hwOpen && (
                  <div className="p-3 space-y-2">
                    {hwList.length === 0 && !addingHw && (
                      <p className="text-xs text-muted-foreground py-1.5 px-1">아직 추가된 숙제가 없습니다</p>
                    )}

                    {hwList.map((hw) => {
                      const meta = HW_TYPE_META[hw.type];
                      const Icon = meta.icon;
                      const isEditing = editingHwId === hw.id;

                      if (isEditing) {
                        return (
                          <div key={hw.id} className="border border-[hsl(var(--gold)/0.5)] rounded-lg p-3 space-y-2.5 bg-[hsl(var(--gold)/0.04)]">
                            <div className="grid grid-cols-2 gap-1.5">
                              {(Object.keys(HW_TYPE_META) as HwType[]).map((t) => {
                                const m = HW_TYPE_META[t]; const TIcon = m.icon;
                                return (
                                  <button key={t} onClick={() => setEditHwType(t)}
                                    className={cn("flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all",
                                      editHwType === t ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.10)] text-foreground" : "border-border bg-card text-muted-foreground hover:border-[hsl(var(--gold)/0.4)]")}
                                  >
                                    <TIcon className={cn("w-3.5 h-3.5 flex-shrink-0", editHwType === t ? m.color : "")} />{m.label}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-muted-foreground px-0.5">{HW_TYPE_META[editHwType].hint}</p>
                            <Input value={editHwTitle} onChange={(e) => setEditHwTitle(e.target.value)} placeholder="숙제 제목 (필수)" className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && handleSaveEditHw()} />
                            <Textarea value={editHwDesc} onChange={(e) => setEditHwDesc(e.target.value)} placeholder="상세 설명 (선택)" className="min-h-[60px] resize-none text-xs" />
                            <div className="flex gap-1.5">
                              <Button size="sm" onClick={handleSaveEditHw} disabled={!editHwTitle.trim() || savingEditHw}
                                className="flex-1 h-8 text-xs bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />{savingEditHw ? "저장 중..." : "저장"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEditHw} className="h-8 text-xs">취소</Button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={hw.id} className="flex items-start gap-2.5 py-2 px-2.5 rounded-lg bg-muted/30 group border border-border">
                          <div className={cn("mt-0.5 flex-shrink-0", meta.color)}><Icon className="w-3.5 h-3.5" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">{hw.title}</span>
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted", meta.color)}>{meta.label}</span>
                            </div>
                            {hw.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{hw.description}</p>}
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{meta.hint}</p>
                          </div>
                          {!isDisabled && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                              <button onClick={() => startEditHw(hw)} className="text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => removeHw(hw.id)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {addingHw ? (
                      <div className="border border-[hsl(var(--gold)/0.4)] rounded-lg p-3 space-y-2.5 bg-[hsl(var(--gold)/0.04)]">
                        <div className="grid grid-cols-2 gap-1.5">
                          {(Object.keys(HW_TYPE_META) as HwType[]).map((t) => {
                            const m = HW_TYPE_META[t]; const Icon = m.icon;
                            return (
                              <button key={t} onClick={() => setNewHwType(t)}
                                className={cn("flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all",
                                  newHwType === t ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.10)] text-foreground" : "border-border bg-card text-muted-foreground hover:border-[hsl(var(--gold)/0.4)]")}
                              >
                                <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", newHwType === t ? m.color : "")} />{m.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground px-0.5">{HW_TYPE_META[newHwType].hint}</p>
                        <Input value={newHwTitle} onChange={(e) => setNewHwTitle(e.target.value)} placeholder="숙제 제목 (필수)" className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && handleAddHw()} />
                        <Textarea value={newHwDesc} onChange={(e) => setNewHwDesc(e.target.value)} placeholder="상세 설명 (선택)" className="min-h-[60px] resize-none text-xs" />
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={handleAddHw} disabled={!newHwTitle.trim() || savingHw}
                            className="flex-1 h-8 text-xs bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />{savingHw ? "저장 중..." : "추가"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setAddingHw(false); setNewHwTitle(""); setNewHwDesc(""); }} className="h-8 text-xs">취소</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setAddingHw(true)} disabled={isDisabled}
                        className="w-full h-8 text-xs gap-1.5 border-dashed border-[hsl(var(--gold)/0.5)] text-[hsl(var(--gold-dark))] hover:bg-[hsl(var(--gold)/0.06)]"
                      >
                        <Plus className="w-3.5 h-3.5" />숙제 추가
                      </Button>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
          {role === "instructor" ? (
            <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col gap-4">
              <WordLookupPanel studentLevel={session.level} />
              <InstructorSTTPanel disabled={classState !== "active"} autoStart={classState === "active"} />
            </div>
          ) : (
            <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col">
              <StudentVocabPanel studentName={session.studentName} scheduledAt={session.scheduledAt} sessionId={session.sessionId} />
            </div>
          )}

        </div>
      )}
    </div>
  );
}
