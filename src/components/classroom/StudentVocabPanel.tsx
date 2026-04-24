import { useState, useEffect, useRef } from "react";
import {
  Volume2, Loader2, Square, ChevronDown, ChevronUp, BookOpen,
  RefreshCw, ClipboardCheck, History, Download,
  CheckCircle2, XCircle, Mic, Type, Trash2, BookMarked,
  Pencil, Plus, Sparkles, Check, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import VocabTestModal from "@/components/classroom/VocabTestModal";
import { toast } from "sonner";
import { exportWordsPdf } from "@/lib/exportVocabPdf";

function getWeekLabel(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

interface VocabWord {
  id: string;
  english_word: string;
  korean_meaning: string;
  part_of_speech: string | null;
  example_sentence: string | null;
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
  word_ids: string[] | null;
}

interface TestResultDetail {
  id: string;
  word_id: string | null;
  student_answer: string | null;
  is_correct: boolean | null;
}

// ── TTS Button ────────────────────────────────────────────────────────────────
function TTSButton({ word }: { word: VocabWord }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = async () => {
    if (playing) { audioRef.current?.pause(); setPlaying(false); return; }
    if (word.audio_url) {
      const audio = new Audio(word.audio_url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.play(); setPlaying(true); return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tts-cache", {
        body: { word: word.english_word, wordId: word.id },
      });
      if (error || !data?.audio_url) throw new Error("TTS failed");
      word.audio_url = data.audio_url;
      const audio = new Audio(data.audio_url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.play(); setPlaying(true);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); play(); }}
      disabled={loading}
      className="flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--navy)/0.08)] hover:bg-[hsl(var(--navy)/0.18)] transition-colors flex-shrink-0"
      title="발음 듣기"
    >
      {loading ? <Loader2 className="w-3 h-3 text-navy animate-spin" />
        : playing ? <Square className="w-2.5 h-2.5 text-navy fill-navy" />
        : <Volume2 className="w-3 h-3 text-navy" />}
    </button>
  );
}

// ── Inline edit/add form ─────────────────────────────────────────────────────
interface VocabFormValue {
  english_word: string;
  korean_meaning: string;
  part_of_speech: string;
  example_sentence: string;
}

function VocabEditForm({
  initial,
  onSave,
  onCancel,
  noteContext,
  autoFocus = true,
}: {
  initial: VocabFormValue;
  onSave: (value: VocabFormValue) => Promise<void> | void;
  onCancel: () => void;
  noteContext?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState<VocabFormValue>(initial);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const englishRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) englishRef.current?.focus();
  }, [autoFocus]);

  const valid = value.english_word.trim().length > 0 && value.korean_meaning.trim().length > 0;

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave({
        english_word: value.english_word.trim(),
        korean_meaning: value.korean_meaning.trim(),
        part_of_speech: value.part_of_speech.trim(),
        example_sentence: value.example_sentence.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAiFill = async () => {
    const w = value.english_word.trim();
    if (!w) { toast.error("영단어를 먼저 입력하세요"); return; }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-vocab-word", {
        body: { word: w, context: noteContext },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setValue((v) => ({
        english_word: v.english_word,
        korean_meaning: data.korean_meaning || v.korean_meaning,
        part_of_speech: data.part_of_speech || v.part_of_speech,
        example_sentence: data.example_sentence || v.example_sentence,
      }));
      toast.success("AI가 채워드렸어요");
    } catch (e: any) {
      toast.error(e?.message ?? "AI 채우기 실패");
    } finally {
      setAiLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    if ((e.key === "Enter") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); }
  };

  const inputCls = "w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-gold/50";

  return (
    <div className="px-3 py-2.5 bg-gold/5 border-y border-gold/30 space-y-2" onKeyDown={onKey}>
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-5 flex gap-1">
          <input
            ref={englishRef}
            value={value.english_word}
            onChange={(e) => setValue((v) => ({ ...v, english_word: e.target.value }))}
            placeholder="English word"
            className={cn(inputCls, "flex-1")}
          />
          <button
            type="button"
            onClick={handleAiFill}
            disabled={aiLoading || !value.english_word.trim()}
            title="AI로 한국어 뜻/품사/예문 자동 채우기"
            className="flex items-center justify-center w-7 h-7 rounded-md bg-gold/15 hover:bg-gold/25 text-gold-dark disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          </button>
        </div>
        <input
          value={value.part_of_speech}
          onChange={(e) => setValue((v) => ({ ...v, part_of_speech: e.target.value }))}
          placeholder="품사"
          className={cn(inputCls, "col-span-2")}
        />
        <input
          value={value.korean_meaning}
          onChange={(e) => setValue((v) => ({ ...v, korean_meaning: e.target.value }))}
          placeholder="한국어 뜻"
          className={cn(inputCls, "col-span-5")}
        />
      </div>
      <input
        value={value.example_sentence}
        onChange={(e) => setValue((v) => ({ ...v, example_sentence: e.target.value }))}
        placeholder="예문 (선택)"
        className={inputCls}
      />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">⌘/Ctrl+Enter 저장 · Esc 취소</p>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs gap-1">
            <X className="w-3 h-3" /> 취소
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!valid || saving}
            className="h-7 text-xs gap-1 bg-navy hover:bg-navy-light text-primary-foreground"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}

function WordRow({
  word,
  onDelete,
  onEdit,
  noteContext,
}: {
  word: VocabWord;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, value: VocabFormValue) => Promise<void>;
  noteContext?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  if (editing && onEdit) {
    return (
      <VocabEditForm
        initial={{
          english_word: word.english_word,
          korean_meaning: word.korean_meaning,
          part_of_speech: word.part_of_speech ?? "",
          example_sentence: word.example_sentence ?? "",
        }}
        noteContext={noteContext}
        onSave={async (val) => {
          await onEdit(word.id, val);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors group"
        onClick={() => setExpanded((v) => !v)}
      >
        <TTSButton word={word} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-medium text-sm text-foreground break-words">{word.english_word}</span>
          {word.part_of_speech && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium flex-shrink-0 hidden sm:inline">
              {word.part_of_speech}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0 max-w-[90px] text-right leading-snug">{word.korean_meaning}</span>
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-navy/10 text-muted-foreground hover:text-navy flex-shrink-0"
            title="수정"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(word.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0"
            title="삭제"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </div>
      {expanded && word.example_sentence && (
        <div className="px-4 pb-2.5 bg-muted/10">
          <p className="text-xs text-muted-foreground italic">"{word.example_sentence}"</p>
        </div>
      )}
    </div>
  );
}

function WeekGroup({
  weekLabel, words, lessonNumber, onDownloadPdf, onDeleteWord, onEditWord, onAddWord, isCurrentWeek, noteContext,
}: {
  weekLabel: string;
  words: VocabWord[];
  lessonNumber: string | null;
  onDownloadPdf: () => void;
  onDeleteWord: (id: string) => void;
  onEditWord?: (id: string, value: VocabFormValue) => Promise<void>;
  onAddWord?: () => void;
  isCurrentWeek: boolean;
  noteContext?: string;
}) {
  const [open, setOpen] = useState(true);
  const label = lessonNumber != null && isCurrentWeek
    ? `${lessonNumber} 수업`
    : weekLabel.replace(/(\d{4})-W(\d{2})/, (_, y, w) => `${y}년 ${parseInt(w)}주차`);
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40">
        <button onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
          <span className="text-xs text-muted-foreground">({words.length}개)</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        <div className="flex items-center gap-1">
          {onAddWord && isCurrentWeek && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] gap-1 text-gold-dark hover:text-gold hover:bg-gold/10 px-2"
              onClick={onAddWord}
              title="이 주차에 단어 추가"
            >
              <Plus className="w-3 h-3" />
              추가
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground px-2"
            onClick={onDownloadPdf}
          >
            <Download className="w-3 h-3" />
            PDF
          </Button>
        </div>
      </div>
      {open && words.map((w) => (
        <WordRow
          key={w.id}
          word={w}
          onDelete={onDeleteWord}
          onEdit={onEditWord}
          noteContext={noteContext}
        />
      ))}
    </div>
  );
}

// ── Flashcard Study View ──────────────────────────────────────────────────────
function StudyView({ words, onClose }: { words: VocabWord[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [shuffled] = useState(() => [...words].sort(() => Math.random() - 0.5));
  const word = shuffled[idx];

  if (!word) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">{idx + 1} / {shuffled.length}</span>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">닫기</button>
        </div>
        <div className="p-8 text-center space-y-4 min-h-[220px] flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-foreground">{word.korean_meaning}</p>
          {word.part_of_speech && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{word.part_of_speech}</span>
          )}
          {showAnswer ? (
            <div className="space-y-2">
              <p className="text-xl font-bold text-navy">{word.english_word}</p>
              {word.example_sentence && (
                <p className="text-xs text-muted-foreground italic">"{word.example_sentence}"</p>
              )}
            </div>
          ) : (
            <button onClick={() => setShowAnswer(true)}
              className="text-sm text-gold-dark hover:text-gold font-medium transition-colors"
            >
              정답 보기
            </button>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setIdx(i => Math.max(0, i - 1)); setShowAnswer(false); }}
            disabled={idx === 0} className="flex-1 text-xs"
          >
            이전
          </Button>
          <Button size="sm" onClick={() => {
            if (idx < shuffled.length - 1) { setIdx(i => i + 1); setShowAnswer(false); }
            else onClose();
          }}
            className="flex-1 text-xs bg-navy hover:bg-navy-light text-primary-foreground"
          >
            {idx === shuffled.length - 1 ? "완료" : "다음"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Test Detail Modal ─────────────────────────────────────────────────────────
function TestDetailView({
  testRecord,
  results,
  allWords,
  onClose,
}: {
  testRecord: TestRecord;
  results: TestResultDetail[];
  allWords: VocabWord[];
  onClose: () => void;
}) {
  const wordMap = new Map(allWords.map((w) => [w.id, w]));
  const pct = testRecord.score != null && testRecord.total ? Math.round((testRecord.score / testRecord.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div>
            <p className="font-bold text-sm text-foreground">테스트 상세 결과</p>
            <p className="text-[10px] text-muted-foreground">
              {testRecord.completed_at ? new Date(testRecord.completed_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("text-lg font-bold",
              pct >= 80 ? "text-success" : pct >= 60 ? "text-gold-dark" : "text-destructive"
            )}>{pct}점</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {results.map((r) => {
            const word = r.word_id ? wordMap.get(r.word_id) : null;
            return (
              <div key={r.id} className={cn("rounded-lg p-3 border text-sm space-y-1",
                r.is_correct ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
              )}>
                <div className="flex items-center gap-2">
                  {r.is_correct
                    ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                  <span className="font-medium text-foreground text-xs">
                    {word?.korean_meaning ?? "(알 수 없음)"}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    정답: <span className="font-mono font-semibold">{word?.english_word ?? "-"}</span>
                  </span>
                </div>
                {!r.is_correct && (
                  <div className="pl-6">
                    <p className="text-[11px] text-destructive/80">
                      내 답: <span className="font-mono">{r.student_answer || "(미입력)"}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-border">
          <Button className="w-full bg-navy hover:bg-navy-light text-primary-foreground" size="sm" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function StudentVocabPanel({
  studentName,
  scheduledAt,
  sessionId,
  instructorMode = false,
  noteContext,
}: {
  studentName: string;
  scheduledAt: Date;
  sessionId: string;
  /** 강사/매니저 모드: 단어 인라인 편집 + 추가 + AI 자동 채움 활성화 */
  instructorMode?: boolean;
  /** AI 자동 채움 시 톤/주제 참고용 노트 텍스트 */
  noteContext?: string;
}) {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [completedTests, setCompletedTests] = useState(0);
  const [loadingTests, setLoadingTests] = useState(true);
  const [testHistory, setTestHistory] = useState<TestRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lessonNumber, setLessonNumber] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<TestRecord | null>(null);
  const [testDetails, setTestDetails] = useState<TestResultDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [addingNew, setAddingNew] = useState(false);

  // Use the session's word week label instead of current calendar week
  const sessionWeekLabel = words.length > 0 ? words[0].week_label : getWeekLabel();
  const canTest = words.length >= 5;

  const handleDeleteWord = async (wordId: string) => {
    if (!confirm("이 단어를 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("vocabulary_words").delete().eq("id", wordId);
    if (error) { toast.error("삭제 실패"); return; }
    setWords((prev) => prev.filter((w) => w.id !== wordId));
    toast.success("단어가 삭제되었습니다");
  };

  const handleEditWord = async (wordId: string, val: VocabFormValue) => {
    const original = words.find((w) => w.id === wordId);
    // 영단어가 바뀌면 기존 audio_url 무효화 (TTS 재생성)
    const englishChanged = original && original.english_word !== val.english_word;
    const updates: Record<string, unknown> = {
      english_word: val.english_word,
      korean_meaning: val.korean_meaning,
      part_of_speech: val.part_of_speech || null,
      example_sentence: val.example_sentence || null,
    };
    if (englishChanged) updates.audio_url = null;
    const { error } = await supabase.from("vocabulary_words").update(updates).eq("id", wordId);
    if (error) { toast.error("수정 실패"); throw error; }
    setWords((prev) => prev.map((w) => w.id === wordId ? { ...w, ...updates } as VocabWord : w));
    toast.success("수정되었습니다");
  };

  const handleAddWord = async (val: VocabFormValue) => {
    // 같은 세션에 동일 영단어(대소문자 무시) 중복 검사
    const dupe = words.find((w) =>
      w.english_word.trim().toLowerCase() === val.english_word.trim().toLowerCase()
    );
    if (dupe) {
      const ok = confirm(`"${val.english_word}"는 이미 단어장에 있습니다. 그래도 추가할까요?`);
      if (!ok) return;
    }
    const weekLabel = words.length > 0 ? words[0].week_label : getWeekLabel(scheduledAt);
    const { data, error } = await supabase
      .from("vocabulary_words")
      .insert({
        student_name: studentName,
        session_id: sessionId,
        week_label: weekLabel,
        english_word: val.english_word,
        korean_meaning: val.korean_meaning,
        part_of_speech: val.part_of_speech || null,
        example_sentence: val.example_sentence || null,
      })
      .select("id, english_word, korean_meaning, part_of_speech, example_sentence, audio_url, week_label")
      .single();
    if (error || !data) { toast.error("추가 실패"); throw error ?? new Error("insert failed"); }
    setWords((prev) => [...prev, data as VocabWord]);
    toast.success("추가되었습니다");
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vocabulary_words")
      .select("id, english_word, korean_meaning, part_of_speech, example_sentence, audio_url, week_label")
      .eq("student_name", studentName)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    setWords(data ?? []);
    setLoading(false);
  };

  const [latestCorrect, setLatestCorrect] = useState(0);
  const [latestAttempted, setLatestAttempted] = useState(0);

  const loadTestCount = async () => {
    setLoadingTests(true);
    const { data } = await supabase
      .from("vocabulary_tests")
      .select("id, week_label, type, score, total, completed_at, word_ids")
      .eq("student_name", studentName)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });
    const all = (data ?? []) as TestRecord[];
    // Filter tests to only those whose word_ids overlap with current session's words
    const sessionWordIds = new Set(words.map((w) => w.id));
    const relevant = all.filter((t) => t.word_ids?.some((id) => sessionWordIds.has(id)));
    setTestHistory(relevant);
    setCompletedTests(relevant.length);

    // 단어별 최신 정답률: 관련 테스트들의 모든 결과에서 단어별 가장 최근 결과만 집계
    if (relevant.length > 0 && sessionWordIds.size > 0) {
      const testIds = relevant.map((t) => t.id);
      const { data: resultsData } = await supabase
        .from("vocabulary_test_results")
        .select("word_id, is_correct, created_at, test_id")
        .in("test_id", testIds)
        .order("created_at", { ascending: false });
      const latest = new Map<string, boolean>();
      for (const r of (resultsData ?? []) as { word_id: string | null; is_correct: boolean | null }[]) {
        if (!r.word_id || !sessionWordIds.has(r.word_id)) continue;
        if (!latest.has(r.word_id)) latest.set(r.word_id, !!r.is_correct);
      }
      setLatestAttempted(latest.size);
      setLatestCorrect(Array.from(latest.values()).filter(Boolean).length);
    } else {
      setLatestAttempted(0);
      setLatestCorrect(0);
    }
    setLoadingTests(false);
  };

  const loadLessonNumber = async () => {
    const d = new Date(scheduledAt);
    const month = d.getMonth() + 1;
    const weekOfMonth = Math.ceil(d.getDate() / 7);
    setLessonNumber(`${month}월 ${weekOfMonth}주차`);
  };

  useEffect(() => { load(); loadLessonNumber(); }, [studentName, sessionId]);
  useEffect(() => { if (!loading) loadTestCount(); }, [words]);

  const [detailWords, setDetailWords] = useState<VocabWord[]>([]);

  const openTestDetail = async (test: TestRecord) => {
    setSelectedTest(test);
    setLoadingDetails(true);
    // Fetch test results and the actual words used in this test
    const [resultsRes, wordsRes] = await Promise.all([
      supabase
        .from("vocabulary_test_results")
        .select("id, word_id, student_answer, is_correct")
        .eq("test_id", test.id),
      test.word_ids && test.word_ids.length > 0
        ? supabase
            .from("vocabulary_words")
            .select("id, english_word, korean_meaning, part_of_speech, example_sentence, audio_url, week_label")
            .in("id", test.word_ids)
        : Promise.resolve({ data: [] }),
    ]);
    setTestDetails((resultsRes.data ?? []) as TestResultDetail[]);
    setDetailWords((wordsRes.data ?? []) as VocabWord[]);
    setLoadingDetails(false);
  };

  const byWeek = words.reduce<Record<string, VocabWord[]>>((acc, w) => {
    if (!acc[w.week_label]) acc[w.week_label] = [];
    acc[w.week_label].push(w);
    return acc;
  }, {});
  const weeks = Object.keys(byWeek).sort((a, b) => b.localeCompare(a));

  const currentWeekWords = byWeek[sessionWeekLabel] ?? [];

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-gold" />
            <span className="font-semibold text-xs text-foreground">내 단어장</span>
            {!loading && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy/10 text-navy font-medium">
                {words.length}개
              </span>
            )}
          </div>
          <button onClick={() => { load(); loadTestCount(); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="새로고침"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>

        {/* Test & Study Button Section */}
        {!loading && currentWeekWords.length >= 5 && (
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2 bg-muted/10">
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardCheck className="w-3.5 h-3.5 text-gold flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  단어 학습 & 테스트 ({completedTests}회 완료
                  {latestAttempted > 0 && (
                    <span className="text-muted-foreground font-normal"> · 최근 {latestCorrect}/{latestAttempted}</span>
                  )}
                  )
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  플래시카드로 학습하거나 테스트하세요
                </p>
              </div>
            </div>

            {!loadingTests && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStudyOpen(true)}
                  className="h-7 text-xs gap-1 border-gold/50 text-gold-dark hover:bg-gold/10"
                >
                  <BookMarked className="w-3 h-3" />
                  학습
                </Button>
                <Button
                  size="sm"
                  onClick={() => setTestModalOpen(true)}
                  disabled={!canTest}
                  className="h-7 text-xs gap-1 bg-navy hover:bg-navy-light text-primary-foreground"
                >
                  <ClipboardCheck className="w-3 h-3" />
                  테스트
                </Button>
              </div>
            )}
          </div>
        )}
        {/* Study mode for fewer than 5 words */}
        {!loading && words.length > 0 && currentWeekWords.length < 5 && (
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2 bg-muted/10">
            <div className="flex items-center gap-2 min-w-0">
              <BookMarked className="w-3.5 h-3.5 text-gold flex-shrink-0" />
              <p className="text-xs font-semibold text-foreground">플래시카드 학습</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStudyOpen(true)}
              className="h-7 text-xs gap-1 border-gold/50 text-gold-dark hover:bg-gold/10 flex-shrink-0"
            >
              <BookMarked className="w-3 h-3" />
              학습
            </Button>
          </div>
        )}

        {/* Test History */}
        {testHistory.length > 0 && (
          <div className="border-b border-border">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
            >
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">테스트 이력</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{testHistory.length}회</span>
              </div>
              {historyOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {historyOpen && (
              <div className="divide-y divide-border/50">
                {testHistory.map((t, i) => {
                  const pct = t.score != null && t.total ? Math.round((t.score / t.total) * 100) : null;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => openTestDetail(t)}
                    >
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                        pct == null ? "bg-muted" : pct >= 80 ? "bg-success/15" : pct >= 60 ? "bg-gold/15" : "bg-destructive/10"
                      )}>
                        {t.type === "audio"
                          ? <Mic className={cn("w-3 h-3", pct != null && pct >= 80 ? "text-success" : pct != null && pct >= 60 ? "text-gold" : "text-destructive")} />
                          : <Type className={cn("w-3 h-3", pct != null && pct >= 80 ? "text-success" : pct != null && pct >= 60 ? "text-gold" : "text-destructive")} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{testHistory.length - i}회차</p>
                        <p className="text-[10px] text-muted-foreground">{t.completed_at ? fmtDate(t.completed_at) : "-"}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {pct != null ? (
                          <>
                            <p className={cn("text-sm font-bold", pct >= 80 ? "text-success" : pct >= 60 ? "text-gold-dark" : "text-destructive")}>{pct}점</p>
                            <p className="text-[10px] text-muted-foreground">{t.total}문제 중 {t.score}개</p>
                          </>
                        ) : <span className="text-xs text-muted-foreground">-</span>}
                      </div>
                      <ChevronDown className="w-3 h-3 text-muted-foreground -rotate-90 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 강사 모드: 패널 상단 단어 추가 영역 */}
        {instructorMode && !loading && (
          <div className="border-b border-border">
            {addingNew ? (
              <VocabEditForm
                initial={{ english_word: "", korean_meaning: "", part_of_speech: "", example_sentence: "" }}
                noteContext={noteContext}
                onSave={async (val) => {
                  await handleAddWord(val);
                  // 연속 추가를 위해 폼 유지 (재마운트로 초기화)
                  setAddingNew(false);
                  setTimeout(() => setAddingNew(true), 0);
                }}
                onCancel={() => setAddingNew(false)}
              />
            ) : (
              <button
                onClick={() => setAddingNew(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-gold-dark hover:text-gold hover:bg-gold/5 transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                단어 직접 추가
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : words.length === 0 && !addingNew ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-4">
              <BookOpen className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">아직 단어장이 비어있습니다</p>
              <p className="text-[11px] text-muted-foreground/60">
                {instructorMode
                  ? "노트에서 단어 추출하거나 위 '+ 단어 직접 추가'로 등록하세요"
                  : "수업 후 강사가 단어를 추출하면 여기에 표시됩니다"}
              </p>
            </div>
          ) : (
            <div>
              {weeks.map((wk) => (
                <WeekGroup
                  key={wk}
                  weekLabel={wk}
                  words={byWeek[wk]}
                  lessonNumber={lessonNumber}
                  onDownloadPdf={() => { exportWordsPdf(byWeek[wk], studentName); }}
                  onDeleteWord={handleDeleteWord}
                  onEditWord={instructorMode ? handleEditWord : undefined}
                  onAddWord={instructorMode ? () => setAddingNew(true) : undefined}
                  isCurrentWeek={wk === sessionWeekLabel}
                  noteContext={noteContext}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {testModalOpen && (
        <VocabTestModal
          words={currentWeekWords}
          studentName={studentName}
          weekLabel={sessionWeekLabel}
          completedTests={completedTests}
          scheduledAt={scheduledAt}
          onClose={() => setTestModalOpen(false)}
          onTestComplete={() => { loadTestCount(); setHistoryOpen(true); setTestModalOpen(false); }}
        />
      )}

      {studyOpen && words.length > 0 && (
        <StudyView words={words} onClose={() => setStudyOpen(false)} />
      )}

      {selectedTest && !loadingDetails && (
        <TestDetailView
          testRecord={selectedTest}
          results={testDetails}
          allWords={detailWords}
          onClose={() => setSelectedTest(null)}
        />
      )}
    </>
  );
}
