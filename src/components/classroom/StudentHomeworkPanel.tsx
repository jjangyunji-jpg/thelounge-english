import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, Square, Play, Pause, Send, CheckCircle2, RotateCcw,
  PenLine, BookOpen, Brain, ChevronDown, ChevronUp, Loader2,
  Clock, MessageSquare, CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type HwType = "writing" | "reading" | "speaking" | "memorizing";

interface Assignment {
  id: string;
  type: HwType;
  title: string;
  description: string | null;
  is_preset: boolean;
}

interface Submission {
  id: string;
  assignment_id: string | null;
  status: string;
  text_content: string | null;
  audio_url: string | null;
  submitted_at: string;
  instructor_note: string | null;
}

const HW_META: Record<HwType, {
  label: string;
  icon: React.ElementType;
  color: string;
  requiresText: boolean;
  requiresAudio: boolean;
  hint: string;
}> = {
  writing:    { label: "쓰기",   icon: PenLine,   color: "text-[hsl(var(--navy))]",      requiresText: true,  requiresAudio: false, hint: "텍스트 작성 필수" },
  reading:    { label: "읽기",   icon: BookOpen,  color: "text-[hsl(var(--gold-dark))]", requiresText: false, requiresAudio: false, hint: "녹음 선택" },
  speaking:   { label: "말하기", icon: Mic,       color: "text-[hsl(var(--success))]",   requiresText: false, requiresAudio: true,  hint: "녹음 필수" },
  memorizing: { label: "외우기", icon: Brain,     color: "text-purple-500",              requiresText: false, requiresAudio: false, hint: "녹음 선택" },
};

// ── Audio Recorder ─────────────────────────────────────────────────────────────
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
}: {
  assignment: Assignment;
  submission: Submission | null;
  studentName: string;
  onSubmitted: (sub: Submission) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(true);
  const [text, setText] = useState(submission?.text_content ?? "");
  const [submitting, setSubmitting] = useState(false);
  const meta = HW_META[assignment.type];
  const Icon = meta.icon;
  const recorder = useAudioRecorder();

  const canSubmit =
    (!meta.requiresText || text.trim().length > 0) &&
    (!meta.requiresAudio || recorder.audioBlob !== null);

  const handleSubmit = async () => {
    setSubmitting(true);
    let audioStorageUrl: string | null = null;

    try {
      // 1. 오디오 업로드
      if (recorder.audioBlob) {
        const path = `${studentName}/${assignment.id}/${Date.now()}.webm`;
        const { error: upErr } = await supabase.storage
          .from("homework-audio")
          .upload(path, recorder.audioBlob, { contentType: "audio/webm", upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("homework-audio").getPublicUrl(path);
        audioStorageUrl = pub.publicUrl;
      }

      // 2. 기존 제출물이 있으면 업데이트, 없으면 insert
      let resultSub: Submission | null = null;
      if (submission) {
        const { data, error } = await supabase
          .from("homework_submissions")
          .update({
            text_content: text.trim() || null,
            audio_url: audioStorageUrl ?? submission.audio_url,
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
        onClick={() => setOpen((v) => !v)}
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
                <div className="px-3 py-2.5 bg-muted/20">
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{assignment.description}</p>
                </div>
              )}
            </div>
          )}
          {/* Instructor note (reviewed) */}
          {submission?.instructor_note && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[hsl(var(--success)/0.08)] border border-[hsl(var(--success)/0.2)]">
              <p className="text-xs font-semibold text-[hsl(var(--success))] mb-0.5">강사 피드백</p>
              <p className="text-xs text-foreground">{submission.instructor_note}</p>
            </div>
          )}

          {/* Previous submission playback */}
          {submission?.audio_url && (
            <div className="mt-3">
              <p className="text-[10px] text-muted-foreground mb-1">제출된 녹음</p>
              <audio controls src={submission.audio_url} className="w-full h-8" />
            </div>
          )}

          {/* Text area */}
          {(meta.requiresText || assignment.type === "reading" || assignment.type === "memorizing") && (
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
                className="min-h-[100px] resize-none text-sm"
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
export default function StudentHomeworkPanel({ studentName, sessionId }: { studentName: string; sessionId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: asgn }, { data: subs }] = await Promise.all([
        supabase
          .from("homework_assignments")
          .select("id, type, title, description, is_preset, session_id")
          .eq("student_name", studentName)
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true }),
        supabase
          .from("homework_submissions")
          .select("*")
          .eq("student_name", studentName),
      ]);

      setAssignments((asgn ?? []) as Assignment[]);

      const subMap: Record<string, Submission> = {};
      (subs ?? []).forEach((s) => {
        if (s.assignment_id) subMap[s.assignment_id] = s as Submission;
      });
      setSubmissions(subMap);
      setLoading(false);
    };
    load();
  }, [studentName, sessionId]);

  const handleSubmitted = (assignmentId: string, sub: Submission) => {
    setSubmissions((prev) => ({ ...prev, [assignmentId]: sub }));
  };

  const submitted = Object.keys(submissions).length;
  const total = assignments.length;

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
            />
          ))
        )}
      </div>
    </div>
  );
}
