import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, BookOpen, Volume2, Loader2, Plus, Trash2,
  ChevronDown, ChevronUp, Play, Square, Check, X,
  RotateCcw, Trophy, RefreshCw, User, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Role = "student" | "instructor";

interface VocabWord {
  id: string;
  english_word: string;
  korean_meaning: string;
  part_of_speech: string | null;
  example_sentence: string | null;
  audio_url: string | null;
  week_label: string;
  student_name: string;
  session_id: string | null;
  created_at: string;
}

type TestMode = "idle" | "running" | "done";
type TestType = "week" | "all";

interface TestQuestion {
  word: VocabWord;
  userAnswer: string;
  isCorrect: boolean | null;
}

const STUDENTS = ["김민준", "이지은", "박서연"];
const CURRENT_STUDENT = "김민준";

function groupByWeek(words: VocabWord[]): Record<string, VocabWord[]> {
  return words.reduce<Record<string, VocabWord[]>>((acc, w) => {
    if (!acc[w.week_label]) acc[w.week_label] = [];
    acc[w.week_label].push(w);
    return acc;
  }, {});
}

// ── TTS Player ────────────────────────────────────────────────────────────────
function TTSButton({ word }: { word: VocabWord }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = async () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }

    // If cached audio exists, play directly
    if (word.audio_url) {
      const audio = new Audio(word.audio_url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.play();
      setPlaying(true);
      return;
    }

    // Generate & cache via edge function
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tts-cache", {
        body: { word: word.english_word, wordId: word.id },
      });
      if (error || !data?.audio_url) throw new Error(error?.message || "TTS failed");

      // Update local cache in DB (the edge function already does this, but update local state)
      word.audio_url = data.audio_url;

      const audio = new Audio(data.audio_url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.play();
      setPlaying(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={play}
      disabled={loading}
      className="flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--navy)/0.08)] hover:bg-[hsl(var(--navy)/0.16)] transition-colors flex-shrink-0"
      title="발음 듣기"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 text-navy animate-spin" />
      ) : playing ? (
        <Square className="w-3 h-3 text-navy fill-navy" />
      ) : (
        <Volume2 className="w-3.5 h-3.5 text-navy" />
      )}
    </button>
  );
}

// ── Word Card ─────────────────────────────────────────────────────────────────
function WordCard({
  word,
  onDelete,
  isInstructor,
}: {
  word: VocabWord;
  onDelete: (id: string) => void;
  isInstructor: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors group"
        onClick={() => setExpanded((v) => !v)}
      >
        <TTSButton word={word} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{word.english_word}</span>
            {word.part_of_speech && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                {word.part_of_speech}
              </span>
            )}
          </div>
          <span className="text-sm text-muted-foreground">{word.korean_meaning}</span>
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {isInstructor && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(word.id); }}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/10 space-y-1.5">
          {word.example_sentence && (
            <p className="text-sm text-foreground italic">"{word.example_sentence}"</p>
          )}
          {word.audio_url && (
            <audio src={word.audio_url} controls className="w-full h-8 mt-1" />
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Word Form ─────────────────────────────────────────────────────────────
function AddWordForm({
  studentName,
  weekLabel,
  onAdded,
  onCancel,
}: {
  studentName: string;
  weekLabel: string;
  onAdded: (word: VocabWord) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [english, setEnglish] = useState("");
  const [korean, setKorean] = useState("");
  const [pos, setPos] = useState("");
  const [example, setExample] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!english.trim() || !korean.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("vocabulary_words")
      .insert({
        student_name: studentName,
        english_word: english.trim(),
        korean_meaning: korean.trim(),
        part_of_speech: pos.trim() || null,
        example_sentence: example.trim() || null,
        week_label: weekLabel,
      })
      .select()
      .single();

    if (!error && data) {
      onAdded(data);
      toast({ title: "단어 추가 완료 ✓" });
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--gold)/0.5)] bg-[hsl(var(--gold)/0.04)] p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">영단어 *</label>
          <Input value={english} onChange={(e) => setEnglish(e.target.value)} placeholder="e.g. procrastinate" className="h-8 text-sm" autoFocus />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">한국어 뜻 *</label>
          <Input value={korean} onChange={(e) => setKorean(e.target.value)} placeholder="e.g. 미루다" className="h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">품사</label>
          <Input value={pos} onChange={(e) => setPos(e.target.value)} placeholder="e.g. verb" className="h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">예문</label>
          <Input value={example} onChange={(e) => setExample(e.target.value)} placeholder="예문 (선택)" className="h-8 text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!english.trim() || !korean.trim() || saving}
          className="flex-1 h-8 text-xs bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          {saving ? "저장 중..." : "추가"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 text-xs">취소</Button>
      </div>
    </div>
  );
}

// ── Test Mode ─────────────────────────────────────────────────────────────────
function VocabTest({
  words,
  testType,
  weekLabel,
  studentName,
  onClose,
}: {
  words: VocabWord[];
  testType: TestType;
  weekLabel: string;
  studentName: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<TestMode>("running");
  const [testId, setTestId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Shuffle words
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setQuestions(shuffled.map((w) => ({ word: w, userAnswer: "", isCorrect: null })));
    // Create test record
    createTestRecord(shuffled);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [current]);

  const createTestRecord = async (shuffled: VocabWord[]) => {
    const { data } = await supabase
      .from("vocabulary_tests")
      .insert({
        student_name: studentName,
        type: testType,
        week_label: testType === "week" ? weekLabel : null,
        word_ids: shuffled.map((w) => w.id),
        total: shuffled.length,
      })
      .select()
      .single();
    if (data) setTestId(data.id);
  };

  const handleAnswer = async () => {
    if (!input.trim()) return;
    const q = questions[current];
    const correct = input.trim().toLowerCase() === q.word.english_word.toLowerCase();

    const updated = [...questions];
    updated[current] = { ...q, userAnswer: input.trim(), isCorrect: correct };
    setQuestions(updated);

    // Save result
    if (testId) {
      await supabase.from("vocabulary_test_results").insert({
        test_id: testId,
        word_id: q.word.id,
        student_answer: input.trim(),
        is_correct: correct,
      });
    }

    setInput("");

    if (current + 1 >= questions.length) {
      // Finish test
      const score = updated.filter((q) => q.isCorrect).length;
      await supabase
        .from("vocabulary_tests")
        .update({ score, completed_at: new Date().toISOString() })
        .eq("id", testId ?? "");
      setMode("done");
    } else {
      setCurrent((c) => c + 1);
    }
  };

  if (mode === "done") {
    const score = questions.filter((q) => q.isCorrect).length;
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8 max-w-lg mx-auto w-full">
        <div className="w-20 h-20 rounded-full bg-[hsl(var(--gold)/0.15)] flex items-center justify-center">
          <Trophy className="w-10 h-10 text-[hsl(var(--gold))]" />
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">{score} / {questions.length}</p>
          <p className="text-muted-foreground mt-1">{pct}% 정답</p>
        </div>

        <div className="w-full space-y-2">
          {questions.map((q, i) => (
            <div key={i} className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm",
              q.isCorrect
                ? "border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.05)]"
                : "border-destructive/20 bg-destructive/5"
            )}>
              {q.isCorrect
                ? <Check className="w-4 h-4 text-[hsl(var(--success))] flex-shrink-0" />
                : <X className="w-4 h-4 text-destructive flex-shrink-0" />}
              <span className="text-muted-foreground w-24 flex-shrink-0">{q.word.korean_meaning}</span>
              <span className="flex-1 font-medium text-foreground">{q.word.english_word}</span>
              {!q.isCorrect && (
                <span className="text-xs text-destructive/80">내 답: {q.userAnswer}</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={onClose} className="gap-2 bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground">
            <ArrowLeft className="w-4 h-4" />
            단어장으로
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  if (!q) return null;
  const progress = ((current) / questions.length) * 100;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8 max-w-lg mx-auto w-full">
      {/* Progress */}
      <div className="w-full">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>{current + 1} / {questions.length}</span>
          <button onClick={onClose} className="hover:text-foreground">종료</button>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-[hsl(var(--gold))] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question card */}
      <div className="w-full rounded-2xl border border-border bg-card shadow-card p-8 text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">한국어 → 영어</p>
        <p className="text-3xl font-bold text-foreground">{q.word.korean_meaning}</p>
        {q.word.part_of_speech && (
          <p className="text-xs text-muted-foreground">({q.word.part_of_speech})</p>
        )}
      </div>

      {/* Answer input */}
      <div className="w-full space-y-3">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAnswer()}
          placeholder="영단어를 입력하세요..."
          className="h-12 text-base text-center"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button
          onClick={handleAnswer}
          disabled={!input.trim()}
          className="w-full h-12 text-base font-semibold gold-gradient text-accent-foreground shadow-gold hover:opacity-90"
        >
          확인 →
        </Button>
      </div>
    </div>
  );
}

// ── Student View ──────────────────────────────────────────────────────────────
function StudentVocabView({ studentName }: { studentName: string }) {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [addingWeek, setAddingWeek] = useState<string | null>(null);
  const [testTarget, setTestTarget] = useState<{ words: VocabWord[]; type: TestType; week: string } | null>(null);

  useEffect(() => {
    fetchWords();
  }, [studentName]);

  const fetchWords = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vocabulary_words")
      .select("*")
      .eq("student_name", studentName)
      .order("created_at", { ascending: false });
    setWords(data || []);
    // Auto-expand first week
    if (data && data.length > 0) {
      setExpandedWeeks(new Set([data[0].week_label]));
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("vocabulary_words").delete().eq("id", id);
    setWords((prev) => prev.filter((w) => w.id !== id));
  };

  const handleWordAdded = (word: VocabWord) => {
    setWords((prev) => [word, ...prev]);
    setAddingWeek(null);
  };

  const toggleWeek = (label: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const grouped = groupByWeek(words);
  const weeks = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (testTarget) {
    return (
      <VocabTest
        words={testTarget.words}
        testType={testTarget.type}
        weekLabel={testTarget.week}
        studentName={studentName}
        onClose={() => setTestTarget(null)}
      />
    );
  }

  return (
    <div className="flex-1 px-4 py-5 max-w-3xl mx-auto w-full space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            총 <span className="font-bold text-foreground">{words.length}</span>개 단어 ·{" "}
            <span className="font-bold text-foreground">{weeks.length}</span>주차
          </div>
        </div>
        {words.length > 0 && (
          <Button
            size="sm"
            onClick={() => setTestTarget({ words, type: "all", week: "" })}
            className="h-8 text-xs gap-1.5 bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground"
          >
            <Trophy className="w-3.5 h-3.5" />
            전체 테스트
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : words.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground text-sm">
          아직 등록된 단어가 없습니다
        </div>
      ) : (
        weeks.map((week) => {
          const weekWords = grouped[week];
          const isOpen = expandedWeeks.has(week);
          return (
            <div key={week} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              {/* Week header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                <button
                  onClick={() => toggleWeek(week)}
                  className="flex-1 flex items-center gap-2.5 text-left"
                >
                  <BookOpen className="w-4 h-4 text-[hsl(var(--gold))]" />
                  <span className="font-semibold text-foreground text-sm">{week}</span>
                  <span className="text-xs bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))] px-1.5 py-0.5 rounded-full font-medium">
                    {weekWords.length}개
                  </span>
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />}
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTestTarget({ words: weekWords, type: "week", week })}
                  className="h-7 text-xs gap-1 border-[hsl(var(--gold)/0.4)] text-[hsl(var(--gold-dark))] hover:bg-[hsl(var(--gold)/0.08)]"
                >
                  <Trophy className="w-3 h-3" />
                  테스트
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setAddingWeek(addingWeek === week ? null : week); setExpandedWeeks((p) => new Set([...p, week])); }}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>

              {/* Add form */}
              {addingWeek === week && (
                <div className="border-t border-border p-3">
                  <AddWordForm
                    studentName={studentName}
                    weekLabel={week}
                    onAdded={handleWordAdded}
                    onCancel={() => setAddingWeek(null)}
                  />
                </div>
              )}

              {/* Word list */}
              {isOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {weekWords.map((w) => (
                    <WordCard
                      key={w.id}
                      word={w}
                      onDelete={handleDelete}
                      isInstructor={false}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Add new week */}
      <NewWeekButton studentName={studentName} onAdded={(w) => setWords((prev) => [w, ...prev])} />
    </div>
  );
}

// ── New Week Button ───────────────────────────────────────────────────────────
function NewWeekButton({ studentName, onAdded }: { studentName: string; onAdded: (w: VocabWord) => void }) {
  const [open, setOpen] = useState(false);
  const [weekLabel, setWeekLabel] = useState("");
  const [english, setEnglish] = useState("");
  const [korean, setKorean] = useState("");
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!weekLabel.trim() || !english.trim() || !korean.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("vocabulary_words")
      .insert({ student_name: studentName, week_label: weekLabel.trim(), english_word: english.trim(), korean_meaning: korean.trim() })
      .select().single();
    if (!error && data) { onAdded(data); toast({ title: "새 주차 추가 완료 ✓" }); setOpen(false); setWeekLabel(""); setEnglish(""); setKorean(""); }
    setSaving(false);
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full h-9 text-sm gap-2 border-dashed border-[hsl(var(--gold)/0.5)] text-[hsl(var(--gold-dark))] hover:bg-[hsl(var(--gold)/0.06)]">
        <Plus className="w-4 h-4" />새 주차 추가
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--gold)/0.5)] bg-[hsl(var(--gold)/0.04)] p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">새 주차 & 첫 단어</p>
      <Input value={weekLabel} onChange={(e) => setWeekLabel(e.target.value)} placeholder='주차명 (예: 2026년 3월 1주차)' className="h-8 text-sm" autoFocus />
      <div className="grid grid-cols-2 gap-2.5">
        <Input value={english} onChange={(e) => setEnglish(e.target.value)} placeholder="영단어" className="h-8 text-sm" />
        <Input value={korean} onChange={(e) => setKorean(e.target.value)} placeholder="한국어 뜻" className="h-8 text-sm" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={!weekLabel.trim() || !english.trim() || !korean.trim() || saving}
          className="flex-1 h-8 text-xs bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-light))] text-primary-foreground">
          {saving ? "저장 중..." : "추가"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-8 text-xs">취소</Button>
      </div>
    </div>
  );
}

// ── Instructor View ───────────────────────────────────────────────────────────
function InstructorVocabView() {
  const [selectedStudent, setSelectedStudent] = useState(STUDENTS[0]);

  return (
    <div className="flex-1 flex gap-4 px-4 py-5 max-w-5xl mx-auto w-full">
      {/* Student selector */}
      <div className="w-48 flex-shrink-0 space-y-1">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">학생 선택</h2>
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

      {/* Word list — reuse student view but with delete enabled */}
      <div className="flex-1 min-w-0">
        <InstructorStudentWords studentName={selectedStudent} />
      </div>
    </div>
  );
}

function InstructorStudentWords({ studentName }: { studentName: string }) {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [addingWeek, setAddingWeek] = useState<string | null>(null);

  useEffect(() => {
    fetchWords();
  }, [studentName]);

  const fetchWords = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vocabulary_words")
      .select("*")
      .eq("student_name", studentName)
      .order("created_at", { ascending: false });
    setWords(data || []);
    if (data && data.length > 0) setExpandedWeeks(new Set([data[0].week_label]));
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("vocabulary_words").delete().eq("id", id);
    setWords((prev) => prev.filter((w) => w.id !== id));
  };

  const handleWordAdded = (word: VocabWord) => {
    setWords((prev) => [word, ...prev]);
    setAddingWeek(null);
  };

  const toggleWeek = (label: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const grouped = groupByWeek(words);
  const weeks = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {studentName} · 총 <span className="font-bold text-foreground">{words.length}</span>개 단어
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : words.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">아직 등록된 단어가 없습니다</div>
      ) : (
        weeks.map((week) => {
          const weekWords = grouped[week];
          const isOpen = expandedWeeks.has(week);
          return (
            <div key={week} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                <button onClick={() => toggleWeek(week)} className="flex-1 flex items-center gap-2.5 text-left">
                  <BookOpen className="w-4 h-4 text-[hsl(var(--gold))]" />
                  <span className="font-semibold text-foreground text-sm">{week}</span>
                  <span className="text-xs bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))] px-1.5 py-0.5 rounded-full font-medium">{weekWords.length}개</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />}
                </button>
                <Button size="sm" variant="ghost"
                  onClick={() => { setAddingWeek(addingWeek === week ? null : week); setExpandedWeeks((p) => new Set([...p, week])); }}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                  <Plus className="w-3 h-3" />단어 추가
                </Button>
              </div>

              {addingWeek === week && (
                <div className="border-t border-border p-3">
                  <AddWordForm studentName={studentName} weekLabel={week} onAdded={handleWordAdded} onCancel={() => setAddingWeek(null)} />
                </div>
              )}

              {isOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {weekWords.map((w) => (
                    <WordCard key={w.id} word={w} onDelete={handleDelete} isInstructor={true} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      <NewWeekButton studentName={studentName} onAdded={(w) => setWords((prev) => [w, ...prev])} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Vocabulary() {
  const [role, setRole] = useState<Role>("student");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sidebar-gradient text-sidebar-foreground px-4 py-3 flex items-center gap-4 shadow-lg">
        <a href="/" className="flex items-center gap-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">어드민</span>
        </a>
        <div className="w-px h-5 bg-sidebar-border" />
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[hsl(var(--gold))]" />
          <span className="font-bold text-sidebar-accent-foreground text-sm">단어장</span>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1 p-0.5 bg-sidebar-accent rounded-lg">
          {(["student", "instructor"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                role === r ? "bg-gold text-accent-foreground" : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
              )}
            >
              {r === "student" ? "학생" : "강사"}
            </button>
          ))}
        </div>
      </header>

      {role === "student"
        ? <StudentVocabView studentName={CURRENT_STUDENT} />
        : <InstructorVocabView />}
    </div>
  );
}
