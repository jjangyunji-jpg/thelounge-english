import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft, CheckSquare, FileText, Mic, MicOff, Play,
  Pause, Upload, MessageSquare, Clock, Check, X,
  ChevronDown, ChevronUp, RefreshCw, BookOpen, User,
  PenLine, Brain, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


type Role = "instructor" | "student";
type HwType = "writing" | "reading" | "speaking" | "memorizing";

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  student_name: string;
  due_at: string | null;
  is_preset: boolean;
  session_id: string | null;
  created_at: string;
};

type Submission = {
  id: string;
  assignment_id: string | null;
  student_name: string;
  status: string;
  text_content: string | null;
  audio_url: string | null;
  submitted_at: string;
  instructor_note: string | null;
  reviewed_at: string | null;
};

// Demo students
const STUDENTS = ["김민준", "이서연", "박지호"];
const CURRENT_STUDENT = "김민준";

const HW_TYPE_META: Record<HwType, { label: string; icon: React.ElementType; color: string; hint: string }> = {
  writing:    { label: "쓰기",   icon: PenLine,  color: "text-[hsl(var(--navy))]",      hint: "텍스트 작성 필수" },
  reading:    { label: "읽기",   icon: BookOpen, color: "text-[hsl(var(--gold-dark))]", hint: "녹음 필수" },
  speaking:   { label: "말하기", icon: Mic,      color: "text-[hsl(var(--success))]",   hint: "녹음 필수 / 텍스트 선택" },
  memorizing: { label: "외우기", icon: Brain,    color: "text-purple-500",              hint: "녹음 필수 (대화문 등)" },
};

// ── URL / YouTube helpers ─────────────────────────────────────────────────────
function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function isUrl(str: string) {
  return /^https?:\/\/\S+/.test(str);
}

// Render description: plain text + clickable links + YouTube embeds
function RichDescription({ text }: { text: string }) {
  // Split on whitespace-bounded URLs
  const tokens = text.split(/(\s+)/);
  const urlTokens = text.split(/\s+/).filter(Boolean);

  // Collect YouTube IDs to render embeds at the bottom
  const ytIds: string[] = [];
  const inlineNodes: React.ReactNode[] = [];

  let keyIdx = 0;
  for (const raw of tokens) {
    const trimmed = raw.trim();
    if (!trimmed) {
      inlineNodes.push(raw); // preserve whitespace
      continue;
    }
    if (isUrl(trimmed)) {
      const ytId = getYouTubeId(trimmed);
      if (ytId && !ytIds.includes(ytId)) ytIds.push(ytId);
      inlineNodes.push(
        <a
          key={keyIdx++}
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[hsl(var(--navy))] underline underline-offset-2 hover:text-[hsl(var(--navy-light))] break-all"
        >
          {trimmed}
          <ExternalLink className="w-3 h-3 flex-shrink-0 ml-0.5" />
        </a>
      );
    } else {
      inlineNodes.push(<span key={keyIdx++}>{raw}</span>);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground leading-relaxed">{inlineNodes}</p>
      {ytIds.map((id) => (
        <div key={id} className="rounded-xl overflow-hidden border border-border aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${id}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      ))}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const meta = HW_TYPE_META[type as HwType];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted", meta.color)}>
      <Icon className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short", day: "numeric", weekday: "short"
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "reviewed") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]">
      <Check className="w-3 h-3" /> 검토 완료
    </span>
  );
  if (status === "submitted") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]">
      <Clock className="w-3 h-3" /> 제출됨
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
      <X className="w-3 h-3" /> 미제출
    </span>
  );
}

// ── Audio Recorder hook ──────────────────────────────────────────────────────
function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setRecording(true);
    } catch {
      alert("마이크 권한이 필요합니다.");
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const reset = () => {
    setAudioBlob(null);
    setAudioUrl(null);
  };

  return { recording, audioBlob, audioUrl, start, stop, reset };
}

// ── Student View ─────────────────────────────────────────────────────────────
function StudentView({ studentName }: { studentName: string }) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { recording, audioBlob, audioUrl, start, stop, reset } = useAudioRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, [studentName]);

  const fetchAssignments = async () => {
    const { data: asgn } = await supabase
      .from("homework_assignments")
      .select("*")
      .eq("student_name", studentName)
      .order("created_at", { ascending: false });

    const { data: subs } = await supabase
      .from("homework_submissions")
      .select("*")
      .eq("student_name", studentName);

    setAssignments(asgn || []);
    setSubmissions(subs || []);
    if (asgn && asgn.length > 0 && !selectedId) {
      setSelectedId(asgn[0].id);
      const firstSub = (subs || []).find((s) => s.assignment_id === asgn[0].id);
      setTextContent(firstSub?.text_content || "");
      setIsEditing(!firstSub); // 제출 이력 없으면 편집 모드
    }
  };

  const getSubmission = (assignmentId: string) =>
    submissions.find((s) => s.assignment_id === assignmentId);

  const handleSubmit = async () => {
    if (!selectedId) return;
    setSubmitting(true);

    let finalAudioUrl: string | null = null;
    if (audioBlob) {
      setUploadingAudio(true);
      const fileName = `${studentName}/${selectedId}/${Date.now()}.webm`;
      const { data, error } = await supabase.storage
        .from("homework-audio")
        .upload(fileName, audioBlob, { contentType: "audio/webm" });

      if (!error && data) {
        const { data: urlData } = supabase.storage.from("homework-audio").getPublicUrl(data.path);
        finalAudioUrl = urlData.publicUrl;
      }
      setUploadingAudio(false);
    }

    const existing = getSubmission(selectedId);
    if (existing) {
      await supabase
        .from("homework_submissions")
        .update({
          text_content: textContent || null,
          audio_url: finalAudioUrl || existing.audio_url,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("homework_submissions").insert({
        assignment_id: selectedId,
        student_name: studentName,
        text_content: textContent || null,
        audio_url: finalAudioUrl,
        status: "submitted",
      });
    }

    toast({ title: "숙제 제출 완료! ✓", description: "강사님이 확인할 예정입니다." });
    reset();
    setIsEditing(false);
    await fetchAssignments();
    setSubmitting(false);
  };

  const selected = assignments.find((a) => a.id === selectedId);
  const submission = selectedId ? getSubmission(selectedId) : null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div className="flex-1 flex gap-5 px-4 py-5 max-w-5xl w-full mx-auto">
      {/* Left: Assignment list */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">숙제 목록</h2>
        {assignments.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            배정된 숙제가 없습니다
          </div>
        ) : (
          assignments.map((a) => {
            const sub = getSubmission(a.id);
            return (
              <button
                key={a.id}
                onClick={() => {
                  setSelectedId(a.id);
                  const sub = getSubmission(a.id);
                  setTextContent(sub?.text_content || "");
                  setIsEditing(!sub); // 미제출이면 바로 편집 모드
                  reset();
                  setPlaying(false);
                }}
                className={cn(
                  "w-full text-left rounded-xl border p-3.5 transition-all",
                  selectedId === a.id
                    ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.06)] shadow-gold"
                    : "border-border bg-card hover:border-[hsl(var(--gold)/0.4)] hover:bg-muted/30"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-medium text-sm text-foreground leading-snug">{a.title}</span>
                  {a.is_preset && <RefreshCw className="w-3 h-3 text-[hsl(var(--gold))] flex-shrink-0 mt-0.5" />}
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <TypeBadge type={a.type} />
                    <StatusBadge status={sub?.status || "pending"} />
                  </div>
                  {a.due_at && (
                    <span className="text-xs text-muted-foreground">{formatDate(a.due_at)}</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Right: Submission area */}
      <div className="flex-1 flex flex-col gap-4">
        {selected ? (
          <>
            {/* Assignment info */}
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
                <BookOpen className="w-4 h-4 text-[hsl(var(--gold))]" />
                <span className="font-semibold text-sm text-foreground">{selected.title}</span>
                <TypeBadge type={selected.type} />
                {selected.is_preset && (
                  <span className="text-xs text-muted-foreground">(정기 숙제)</span>
                )}
              </div>
              {selected.description && (
                <div className="px-4 py-3">
                  <RichDescription text={selected.description} />
                </div>
              )}
              {/* 타입별 안내 */}
              <div className="px-4 pb-3">
                {(() => {
                  const meta = HW_TYPE_META[selected.type as HwType];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <div className={cn("inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-muted", meta.color)}>
                      <Icon className="w-3.5 h-3.5" />
                      {meta.hint}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Instructor feedback (if reviewed) */}
            {submission?.instructor_note && (
              <div className="rounded-xl border border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.05)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-[hsl(var(--success))]" />
                  <span className="text-sm font-semibold text-[hsl(var(--success))]">강사 피드백</span>
                </div>
                <p className="text-sm text-foreground">{submission.instructor_note}</p>
              </div>
            )}

            {/* Submission form */}
            {(() => {
              const hwType = selected.type as HwType;
              const needsText = hwType === "writing" || hwType === "speaking";
              const textRequired = hwType === "writing";
              const audioRequired = hwType !== "writing";
              const isSubmitDisabled = submitting
                || (textRequired && !textContent.trim())
                || (audioRequired && !audioBlob && !submission?.audio_url);

              return (
                <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col gap-0">
                  <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[hsl(var(--gold))]" />
                      <span className="font-semibold text-sm text-foreground">
                        {submission ? "제출 내용" : "제출하기"}
                      </span>
                      {submission && <StatusBadge status={submission.status} />}
                    </div>
                    {submission && !isEditing && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditing(true)}
                        className="h-7 text-xs gap-1.5 border-[hsl(var(--gold)/0.5)] text-[hsl(var(--gold-dark))] hover:bg-[hsl(var(--gold)/0.08)]"
                      >
                        ✏️ 수정하기
                      </Button>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    {/* 읽기 전용 뷰 */}
                    {submission && !isEditing ? (
                      <>
                        {submission.text_content ? (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">텍스트 답변</label>
                            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-foreground whitespace-pre-wrap min-h-[120px]">
                              {submission.text_content}
                            </div>
                          </div>
                        ) : (hwType === "speaking" && (
                          <p className="text-sm text-muted-foreground italic">텍스트 없음 (선택 항목)</p>
                        ))}
                        {submission.audio_url ? (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">녹음 파일</label>
                            <audio src={submission.audio_url} controls className="w-full h-9" />
                          </div>
                        ) : audioRequired ? (
                          <p className="text-sm text-destructive/70 italic">녹음 파일 없음</p>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {/* 텍스트 입력 (쓰기: 필수 / 말하기: 선택) */}
                        {needsText && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                              텍스트 답변
                              {textRequired
                                ? <span className="text-destructive ml-1">*필수</span>
                                : <span className="text-muted-foreground/60 ml-1">(선택)</span>
                              }
                            </label>
                            <Textarea
                              value={textContent}
                              onChange={(e) => setTextContent(e.target.value)}
                              placeholder={hwType === "writing" ? "영어로 답변을 작성해주세요..." : "대본이나 메모를 작성해주세요... (선택)"}
                              className="min-h-[160px] resize-none text-sm"
                            />
                          </div>
                        )}

                        {/* 오디오 (녹음 필요 타입) */}
                        {audioRequired && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                              음성 녹음
                              <span className="text-destructive ml-1">*필수</span>
                            </label>

                            {/* 기존 녹음 (수정 모드) */}
                            {submission?.audio_url && !audioUrl && (
                              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border mb-2">
                                <span className="text-xs text-muted-foreground">기존 녹음:</span>
                                <audio src={submission.audio_url} controls className="h-8 flex-1" />
                              </div>
                            )}

                            <div className="flex items-center gap-3">
                              {!recording && !audioUrl && (
                                <Button size="sm" variant="outline" onClick={start} className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/08">
                                  <Mic className="w-3.5 h-3.5" />
                                  녹음 시작
                                </Button>
                              )}
                              {recording && (
                                <Button size="sm" onClick={stop} className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse">
                                  <MicOff className="w-3.5 h-3.5" />
                                  녹음 중지
                                </Button>
                              )}
                              {audioUrl && !recording && (
                                <div className="flex items-center gap-2 flex-1">
                                  <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
                                  <Button size="sm" variant="outline" onClick={togglePlay} className="gap-1.5">
                                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                    {playing ? "일시정지" : "재생"}
                                  </Button>
                                  <span className="text-xs text-muted-foreground flex-1">녹음 완료 ✓</span>
                                  <Button size="sm" variant="ghost" onClick={reset} className="text-muted-foreground hover:text-destructive text-xs">
                                    다시 녹음
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 쓰기 타입의 오디오 선택 입력 */}
                        {!audioRequired && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">음성 녹음 <span className="text-muted-foreground/60">(선택)</span></label>
                            {submission?.audio_url && !audioUrl && (
                              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border mb-2">
                                <span className="text-xs text-muted-foreground">기존 녹음:</span>
                                <audio src={submission.audio_url} controls className="h-8 flex-1" />
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              {!recording && !audioUrl && (
                                <Button size="sm" variant="outline" onClick={start} className="gap-2 border-[hsl(var(--gold)/0.5)] text-[hsl(var(--gold-dark))] hover:bg-[hsl(var(--gold)/0.08)]">
                                  <Mic className="w-3.5 h-3.5" />녹음 시작
                                </Button>
                              )}
                              {recording && (
                                <Button size="sm" onClick={stop} className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse">
                                  <MicOff className="w-3.5 h-3.5" />녹음 중지
                                </Button>
                              )}
                              {audioUrl && !recording && (
                                <div className="flex items-center gap-2 flex-1">
                                  <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
                                  <Button size="sm" variant="outline" onClick={togglePlay} className="gap-1.5">
                                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                    {playing ? "일시정지" : "재생"}
                                  </Button>
                                  <span className="text-xs text-muted-foreground flex-1">녹음 완료</span>
                                  <Button size="sm" variant="ghost" onClick={reset} className="text-muted-foreground hover:text-destructive text-xs">다시 녹음</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={handleSubmit}
                            disabled={isSubmitDisabled}
                            className="flex-1 gold-gradient text-accent-foreground font-semibold gap-2 shadow-gold hover:opacity-90"
                          >
                            <Upload className="w-4 h-4" />
                            {submitting ? (uploadingAudio ? "오디오 업로드 중..." : "제출 중...") : submission ? "수정 제출" : "숙제 제출"}
                          </Button>
                          {submission && isEditing && (
                            <Button
                              size="default"
                              variant="outline"
                              onClick={() => {
                                setIsEditing(false);
                                setTextContent(submission.text_content || "");
                                reset();
                              }}
                            >
                              취소
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            왼쪽에서 숙제를 선택해주세요
          </div>
        )}
      </div>
    </div>
  );
}

// ── Instructor View ──────────────────────────────────────────────────────────
function InstructorView() {
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState(STUDENTS[0]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedStudent]);

  const fetchData = async () => {
    const { data: asgn } = await supabase
      .from("homework_assignments")
      .select("*")
      .eq("student_name", selectedStudent)
      .order("created_at", { ascending: false });

    const { data: subs } = await supabase
      .from("homework_submissions")
      .select("*")
      .eq("student_name", selectedStudent);

    setAssignments(asgn || []);
    setSubmissions(subs || []);
    setSelectedSub(null);
    setNote("");
  };

  const getSubmission = (assignmentId: string) =>
    submissions.find((s) => s.assignment_id === assignmentId);

  const handleReview = async (sub: Submission) => {
    setSaving(true);
    await supabase
      .from("homework_submissions")
      .update({
        instructor_note: note,
        status: "reviewed",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    toast({ title: "피드백 저장 완료 ✓" });
    fetchData();
    setSaving(false);
    setSelectedSub(null);
    setNote("");
  };

  const submitted = submissions.filter((s) => s.status !== "pending");
  const pending = assignments.filter((a) => {
    const sub = getSubmission(a.id);
    return !sub;
  });

  return (
    <div className="flex-1 flex gap-5 px-4 py-5 max-w-6xl w-full mx-auto">
      {/* Left: Student selector + summary */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3">
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">학생 선택</h2>
          <div className="flex flex-col gap-1">
            {STUDENTS.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStudent(s)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                  selectedStudent === s
                    ? "bg-[hsl(var(--navy))] text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <User className="w-3.5 h-3.5 opacity-70" />
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{selectedStudent} 현황</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">전체 숙제</span>
              <span className="font-semibold">{assignments.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">제출</span>
              <span className="font-semibold text-[hsl(var(--gold-dark))]">{submitted.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">검토 완료</span>
              <span className="font-semibold text-[hsl(var(--success))]">
                {submissions.filter((s) => s.status === "reviewed").length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">미제출</span>
              <span className="font-semibold text-muted-foreground">{pending.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Submission list + review panel */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">제출 현황</h2>

        {assignments.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            배정된 숙제가 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => {
              const sub = getSubmission(a.id);
              const isExpanded = expandedId === a.id;
              return (
                <div key={a.id} className={cn(
                  "rounded-xl border bg-card overflow-hidden transition-all",
                  sub ? "border-[hsl(var(--gold)/0.4)]" : "border-border"
                )}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {a.is_preset && <RefreshCw className="w-3.5 h-3.5 text-[hsl(var(--gold))] flex-shrink-0" />}
                      <span className="font-medium text-sm text-foreground truncate">{a.title}</span>
                      <StatusBadge status={sub?.status || "pending"} />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {a.due_at && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">{formatDate(a.due_at)}</span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && sub && (
                    <div className="border-t border-border p-4 space-y-4 bg-muted/10">
                      {/* Text content */}
                      {sub.text_content && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">제출된 답변</label>
                          <div className="rounded-lg border border-border bg-background p-3 text-sm text-foreground whitespace-pre-wrap">
                            {sub.text_content}
                          </div>
                        </div>
                      )}

                      {/* Audio */}
                      {sub.audio_url && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">녹음 파일</label>
                          <audio src={sub.audio_url} controls className="w-full h-9" />
                        </div>
                      )}

                      {/* Existing note */}
                      {sub.instructor_note && sub.status === "reviewed" && (
                        <div className="rounded-lg border border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.05)] p-3">
                          <p className="text-xs font-medium text-[hsl(var(--success))] mb-1">기존 피드백</p>
                          <p className="text-sm text-foreground">{sub.instructor_note}</p>
                        </div>
                      )}

                      {/* Review form */}
                      {selectedSub?.id === sub.id ? (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground block">피드백 작성</label>
                          <Textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="학생에게 보낼 피드백을 입력하세요..."
                            className="min-h-[100px] resize-none text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleReview(sub)}
                              disabled={saving || !note.trim()}
                              className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground gap-2"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {saving ? "저장 중..." : "피드백 저장"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedSub(null); setNote(""); }}>
                              취소
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedSub(sub); setNote(sub.instructor_note || ""); }}
                          className="gap-2 border-[hsl(var(--gold)/0.5)] text-[hsl(var(--gold-dark))] hover:bg-[hsl(var(--gold)/0.08)]"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {sub.status === "reviewed" ? "피드백 수정" : "피드백 작성"}
                        </Button>
                      )}
                    </div>
                  )}

                  {isExpanded && !sub && (
                    <div className="border-t border-border p-4 text-sm text-muted-foreground text-center">
                      아직 제출되지 않았습니다
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Homework() {
  const [role, setRole] = useState<Role>("student");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sidebar-gradient text-sidebar-foreground px-4 py-3 flex items-center gap-4 shadow-lg">
        <a href="/" className="flex items-center gap-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">어드민</span>
        </a>

        <div className="w-px h-5 bg-sidebar-border" />

        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-[hsl(var(--gold))]" />
          <span className="font-bold text-sidebar-accent-foreground text-sm">숙제 관리</span>
        </div>

        <div className="flex-1" />

        {/* Role switcher */}
        <div className="flex gap-1 p-0.5 bg-sidebar-accent rounded-lg">
          {(["student", "instructor"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                role === r ? "bg-[hsl(var(--gold))] text-accent-foreground" : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
              )}
            >
              {r === "instructor" ? "강사" : "학생"}
            </button>
          ))}
        </div>
      </header>

      {role === "student" ? (
        <StudentView studentName={CURRENT_STUDENT} />
      ) : (
        <InstructorView />
      )}
    </div>
  );
}
