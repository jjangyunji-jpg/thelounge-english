import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { formatStudentName } from "@/lib/formatStudentName";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Video, VideoOff, Clock, FileText, CheckSquare,
  Sparkles, ExternalLink, ChevronDown, ChevronUp,
  Plus, ArrowLeft, Wifi, WifiOff, RotateCcw,
  PenLine, BookOpen, Mic, Brain, X, Pencil, Check, Edit3, BookMarked, Paperclip,
  Loader2, Monitor, Download, History, Maximize2, Trash2, MessageCircle, Newspaper, Lightbulb, Target,
} from "lucide-react";
import SessionSidebar from "@/components/classroom/SessionSidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import NotesEditor from "@/components/classroom/NotesEditor";
import MaterialPickerModal from "@/components/classroom/MaterialPickerModal";
import NoteVersionsModal from "@/components/classroom/NoteVersionsModal";
import DialogueGeneratorModal from "@/components/classroom/DialogueGeneratorModal";
import NewsLessonGeneratorModal from "@/components/classroom/NewsLessonGeneratorModal";
import InsightGeneratorModal from "@/components/classroom/InsightGeneratorModal";
import OpicGeneratorModal from "@/components/classroom/OpicGeneratorModal";
import KeyExpressionExtractModal from "@/components/classroom/KeyExpressionExtractModal";
import RenewalDecisionModal from "@/components/classroom/RenewalDecisionModal";
import { exportNotesPdf } from "@/lib/exportNotesPdf";
import { loadEffectiveStudentMeetInfo } from "@/lib/meetLink";

import StudentVocabPanel from "@/components/classroom/StudentVocabPanel";
import StudentExpressionPanel from "@/components/classroom/StudentExpressionPanel";
import StudentHomeworkPanel from "@/components/classroom/StudentHomeworkPanel";
import LevelTestPanel from "@/components/classroom/LevelTestPanel";

import HomeworkFeedbackModal from "@/components/dashboard/HomeworkFeedbackModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ClassState = "pre" | "ready" | "active" | "ended";
type Role = "instructor" | "student";
type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file" | "watching";

interface HomeworkItem {
  id: string;
  type: HwType;
  title: string;
  description: string;
  isPreset: boolean;
  saved: boolean;
  presetOriginId?: string | null;
  studentName?: string;
}

const HW_TYPE_META: Record<HwType, { label: string; icon: React.ElementType; color: string; hint: string }> = {
  writing:    { label: "쓰기",       icon: PenLine,    color: "text-[hsl(var(--navy))]",      hint: "텍스트 작성 필수" },
  reading:    { label: "읽기",       icon: BookOpen,   color: "text-[hsl(var(--gold-dark))]", hint: "녹음 선택" },
  speaking:   { label: "말하기",     icon: Mic,        color: "text-[hsl(var(--success))]",   hint: "녹음 필수 / 텍스트 선택" },
  memorizing: { label: "외우기",     icon: Brain,      color: "text-purple-500",              hint: "녹음 선택 (대화문 등)" },
  file:       { label: "파일올리기", icon: Paperclip,  color: "text-blue-500",                hint: "파일 첨부 필수" },
  watching:   { label: "시청하기",   icon: Monitor,    color: "text-rose-500",                hint: "시청 후 체크" },
};

function getWeekLabel(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}


function formatDate(date = new Date()) {
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" });
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
}

interface SessionData {
  sessionId: string;
  studentName: string;      // display name (may be nickname)
  dbStudentName: string;    // actual DB student_name (never nickname)
  englishName: string;      // english name from instructor_students
  instructorName: string;
  level: string;
  scheduledAt: Date;
  meetLink: string;
  topic: string;
}

const DEFAULT_SESSION: SessionData = {
  sessionId: "",
  studentName: "",
  dbStudentName: "",
  englishName: "",
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSessionId = searchParams.get("sessionId");
  const urlStudentName = searchParams.get("student");

  const [session, setSession] = useState<SessionData>(DEFAULT_SESSION);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionNumber, setSessionNumber] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [editGoalValue, setEditGoalValue] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  // Ref to hold current notes for flush before session switch
  const notesRef = useRef("");
  const sessionIdRef = useRef("");
  // Guard: true while switching sessions to prevent localStorage backup with stale notes + new sessionId
  const isTransitioningRef = useRef(false);

  // Load session from DB if sessionId provided
  useEffect(() => {
    const loadSession = async () => {
      // Mark transition to prevent localStorage backup from writing stale notes with new sessionId
      isTransitioningRef.current = true;
      // Flush current notes before switching sessions
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
      const prevSessionId = sessionIdRef.current;
      const prevNotes = notesRef.current;
      if (prevSessionId && prevNotes.trim()) {
        const stripped = prevNotes.replace(/<[^>]*>/g, "").trim();
        if (stripped && stripped !== "Homework Feedback /Small Talk /") {
          await supabase.from("class_sessions").update({ notes: prevNotes.trim() }).eq("id", prevSessionId);
        }
      }
      // Clear localStorage backup to prevent cross-session contamination
      localStorage.removeItem(LOCAL_BACKUP_KEY);
      setSessionLoading(true);
      setNotes("");
      setHwList([]);
      setObjectives([]);
      setSessionTopic("");
      setExtracted(false);
      let sessionData: any = null;
      // Try to get student_name from auth session for filtering
      let studentNameFilter: string | null = null;
      let nicknameValue: string | null = null;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (authSession) {
        const { data: profile } = await supabase
          .from("student_profiles")
          .select("student_name, nickname")
          .eq("user_id", authSession.user.id)
          .maybeSingle();
        if (profile?.student_name) studentNameFilter = profile.student_name;
        nicknameValue = profile?.nickname || null;
      }

      if (!urlSessionId) {
        // If student name provided via URL, use it as filter
        const nameFilter = urlStudentName || studentNameFilter;
        let query = supabase
          .from("class_sessions")
          .select("id,student_name,instructor_name,level,scheduled_at,meet_link,topic,group_students")
          .order("scheduled_at", { ascending: false })
          .limit(1);
        if (nameFilter) {
          query = query.eq("student_name", nameFilter);
        }
        const { data } = await query.maybeSingle();
        sessionData = data;

        // If no session found but we have a student name from URL, load their info
        if (!sessionData && urlStudentName) {
          const { data: isData } = await supabase
            .from("instructor_students")
            .select("level, instructor_name, meet_link")
            .eq("student_name", urlStudentName)
            .eq("status", "active")
            .maybeSingle();
          // Get instructor name from auth session
          let instrName = isData?.instructor_name || "";
          if (!instrName && authSession) {
            const { data: instrData } = await supabase
              .from("instructors")
              .select("name")
              .eq("user_id", authSession.user.id)
              .maybeSingle();
            instrName = instrData?.name || "";
          }
          setSession(prev => ({
            ...prev,
            studentName: urlStudentName,
            dbStudentName: urlStudentName,
            level: isData?.level ?? prev.level,
            instructorName: instrName || prev.instructorName,
            meetLink: isData?.meet_link ?? "",
          }));
          setSessionLoading(false);
          isTransitioningRef.current = false;
          return;
        }
      } else {
        const { data } = await supabase
          .from("class_sessions")
          .select("id,student_name,instructor_name,level,scheduled_at,meet_link,topic,group_students")
          .eq("id", urlSessionId)
          .single();
        sessionData = data;
        if (data) setGroupStudents(Array.isArray((data as any).group_students) ? (data as any).group_students : []);
      }
      if (sessionData) {
        // Meet 링크는 이관일 기준 instructor_students의 유효 레코드를 source of truth로 사용
        const meetInfo = await loadEffectiveStudentMeetInfo(
          supabase,
          sessionData.student_name,
          sessionData.scheduled_at,
          sessionData.meet_link || "",
        );
        setSession({
          sessionId: sessionData.id,
          studentName: (urlRole === "student" && nicknameValue) ? nicknameValue : sessionData.student_name,
          dbStudentName: sessionData.student_name,
          englishName: meetInfo.englishName,
          instructorName: sessionData.instructor_name,
          level: sessionData.level,
          scheduledAt: new Date(sessionData.scheduled_at),
          meetLink: meetInfo.meetLink,
          topic: sessionData.topic || "",
        });
        // Calculate session number within the period that contains this session's date
        const sessionDateStr = sessionData.scheduled_at.slice(0, 10);
        const { data: matchingPeriod } = await supabase
          .from("schedule_periods")
          .select("start_date, end_date")
          .eq("is_active", true)
          .lte("start_date", sessionDateStr)
          .gte("end_date", sessionDateStr)
          .maybeSingle();

        let periodFilter = supabase
          .from("class_sessions")
          .select("id,scheduled_at")
          .eq("student_name", sessionData.student_name)
          .eq("instructor_name", sessionData.instructor_name)
          .order("scheduled_at", { ascending: true });

        if (matchingPeriod) {
          periodFilter = periodFilter
            .gte("scheduled_at", matchingPeriod.start_date + "T00:00:00+09:00")
            .lte("scheduled_at", matchingPeriod.end_date + "T23:59:59+09:00");
        }

        const { data: allSessions } = await periodFilter;
        if (allSessions) {
          const idx = allSessions.findIndex(s => s.id === sessionData!.id);
          setSessionNumber(`${idx + 1}회차`);
        } else {
          setSessionNumber("1회차");
        }
      } else {
        // No session found — fill in student info from instructor_students
        const studentName = studentNameFilter ?? "";
        if (studentName) {
          const { data: isData } = await supabase
            .from("instructor_students")
            .select("level, instructor_name, meet_link")
            .eq("student_name", studentName)
            .eq("status", "active")
            .maybeSingle();
          setSession(prev => ({
            ...prev,
            studentName: nicknameValue || studentName,
            dbStudentName: studentName,
            level: isData?.level ?? prev.level,
            instructorName: isData?.instructor_name ?? prev.instructorName,
            meetLink: isData?.meet_link ?? "",
          }));
        }
      }
      setSessionLoading(false);
      isTransitioningRef.current = false;
    };
    loadSession();
  }, [urlSessionId, urlStudentName]);

  const urlRole = searchParams.get("role") as Role | null;
  const [role, setRole] = useState<Role>(urlRole === "student" ? "student" : "instructor");
  const [classState, setClassState] = useState<ClassState>("ready");
  const [meetConnected, setMeetConnected] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [notes, setNotes] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  // Keep refs in sync for flush-before-switch
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { sessionIdRef.current = session.sessionId; }, [session.sessionId]);
  const [notesEditMode, setNotesEditMode] = useState(true);
  const [hwList, setHwList] = useState<HomeworkItem[]>([]);
  const [prevHwList, setPrevHwList] = useState<{ id: string; type: HwType; title: string; description?: string | null; status: string; presetOriginId?: string | null }[]>([]);
  const [prevVocabTests, setPrevVocabTests] = useState<{ id: string; score: number | null; total: number | null; started_at: string; completed_at: string | null }[]>([]);
  const [prevHwOpen, setPrevHwOpen] = useState(false);
  const [hwOpen, setHwOpen] = useState(true);
  const [remarks, setRemarks] = useState("");
  const [remarksSaving, setRemarksSaving] = useState(false);
  const [remarksSaved, setRemarksSaved] = useState(false);
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [reviewModalHw, setReviewModalHw] = useState<{ id: string; type: HwType; title: string; description?: string | null } | null>(null);
  const [reviewSubmission, setReviewSubmission] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const remarksTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ── 수업 목표 (장기, 시점별 버전 관리) ─────────────────
  const [lessonGoal, setLessonGoal] = useState("");
  const [lessonGoalOriginal, setLessonGoalOriginal] = useState("");
  const [lessonGoalEffectiveFrom, setLessonGoalEffectiveFrom] = useState<string | null>(null);
  const [lessonGoalSaving, setLessonGoalSaving] = useState(false);
  const [lessonGoalSaved, setLessonGoalSaved] = useState(false);
  const [lessonGoalOpen, setLessonGoalOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [sessionTopic, setSessionTopic] = useState("");
  const [generatingObjectives, setGeneratingObjectives] = useState(false);
  const [sidebarSessions, setSidebarSessions] = useState<{ id: string; scheduled_at: string; topic: string | null; notes?: string | null; started_at?: string | null; ended_at?: string | null; cancellation_type?: string | null; cancellation_resolution?: string | null; reschedule_origin_dates?: string[] | null; is_urgent_makeup?: boolean | null }[]>([]);
  const [groupStudents, setGroupStudents] = useState<string[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesEditorRef = useRef<any>(null);
  const [dialogueModalOpen, setDialogueModalOpen] = useState(false);
  const [newsLessonModalOpen, setNewsLessonModalOpen] = useState(false);
  const [insightModalOpen, setInsightModalOpen] = useState(false);
  const [opicModalOpen, setOpicModalOpen] = useState(false);
  const [keyExprModalOpen, setKeyExprModalOpen] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);

  const [versionModalOpen, setVersionModalOpen] = useState(false);

  // Export all notes as PDF
  const handleExportPdf = async () => {
    if (!session.dbStudentName) return;
    const { data } = await supabase
      .from("class_sessions")
      .select("scheduled_at, topic, notes, remarks")
      .eq("student_name", session.dbStudentName)
      .order("scheduled_at", { ascending: true });
    if (!data || data.length === 0) {
      toast({ title: "내보낼 노트가 없습니다", variant: "destructive" });
      return;
    }
    const withNotes = data.filter(s => s.notes && s.notes.trim());
    if (withNotes.length === 0) {
      toast({ title: "노트가 있는 수업이 없습니다", variant: "destructive" });
      return;
    }
    await exportNotesPdf(withNotes, session.dbStudentName);
    toast({ title: `${withNotes.length}개 수업 노트를 PDF로 내보냈습니다` });
  };

  // Restore note version
  const handleRestoreVersion = async (restoredNotes: string, restoredTopic: string) => {
    if (!session.sessionId) return;
    setNotes(restoredNotes);
    setSessionTopic(restoredTopic);
    await supabase.from("class_sessions").update({ notes: restoredNotes, topic: restoredTopic }).eq("id", session.sessionId);
    toast({ title: "이전 버전이 복원되었습니다" });
  };

  // Save notes on page unload (browser close, back navigation, etc.)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const sid = sessionIdRef.current;
      const n = notesRef.current;
      if (!sid || !n.trim()) return;
      const stripped = n.replace(/<[^>]*>/g, "").trim();
      if (!stripped || stripped === "Homework Feedback /Small Talk /") return;
      // Use sendBeacon for reliable save on page unload
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/class_sessions?id=eq.${sid}`;
      const body = JSON.stringify({ notes: n.trim() });
      const headers = {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        "Prefer": "return=minimal",
      };
      // sendBeacon doesn't support custom headers, use fetch with keepalive
      fetch(url, { method: "PATCH", headers, body, keepalive: true }).catch(() => {});
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ── Local backup & offline detection ──
  const LOCAL_BACKUP_KEY = "classroom_notes_backup";

  // Save to localStorage on every change as safety net
  useEffect(() => {
    // Skip backup during session transitions to prevent writing stale notes with new sessionId
    if (!session.sessionId || !notes.trim() || isTransitioningRef.current) return;
    const stripped = notes.replace(/<[^>]*>/g, "").trim();
    if (!stripped || stripped === "Homework Feedback /Small Talk /") return;
    try {
      localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify({
        sessionId: session.sessionId,
        notes,
        savedAt: Date.now(),
      }));
    } catch { /* quota exceeded – ignore */ }
  }, [notes, session.sessionId]);

  // Detect online/offline
  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      toast({ title: "⚠️ 인터넷 연결이 끊겼습니다", description: "노트가 로컬에 자동 백업됩니다. 연결이 복구되면 자동 저장됩니다.", variant: "destructive" });
    };
    const goOnline = () => {
      setIsOffline(false);
      toast({ title: "✓ 인터넷 연결이 복구되었습니다" });
      // Flush current notes to DB on reconnect
      const sid = sessionIdRef.current;
      const n = notesRef.current;
      if (sid && n.trim()) {
        supabase.from("class_sessions").update({ notes: n.trim() }).eq("id", sid);
      }
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  // On load, check for unsaved local backup and offer recovery
  useEffect(() => {
    if (!session.sessionId) return;
    try {
      const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
      if (!raw) return;
      const backup = JSON.parse(raw);
      if (backup.sessionId !== session.sessionId) return;
      // Only offer recovery if backup is recent (within 2 hours) and longer than DB version
      const age = Date.now() - backup.savedAt;
      if (age > 2 * 60 * 60 * 1000) { localStorage.removeItem(LOCAL_BACKUP_KEY); return; }
      // Compare after initial load
      const checkTimer = setTimeout(() => {
        const currentLen = notesRef.current.replace(/<[^>]*>/g, "").trim().length;
        const backupLen = backup.notes.replace(/<[^>]*>/g, "").trim().length;
        if (backupLen > currentLen + 50) {
          // Backup has significantly more content
          toast({
            title: "📋 저장되지 않은 로컬 백업이 발견되었습니다",
            description: `백업 내용이 현재보다 ${backupLen - currentLen}자 더 많습니다. 복원하려면 버전 히스토리를 확인하세요.`,
            duration: 10000,
          });
          // Auto-restore since backup is clearly more complete
          setNotes(backup.notes);
          autoSaveNotes(backup.notes);
        }
        localStorage.removeItem(LOCAL_BACKUP_KEY);
      }, 2000);
      return () => clearTimeout(checkTimer);
    } catch { /* ignore */ }
  }, [session.sessionId]);


  // Auto-save notes to DB for realtime mirroring (debounced 1.5s)
  const autoSaveNotes = useCallback(async (text: string) => {
    if (!session.sessionId || !text.trim()) return;
    const { error } = await supabase.from("class_sessions").update({ notes: text.trim() }).eq("id", session.sessionId);
    if (error && !navigator.onLine) {
      setIsOffline(true);
    }
  }, [session.sessionId]);

  const autoSaveRemarks = useCallback(async (text: string) => {
    if (!session.sessionId) return;
    setRemarksSaving(true);
    const { error } = await supabase.from("class_sessions").update({ remarks: text }).eq("id", session.sessionId);
    setRemarksSaving(false);
    if (!error) {
      setRemarksSaved(true);
      setTimeout(() => setRemarksSaved(false), 2000);
    }
  }, [session.sessionId]);

  const handleRemarksSave = () => {
    if (remarksTimerRef.current) clearTimeout(remarksTimerRef.current);
    autoSaveRemarks(remarks);
  };

  const stripHtml = (text: string): string => {
    if (!text || !/<[a-z][\s\S]*>/i.test(text)) return text;
    const tmp = document.createElement("div");
    tmp.innerHTML = text;
    return tmp.textContent || tmp.innerText || "";
  };

  const handleRemarksChange = (val: string) => {
    const clean = stripHtml(val);
    setRemarks(clean);
    setRemarksSaved(false);
    if (remarksTimerRef.current) clearTimeout(remarksTimerRef.current);
    remarksTimerRef.current = setTimeout(() => autoSaveRemarks(clean), 1500);
  };

  const handleOpenEditorFullscreen = () => {
    if (!session.sessionId) return;
    window.open(`/t/classroom/editor?sessionId=${session.sessionId}`, "_blank", "noopener");
  };

  // Listen for broadcast from fullscreen editor
  const fullscreenChannelRef = useRef<any>(null);
  useEffect(() => {
    if (!session.sessionId) return;
    const channel = supabase
      .channel(`editor-sync-${session.sessionId}`)
      .on("broadcast", { event: "notes-update" }, (payload) => {
        const html = payload?.payload?.html;
        const source = payload?.payload?.source;
        if (typeof html === "string" && source === "fullscreen") {
          setNotes(html);
          // Also auto-save
          if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
          autoSaveTimer.current = setTimeout(() => autoSaveNotes(html), 500);
        }
      })
      .subscribe();
    fullscreenChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [session.sessionId, autoSaveNotes]);

  const [addingHw, setAddingHw] = useState(false);
  const [newHwType, setNewHwType] = useState<HwType>("writing");
  const [newHwTitle, setNewHwTitle] = useState("");
  const [newHwDesc, setNewHwDesc] = useState("");
  const [newHwPreset, setNewHwPreset] = useState(false);
  const [savingHw, setSavingHw] = useState(false);
  const [selectedHwStudents, setSelectedHwStudents] = useState<string[]>([]);
  // All group members including the primary student
  const allGroupMembers = useMemo(() => {
    if (groupStudents.length === 0) return [];
    const primary = session.dbStudentName;
    return primary && !groupStudents.includes(primary) ? [primary, ...groupStudents] : groupStudents;
  }, [groupStudents, session.dbStudentName]);

  const [editingHwId, setEditingHwId] = useState<string | null>(null);
  const [editHwType, setEditHwType] = useState<HwType>("writing");
  const [editHwTitle, setEditHwTitle] = useState("");
  const [editHwDesc, setEditHwDesc] = useState("");
  const [editHwPreset, setEditHwPreset] = useState(false);
  const [selectedEditHwStudents, setSelectedEditHwStudents] = useState<string[]>([]);
  const [savingEditHw, setSavingEditHw] = useState(false);

  // Listen for remarks updates from popup window
  useEffect(() => {
    if (!session.sessionId) return;
    const channel = supabase
      .channel(`remarks-popup-sync-${session.sessionId}`)
      .on("broadcast", { event: "remarks" }, (payload) => {
        const text = payload?.payload?.text;
        if (typeof text === "string") setRemarks(text);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session.sessionId]);

  // Load active lesson goal for this session (most recent goal effective at scheduled_at)
  useEffect(() => {
    if (!session.sessionId || !session.dbStudentName || !session.scheduledAt) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("student_lesson_goals")
        .select("goal, effective_from")
        .eq("student_name", session.dbStudentName)
        .lte("effective_from", session.scheduledAt.toISOString())
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const g = data?.goal ?? "";
      setLessonGoal(g);
      setLessonGoalOriginal(g);
      setLessonGoalEffectiveFrom(data?.effective_from ?? null);
    })();
    return () => { cancelled = true; };
  }, [session.sessionId, session.dbStudentName, session.scheduledAt]);

  const handleSaveLessonGoal = async () => {
    if (!session.dbStudentName) return;
    const text = lessonGoal.trim();
    if (text === lessonGoalOriginal.trim()) return;
    setLessonGoalSaving(true);
    const nowIso = new Date().toISOString();
    const { data: userData } = await supabase.auth.getSession();
    const uid = userData.session?.user?.id ?? null;
    const { error } = await supabase.from("student_lesson_goals").insert({
      student_name: session.dbStudentName,
      goal: text,
      effective_from: nowIso,
      created_by: uid,
    });
    setLessonGoalSaving(false);
    if (!error) {
      setLessonGoalOriginal(text);
      setLessonGoalEffectiveFrom(nowIso);
      setLessonGoalSaved(true);
      toast({ title: "수업 목표가 저장되었습니다.", description: "이후 진행되는 모든 수업에 적용됩니다." });
      setTimeout(() => setLessonGoalSaved(false), 2000);
    } else {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    }
  };

  const dataLoadedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (sessionLoading || !session.sessionId) return;
    // Prevent re-loading data for the same session (e.g. when sessionLoading toggles)
    if (dataLoadedForRef.current === session.sessionId) return;
    dataLoadedForRef.current = session.sessionId;
    const loadData = async () => {
      const { data: sessionData } = await supabase
        .from("class_sessions").select("notes, remarks, group_students").eq("id", session.sessionId).single();
      const notesRaw = sessionData?.notes || "";
      const isEmptyNotes = !notesRaw || notesRaw.replace(/<p><\/p>/g, "").replace(/<br\s*\/?>/g, "").trim() === "";
      if (!isEmptyNotes) {
        setNotes(notesRaw);
      } else {
        // Default template for empty notes
        const template = `<p></p><div data-callout data-callout-type="info" class="callout callout-info"><h1>Homework Feedback /</h1></div><p></p><p></p><div data-callout data-callout-type="info" class="callout callout-info"><h1>Small Talk /</h1></div><p></p><p></p>`;
        setNotes(template);
      }

      // Load remarks: use current session's remarks, or fall back to most recent previous session's remarks
      if (sessionData?.remarks) {
        const cleanRemarks = stripHtml(sessionData.remarks);
        setRemarks(cleanRemarks);
        // If HTML was stripped, save the cleaned version back
        if (cleanRemarks !== sessionData.remarks) {
          await supabase.from("class_sessions").update({ remarks: cleanRemarks }).eq("id", session.sessionId);
        }
      } else {
        // Fetch previous session's remarks for carry-forward
        const { data: prevSession } = await supabase
          .from("class_sessions")
          .select("remarks")
          .eq("student_name", session.dbStudentName)
          .lt("scheduled_at", session.scheduledAt.toISOString())
          .not("remarks", "is", null)
          .order("scheduled_at", { ascending: false })
          .limit(1)
          .single();
        if (prevSession?.remarks) {
          const cleanPrev = stripHtml(prevSession.remarks);
          setRemarks(cleanPrev);
          await supabase.from("class_sessions").update({ remarks: cleanPrev }).eq("id", session.sessionId);
        } else {
          setRemarks("");
        }
      }

      // Load homework for primary student AND group members
      const gsArr = Array.isArray((sessionData as any)?.group_students) ? (sessionData as any).group_students as string[] : [];
      const allHwStudents = [session.dbStudentName, ...gsArr.filter(s => s !== session.dbStudentName)];
      
      const { data } = await supabase
        .from("homework_assignments").select("*")
        .in("student_name", allHwStudents)
        .or(`session_id.eq.${session.sessionId},is_preset.eq.true`)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        // Auto-create session copies for preset templates that don't have one yet
        // But skip if a manual assignment with the same title already exists for this session
        const existingCopyOriginIds = new Set(
          data.filter(d => d.preset_origin_id && d.session_id === session.sessionId)
            .map(d => `${d.preset_origin_id}__${d.student_name}`)
        );
        const existingManualTitles = new Set(
          data.filter(d => !d.is_preset && !d.preset_origin_id && d.session_id === session.sessionId)
            .map(d => `${d.title.trim()}__${d.student_name}`)
        );
        // Only copy presets that were created BEFORE this session — new presets must not
        // retroactively appear on past sessions
        const sessionStartMs = session.scheduledAt.getTime();
        const presetsNeedingCopy = data.filter(d =>
          d.is_preset
          && new Date(d.created_at).getTime() < sessionStartMs
          && !existingCopyOriginIds.has(`${d.id}__${d.student_name}`)
          && !existingManualTitles.has(`${d.title.trim()}__${d.student_name}`)
        );

        let newCopies: typeof data = [];
        if (presetsNeedingCopy.length > 0) {
          const inserts = presetsNeedingCopy.map(p => ({
            student_name: p.student_name,
            title: p.title,
            description: p.description,
            type: p.type,
            is_preset: false,
            session_id: session.sessionId,
            preset_origin_id: p.id,
          }));
          const { data: inserted } = await supabase
            .from("homework_assignments").insert(inserts).select();
          newCopies = inserted || [];
        }

        // Combine original data with new copies, then filter out preset templates
        const allData = [...data, ...newCopies];
        const sessionCopyOriginIds = new Set(
          allData.filter(d => d.preset_origin_id && d.session_id === session.sessionId)
            .map(d => d.preset_origin_id)
        );
        // Collect copy titles for deduplication of manual assignments
        const copyTitleSet = new Set(
          allData.filter(d => d.preset_origin_id && d.session_id === session.sessionId)
            .map(d => `${d.title.trim()}__${d.student_name}`)
        );
        const filtered = allData.filter(d => {
          // Hide preset templates
          if (d.is_preset) return false;
          // Hide manual assignments that duplicate a session copy (same title)
          if (d.session_id === session.sessionId && !d.preset_origin_id) {
            if (copyTitleSet.has(`${d.title.trim()}__${d.student_name}`)) return false;
          }
          return true;
        });
        setHwList(filtered.map((d) => ({
          id: d.id, type: d.type as HwType, title: d.title,
          description: d.description || "", isPreset: d.is_preset, saved: true,
          presetOriginId: d.preset_origin_id,
          studentName: d.student_name,
        })));
      }

      // Load previous session's homework status
      // Fetch recent non-cancelled sessions before current to determine time window
      // Use higher limit to skip cancelled sessions
      const { data: prevSessArr } = await supabase
        .from("class_sessions")
        .select("id, scheduled_at, cancellation_type")
        .eq("student_name", session.dbStudentName)
        .lt("scheduled_at", session.scheduledAt.toISOString())
        .is("cancellation_type", null)
        .order("scheduled_at", { ascending: false })
        .limit(2);

      const prevSessData = prevSessArr?.[0] ?? null;
      const prevPrevSess = prevSessArr?.[1] ?? null;

      if (prevSessData?.id) {
        const { data: prevHwData } = await supabase
          .from("homework_assignments")
          .select("id, type, title, description, is_preset, preset_origin_id, session_id, created_at")
          .eq("student_name", session.dbStudentName)
          .or(`session_id.eq.${prevSessData.id},is_preset.eq.true`)
          .order("created_at", { ascending: true });

        if (prevHwData && prevHwData.length > 0) {
          // Filter: show session copies for prev session, hide templates with copies
          const prevCopyOriginIds = new Set(
            prevHwData.filter(d => d.preset_origin_id && d.session_id === prevSessData.id)
              .map(d => d.preset_origin_id)
          );
          // Also collect preset_origin_ids to deduplicate manual assignments
          const prevCopyTitles = new Map(
            prevHwData.filter(d => d.preset_origin_id && d.session_id === prevSessData.id)
              .map(d => [d.title.trim(), d.id])
          );
          const prevSessionMs = new Date(prevSessData.scheduled_at).getTime();
          const filteredPrev = prevHwData.filter(d => {
            // Hide preset templates that have session copies
            if (d.is_preset && prevCopyOriginIds.has(d.id)) return false;
            // Hide preset templates created AFTER the prev session — newly added presets
            // must not retroactively appear on past "지난 숙제" lists
            if (d.is_preset && new Date(d.created_at).getTime() >= prevSessionMs) return false;
            // Hide manual assignments that duplicate a session copy (same title, no preset_origin)
            if (d.session_id === prevSessData.id && !d.preset_origin_id && !d.is_preset) {
              if (prevCopyTitles.has(d.title.trim())) return false;
            }
            return d.session_id === prevSessData.id || (d.is_preset && !prevCopyOriginIds.has(d.id));
          });
          const hwIds = filteredPrev.map(h => h.id);
          const presetOriginIds = filteredPrev
            .filter(h => h.preset_origin_id)
            .map(h => h.preset_origin_id as string);
          const allLookupIds = [...hwIds, ...presetOriginIds];

          // Time-window filter: only count submissions after the session before prevSession
          // Use generous upper bound — students may submit late (after current session started)
          const cutoffTime = prevPrevSess
            ? new Date(prevPrevSess.scheduled_at).toISOString()
            : new Date(prevSessData.scheduled_at).toISOString();

          const { data: subData } = await supabase
            .from("homework_submissions")
            .select("assignment_id, status, submitted_at")
            .in("assignment_id", allLookupIds)
            .gte("submitted_at", cutoffTime);

          const subMap = new Map((subData || []).map(s => [s.assignment_id, s.status]));
          setPrevHwList(filteredPrev.map(h => ({
            id: h.id,
            type: h.type as HwType,
            title: h.title,
            description: h.description,
            presetOriginId: h.preset_origin_id,
            status: subMap.get(h.id) || (h.preset_origin_id ? subMap.get(h.preset_origin_id) : undefined) || "not_submitted",
          })));
        } else {
          setPrevHwList([]);
        }

        // Fetch vocab tests done as homework for the prev session.
        // Window: from PREV session start (when homework was assigned)
        //         to CURRENT session start (the deadline).
        // Use completed_at — the actual finish time — instead of started_at,
        // because started_at is the DB-row-creation time and can race with
        // the client-generated completed_at by ~1s.
        const vocabQuery = supabase
          .from("vocabulary_tests")
          .select("id, score, total, started_at, completed_at")
          .eq("student_name", session.dbStudentName)
          .not("completed_at", "is", null)
          .gte("completed_at", prevSessData.scheduled_at)
          .lt("completed_at", session.scheduledAt.toISOString());

        const { data: vocabData } = await vocabQuery.order("completed_at", { ascending: false });
        setPrevVocabTests(vocabData || []);
      } else {
        setPrevHwList([]);
        setPrevVocabTests([]);
      }

      setSessionTopic(session.topic);
    };
    loadData();
  }, [session.sessionId, sessionLoading]);

  // Load sidebar sessions list — only when student changes, not on every sessionLoading toggle
  const sidebarLoadedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (sessionLoading || !session.dbStudentName) return;
    // Skip if already loaded for this student
    if (sidebarLoadedForRef.current === session.dbStudentName) return;
    sidebarLoadedForRef.current = session.dbStudentName;
    const loadSidebar = async () => {
      setSidebarLoading(true);

      // Fetch student's start_date and type to filter out sessions before registration (regular only)
      const { data: isData } = await supabase
        .from("instructor_students")
        .select("start_date, student_type")
        .eq("student_name", session.dbStudentName)
        .maybeSingle();
      const startDate = isData?.start_date;
      const studentType = (isData as any)?.student_type || "regular";

      const isInstructor = role === "instructor";
      let query = supabase
        .from("class_sessions")
        .select("id, scheduled_at, topic, notes, started_at, ended_at, cancellation_type, cancellation_resolution, reschedule_origin_dates, is_urgent_makeup")
        .eq("student_name", session.dbStudentName)
        .order("scheduled_at", { ascending: false })
        .limit(30);

      // Students only see past + today sessions; instructors see all in the period
      if (!isInstructor) {
        query = query.lte("scheduled_at", new Date().toISOString());
      }

      if (startDate && studentType !== "corporate") {
        query = query.gte("scheduled_at", startDate + "T00:00:00+09:00");
      }

      const { data } = await query;
      setSidebarSessions(data ?? []);
      setSidebarLoading(false);
    };
    loadSidebar();
  }, [session.dbStudentName, sessionLoading, role]);

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

  const ensureHttps = (url: string) => url && !/^https?:\/\//i.test(url) ? `https://${url}` : url;

  const handleStartClass = () => {
    setClassState("active");
    if (session.meetLink) {
      window.open(ensureHttps(session.meetLink), "_blank", "noopener,noreferrer");
    }
    setMeetConnected(true);
  };

  const handleEndClass = () => { setClassState("ended"); setMeetConnected(false); };
  const handleLeaveClass = () => { setMeetConnected(false); setClassState("ready"); };
  const handleJoinMeet = () => {
    if (session.meetLink) {
      const w = window.open(ensureHttps(session.meetLink), "_blank", "noopener,noreferrer");
      if (!w) {
        toast({ title: "팝업이 차단됐습니다", description: "아래 Meet 링크를 직접 복사해서 새 탭에 붙여넣어주세요.", variant: "destructive" });
      }
    }
    setMeetConnected(true);
  };

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
    const weekLabel = getWeekLabel(session.scheduledAt ? new Date(session.scheduledAt) : undefined);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("extract-vocab", {
        body: { notes, studentName: session.dbStudentName, weekLabel, sessionId: session.sessionId },
      });
      if (fnError) { toast({ title: "추출 실패", description: "오류가 발생했습니다.", variant: "destructive" }); return; }
      if (data.error) { toast({ title: "추출 실패", description: data.error, variant: "destructive" }); return; }
      if (data.inserted === 0) {
        toast({ title: data.message ?? "새로운 단어가 없습니다.", description: "이미 단어장에 추가된 단어들입니다." });
      } else {
        toast({ title: `단어 ${data.inserted}개 추출 완료 ✓`, description: `${weekLabel} 단어장에 추가됐습니다.` });
        setExtracted(true);
      }
    } catch { toast({ title: "네트워크 오류", description: "다시 시도해주세요.", variant: "destructive" }); }
    finally { setExtracting(false); }
  };

  const handleDeleteExtractedVocab = async () => {
    if (!session.sessionId) return;
    if (!confirm("이 수업에서 추출된 단어를 모두 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("vocabulary_words").delete().eq("session_id", session.sessionId);
    if (error) { toast({ title: "삭제 실패", variant: "destructive" }); return; }
    setExtracted(false);
    toast({ title: "추출된 단어가 삭제되었습니다 ✓" });
  };

  const handleAddHw = async () => {
    if (!newHwTitle.trim()) return;
    setSavingHw(true);
    try {
      // For group sessions, create homework for selected members (or all if none selected)
      const targetStudents = allGroupMembers.length > 0
        ? (selectedHwStudents.length > 0 ? selectedHwStudents : allGroupMembers)
        : [session.dbStudentName];

      if (newHwPreset) {
        // Create preset templates first (no session_id)
        const presetInserts = targetStudents.map(sn => ({
          student_name: sn, title: newHwTitle.trim(),
          description: newHwDesc.trim() || null, type: newHwType, is_preset: true,
          session_id: null,
        }));
        const { data: presetData, error: presetErr } = await supabase.from("homework_assignments").insert(presetInserts).select();
        if (presetErr) throw presetErr;
        // Immediately create session copies so auto-copy doesn't duplicate
        if (presetData && presetData.length > 0 && session.sessionId) {
          const copyInserts = presetData.map(p => ({
            student_name: p.student_name, title: p.title,
            description: p.description, type: p.type, is_preset: false,
            session_id: session.sessionId, preset_origin_id: p.id,
          }));
          const { data: copies } = await supabase.from("homework_assignments").insert(copyInserts).select();
          if (copies && copies.length > 0) {
            setHwList((prev) => [...prev, ...copies.map(d => ({ id: d.id, type: newHwType, title: newHwTitle.trim(), description: newHwDesc.trim(), isPreset: false, saved: true, presetOriginId: d.preset_origin_id, studentName: d.student_name }))]);
          }
        }
      } else {
        const inserts = targetStudents.map(sn => ({
          student_name: sn, title: newHwTitle.trim(),
          description: newHwDesc.trim() || null, type: newHwType, is_preset: false,
          session_id: session.sessionId || null,
        }));
        const { data, error } = await supabase.from("homework_assignments").insert(inserts).select();
        if (error) throw error;
        if (data && data.length > 0) {
          setHwList((prev) => [...prev, ...data.map(d => ({ id: d.id, type: newHwType, title: newHwTitle.trim(), description: newHwDesc.trim(), isPreset: false, saved: true, studentName: d.student_name }))]);
        }
      }
      const count = allGroupMembers.length > 0 ? targetStudents.length : 0;
      const msg = count > 0 ? `숙제가 ${count}명에게 추가됐습니다 ✓` : "숙제가 추가됐습니다 ✓";
      toast({ title: msg });
      setNewHwTitle(""); setNewHwDesc(""); setNewHwType("writing"); setNewHwPreset(false); setSelectedHwStudents([]);
      setAddingHw(false);
    } catch (e: unknown) {
      console.error("homework save error:", e);
      toast({ title: "숙제 저장 실패", description: e instanceof Error ? e.message : "오류가 발생했습니다. 다시 시도해주세요.", variant: "destructive" });
    } finally {
      setSavingHw(false);
    }
  };

  const removeHw = async (id: string) => {
    await supabase.from("homework_assignments").delete().eq("id", id);
    setHwList((prev) => prev.filter((h) => h.id !== id));
  };

  const startEditHw = (hw: HomeworkItem) => { setEditingHwId(hw.id); setEditHwType(hw.type); setEditHwTitle(hw.title); setEditHwDesc(hw.description); setEditHwPreset(hw.isPreset); setAddingHw(false); setSelectedEditHwStudents(hw.studentName ? [hw.studentName] : [session.dbStudentName]); };
  const cancelEditHw = () => { setEditingHwId(null); setEditHwTitle(""); setEditHwDesc(""); setEditHwPreset(false); setSelectedEditHwStudents([]); };

  const handleSaveEditHw = async () => {
    if (!editHwTitle.trim() || !editingHwId) return;
    setSavingEditHw(true);
    
    const editingItem = hwList.find(h => h.id === editingHwId);
    const originalStudentName = editingItem?.studentName || session.dbStudentName;
    
    // Determine which students need new copies (excluding the original student who keeps the edited record)
    const additionalStudents = allGroupMembers.length > 0
      ? selectedEditHwStudents.filter(s => s !== originalStudentName)
      : [];
    
    try {
      // Case A: Editing a session copy that has a preset origin
      if (editingItem?.presetOriginId) {
        // Update the session copy
        const { error } = await supabase.from("homework_assignments")
          .update({ type: editHwType, title: editHwTitle.trim(), description: editHwDesc.trim() || null })
          .eq("id", editingHwId);
        if (!error) {
          // Also update the preset template so future sessions get the updated version
          await supabase.from("homework_assignments")
            .update({ type: editHwType, title: editHwTitle.trim(), description: editHwDesc.trim() || null })
            .eq("id", editingItem.presetOriginId);
          setHwList((prev) => prev.map((h) => h.id === editingHwId ? { ...h, type: editHwType, title: editHwTitle.trim(), description: editHwDesc.trim() } : h));
          toast({ title: "숙제가 수정됐습니다 (정기 숙제도 업데이트) ✓" });
        }
      }
      // Case B: Editing a preset template directly (shouldn't normally happen since auto-copy replaces it, but safety)
      else if (editingItem?.isPreset && !editingItem.presetOriginId) {
        // Create session copy instead of modifying template
        const primaryStudent = selectedEditHwStudents.length > 0 ? (selectedEditHwStudents.includes(originalStudentName) ? originalStudentName : selectedEditHwStudents[0]) : originalStudentName;
        const { data: copy, error } = await supabase.from("homework_assignments").insert({
          student_name: primaryStudent,
          title: editHwTitle.trim(),
          description: editHwDesc.trim() || null,
          type: editHwType,
          is_preset: false,
          session_id: session.sessionId || null,
          preset_origin_id: editingHwId,
        }).select().single();
        if (error) throw error;
        // Also update the preset template for future sessions
        await supabase.from("homework_assignments")
          .update({ type: editHwType, title: editHwTitle.trim(), description: editHwDesc.trim() || null })
          .eq("id", editingHwId);
        if (copy) {
          setHwList((prev) => prev.map((h) => h.id === editingHwId ? {
            id: copy.id, type: editHwType, title: editHwTitle.trim(),
            description: editHwDesc.trim(), isPreset: false, saved: true,
            presetOriginId: editingHwId, studentName: primaryStudent,
          } : h));
          toast({ title: "숙제가 수정됐습니다 ✓" });
        }
        // Create copies for additional students
        const otherStudents = selectedEditHwStudents.filter(s => s !== primaryStudent);
        if (otherStudents.length > 0) {
          const inserts = otherStudents.map(sn => ({
            student_name: sn, title: editHwTitle.trim(),
            description: editHwDesc.trim() || null, type: editHwType,
            is_preset: false, session_id: session.sessionId || null,
            preset_origin_id: editingHwId,
          }));
          const { data: extras } = await supabase.from("homework_assignments").insert(inserts).select();
          if (extras) {
            setHwList(prev => [...prev, ...extras.map(r => ({
              id: r.id, type: r.type as HwType, title: r.title,
              description: r.description || "", isPreset: false, saved: true,
              presetOriginId: r.preset_origin_id || undefined, studentName: r.student_name,
            }))]);
          }
        }
      }
      // Case C: Normal session-specific homework (no preset)
      else {
        // Check if user is converting to preset
        if (editHwPreset && !editingItem?.isPreset) {
          // Convert: create a preset template and link this as a session copy
          const { data: presetData } = await supabase.from("homework_assignments").insert({
            student_name: originalStudentName, title: editHwTitle.trim(),
            description: editHwDesc.trim() || null, type: editHwType,
            is_preset: true, session_id: null,
          }).select().single();
          if (presetData) {
            // Update current record to be a session copy of the new preset
            await supabase.from("homework_assignments")
              .update({ type: editHwType, title: editHwTitle.trim(), description: editHwDesc.trim() || null, preset_origin_id: presetData.id })
              .eq("id", editingHwId);
            setHwList((prev) => prev.map((h) => h.id === editingHwId ? { ...h, type: editHwType, title: editHwTitle.trim(), description: editHwDesc.trim(), isPreset: false, presetOriginId: presetData.id } : h));
            toast({ title: "정기 숙제로 등록됐습니다 ✓" });
          }
        } else {
          const { error } = await supabase.from("homework_assignments")
            .update({ type: editHwType, title: editHwTitle.trim(), description: editHwDesc.trim() || null })
            .eq("id", editingHwId);
          if (!error) {
            setHwList((prev) => prev.map((h) => h.id === editingHwId ? { ...h, type: editHwType, title: editHwTitle.trim(), description: editHwDesc.trim() } : h));
            toast({ title: "숙제가 수정됐습니다 ✓" });
          }
        }
        // Create copies for additional students
        if (additionalStudents.length > 0) {
          const inserts = additionalStudents.map(sn => ({
            student_name: sn, title: editHwTitle.trim(),
            description: editHwDesc.trim() || null, type: editHwType,
            is_preset: false, session_id: session.sessionId || null,
          }));
          const { data: extras } = await supabase.from("homework_assignments").insert(inserts).select();
          if (extras) {
            setHwList(prev => [...prev, ...extras.map(r => ({
              id: r.id, type: r.type as HwType, title: r.title,
              description: r.description || "", isPreset: false, saved: true,
              studentName: r.student_name,
            }))]);
          }
        }
      }
    } catch (e: unknown) {
      toast({ title: "저장 실패", variant: "destructive" });
    }
    setSavingEditHw(false);
    cancelEditHw();
  };

  const isDisabled = classState === "pre";

  return (
    <>
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header className="sidebar-gradient text-sidebar-foreground px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-4 shadow-lg">
        <button
          onClick={() => {
            // 이전 페이지가 있으면 뒤로 가기, 없으면 기본 대시보드로
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate(urlRole === "student" ? "/my/dashboard" : "/t/dashboard");
            }
          }}
          className="flex items-center gap-1 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors text-sm flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">돌아가기</span>
        </button>
        <div className="w-px h-5 bg-sidebar-border flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sidebar-accent-foreground text-sm">{formatStudentName(session.studentName, session.englishName)}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground font-medium">{session.level}</span>
            {sessionNumber && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gold/20 text-gold font-bold">{sessionNumber}</span>
            )}
            <span className="text-sidebar-foreground/60 text-xs hidden sm:inline">with {session.instructorName}</span>
            {sessionTopic && <span className="text-gold text-xs hidden md:inline">· {sessionTopic}</span>}
            {/* Inline lesson goal (session topic) */}
            {role === "instructor" && session.topic && !editingGoal && (
              <button
                onClick={(e) => { e.stopPropagation(); setEditGoalValue(session.topic); setEditingGoal(true); }}
                className="text-xs px-2 py-0.5 rounded-full bg-sidebar-accent/50 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors hidden md:inline-flex items-center gap-1"
                title="수업 목표 수정"
              >
                <Sparkles className="w-3 h-3 text-gold/70" />
                {session.topic}
              </button>
            )}
            {role === "instructor" && !session.topic && !editingGoal && (
              <button
                onClick={(e) => { e.stopPropagation(); setEditGoalValue(""); setEditingGoal(true); }}
                className="text-xs px-2 py-0.5 rounded-full bg-sidebar-accent/30 text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70 transition-colors hidden md:inline-flex items-center gap-1"
                title="수업 목표 추가"
              >
                <Plus className="w-3 h-3" /> 수업 목표
              </button>
            )}
            {editingGoal && (
              <span className="hidden md:inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={editGoalValue}
                  onChange={(e) => setEditGoalValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (async () => {
                        setSavingGoal(true);
                        await supabase.from("class_sessions").update({
                          topic: editGoalValue.trim(),
                        }).eq("id", session.sessionId);
                        setSession(prev => ({ ...prev, topic: editGoalValue.trim() }));
                        setEditingGoal(false);
                        setSavingGoal(false);
                        toast({ title: "수업 목표 저장 완료 ✓" });
                      })();
                    }
                    if (e.key === "Escape") setEditingGoal(false);
                  }}
                  placeholder="수업 목표 입력"
                  className="h-6 text-xs w-40 bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground"
                  autoFocus
                  disabled={savingGoal}
                />
                <button
                  onClick={async () => {
                    setSavingGoal(true);
                    await supabase.from("class_sessions").update({
                      topic: editGoalValue.trim(),
                    }).eq("id", session.sessionId);
                    setSession(prev => ({ ...prev, topic: editGoalValue.trim() }));
                    setEditingGoal(false);
                    setSavingGoal(false);
                    toast({ title: "수업 목표 저장 완료 ✓" });
                  }}
                  className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  disabled={savingGoal}
                >
                  {savingGoal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setEditingGoal(false)} className="text-sidebar-foreground/50 hover:text-sidebar-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
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
            {session.sessionId && (
              <span className="text-sidebar-foreground/40 text-xs font-mono hidden sm:inline">
                · {formatDate(session.scheduledAt)} {formatTime(session.scheduledAt)}
              </span>
            )}
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
            {role === "instructor" ? (
              <Button size="sm" onClick={handleEndClass}
                className="h-8 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
              >
                <VideoOff className="w-3.5 h-3.5" />수업 종료
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={handleLeaveClass}
                className="h-8 text-xs border-destructive/50 text-destructive hover:bg-destructive/10 gap-1.5"
              >
                <VideoOff className="w-3.5 h-3.5" />수업 나가기
              </Button>
            )}
          </div>
        )}

        {classState === "ended" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-sidebar-foreground/60">수업 종료 · {formatDuration(elapsed)}</span>
            <Button size="sm" onClick={() => { setClassState("ready"); setElapsed(0); }}
              className="h-7 text-[11px] bg-gold/20 text-gold-dark hover:bg-gold/30 gap-1"
            >
              <RotateCcw className="w-3 h-3" />수업 재시작
            </Button>
          </div>
        )}
      </header>

      {/* ── MEET STATUS BANNER ───────────────────────────────────────────── */}
      {classState === "ready" && (
        <div className="bg-gold/5 border-b border-gold/20 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <WifiOff className="w-4 h-4 text-gold-dark flex-shrink-0" />
            <span className="text-gold-dark font-medium">수업 시작 버튼을 누르면 Google Meet가 자동으로 열립니다</span>
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
        <div className="flex-1 flex min-h-0">
          {/* Session Sidebar */}
          <SessionSidebar
            sessions={sidebarSessions}
            selectedId={session.sessionId}
            onSelect={async (id) => {
              // Mark transition to prevent localStorage backup race condition
              isTransitioningRef.current = true;
              localStorage.removeItem(LOCAL_BACKUP_KEY);
              // Flush current notes before switching
              if (autoSaveTimer.current) {
                clearTimeout(autoSaveTimer.current);
                autoSaveTimer.current = null;
              }
              const prevSid = sessionIdRef.current;
              const prevN = notesRef.current;
              if (prevSid && prevN.trim()) {
                const stripped = prevN.replace(/<[^>]*>/g, "").trim();
                if (stripped && stripped !== "Homework Feedback /Small Talk /") {
                  await supabase.from("class_sessions").update({ notes: prevN.trim() }).eq("id", prevSid);
                }
              }
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("sessionId", id);
                return next;
              });
            }}
            onDelete={role === "instructor" ? async (id) => {
              // Check for related homework assignments
              const { count: hwCount } = await supabase
                .from("homework_assignments")
                .select("id", { count: "exact", head: true })
                .eq("session_id", id);

              // Check for related vocabulary words
              const { count: vocabCount } = await supabase
                .from("vocabulary_words")
                .select("id", { count: "exact", head: true })
                .eq("session_id", id);

              const relatedItems: string[] = [];
              if (hwCount && hwCount > 0) relatedItems.push(`숙제 ${hwCount}개`);
              if (vocabCount && vocabCount > 0) relatedItems.push(`단어 ${vocabCount}개`);

              let confirmMsg = "이 수업 일정을 삭제하시겠습니까?";
              if (relatedItems.length > 0) {
                confirmMsg += `\n\n⚠️ 연관 데이터: ${relatedItems.join(", ")}도 함께 삭제됩니다.`;
              }

              if (!window.confirm(confirmMsg)) return;

              // Delete related data first
              if (hwCount && hwCount > 0) {
                await supabase.from("homework_assignments").delete().eq("session_id", id);
              }
              if (vocabCount && vocabCount > 0) {
                await supabase.from("vocabulary_words").delete().eq("session_id", id);
              }

              const { error } = await supabase.from("class_sessions").delete().eq("id", id);
              if (error) {
                toast({
                  title: "삭제 실패",
                  description: error.message.includes("Cannot delete")
                    ? "노트나 시작 기록이 있는 수업은 삭제할 수 없습니다."
                    : "수업 삭제에 실패했습니다.",
                  variant: "destructive",
                });
                return;
              }

              toast({ title: "수업이 삭제되었습니다." });

              // Remove from sidebar list
              setSidebarSessions(prev => prev.filter(s => s.id !== id));

              // If deleted the currently selected session, navigate to the first remaining
              if (session.sessionId === id) {
                const remaining = sidebarSessions.filter(s => s.id !== id);
                if (remaining.length > 0) {
                  setSearchParams(prev => {
                    const next = new URLSearchParams(prev);
                    next.set("sessionId", remaining[0].id);
                    return next;
                  });
                }
              }
            } : undefined}
            loading={sidebarLoading}
            initialOpen={true}
            headerSlot={
              role === "instructor" && session.sessionId && session.dbStudentName ? (
                <LevelTestPanel
                  studentName={session.dbStudentName}
                  role="instructor"
                  instructorName={session.instructorName}
                />
              ) : undefined
            }
          />
          <div className="flex-1 flex flex-col md:flex-row gap-3 sm:gap-5 px-3 sm:px-4 py-3 sm:py-5 max-w-7xl w-full mx-auto overflow-y-auto">

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          {role === "student" ? (
            <div className="flex-1 flex flex-col gap-5 min-w-0">
              {/* 수업 노트 (읽기 전용) */}
              <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/30">
                  <FileText className="w-4 h-4 text-gold" />
                  <span className="font-semibold text-sm text-foreground">수업 노트</span>
                  {session.sessionId && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDate(session.scheduledAt)} {formatTime(session.scheduledAt)}
                    </span>
                  )}
                </div>
                <div
                  className="tiptap h-[420px] overflow-y-auto p-4 text-sm leading-relaxed text-foreground"
                  dangerouslySetInnerHTML={{ __html: (() => {
                    const raw = notes || "";
                    if (!raw) return "<p class='text-muted-foreground'>강사가 수업 노트를 작성하면 여기에 표시됩니다.</p>";
                    try {
                      const decoded = new DOMParser().parseFromString(raw, "text/html").body.innerHTML;
                      return sanitizeHtml(decoded);
                    } catch { return sanitizeHtml(raw); }
                  })() }}
                />
              </div>
              {/* 숙제 */}
              <StudentHomeworkPanel studentName={session.dbStudentName} sessionId={session.sessionId} />
              {/* 레벨 테스트 */}
              <LevelTestPanel studentName={session.dbStudentName} role="student" />
              {/* 강사 미리보기용 (학생 화면에서는 숨김) */}
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-5 min-w-0">

              {/* ── PREVIOUS HOMEWORK STATUS ───────────────────────── */}
              {(prevHwList.length > 0 || prevVocabTests.length > 0) && (
                <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                  <button
                    onClick={() => setPrevHwOpen(!prevHwOpen)}
                    className="w-full px-4 py-2.5 flex items-center gap-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-navy flex-shrink-0" />
                    <span className="text-xs font-semibold text-foreground">지난 숙제 현황</span>
                    {(() => {
                      const submitted = prevHwList.filter(h => h.status === "submitted" || h.status === "reviewed").length;
                      const total = prevHwList.length;
                      const allDone = submitted === total && total > 0;
                      const noneDone = submitted === 0 && total > 0;
                      return total > 0 ? (
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          allDone ? "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]" :
                          noneDone ? "bg-destructive/10 text-destructive" :
                          "bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]"
                        )}>
                          {submitted}/{total}
                        </span>
                      ) : null;
                    })()}
                    <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform", prevHwOpen && "rotate-180")} />
                  </button>
                  {prevHwOpen && (
                    <div className="px-4 py-2 space-y-1 border-t border-border/50">
                      {prevHwList.map(h => {
                        const meta = HW_TYPE_META[h.type];
                        const Icon = meta?.icon || FileText;
                        const isSubmitted = h.status === "submitted" || h.status === "reviewed";
                        const isReviewed = h.status === "reviewed";
                        return (
                          <button
                            key={h.id}
                            onClick={async () => {
                              setReviewModalHw({ id: h.id, type: h.type, title: h.title, description: h.description });
                              setReviewLoading(true);
                              const lookupIds = [h.id];
                              if (h.presetOriginId) lookupIds.push(h.presetOriginId);
                              const { data: subs } = await supabase
                                .from("homework_submissions")
                                .select("*")
                                .in("assignment_id", lookupIds)
                                .order("submitted_at", { ascending: false })
                                .limit(1);
                              const sub = subs?.[0] ?? null;
                              setReviewSubmission(sub);
                              setReviewLoading(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-left hover:bg-muted/50 transition-colors",
                              isSubmitted ? "border-border bg-card" : "border-dashed border-muted-foreground/20 bg-muted/10"
                            )}
                          >
                            <Icon className={cn("w-3 h-3 flex-shrink-0", meta?.color || "text-muted-foreground")} />
                            <span className="text-[11px] flex-1 truncate">{h.title}</span>
                            {isReviewed ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] font-medium flex-shrink-0">검토됨</span>
                            ) : isSubmitted ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--gold)/0.12)] text-[hsl(var(--gold-dark))] font-medium flex-shrink-0">제출됨</span>
                            ) : (
                              <span className="text-[9px] text-destructive/70 font-medium flex-shrink-0">미제출</span>
                            )}
                          </button>
                        );
                      })}

                      {/* Vocab test results */}
                      {prevVocabTests.length > 0 && (
                        <>
                          {prevHwList.length > 0 && <div className="border-t border-border/50 my-1.5" />}
                          <div className="flex items-center gap-1.5 px-1 pt-0.5">
                            <Brain className="w-3 h-3 text-purple-500" />
                            <span className="text-[10px] font-semibold text-muted-foreground">단어 테스트</span>
                          </div>
                          {prevVocabTests.map(v => {
                            const pct = v.total ? Math.round(((v.score || 0) / v.total) * 100) : 0;
                            return (
                              <div
                                key={v.id}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-card"
                              >
                                <Brain className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                <span className="text-[11px] flex-1">
                                  {v.score !== null && v.total !== null ? `${v.score}/${v.total}` : "—"}
                                  <span className={cn(
                                    "ml-1 text-[10px] font-bold",
                                    pct >= 80 ? "text-[hsl(var(--success))]" :
                                    pct >= 50 ? "text-[hsl(var(--gold-dark))]" :
                                    "text-destructive"
                                  )}>
                                    ({pct}%)
                                  </span>
                                </span>
                                <span className="text-[9px] text-muted-foreground flex-shrink-0">
                                  {new Date(v.started_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}
                      {prevVocabTests.length === 0 && prevHwList.length > 0 && (
                        <>
                          <div className="border-t border-border/50 my-1.5" />
                          <div className="flex items-center gap-1.5 px-1 pt-0.5">
                            <Brain className="w-3 h-3 text-purple-500" />
                            <span className="text-[10px] text-muted-foreground">단어 테스트 기록 없음</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── REMARKS (비고) — collapsible ───────────────────────── */}
              {role === "instructor" && (
                <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                  <button
                    onClick={() => setRemarksOpen(!remarksOpen)}
                    className="w-full px-4 py-2.5 flex items-center gap-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                    <span className="text-xs font-semibold text-foreground">비고</span>
                    <div className="flex items-center gap-2 ml-auto">
                      {remarksSaving && <span className="text-[10px] text-muted-foreground">저장 중...</span>}
                      {remarksSaved && !remarksSaving && <span className="text-[10px] text-[hsl(var(--success))] flex items-center gap-0.5"><Check className="w-3 h-3" />저장됨</span>}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(
                            `/t/classroom/remarks?sessionId=${session.sessionId}`,
                            `remarks-${session.sessionId}`,
                            "width=480,height=600,scrollbars=yes,resizable=yes"
                          );
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
                        className="p-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
                        title="새 창에서 열기"
                      >
                        <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </span>
                      <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", remarksOpen && "rotate-180")} />
                    </div>
                  </button>
                  {remarksOpen && (
                    <div className="p-3 border-t border-border/50 space-y-2">
                      <Textarea
                        value={remarks}
                        onChange={e => handleRemarksChange(e.target.value)}
                        placeholder="다음 수업까지 기억할 사항을 메모하세요... (이전 세션에서 자동으로 이어집니다)"
                        className="resize-none text-sm min-h-[80px]"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={handleRemarksSave}
                          disabled={remarksSaving || !session.sessionId}
                          className="text-[10px] font-bold text-navy hover:text-navy-light transition-colors px-2 py-1 rounded-md bg-navy/5 hover:bg-navy/10 disabled:opacity-40"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 수업 목표 (장기, 시점별 버전) — 항상 표시 ───────── */}
              {role === "instructor" && (
                <div className="rounded-xl border border-border bg-card shadow-card px-5 py-4">
                  {!lessonGoalOpen ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <Target className="w-5 h-5 text-gold flex-shrink-0" />
                      <span className="text-base font-semibold text-foreground">수업목표 :</span>
                      <span className="text-base text-foreground flex-1 min-w-0 break-words font-medium">
                        {lessonGoal.trim() ? lessonGoal : <span className="text-muted-foreground italic font-normal">아직 설정되지 않음</span>}
                      </span>
                      {lessonGoalEffectiveFrom && lessonGoal.trim() && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(lessonGoalEffectiveFrom).toLocaleDateString("ko-KR", { year: "2-digit", month: "numeric", day: "numeric", timeZone: "Asia/Seoul" })} 적용
                        </span>
                      )}
                      <button
                        onClick={() => setLessonGoalOpen(true)}
                        className="text-xs font-medium text-navy hover:text-navy-light px-2.5 py-1.5 rounded hover:bg-navy/5 transition-colors flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />수정
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                        <span className="text-xs font-semibold text-foreground">수업목표 (장기)</span>
                        {lessonGoalSaving && <span className="text-[10px] text-muted-foreground ml-auto">저장 중...</span>}
                        {lessonGoalSaved && !lessonGoalSaving && <span className="text-[10px] text-[hsl(var(--success))] ml-auto flex items-center gap-0.5"><Check className="w-3 h-3" />저장됨</span>}
                      </div>
                      <Textarea
                        value={lessonGoal}
                        onChange={e => setLessonGoal(e.target.value)}
                        placeholder="예) 시제로 일상적인 대화 하기"
                        className="resize-none text-sm min-h-[60px]"
                        autoFocus
                      />
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-muted-foreground">
                          저장 시 <span className="font-semibold">오늘 이후 수업</span>부터 새 목표 반영
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setLessonGoal(lessonGoalOriginal); setLessonGoalOpen(false); }}
                            className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                          >
                            취소
                          </button>
                          <button
                            onClick={async () => { await handleSaveLessonGoal(); setLessonGoalOpen(false); }}
                            disabled={lessonGoalSaving || !session.dbStudentName || lessonGoal.trim() === lessonGoalOriginal.trim()}
                            className="text-[10px] font-bold text-navy hover:text-navy-light transition-colors px-2 py-1 rounded-md bg-navy/5 hover:bg-navy/10 disabled:opacity-40"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gold" />
                    <span className="font-semibold text-sm text-foreground">수업 노트</span>
                    {classState === "active" && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
                    {session.sessionId && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatDate(session.scheduledAt)} {formatTime(session.scheduledAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setVersionModalOpen(true)}
                      disabled={!session.sessionId}
                      className="h-7 text-xs gap-1.5 transition-all border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                    >
                      <History className="w-3 h-3" />버전
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportPdf}
                      disabled={!session.dbStudentName}
                      className="h-7 text-xs gap-1.5 transition-all border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                    >
                      <Download className="w-3 h-3" />PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDialogueModalOpen(true)}
                      disabled={isDisabled}
                      className="h-7 text-xs gap-1.5 transition-all border-gold/30 text-gold-dark hover:bg-gold/10"
                    >
                      <MessageCircle className="w-3 h-3" />Dialogue
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setNewsLessonModalOpen(true)}
                      disabled={isDisabled}
                      className="h-7 text-xs gap-1.5 transition-all border-navy/30 text-navy hover:bg-navy/10"
                    >
                      <Newspaper className="w-3 h-3" />News Talk
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setInsightModalOpen(true)}
                      disabled={isDisabled}
                      className="h-7 text-xs gap-1.5 transition-all border-purple-300 text-purple-600 hover:bg-purple-50"
                    >
                      <Lightbulb className="w-3 h-3" />Insight
                    </Button>
                    {role === "instructor" && (
                      <Button size="sm" variant="outline" onClick={() => setKeyExprModalOpen(true)}
                        disabled={isDisabled}
                        className="h-7 text-xs gap-1.5 transition-all border-purple-300 text-purple-600 hover:bg-purple-50"
                      >
                        <BookMarked className="w-3 h-3" />핵심표현
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setMaterialPickerOpen(true)}
                      disabled={isDisabled}
                      className="h-7 text-xs gap-1.5 transition-all border-gold/30 text-gold-dark hover:bg-gold/10"
                    >
                      <FileText className="w-3 h-3" />자료
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExtractVocab}
                      disabled={isDisabled || extracting || !notes.trim()}
                      className={cn("h-7 text-xs gap-1.5 transition-all border-navy/30 text-navy hover:bg-navy/10", extracted && "border-success/40 text-success")}
                    >
                      <BookMarked className="w-3 h-3" />
                      {extracting ? "추출 중..." : extracted ? "단어 추출됨 ✓" : "단어 추출"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDeleteExtractedVocab}
                      disabled={isDisabled}
                      className="h-7 text-xs gap-1.5 transition-all border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3 h-3" />단어 삭제
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
                      {saveFlash ? "저장됨 ✓" : "저장"}
                    </Button>
                    {isOffline && (
                      <span className="flex items-center gap-1 text-[10px] text-destructive font-semibold animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />오프라인
                      </span>
                    )}
                    <Button size="sm" variant="outline" onClick={handleOpenEditorFullscreen}
                      disabled={!session.sessionId}
                      className="h-7 text-xs gap-1.5 transition-all border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                      title="전체 화면 에디터 열기"
                    >
                      <Maximize2 className="w-3 h-3" />전체화면
                    </Button>
                  </div>
                </div>
                <NotesEditor
                  content={notes}
                  onChange={(newVal) => {
                    setNotes(newVal);
                    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
                    autoSaveTimer.current = setTimeout(() => autoSaveNotes(newVal), 100);
                    // Broadcast to fullscreen editor
                    fullscreenChannelRef.current?.send({
                      type: "broadcast",
                      event: "notes-update",
                      payload: { html: newVal, source: "classroom" },
                    });
                  }}
                  editable={notesEditMode}
                  disabled={isDisabled}
                  placeholder={`수업 내용을 자유롭게 타이핑하세요...\n\nToday's topic: ${session.topic}`}
                  editorRef={notesEditorRef}
                  studentName={session.dbStudentName}
                  level={session.level}
                />
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
                            {/* Show preset status: if it's a session copy of a preset, allow cancelling preset */}
                            {hw.presetOriginId ? (
                              <div className="flex items-center gap-2 px-1">
                                <span className="text-xs text-muted-foreground">🔁 정기 숙제</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm("정기 숙제를 해제하시겠습니까? 다음 수업부터 이 숙제가 자동으로 표시되지 않습니다.")) return;
                                    await supabase.from("homework_assignments").delete().eq("id", hw.presetOriginId!);
                                    await supabase.from("homework_assignments").update({ preset_origin_id: null }).eq("id", editingHwId!);
                                    setHwList(prev => prev.map(h => h.id === editingHwId ? { ...h, presetOriginId: undefined } : h));
                                    toast({ title: "정기 숙제 해제됨 ✓" });
                                    cancelEditHw();
                                  }}
                                  className="text-[10px] text-destructive hover:underline"
                                >
                                  정기 해제
                                </button>
                              </div>
                            ) : !hw.isPreset ? (
                              <label className="flex items-center gap-2 px-1 cursor-pointer">
                                <input type="checkbox" checked={editHwPreset} onChange={(e) => setEditHwPreset(e.target.checked)} className="rounded border-border" />
                                <span className="text-xs text-muted-foreground">정기 숙제로 등록 (모든 수업에 노출)</span>
                              </label>
                            ) : null}
                            {allGroupMembers.length > 0 && (
                              <div className="space-y-1.5 p-2.5 rounded-lg border border-border bg-muted/30">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-foreground">대상 학생 선택</span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedEditHwStudents(prev => prev.length === allGroupMembers.length ? [] : [...allGroupMembers])}
                                    className="text-[10px] text-[hsl(var(--navy))] hover:underline"
                                  >
                                    {selectedEditHwStudents.length === allGroupMembers.length ? "전체 해제" : "전체 선택"}
                                  </button>
                                </div>
                                {allGroupMembers.map(sn => (
                                  <label key={sn} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedEditHwStudents.includes(sn)}
                                      onChange={(e) => {
                                        setSelectedEditHwStudents(prev => e.target.checked ? [...prev, sn] : prev.filter(s => s !== sn));
                                      }}
                                      className="rounded border-border"
                                    />
                                    <span className="text-xs text-foreground">{sn}</span>
                                  </label>
                                ))}
                                {selectedEditHwStudents.length > 0 && selectedEditHwStudents.length < allGroupMembers.length && (
                                  <p className="text-[10px] text-muted-foreground">{selectedEditHwStudents.length}명 선택됨</p>
                                )}
                              </div>
                            )}
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
                              {allGroupMembers.length > 0 && hw.studentName && hw.studentName !== session.dbStudentName && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[hsl(var(--gold)/0.12)] text-[hsl(var(--gold-dark))]">{hw.studentName}</span>
                              )}
                              <span className="text-xs font-semibold text-foreground">{hw.title}</span>
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted", meta.color)}>{meta.label}</span>
                              {(hw.isPreset || hw.presetOriginId) && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[hsl(var(--navy)/0.1)] text-[hsl(var(--navy))]">정기</span>}
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
                        <label className="flex items-center gap-2 px-0.5 cursor-pointer">
                          <input type="checkbox" checked={newHwPreset} onChange={(e) => setNewHwPreset(e.target.checked)} className="rounded border-border" />
                          <span className="text-xs text-muted-foreground">정기 숙제로 등록 <span className="text-[10px]">(매 수업마다 자동 표시)</span></span>
                        </label>
                        {allGroupMembers.length > 0 && (
                          <div className="space-y-1.5 p-2.5 rounded-lg border border-border bg-muted/30">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-foreground">대상 학생 선택</span>
                              <button
                                type="button"
                                onClick={() => setSelectedHwStudents(prev => prev.length === allGroupMembers.length ? [] : [...allGroupMembers])}
                                className="text-[10px] text-[hsl(var(--navy))] hover:underline"
                              >
                                {selectedHwStudents.length === allGroupMembers.length ? "전체 해제" : "전체 선택"}
                              </button>
                            </div>
                            {allGroupMembers.map(sn => (
                              <label key={sn} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedHwStudents.length === 0 || selectedHwStudents.includes(sn)}
                                  onChange={(e) => {
                                    if (selectedHwStudents.length === 0) {
                                      setSelectedHwStudents(e.target.checked ? allGroupMembers : allGroupMembers.filter(s => s !== sn));
                                    } else {
                                      setSelectedHwStudents(prev => e.target.checked ? [...prev, sn] : prev.filter(s => s !== sn));
                                    }
                                  }}
                                  className="rounded border-border"
                                />
                                <span className="text-xs text-foreground">{sn}</span>
                              </label>
                            ))}
                            {selectedHwStudents.length > 0 && selectedHwStudents.length < allGroupMembers.length && (
                              <p className="text-[10px] text-muted-foreground">{selectedHwStudents.length}명 선택됨</p>
                            )}
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={handleAddHw} disabled={!newHwTitle.trim() || savingHw || (groupStudents.length > 0 && selectedHwStudents.length === 0 && false)}
                            className="flex-1 h-8 text-xs bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />{savingHw ? "저장 중..." : "추가"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setAddingHw(false); setNewHwTitle(""); setNewHwDesc(""); setNewHwPreset(false); setSelectedHwStudents([]); }} className="h-8 text-xs">취소</Button>
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

          {/* ── RIGHT COLUMN (학생 탭에서만 노출) ────────────────────────── */}
          {session.sessionId && role === "student" && (
            <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col gap-4 lg:gap-5 overflow-y-auto">
              <StudentExpressionPanel
                studentName={session.dbStudentName}
                sessionId={session.sessionId}
              />
              <StudentVocabPanel
                studentName={session.dbStudentName}
                scheduledAt={session.scheduledAt}
                sessionId={session.sessionId}
                instructorMode={true}
                noteContext={notes}
              />
            </div>
          )}

          {/* 강사 뷰: 레벨 테스트 패널은 SessionSidebar 푸터로 이동됨 */}

        </div>
        </div>
      )}
    </div>

    <DialogueGeneratorModal
      open={dialogueModalOpen}
      onClose={() => setDialogueModalOpen(false)}
      defaultLevel={session.level}
      defaultStudentName={session.dbStudentName}
      onInsert={(html) => {
        const editor = notesEditorRef.current;
        if (editor) {
          editor.chain().focus().insertContent(html).run();
          setNotes(editor.getHTML());
        }
      }}
    />
    <NewsLessonGeneratorModal
      open={newsLessonModalOpen}
      onClose={() => setNewsLessonModalOpen(false)}
      defaultLevel={session.level}
      defaultStudentName={session.dbStudentName}
      onInsert={(html) => {
        const editor = notesEditorRef.current;
        if (editor) {
          editor.chain().focus().insertContent(html).run();
          setNotes(editor.getHTML());
        }
      }}
    />
    <InsightGeneratorModal
      open={insightModalOpen}
      onClose={() => setInsightModalOpen(false)}
      defaultLevel={session.level}
      defaultStudentName={session.dbStudentName}
      onInsert={(html) => {
        const editor = notesEditorRef.current;
        if (editor) {
          editor.chain().focus().insertContent(html).run();
          setNotes(editor.getHTML());
        }
      }}
    />
    <KeyExpressionExtractModal
      open={keyExprModalOpen}
      onClose={() => setKeyExprModalOpen(false)}
      notesHtml={notes}
      level={session.level}
      sessionId={session.sessionId}
      studentNames={allGroupMembers.length > 0 ? allGroupMembers : [session.dbStudentName]}
      instructorName={session.instructorName}
    />
    <MaterialPickerModal
      open={materialPickerOpen}
      onOpenChange={setMaterialPickerOpen}
      onInsert={(content) => {
        const editor = notesEditorRef.current;
        if (editor) {
          editor.chain().focus().insertContent(content).run();
          setNotes(editor.getHTML());
        }
      }}
    />
    <NoteVersionsModal
      open={versionModalOpen}
      onOpenChange={setVersionModalOpen}
      sessionId={session.sessionId}
      onRestore={handleRestoreVersion}
    />
    {reviewModalHw && reviewSubmission && (
      <HomeworkFeedbackModal
        assignmentTitle={reviewModalHw.title}
        assignmentType={reviewModalHw.type}
        assignmentDescription={reviewModalHw.description}
        textContent={reviewSubmission.text_content}
        audioUrl={reviewSubmission.audio_url}
        fileUrl={reviewSubmission.file_url}
        instructorNote={reviewSubmission.instructor_note}
        reviewedAt={reviewSubmission.reviewed_at}
        aiCorrection={reviewSubmission.ai_correction as any}
        onClose={() => { setReviewModalHw(null); setReviewSubmission(null); }}
      />
    )}
    {reviewModalHw && !reviewSubmission && !reviewLoading && (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setReviewModalHw(null)}>
        <div className="bg-card rounded-xl p-6 max-w-sm text-center space-y-3" onClick={e => e.stopPropagation()}>
          <p className="text-sm font-semibold text-foreground">제출된 숙제가 없습니다</p>
          <p className="text-xs text-muted-foreground">학생이 아직 이 숙제를 제출하지 않았습니다.</p>
          <Button size="sm" onClick={() => setReviewModalHw(null)}>닫기</Button>
        </div>
      </div>
    )}
    {role === "student" && session.dbStudentName && (
      <RenewalDecisionModal
        studentName={session.dbStudentName}
        triggerKey={session.sessionId}
      />
    )}
    </>
  );
}
