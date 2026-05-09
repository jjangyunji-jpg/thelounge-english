import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, Square, Play, Pause, Send, CheckCircle2, RotateCcw,
  PenLine, BookOpen, Brain, ChevronDown, ChevronUp, Loader2,
  Clock, MessageSquare, CheckSquare, ExternalLink, Link2, Paperclip, FileUp, X as XIcon, Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import HomeworkFeedbackModal from "@/components/dashboard/HomeworkFeedbackModal";

type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file" | "watching";

interface Assignment {
  id: string;
  type: HwType;
  title: string;
  description: string | null;
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
  submitted_at: string;
  instructor_note: string | null;
  reviewed_at: string | null;
  ai_correction: any | null;
}

const HW_META: Record<HwType, {
  label: string;
  icon: React.ElementType;
  color: string;
  requiresText: boolean;
  requiresAudio: boolean;
  requiresFile?: boolean;
  hint: string;
}> = {
  writing:    { label: "쓰기",       icon: PenLine,    color: "text-[hsl(var(--navy))]",      requiresText: true,  requiresAudio: false, hint: "텍스트 작성 필수" },
  reading:    { label: "읽기",       icon: BookOpen,   color: "text-[hsl(var(--gold-dark))]", requiresText: false, requiresAudio: false, hint: "녹음 선택" },
  speaking:   { label: "말하기",     icon: Mic,        color: "text-[hsl(var(--success))]",   requiresText: false, requiresAudio: true,  hint: "녹음 필수" },
  memorizing: { label: "외우기",     icon: Brain,      color: "text-purple-500",              requiresText: false, requiresAudio: false, hint: "녹음 선택" },
  file:       { label: "파일올리기", icon: Paperclip,  color: "text-blue-500",                requiresText: false, requiresAudio: false, requiresFile: true, hint: "파일 첨부 필수" },
  watching:   { label: "시청하기",   icon: Monitor,    color: "text-rose-500",                requiresText: false, requiresAudio: false, hint: "시청 후 체크" },
};

// ── URL detection helpers ──────────────────────────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

function extractUrls(text: string | null): string[] {
  if (!text) return [];
  return text.match(URL_REGEX) || [];
}

function getDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

function removeUrls(text: string): string {
  return text.replace(URL_REGEX, "").replace(/\n{2,}/g, "\n").trim();
}

function BookmarkCard({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 hover:border-[hsl(var(--gold)/0.5)] transition-all group"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-[hsl(var(--gold)/0.15)] flex items-center justify-center">
        <Link2 className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate group-hover:text-[hsl(var(--gold-dark))] transition-colors">
          {getDomain(url)}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{url}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[hsl(var(--gold-dark))] flex-shrink-0 transition-colors" />
    </a>
  );
}
function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      alert("마이크 접근 권한이 필요합니다.");
    }
  }, []);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioUrl) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      const a = new Audio(audioUrl);
      audioRef.current = a;
      a.onended = () => setPlaying(false);
      a.play();
      setPlaying(true);
    }
  }, [audioUrl, playing]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return { recording, audioBlob, audioUrl, playing, duration, start, stop, reset, togglePlay, fmt };
}

// ── Submission Card ────────────────────────────────────────────────────────────
function SubmissionCard({
  assignment,
  submission,
  studentName,
  onSubmitted,
  onViewFeedback,
}: {
  assignment: Assignment;
  submission: Submission | null;
  studentName: string;
  onSubmitted: (sub: Submission) => void;
  onViewFeedback: (assignment: Assignment, submission: Submission) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(true);
  const [text, setText] = useState(submission?.text_content ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const meta = HW_META[assignment.type];
  const Icon = meta.icon;
  const recorder = useAudioRecorder();

  const canSubmit =
    (!meta.requiresText || text.trim().length > 0) &&
    (!meta.requiresAudio || recorder.audioBlob !== null) &&
    (!meta.requiresFile || fileObj !== null);

  const handleSubmit = async () => {
    setSubmitting(true);
    let audioStorageUrl: string | null = null;
    let fileStorageUrl: string | null = null;

    try {
      if (recorder.audioBlob) {
        const path = `${assignment.id}/${Date.now()}.webm`;
        const { error: upErr } = await supabase.storage
          .from("homework-audio")
          .upload(path, recorder.audioBlob, { contentType: "audio/webm", upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("homework-audio").getPublicUrl(path);
        audioStorageUrl = pub.publicUrl;
      }

      if (fileObj) {
        const ext = fileObj.name.split(".").pop() || "file";
        const path = `${assignment.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("homework-files")
          .upload(path, fileObj, { contentType: fileObj.type, upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("homework-files").getPublicUrl(path);
        fileStorageUrl = pub.publicUrl;
      }

      let resultSub: Submission | null = null;
      if (submission) {
        const { data, error } = await supabase
          .from("homework_submissions")
          .update({
            text_content: text.trim() || null,
            audio_url: audioStorageUrl ?? submission.audio_url,
            file_url: fileStorageUrl ?? submission.file_url,
            status: "submitted",
            submitted_at: new Date().toISOString(),
          })
          .eq("id", submission.id)
          .select()
          .single();
        if (error) throw error;
        resultSub = data;
      } else {
        const { data, error } = await supabase
          .from("homework_submissions")
          .insert({
            assignment_id: assignment.id,
            student_name: studentName,
            text_content: text.trim() || null,
            audio_url: audioStorageUrl,
            file_url: fileStorageUrl,
            status: "submitted",
          })
          .select()
          .single();
        if (error) throw error;
        resultSub = data;
      }

      toast({ title: "숙제가 제출됐습니다 ✓" });
      if (resultSub) onSubmitted(resultSub);
      setOpen(false);
    } catch (e: unknown) {
      toast({ title: "제출 실패", description: e instanceof Error ? e.message : "오류가 발생했습니다", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const submitted = !!submission && submission.status === "submitted";
  const reviewed = !!submission && submission.status === "reviewed";

  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden transition-all",
      reviewed ? "border-[hsl(var(--success)/0.5)]" : submitted ? "border-[hsl(var(--gold)/0.4)]" : "border-border"
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => {
          if (reviewed && submission) {
            onViewFeedback(assignment, submission);
          } else {
            setOpen((v) => !v);
          }
        }}
      >
        <div className={cn("flex-shrink-0", meta.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{assignment.title}</span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted", meta.color)}>
              {meta.label}
            </span>
            {reviewed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]">
                검토 완료
              </span>
            )}
            {submitted && !reviewed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]">
                제출 완료
              </span>
            )}
          </div>
          {assignment.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{assignment.description}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          {submitted || reviewed
            ? <CheckCircle2 className={cn("w-4 h-4", reviewed ? "text-[hsl(var(--success))]" : "text-[hsl(var(--gold))]")} />
            : open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

        {/* Body */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50">
          {/* Description (collapsible) */}
          {assignment.description && (
            <div className="mt-3 rounded-lg border border-border/60 overflow-hidden">
              <button
                onClick={() => setDescOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
              >
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">상세 내용</span>
                {descOpen ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
              </button>
              {descOpen && (
                <div className="px-3 py-2.5 bg-muted/20 space-y-2">
                  {/* Bookmark cards for URLs */}
                  {extractUrls(assignment.description).map((url, i) => (
                    <BookmarkCard key={i} url={url} />
                  ))}
                  {/* Remaining text */}
                  {removeUrls(assignment.description) && (
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {removeUrls(assignment.description)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Instructor note (reviewed) */}
          {submission?.instructor_note && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[hsl(var(--success)/0.08)] border border-[hsl(var(--success)/0.2)]">
              <p className="text-xs font-semibold text-[hsl(var(--success))] mb-0.5">강사 피드백</p>
              <p className="text-xs text-foreground line-clamp-2">{submission.instructor_note}</p>
            </div>
          )}

          {/* View full feedback button */}
          {submission && (submission.status === "reviewed" || submission.ai_correction) && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full h-8 text-xs gap-1.5"
              onClick={(e) => { e.stopPropagation(); onViewFeedback(assignment, submission); }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              검토 결과 보기
            </Button>
          )}

          {/* Previous submission playback */}
          {submission?.audio_url && (
            <div className="mt-3">
              <p className="text-[10px] text-muted-foreground mb-1">제출된 녹음</p>
              <audio controls src={submission.audio_url} className="w-full h-8" />
            </div>
          )}

          {/* Text area */}
          {(meta.requiresText || assignment.type === "memorizing") && (
            <div className="mt-3">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck
                lang="en"
                placeholder={
                  meta.requiresText
                    ? "여기에 작성하세요 (필수)"
                    : "메모 또는 자유 작성 (선택)"
                }
                className={cn(
                  "resize-none text-sm",
                  assignment.type === "writing" ? "min-h-[200px]" : "min-h-[100px]"
                )}
              />
            </div>
          )}

          {/* Audio recorder */}
          {(meta.requiresAudio || assignment.type === "reading" || assignment.type === "memorizing") && (
            <div className="mt-3">
              <p className="text-[10px] text-muted-foreground mb-2">
                {meta.requiresAudio ? "음성 녹음 (필수)" : "음성 녹음 (선택)"}
              </p>
              {!recorder.audioBlob ? (
                <div className="flex items-center gap-2">
                  {!recorder.recording ? (
                    <Button
                      size="sm"
                      onClick={recorder.start}
                      className="gap-2 h-8 text-xs bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.85)] text-white"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      녹음 시작
                    </Button>
                  ) : (
                    <>
                      <span className="flex items-center gap-1.5 text-xs text-destructive font-mono font-bold">
                        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                        {recorder.fmt(recorder.duration)}
                      </span>
                      <Button
                        size="sm"
                        onClick={recorder.stop}
                        className="gap-2 h-8 text-xs bg-destructive hover:bg-destructive/85 text-destructive-foreground"
                      >
                        <Square className="w-3 h-3 fill-white" />
                        녹음 중지
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                  <Button size="icon" variant="ghost" className="w-7 h-7" onClick={recorder.togglePlay}>
                    {recorder.playing
                      ? <Pause className="w-3.5 h-3.5" />
                      : <Play className="w-3.5 h-3.5" />}
                  </Button>
                  <span className="text-xs text-muted-foreground flex-1">
                    녹음 완료 ({recorder.fmt(recorder.duration)})
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={recorder.reset}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="w-3 h-3" />
                    다시 녹음
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* File upload */}
          {meta.requiresFile && (
            <div className="mt-3">
              <p className="text-[10px] text-muted-foreground mb-2">파일 첨부 (필수)</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) setFileObj(e.target.files[0]); }}
              />
              {!fileObj ? (
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}
                  className="gap-2 h-8 text-xs border-dashed">
                  <FileUp className="w-3.5 h-3.5" /> 파일 선택
                </Button>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                  <Paperclip className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span className="text-xs text-foreground flex-1 truncate">{fileObj.name}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {(fileObj.size / 1024).toFixed(0)}KB
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => { setFileObj(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                    <XIcon className="w-3 h-3" />
                  </Button>
                </div>
              )}
              {submission?.file_url && (
                <a href={submission.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 mt-2 text-xs text-blue-500 hover:underline">
                  <Paperclip className="w-3 h-3" /> 이전 제출 파일 보기
                </a>
              )}
            </div>
          )}

          {/* Submit button */}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || recorder.recording}
            className="w-full h-9 text-sm gap-2 bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground mt-1"
          >
            {submitting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />제출 중...</>
            ) : submitted ? (
              <><Send className="w-3.5 h-3.5" />다시 제출</>
            ) : (
              <><Send className="w-3.5 h-3.5" />숙제 완료하기</>
            )}
          </Button>

          {!canSubmit && !submitting && (
            <p className="text-[10px] text-muted-foreground text-center">
              {meta.requiresText && !text.trim() && "텍스트 작성이 필요합니다"}
              {meta.requiresAudio && !recorder.audioBlob && "녹음이 필요합니다"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
export default function StudentHomeworkPanel({
  studentName,
  sessionId,
  showPreviousCycle = false,
}: {
  studentName: string;
  sessionId: string;
  /**
   * When true (e.g. student dashboard 수업 노트 past-session view), display the
   * homework cycle that was DUE BEFORE this session — i.e. the cards tied to
   * the immediately-previous session. Submissions made between the previous
   * session and this session are reflected as completion for THIS session view.
   * When false (default — used in classroom during a live class), use the
   * given sessionId directly.
   */
  showPreviousCycle?: boolean;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [loading, setLoading] = useState(true);
  const [feedbackTarget, setFeedbackTarget] = useState<{ assignment: Assignment; submission: Submission } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // First, fetch sessions to determine effective sessionId (for previous-cycle mode)
      const { data: sessionRows } = await supabase
        .from("class_sessions")
        .select("id, scheduled_at")
        .eq("student_name", studentName)
        .order("scheduled_at", { ascending: true });
      const sessions = (sessionRows ?? []) as { id: string; scheduled_at: string }[];

      let effectiveSessionId = sessionId;
      if (showPreviousCycle) {
        const current = sessions.find((s) => s.id === sessionId);
        if (current) {
          const currentTs = new Date(current.scheduled_at).getTime();
          const previous = [...sessions]
            .filter((s) => new Date(s.scheduled_at).getTime() < currentTs)
            .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];
          if (previous) effectiveSessionId = previous.id;
        }
      }

      const [{ data: asgn }, { data: subs }] = await Promise.all([
        supabase
          .from("homework_assignments")
          .select("id, type, title, description, is_preset, session_id, preset_origin_id")
          .eq("student_name", studentName)
          .or(`session_id.eq.${effectiveSessionId},is_preset.eq.true`)
          .order("created_at", { ascending: true }),
        supabase
          .from("homework_submissions")
          .select("*")
          .eq("student_name", studentName),
      ]);

      const assignmentRows = (asgn ?? []) as (Assignment & { preset_origin_id?: string | null })[];
      const submissionRows = (subs ?? []) as Submission[];

      // Filter out preset templates that have session copies for the effective session
      const copyOriginIds = new Set(
        assignmentRows.filter(a => a.preset_origin_id && a.session_id === effectiveSessionId)
          .map(a => a.preset_origin_id)
      );
      const filtered = assignmentRows.filter(a => {
        if (a.is_preset && copyOriginIds.has(a.id)) return false;
        return true;
      });

      setAssignments(filtered);

      const currentSession = sessions.find((s) => s.id === effectiveSessionId) ?? null;
      const currentSessionTime = currentSession ? new Date(currentSession.scheduled_at).getTime() : null;
      const nextSessionTime = currentSession
        ? sessions
            .filter((s) => new Date(s.scheduled_at).getTime() > currentSessionTime!)
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]?.scheduled_at ?? null
        : null;
      const nextSessionTs = nextSessionTime ? new Date(nextSessionTime).getTime() : Number.POSITIVE_INFINITY;

      const groupedByAssignment = submissionRows.reduce<Record<string, Submission[]>>((acc, sub) => {
        if (!sub.assignment_id) return acc;
        if (!acc[sub.assignment_id]) acc[sub.assignment_id] = [];
        acc[sub.assignment_id].push(sub);
        return acc;
      }, {});

      const pickLatest = (list: Submission[]) =>
        [...list].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0] ?? null;

      const subMap: Record<string, Submission> = {};
      filtered.forEach((assignment) => {
        const candidates = groupedByAssignment[assignment.id] ?? [];
        if (candidates.length === 0) return;

        // Only use time-window for remaining preset templates (fallback when no session copy exists)
        if (assignment.is_preset && currentSessionTime) {
          const inWindow = candidates.filter((sub) => {
            const ts = new Date(sub.submitted_at).getTime();
            return ts >= currentSessionTime && ts < nextSessionTs;
          });
          const selected = pickLatest(inWindow);
          if (selected) subMap[assignment.id] = selected;
          return;
        }

        // Session-specific assignments (including auto-copies): any submission counts
        const latest = pickLatest(candidates);
        if (latest) subMap[assignment.id] = latest;
      });

      setSubmissions(subMap);
      setLoading(false);
    };
    load();
  }, [studentName, sessionId, showPreviousCycle]);

  const handleSubmitted = (assignmentId: string, sub: Submission) => {
    setSubmissions((prev) => ({ ...prev, [assignmentId]: sub }));
  };

  const total = assignments.length;
  const submitted = assignments.filter(a => submissions[a.id]?.status === "submitted" || submissions[a.id]?.status === "reviewed").length;

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-gold" />
            <span className="font-semibold text-sm text-foreground">숙제</span>
            {!loading && (
              <span className="text-xs bg-gold/15 text-gold-dark px-1.5 py-0.5 rounded-full font-medium">
                {submitted}/{total} 완료
              </span>
            )}
          </div>
          {!loading && total > 0 && submitted === total && (
            <span className="text-xs text-[hsl(var(--success))] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              모두 제출됨
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">등록된 숙제가 없습니다</p>
            <p className="text-xs text-muted-foreground/60">강사가 숙제를 추가하면 여기에 표시됩니다</p>
          </div>
        ) : (
          assignments.map((a) => (
            <SubmissionCard
              key={a.id}
              assignment={a}
              submission={submissions[a.id] ?? null}
              studentName={studentName}
              onSubmitted={(sub) => handleSubmitted(a.id, sub)}
              onViewFeedback={(asgn, sub) => setFeedbackTarget({ assignment: asgn, submission: sub })}
            />
          ))
        )}
      </div>

      {/* Feedback Modal */}
      {feedbackTarget && (
        <HomeworkFeedbackModal
          assignmentTitle={feedbackTarget.assignment.title}
          assignmentType={feedbackTarget.assignment.type}
          assignmentDescription={feedbackTarget.assignment.description}
          textContent={feedbackTarget.submission.text_content}
          audioUrl={feedbackTarget.submission.audio_url}
          fileUrl={feedbackTarget.submission.file_url}
          instructorNote={feedbackTarget.submission.instructor_note}
          reviewedAt={feedbackTarget.submission.reviewed_at}
          aiCorrection={feedbackTarget.submission.ai_correction}
          onClose={() => setFeedbackTarget(null)}
        />
      )}
    </div>
  );
}
