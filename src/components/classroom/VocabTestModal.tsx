import { useState, useCallback, useEffect, useRef } from "react";
import {
  X, ChevronRight, CheckCircle2,
  XCircle, Loader2, Trophy, Volume2, Mic, MicOff,
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

type Phase = "confirm" | "testing" | "results";
type TestMode = "text" | "speech" | "choice";

interface Question { word: VocabWord; choices?: string[]; }
interface Answer { questionIdx: number; userAnswer: string; correct: boolean; expected: string; }

function buildQuestions(words: VocabWord[], mode: TestMode): Question[] {
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  const count = words.length <= 10 ? words.length : Math.min(20, Math.round(10 + (words.length - 10) * 0.5));
  const selected = shuffled.slice(0, count);
  return selected.map((w) => {
    if (mode === "choice") {
      const distractorPool = words.filter((x) => x.id !== w.id).map((x) => x.english_word);
      const distractors = [...distractorPool].sort(() => Math.random() - 0.5).slice(0, 3);
      const choices = [w.english_word, ...distractors].sort(() => Math.random() - 0.5);
      return { word: w, choices };
    }
    return { word: w };
  });
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[\u2018\u2019\u201C\u201D’‘”“]/g, "'")  // smart quotes → straight
    .replace(/\bi['']?m\b/g, "i am")                    // contractions expansion
    .replace(/\b(\w+)['']?s\b/g, "$1 is")
    .replace(/\b(\w+)n['']?t\b/g, "$1 not")
    .replace(/\b(\w+)['']?re\b/g, "$1 are")
    .replace(/\b(\w+)['']?ve\b/g, "$1 have")
    .replace(/\b(\w+)['']?ll\b/g, "$1 will")
    .replace(/\b(\w+)['']?d\b/g, "$1 would")
    .replace(/[.,!?'"`;:()\[\]{}]/g, "")                // strip all punctuation
    .replace(/[-–—_/\\]/g, " ")                         // separators → spaces
    .replace(/\s+/g, " ")                               // collapse whitespace
    .trim();
}

function isExactMatch(userAnswer: string, expected: string): boolean {
  const u = normalize(userAnswer);
  const e = normalize(expected);
  if (!u || !e) return false;
  if (u === e) return true;
  // Match ignoring spaces entirely (e.g. "oneofakind" === "one of a kind")
  if (u.replace(/\s/g, "") === e.replace(/\s/g, "")) return true;
  // Also match if all words from expected are present in user answer (lenient)
  const eWords = e.split(" ").filter(Boolean);
  const uWords = u.split(" ").filter(Boolean);
  if (eWords.length > 0 && eWords.every((word) => uWords.includes(word))) return true;
  return false;
}

/** Match against expected first, then against any other word in the vocab list
 * that shares the same Korean meaning (synonym in the same word set). */
function findSynonymMatch(
  userAnswer: string,
  currentWord: VocabWord,
  allWords: VocabWord[],
): VocabWord | null {
  const targetKorean = normalize(currentWord.korean_meaning);
  for (const w of allWords) {
    if (w.id === currentWord.id) continue;
    if (normalize(w.korean_meaning) !== targetKorean) continue;
    if (isExactMatch(userAnswer, w.english_word)) return w;
  }
  return null;
}

// ── TTS helper (browser built-in) ──
function speakKorean(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const cleaned = text.replace(/[\/\\,.\-~!@#$%^&*()_+=\[\]{}<>?;:'"「」『』·…|]/g, " ").replace(/\s+/g, " ").trim();
  const utter = new SpeechSynthesisUtterance(cleaned);
  utter.lang = "ko-KR";
  utter.rate = 0.9;
  window.speechSynthesis.speak(utter);
}

// ── Speech Recognition hook ──
function useSpeechRecognition(onResult: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const start = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    return true;
  }, [onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, start, stop };
}

// ── Question Card (Text mode) ──
function TextQuestion({
  question, qIndex, total, onAnswer,
}: {
  question: Question; qIndex: number; total: number; onAnswer: (answer: string) => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => { if (!value.trim()) return; onAnswer(value.trim()); setValue(""); };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
          단어 뜻을 보고 영어로 쓰세요
        </p>
        <p className="text-2xl font-bold text-foreground">{question.word.korean_meaning}</p>
        {question.word.part_of_speech && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {question.word.part_of_speech}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="영어로 입력하세요..." className="flex-1 text-sm" autoFocus
        />
        <Button size="sm" onClick={submit} disabled={!value.trim()}
          className="bg-navy hover:bg-navy-light text-primary-foreground gap-1.5"
        >확인 <ChevronRight className="w-3.5 h-3.5" /></Button>
      </div>
      <p className="text-center text-[10px] text-muted-foreground">{qIndex + 1} / {total}</p>
    </div>
  );
}

// ── Question Card (Speech mode) ──
function SpeechQuestion({
  question, qIndex, total, onAnswer,
}: {
  question: Question; qIndex: number; total: number; onAnswer: (answer: string) => void;
}) {
  const [value, setValue] = useState("");

  const { listening, start, stop } = useSpeechRecognition(
    useCallback((transcript: string) => {
      setValue(transcript);
    }, [])
  );

  // Reset value when question changes
  useEffect(() => {
    setValue("");
  }, [question.word.id]);

  const submit = () => { if (!value.trim()) return; onAnswer(value.trim()); setValue(""); };

  const hasSpeechAPI = typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
          🎙️ 뜻을 보고 영어로 말하세요
        </p>
        <p className="text-2xl font-bold text-foreground">{question.word.korean_meaning}</p>
        {question.word.part_of_speech && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {question.word.part_of_speech}
          </span>
        )}
      </div>

      {/* Mic button */}
      {hasSpeechAPI && (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => listening ? stop() : start()}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all",
              listening
                ? "bg-destructive/15 text-destructive animate-pulse"
                : "bg-navy/10 hover:bg-navy/20 text-navy"
            )}
          >
            {listening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          </button>
          <p className="text-[10px] text-muted-foreground">
            {listening ? "듣고 있어요..." : "탭하여 음성 입력"}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="영어로 입력 또는 🎙️ 음성 입력..." className="flex-1 text-sm" autoFocus
        />
        <Button size="sm" onClick={submit} disabled={!value.trim()}
          className="bg-navy hover:bg-navy-light text-primary-foreground gap-1.5"
        >확인 <ChevronRight className="w-3.5 h-3.5" /></Button>
      </div>
      <p className="text-center text-[10px] text-muted-foreground">{qIndex + 1} / {total}</p>
    </div>
  );
}

// ── Question Card (Multiple Choice mode) ──
function ChoiceQuestion({
  question, qIndex, total, onAnswer,
}: {
  question: Question; qIndex: number; total: number; onAnswer: (answer: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const choices = question.choices ?? [];
  const correctAnswer = question.word.english_word;

  // Reset selection when question changes
  useEffect(() => { setSelected(null); }, [question.word.id]);

  const handlePick = (c: string) => {
    if (selected) return;
    setSelected(c);
    // Brief visual feedback before advancing
    setTimeout(() => onAnswer(c), 600);
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
          뜻에 알맞은 영어 단어를 고르세요
        </p>
        <p className="text-2xl font-bold text-foreground">{question.word.korean_meaning}</p>
        {question.word.part_of_speech && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {question.word.part_of_speech}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {choices.map((c, i) => {
          const isSelected = selected === c;
          const isAnswer = c === correctAnswer;
          const showState = !!selected;
          return (
            <button
              key={i}
              onClick={() => handlePick(c)}
              disabled={!!selected}
              className={cn(
                "w-full text-left rounded-lg border-2 p-3 text-sm transition-all",
                !showState && "border-border hover:border-navy/40 hover:bg-navy/5",
                showState && isAnswer && "border-success bg-success/10",
                showState && isSelected && !isAnswer && "border-destructive bg-destructive/10",
                showState && !isSelected && !isAnswer && "border-border opacity-60"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground w-4">{String.fromCharCode(65 + i)}.</span>
                <span className="flex-1 font-medium text-foreground">{c}</span>
                {showState && isAnswer && <CheckCircle2 className="w-4 h-4 text-success" />}
                {showState && isSelected && !isAnswer && <XCircle className="w-4 h-4 text-destructive" />}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-muted-foreground">{qIndex + 1} / {total}</p>
    </div>
  );
}

// ── Result Item ──
function ResultItem({ question, answer }: { question: Question; answer: Answer }) {
  return (
    <div className={cn("rounded-lg p-3 border text-sm space-y-1",
      answer.correct ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
    )}>
      <div className="flex items-center gap-2">
        {answer.correct
          ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
          : <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
        <span className="font-medium text-foreground text-xs">{question.word.korean_meaning}</span>
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

// ── Main Modal ──
export default function VocabTestModal({
  words, studentName, weekLabel, completedTests, scheduledAt, onClose, onTestComplete,
}: {
  words: VocabWord[]; studentName: string; weekLabel: string; completedTests: number;
  scheduledAt: Date; onClose: () => void; onTestComplete: () => void;
}) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [testMode, setTestMode] = useState<TestMode>("text");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [saving, setSaving] = useState(false);

  const questionCount = words.length <= 10 ? words.length : Math.min(20, Math.round(10 + (words.length - 10) * 0.5));

  const startTest = (mode: TestMode) => {
    setTestMode(mode);
    const qs = buildQuestions(words, mode);
    setQuestions(qs);
    setCurrentIdx(0);
    setAnswers([]);
    setPhase("testing");
  };

  const handleAnswer = useCallback((userAnswer: string) => {
    const q = questions[currentIdx];
    const expected = q.word.english_word;
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
      const { data: testData, error: testErr } = await supabase
        .from("vocabulary_tests")
        .insert({
          student_name: studentName, type: testMode, week_label: weekLabel,
          word_ids: finalQuestions.map((q) => q.word.id), score, total,
          completed_at: new Date().toISOString(),
        })
        .select().single();
      if (testErr) throw testErr;
      const resultRows = finalAnswers.map((a) => ({
        test_id: testData.id, word_id: finalQuestions[a.questionIdx].word.id,
        student_answer: a.userAnswer, is_correct: a.correct,
      }));
      await supabase.from("vocabulary_test_results").insert(resultRows);
      setPhase("results");
      onTestComplete();
    } catch (e: unknown) {
      toast({ title: "저장 실패", description: e instanceof Error ? e.message : "오류", variant: "destructive" });
    } finally { setSaving(false); }
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
              {" · "}{`${completedTests + 1}회차`}
              {phase === "testing" && testMode === "speech" && " · 🔊 음성 모드"}
              {phase === "testing" && testMode === "choice" && " · 📝 객관식"}
              {phase === "testing" && testMode === "text" && " · ✏️ 주관식"}
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

          {/* ── Confirm ── */}
          {phase === "confirm" && (
            <div className="space-y-5">
              <div className="text-center space-y-3 py-4">
                <div className="w-14 h-14 rounded-2xl bg-navy/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl font-bold text-navy">T</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">단어 테스트 준비됐나요?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    총 {questionCount}개 단어 · 모드를 선택하세요
                  </p>
                </div>
              </div>

              {/* Mode selection */}
              <div className="space-y-2">
                <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold gap-2"
                  onClick={() => startTest("choice")}
                >
                  📝 객관식 (4지선다)
                  <span className="text-[10px] font-normal opacity-80">뜻을 보고 영어 단어 고르기</span>
                </Button>
                <Button className="w-full bg-navy hover:bg-navy-light text-primary-foreground font-semibold gap-2"
                  onClick={() => startTest("text")}
                >
                  ✏️ 주관식 (텍스트)
                  <span className="text-[10px] font-normal opacity-80">뜻을 보고 영어 입력</span>
                </Button>
                <Button className="w-full bg-gold hover:bg-gold-dark text-foreground font-semibold gap-2"
                  onClick={() => startTest("speech")}
                >
                  🎙️ 음성 모드
                  <span className="text-[10px] font-normal opacity-80">뜻을 보고 영어로 말하기</span>
                </Button>
              </div>
            </div>
          )}

          {/* ── Testing ── */}
          {phase === "testing" && questions.length > 0 && (
            <div>
              <div className="mb-5">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                  <span>{currentIdx + 1} / {questions.length}</span>
                  <span>{testMode === "speech" ? "🔊 음성" : testMode === "choice" ? "📝 객관식" : "✏️ 주관식"}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-navy transition-all duration-300"
                    style={{ width: `${(currentIdx / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {testMode === "text" ? (
                <TextQuestion question={questions[currentIdx]} qIndex={currentIdx}
                  total={questions.length} onAnswer={handleAnswer}
                />
              ) : testMode === "speech" ? (
                <SpeechQuestion question={questions[currentIdx]} qIndex={currentIdx}
                  total={questions.length} onAnswer={handleAnswer}
                />
              ) : (
                <ChoiceQuestion question={questions[currentIdx]} qIndex={currentIdx}
                  total={questions.length} onAnswer={handleAnswer}
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
