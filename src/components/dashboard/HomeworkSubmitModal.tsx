import { useState, useRef, useCallback, useEffect } from "react";
import {
  Mic, Square, Play, Pause, Send, RotateCcw, Loader2, X,
  PenLine, BookOpen, Brain, Paperclip, FileUp, Monitor, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type HwType = "writing" | "reading" | "speaking" | "memorizing" | "file" | "watching";

const HW_META: Record<HwType, {
  label: string; icon: React.ElementType; color: string;
  requiresText: boolean; requiresAudio: boolean; requiresFile?: boolean;
}> = {
  writing:    { label: "쓰기",       icon: PenLine,    color: "text-[hsl(var(--navy))]",      requiresText: true,  requiresAudio: false },
  reading:    { label: "읽기",       icon: BookOpen,   color: "text-[hsl(var(--gold-dark))]", requiresText: false, requiresAudio: false },
  speaking:   { label: "말하기",     icon: Mic,        color: "text-[hsl(var(--success))]",   requiresText: false, requiresAudio: false },
  memorizing: { label: "외우기",     icon: Brain,      color: "text-purple-500",              requiresText: false, requiresAudio: false },
  file:       { label: "파일올리기", icon: Paperclip,  color: "text-blue-500",                requiresText: false, requiresAudio: false, requiresFile: true },
  watching:   { label: "시청하기",   icon: Monitor,    color: "text-rose-500",                requiresText: false, requiresAudio: false },
};

interface Assignment {
  id: string;
  type: string;
  title: string;
  description: string | null;
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
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch { alert("마이크 접근 권한이 필요합니다."); }
  }, []);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const reset = useCallback(() => { setAudioBlob(null); setAudioUrl(null); setDuration(0); setPlaying(false); }, []);

  const togglePlay = useCallback(() => {
    if (!audioUrl) return;
    if (playing) { audioRef.current?.pause(); setPlaying(false); }
    else {
      const a = new Audio(audioUrl);
      audioRef.current = a;
      a.onended = () => setPlaying(false);
      a.play(); setPlaying(true);
    }
  }, [audioUrl, playing]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return { recording, audioBlob, audioUrl, playing, duration, start, stop, reset, togglePlay, fmt };
}

export default function HomeworkSubmitModal({
  assignment, submission, studentName, onClose, onSubmitted,
}: {
  assignment: Assignment;
  submission: Submission | null;
  studentName: string;
  onClose: () => void;
  onSubmitted: (sub: Submission) => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState(submission?.text_content ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const meta = HW_META[assignment.type as HwType] ?? HW_META.writing;
  const Icon = meta.icon;
  const recorder = useAudioRecorder();

  const isDraft = submission?.status === "draft";

  // Auto-save draft every 30 seconds if text changed
  const lastSavedTextRef = useRef(submission?.text_content ?? "");
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submissionRef = useRef(submission);
  submissionRef.current = submission;
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    autoSaveTimerRef.current = setInterval(async () => {
      const currentText = textRef.current;
      if (!currentText.trim() || currentText === lastSavedTextRef.current) return;
      // Don't auto-save if already submitted and reviewed
      if (submissionRef.current?.status === "reviewed") return;

      try {
        const status = submissionRef.current?.status === "submitted" ? "submitted" : "draft";
        if (submissionRef.current) {
          const { data, error } = await supabase
            .from("homework_submissions")
            .update({ text_content: currentText.trim(), status })
            .eq("id", submissionRef.current.id)
            .select()
            .single();
          if (!error && data) {
            lastSavedTextRef.current = currentText;
            onSubmitted(data);
          }
        } else {
          const { data, error } = await supabase
            .from("homework_submissions")
            .insert({
              assignment_id: assignment.id,
              student_name: studentName,
              text_content: currentText.trim(),
              status: "draft",
            })
            .select()
            .single();
          if (!error && data) {
            lastSavedTextRef.current = currentText;
            submissionRef.current = data;
            onSubmitted(data);
          }
        }
      } catch {}
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [assignment.id, studentName, onSubmitted]);

  const isReadingType = assignment.type === "reading" || assignment.type === "watching";
  const showTextArea = meta.requiresText || assignment.type === "memorizing" || isReadingType;
  const showAudio = meta.requiresAudio || assignment.type === "memorizing";
  const showFile = !!meta.requiresFile;

  // Reading/watching: text is optional, no other requirements
  const canSubmit = isReadingType
    ? true
    : (!meta.requiresText || text.trim().length > 0) &&
      (!meta.requiresAudio || recorder.audioBlob !== null) &&
      (!meta.requiresFile || fileObj !== null);

  const canSaveDraft = text.trim().length > 0 || recorder.audioBlob !== null || fileObj !== null;

  const saveOrSubmit = async (asDraft: boolean) => {
    if (asDraft) setSavingDraft(true);
    else setSubmitting(true);

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

      const status = asDraft ? "draft" : "submitted";
      let resultSub: Submission | null = null;

      if (submission) {
        const { data, error } = await supabase
          .from("homework_submissions")
          .update({
            text_content: text.trim() || null,
            audio_url: audioStorageUrl ?? submission.audio_url,
            file_url: fileStorageUrl ?? (submission as any).file_url,
            status,
            submitted_at: asDraft ? submission.submitted_at ?? new Date().toISOString() : new Date().toISOString(),
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
            status,
          })
          .select()
          .single();
        if (error) throw error;
        resultSub = data;
      }

      if (asDraft) {
        lastSavedTextRef.current = text;
        toast({ title: "임시저장 완료 ✓" });
        if (resultSub) onSubmitted(resultSub);
      } else {
        toast({ title: "숙제가 제출됐습니다 ✓" });
        if (resultSub) onSubmitted(resultSub);
        onClose();
      }
    } catch (e: unknown) {
      toast({ title: asDraft ? "임시저장 실패" : "제출 실패", description: e instanceof Error ? e.message : "오류 발생", variant: "destructive" });
    } finally {
      setSubmitting(false);
      setSavingDraft(false);
    }
  };

  const handleSubmit = () => saveOrSubmit(false);
  const handleSaveDraft = () => saveOrSubmit(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-xl shadow-2xl border border-border overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Icon className={cn("w-4 h-4", meta.color)} />
            <span className="text-sm font-bold text-foreground">{assignment.title}</span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted", meta.color)}>{meta.label}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Description */}
          {assignment.description && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/50">
              {assignment.description}
            </p>
          )}

          {/* Previous submission */}
          {submission?.audio_url && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">이전 녹음</p>
              <audio controls src={submission.audio_url} className="w-full h-8" />
            </div>
          )}

          {/* Instructor note */}
          {submission?.instructor_note && (
            <div className="px-3 py-2 rounded-lg bg-[hsl(var(--success)/0.08)] border border-[hsl(var(--success)/0.2)]">
              <p className="text-xs font-semibold text-[hsl(var(--success))] mb-0.5">강사 피드백</p>
              <p className="text-xs text-foreground">{submission.instructor_note}</p>
            </div>
          )}

          {/* Text area */}
          {showTextArea && (
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              spellCheck lang="en"
              placeholder={isReadingType ? "읽은 내용에 대한 감상이나 메모를 남겨주세요 (선택)" : meta.requiresText ? "여기에 작성하세요 (필수)" : "메모 또는 자유 작성 (선택)"}
              className={cn("resize-none text-sm", assignment.type === "writing" ? "min-h-[200px]" : "min-h-[100px]")}
            />
          )}

          {/* Audio recorder */}
          {showAudio && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">
                {meta.requiresAudio ? "음성 녹음 (필수)" : "음성 녹음 (선택)"}
              </p>
              {!recorder.audioBlob ? (
                <div className="flex items-center gap-2">
                  {!recorder.recording ? (
                    <Button size="sm" onClick={recorder.start}
                      className="gap-2 h-8 text-xs bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.85)] text-white">
                      <Mic className="w-3.5 h-3.5" /> 녹음 시작
                    </Button>
                  ) : (
                    <>
                      <span className="flex items-center gap-1.5 text-xs text-destructive font-mono font-bold">
                        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                        {recorder.fmt(recorder.duration)}
                      </span>
                      <Button size="sm" onClick={recorder.stop}
                        className="gap-2 h-8 text-xs bg-destructive hover:bg-destructive/85 text-destructive-foreground">
                        <Square className="w-3 h-3 fill-white" /> 녹음 중지
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                  <Button size="icon" variant="ghost" className="w-7 h-7" onClick={recorder.togglePlay}>
                    {recorder.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </Button>
                  <span className="text-xs text-muted-foreground flex-1">녹음 완료 ({recorder.fmt(recorder.duration)})</span>
                  <Button size="sm" variant="ghost" onClick={recorder.reset}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                    <RotateCcw className="w-3 h-3" /> 다시
                  </Button>
                </div>
              )}
            </div>
           )}

          {/* File upload */}
          {showFile && (
            <div>
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
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border bg-muted/20 space-y-2">
          {isDraft && (
            <p className="text-[10px] text-muted-foreground text-center">📝 임시저장된 내용입니다</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSaveDraft}
              disabled={!canSaveDraft || savingDraft || submitting || recorder.recording}
              className="h-9 text-sm gap-2 flex-shrink-0">
              {savingDraft
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />저장 중...</>
                : <><Save className="w-3.5 h-3.5" />임시저장</>}
            </Button>
            <Button size="sm" onClick={handleSubmit}
              disabled={!canSubmit || submitting || recorder.recording}
              className="flex-1 h-9 text-sm gap-2 bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground">
              {submitting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />제출 중...</>
                : <><Send className="w-3.5 h-3.5" />{submission && !isDraft ? "숙제 수정하기" : "숙제 제출하기"}</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
