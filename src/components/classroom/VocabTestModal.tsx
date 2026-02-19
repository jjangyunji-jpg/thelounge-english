import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Mic, Square, Play, Pause, ChevronRight, CheckCircle2,
  XCircle, Loader2, Volume2, RotateCcw, Trophy, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VocabWord {
  id: string;
  english_word: string;
  korean_meaning: string;
  part_of_speech: string | null;
  example_sentence: string | null;
  audio_url: string | null;
  week_label: string;
}

type TestMode = "text" | "audio";
type Phase = "mode-select" | "testing" | "results";

interface Question {
  type: "vocab" | "sentence";
  word: VocabWord;
  /** For sentence type: English sentence with target word blanked */
  sentence?: string;
  blankWord?: string;
}

interface Answer {
  questionIdx: number;
  userAnswer: string;
  correct: boolean;
  expected: string;
}

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
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch { alert("마이크 접근 권한이 필요합니다."); }
  }, []);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    setAudioBlob(null); setAudioUrl(null);
    setDuration(0); setPlaying(false);
  }, []);

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

// ── Helper: build questions ────────────────────────────────────────────────────
function buildQuestions(words: VocabWord[]): Question[] {
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  // Scale 10–20 proportionally: <10 words → use all, 10–20 → use all, >20 → cap at 20
  const count = words.length <= 10 ? words.length : Math.min(20, Math.round(10 + (words.length - 10) * 0.5));
  return shuffled.slice(0, count).map((w) => ({ type: "vocab" as const, word: w }));
}

// ── Normalize for comparison ───────────────────────────────────────────────────
function normalize(s: string) {
  return s.toLowerCase().trim().replace(/[.,!?'"]/g, "");
}

function isCorrect(userAnswer: string, expected: string): boolean {
  const u = normalize(userAnswer);
  const e = normalize(expected);
  if (u === e) return true;
  // Allow minor variations (e.g., missing "to" in verb phrases)
  return e.split(" ").every((word) => u.includes(normalize(word)));
}

// ── STT transcription via ElevenLabs ─────────────────────────────────────────
async function transcribeAudio(blob: Blob): Promise<string> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Get scribe token
  const tokenRes = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-scribe-token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
  });
  const { token } = await tokenRes.json();
  if (!token) throw new Error("STT 토큰 발급 실패");

  // Use ElevenLabs batch transcription for simplicity
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");
  formData.append("model_id", "scribe_v2");
  formData.append("language_code", "eng");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": token },
    body: formData,
  });
  const data = await res.json();
  return data.text ?? "";
}

// ── Question Card: Text Mode ───────────────────────────────────────────────────
function TextQuestion({
  question, qIndex, total, onAnswer,
}: {
  question: Question;
  qIndex: number;
  total: number;
  onAnswer: (answer: string) => void;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) return;
    onAnswer(value.trim());
    setValue("");
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
          {question.type === "vocab" ? "단어 뜻을 보고 영어로 쓰세요" : "빈칸에 알맞은 단어를 영어로 쓰세요"}
        </p>
        {question.type === "vocab" ? (
          <p className="text-2xl font-bold text-foreground">{question.word.korean_meaning}</p>
        ) : (
          <p className="text-base font-medium text-foreground leading-relaxed px-2">
            {question.sentence}
          </p>
        )}
        {question.word.part_of_speech && question.type === "vocab" && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{question.word.part_of_speech}</span>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="영어로 입력하세요..."
          className="flex-1 text-sm"
          autoFocus
        />
        <Button size="sm" onClick={submit} disabled={!value.trim()}
          className="bg-navy hover:bg-navy-light text-primary-foreground gap-1.5"
        >
          확인 <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
      <p className="text-center text-[10px] text-muted-foreground">{qIndex + 1} / {total}</p>
    </div>
  );
}

// ── Question Card: Audio Mode ──────────────────────────────────────────────────
function AudioQuestion({
  question, qIndex, total, onAnswer,
}: {
  question: Question;
  qIndex: number;
  total: number;
  onAnswer: (answer: string) => void;
}) {
  const recorder = useAudioRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!recorder.audioBlob) return;
    setTranscribing(true);
    try {
      const text = await transcribeAudio(recorder.audioBlob);
      onAnswer(text.trim());
      recorder.reset();
    } catch {
      toast({ title: "음성 인식 실패", description: "다시 시도해주세요", variant: "destructive" });
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
          {question.type === "vocab" ? "뜻을 보고 영어로 말하세요" : "빈칸에 알맞은 단어를 영어로 말하세요"}
        </p>
        {question.type === "vocab" ? (
          <p className="text-2xl font-bold text-foreground">{question.word.korean_meaning}</p>
        ) : (
          <p className="text-base font-medium text-foreground leading-relaxed px-2">
            {question.sentence}
          </p>
        )}
        {question.word.part_of_speech && question.type === "vocab" && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{question.word.part_of_speech}</span>
        )}
      </div>

      {!recorder.audioBlob ? (
        <div className="flex flex-col items-center gap-3">
          {!recorder.recording ? (
            <Button onClick={recorder.start}
              className="gap-2 bg-success hover:bg-success/85 text-white"
            >
              <Mic className="w-4 h-4" /> 녹음 시작
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="flex items-center gap-2 text-sm text-destructive font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                {recorder.fmt(recorder.duration)}
              </span>
              <Button onClick={recorder.stop}
                className="gap-2 bg-destructive hover:bg-destructive/85 text-destructive-foreground"
              >
                <Square className="w-3.5 h-3.5 fill-white" /> 녹음 중지
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border">
            <Button size="icon" variant="ghost" className="w-7 h-7" onClick={recorder.togglePlay}>
              {recorder.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <span className="text-xs text-muted-foreground flex-1">녹음 완료 ({recorder.fmt(recorder.duration)})</span>
            <Button size="sm" variant="ghost" onClick={recorder.reset} className="h-7 text-xs gap-1 text-muted-foreground">
              <RotateCcw className="w-3 h-3" /> 다시
            </Button>
          </div>
          <Button className="w-full gap-2 bg-navy hover:bg-navy-light text-primary-foreground"
            onClick={handleSubmit} disabled={transcribing}
          >
            {transcribing ? <><Loader2 className="w-4 h-4 animate-spin" /> 분석 중...</> : <><ChevronRight className="w-4 h-4" /> 제출</>}
          </Button>
        </div>
      )}
      <p className="text-center text-[10px] text-muted-foreground">{qIndex + 1} / {total}</p>
    </div>
  );
}

// ── Result Item ────────────────────────────────────────────────────────────────
function ResultItem({ question, answer }: { question: Question; answer: Answer }) {
  return (
    <div className={cn("rounded-lg p-3 border text-sm space-y-1",
      answer.correct ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
    )}>
      <div className="flex items-center gap-2">
        {answer.correct
          ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
          : <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
        <span className="font-medium text-foreground text-xs">
          {question.type === "vocab" ? question.word.korean_meaning : question.sentence}
        </span>
      </div>
      {!answer.correct && (
        <div className="pl-6 space-y-0.5">
          <p className="text-[11px] text-destructive/80">내 답: <span className="font-mono">{answer.userAnswer || "(미입력)"}</span></p>
          <p className="text-[11px] text-success/80">정답: <span className="font-mono font-semibold">{answer.expected}</span></p>
        </div>
      )}
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function VocabTestModal({
  words,
  studentName,
  weekLabel,
  completedTests,
  scheduledAt,
  onClose,
  onTestComplete,
}: {
  words: VocabWord[];
  studentName: string;
  weekLabel: string;
  completedTests: number;
  scheduledAt: Date;
  onClose: () => void;
  onTestComplete: () => void;
}) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("mode-select");
  const [mode, setMode] = useState<TestMode>("text");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [saving, setSaving] = useState(false);

  const isFinal = completedTests === 1;
  const msUntilClass = scheduledAt.getTime() - Date.now();
  const within48h = msUntilClass > 0 && msUntilClass <= 48 * 3600 * 1000;

  const startTest = () => {
    const qs = buildQuestions(words);
    setQuestions(qs);
    setCurrentIdx(0);
    setAnswers([]);
    setPhase("testing");
  };

  const handleAnswer = useCallback((userAnswer: string) => {
    const q = questions[currentIdx];
    const expected = q.type === "vocab" ? q.word.english_word : (q.blankWord ?? q.word.english_word);
    const correct = isCorrect(userAnswer, expected);

    const newAnswer: Answer = { questionIdx: currentIdx, userAnswer, correct, expected };
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);

    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((i) => i + 1);
    } else {
      finishTest(newAnswers, questions);
    }
  }, [questions, currentIdx, answers]);

  const finishTest = async (finalAnswers: Answer[], finalQuestions: Question[]) => {
    setSaving(true);
    const score = finalAnswers.filter((a) => a.correct).length;
    const total = finalAnswers.length;

    try {
      // Insert test record
      const { data: testData, error: testErr } = await supabase
        .from("vocabulary_tests")
        .insert({
          student_name: studentName,
          type: mode,
          week_label: weekLabel,
          word_ids: finalQuestions.map((q) => q.word.id),
          score,
          total,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (testErr) throw testErr;

      // Insert result records
      const resultRows = finalAnswers.map((a) => ({
        test_id: testData.id,
        word_id: finalQuestions[a.questionIdx].word.id,
        student_answer: a.userAnswer,
        is_correct: a.correct,
      }));
      await supabase.from("vocabulary_test_results").insert(resultRows);

      setPhase("results");
      onTestComplete();
    } catch (e: unknown) {
      toast({ title: "저장 실패", description: e instanceof Error ? e.message : "오류", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const score = answers.filter((a) => a.correct).length;
  const total = questions.length;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div>
            <p className="font-bold text-sm text-foreground">단어 테스트</p>
            <p className="text-[10px] text-muted-foreground">
              {weekLabel.replace(/(\d{4})-W(\d{2})/, (_, y, w) => `${y}년 ${parseInt(w)}주차`)}
              {" · "}
              {isFinal ? "최종 테스트" : `${completedTests + 1}회차`}
            </p>
          </div>
          {phase !== "testing" && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Mode Select ── */}
          {phase === "mode-select" && (
            <div className="space-y-5">
              {within48h && isFinal && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="text-xs text-destructive font-medium">
                    수업 48시간 전입니다. 최종 테스트를 완료해야 합니다.
                  </p>
                </div>
              )}

              <div className="text-center">
                <p className="text-sm font-semibold text-foreground mb-0.5">테스트 방식을 선택하세요</p>
                <p className="text-xs text-muted-foreground">
                  총 {words.length <= 10 ? words.length : Math.min(20, Math.round(10 + (words.length - 10) * 0.5))}개 단어 문제
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(["text", "audio"] as TestMode[]).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={cn("rounded-xl border-2 p-4 transition-all text-left space-y-2",
                      mode === m
                        ? "border-navy bg-navy/5"
                        : "border-border hover:border-navy/40"
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center",
                      mode === m ? "bg-navy/15" : "bg-muted"
                    )}>
                      {m === "text"
                        ? <span className="text-sm font-bold text-navy">T</span>
                        : <Mic className={cn("w-4 h-4", mode === m ? "text-navy" : "text-muted-foreground")} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{m === "text" ? "텍스트" : "오디오"}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {m === "text" ? "한국어 뜻을 보고 영어로 타이핑" : "한국어 뜻을 보고 영어로 말하기"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <Button className="w-full bg-navy hover:bg-navy-light text-primary-foreground font-semibold"
                onClick={startTest}
              >
                테스트 시작
              </Button>
            </div>
          )}

          {/* ── Testing ── */}
          {phase === "testing" && questions.length > 0 && (
            <div>
              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                  <span>{currentIdx + 1} / {questions.length}</span>
                  <span className={questions[currentIdx].type === "sentence" ? "text-gold-dark font-semibold" : ""}>
                    {questions[currentIdx].type === "sentence" ? "📝 문장 완성" : "💬 단어"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-navy transition-all duration-300"
                    style={{ width: `${(currentIdx / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {mode === "text" ? (
                <TextQuestion
                  question={questions[currentIdx]}
                  qIndex={currentIdx}
                  total={questions.length}
                  onAnswer={handleAnswer}
                />
              ) : (
                <AudioQuestion
                  question={questions[currentIdx]}
                  qIndex={currentIdx}
                  total={questions.length}
                  onAnswer={handleAnswer}
                />
              )}

              {saving && (
                <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />결과 저장 중...
                </div>
              )}
            </div>
          )}

          {/* ── Results ── */}
          {phase === "results" && (
            <div className="space-y-4">
              {/* Score */}
              <div className="text-center space-y-2">
                <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto",
                  pct >= 80 ? "bg-success/15" : pct >= 60 ? "bg-gold/15" : "bg-destructive/10"
                )}>
                  <Trophy className={cn("w-8 h-8",
                    pct >= 80 ? "text-success" : pct >= 60 ? "text-gold" : "text-destructive"
                  )} />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{pct}점</p>
                  <p className="text-xs text-muted-foreground">{total}문제 중 {score}개 정답</p>
                </div>
                <p className={cn("text-sm font-medium",
                  pct >= 80 ? "text-success" : pct >= 60 ? "text-gold-dark" : "text-destructive"
                )}>
                  {pct >= 80 ? "훌륭해요! 🎉" : pct >= 60 ? "잘 했어요! 조금 더 연습해봐요" : "더 열심히 공부해봐요 💪"}
                </p>
              </div>

              {/* Breakdown */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">오답 목록</p>
                {answers.filter((a) => !a.correct).length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground py-2">오답이 없습니다 🎊</p>
                ) : (
                  answers.filter((a) => !a.correct).map((a, i) => (
                    <ResultItem key={i} question={questions[a.questionIdx]} answer={a} />
                  ))
                )}
              </div>

              <Button className="w-full bg-navy hover:bg-navy-light text-primary-foreground" onClick={onClose}>
                닫기
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
