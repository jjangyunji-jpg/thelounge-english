import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Volume2, Loader2, Square, ChevronDown, ChevronUp,
  ChevronLeft, RefreshCw, Brain, Download, BookMarked, Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import VocabTestModal from "@/components/classroom/VocabTestModal";
import { exportWordsPdf } from "@/lib/exportVocabPdf";
import { Button } from "@/components/ui/button";

interface VocabWord {
  id: string;
  english_word: string;
  korean_meaning: string;
  part_of_speech: string | null;
  example_sentence: string | null;
  audio_url: string | null;
  week_label: string;
}

function TTSButton({ word }: { word: VocabWord }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = async () => {
    if (playing) { audioRef.current?.pause(); setPlaying(false); return; }
    if (word.audio_url) {
      const a = new Audio(word.audio_url);
      audioRef.current = a;
      a.onended = () => setPlaying(false);
      a.play(); setPlaying(true); return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tts-cache", {
        body: { word: word.english_word, wordId: word.id },
      });
      if (error || !data?.audio_url) throw new Error();
      word.audio_url = data.audio_url;
      const a = new Audio(data.audio_url);
      audioRef.current = a;
      a.onended = () => setPlaying(false);
      a.play(); setPlaying(true);
    } finally { setLoading(false); }
  };

  return (
    <button onClick={(e) => { e.stopPropagation(); play(); }} disabled={loading}
      className="w-7 h-7 rounded-full bg-navy/10 hover:bg-navy/20 flex items-center justify-center transition-colors flex-shrink-0"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 text-navy animate-spin" />
        : playing ? <Square className="w-3 h-3 text-navy fill-navy" />
        : <Volume2 className="w-3.5 h-3.5 text-navy" />}
    </button>
  );
}

function fmtWeek(label: string) {
  const m = label.match(/(\d{4})-W(\d{2})/);
  if (!m) return label;
  const year = parseInt(m[1]);
  const week = parseInt(m[2]);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const month = monday.getMonth() + 1;
  const firstOfMonth = new Date(monday.getFullYear(), monday.getMonth(), 1);
  const weekOfMonth = Math.ceil((monday.getDate() + firstOfMonth.getDay()) / 7);
  return `${month}월 ${weekOfMonth}주차`;
}

function WeekGroup({ weekLabel, words }: { weekLabel: string; words: VocabWord[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gold" />
          <span className="text-sm font-bold text-foreground">{fmtWeek(weekLabel)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{words.length}개</span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="divide-y divide-border/50">
          {words.map(w => (
            <div key={w.id} className="group">
              <div className="flex items-center gap-3 px-4 py-3">
                <TTSButton word={w} />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{w.english_word}</span>
                  {w.part_of_speech && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{w.part_of_speech}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{w.korean_meaning}</span>
              </div>
              {w.example_sentence && (
                <div className="px-4 pb-3 -mt-1">
                  <p className="text-xs text-muted-foreground/70 italic pl-10">"{w.example_sentence}"</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Month range options ────────────────────────────────────────────────────────
const RANGE_OPTIONS = [
  { label: "최근 1개월", months: 1 },
  { label: "최근 2개월", months: 2 },
  { label: "최근 3개월", months: 3 },
  { label: "최근 6개월", months: 6 },
  { label: "전체", months: 0 },
];

function getWeekLabelNMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(d.getDate() + (4 - (d.getDay() || 7)));
  const yearStart = new Date(Date.UTC(d.getFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ── Study/Test selection popup ─────────────────────────────────────────────────
type StudyMode = "study" | "test";

interface RangePickerProps {
  onStart: (filteredWords: VocabWord[], mode: StudyMode) => void;
  onClose: () => void;
  allWords: VocabWord[];
  studentName: string;
}

function RangePickerModal({ onStart, onClose, allWords, studentName }: RangePickerProps) {
  const [selectedRange, setSelectedRange] = useState(3);
  const [exporting, setExporting] = useState(false);

  const filteredWords = selectedRange === 0
    ? allWords
    : allWords.filter(w => w.week_label >= getWeekLabelNMonthsAgo(selectedRange));

  const handleExportPdf = async () => {
    if (filteredWords.length === 0) return;
    setExporting(true);
    try {
      await exportWordsPdf(filteredWords, studentName);
    } finally { setExporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Brain className="w-4.5 h-4.5 text-gold" />
            단어 학습 & 테스트
          </h2>
          <p className="text-xs text-muted-foreground mt-1">학습 범위를 선택하고 공부 또는 테스트를 시작하세요</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Range selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">학습 범위</label>
            <div className="grid grid-cols-3 gap-1.5">
              {RANGE_OPTIONS.map(opt => (
                <button key={opt.months} onClick={() => setSelectedRange(opt.months)}
                  className={cn(
                    "px-2.5 py-2 rounded-lg border text-xs font-medium transition-all",
                    selectedRange === opt.months
                      ? "border-gold bg-gold/10 text-gold-dark"
                      : "border-border bg-card text-muted-foreground hover:border-gold/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              선택된 단어: <span className="font-bold text-foreground">{filteredWords.length}개</span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button onClick={() => onStart(filteredWords, "study")} disabled={filteredWords.length === 0}
              className="w-full h-10 text-sm gap-2 bg-navy hover:bg-navy-light text-primary-foreground"
            >
              <BookMarked className="w-4 h-4" />
              단어 학습하기 ({filteredWords.length}개)
            </Button>
            <Button onClick={() => onStart(filteredWords, "test")} disabled={filteredWords.length === 0}
              variant="outline"
              className="w-full h-10 text-sm gap-2 border-gold/50 text-gold-dark hover:bg-gold/10"
            >
              <Play className="w-4 h-4" />
              테스트 시작
            </Button>
            <Button onClick={handleExportPdf} disabled={filteredWords.length === 0 || exporting}
              variant="outline"
              className="w-full h-10 text-sm gap-2 border-muted-foreground/30 text-muted-foreground hover:bg-muted"
            >
              <Download className="w-4 h-4" />
              {exporting ? "PDF 생성 중..." : "단어 목록 PDF 다운로드"}
            </Button>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/20">
          <button onClick={onClose} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Study mode (flashcard-style) ───────────────────────────────────────────────
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

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Vocabulary() {
  const navigate = useNavigate();
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [studyWords, setStudyWords] = useState<VocabWord[] | null>(null);
  const [testWords, setTestWords] = useState<VocabWord[] | null>(null);
  const [autoTestTriggered, setAutoTestTriggered] = useState(false);
  const [autoTestWeekLabel, setAutoTestWeekLabel] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("student_profiles")
          .select("student_name, nickname")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (profile?.student_name) setStudent(profile.student_name);
        if (profile?.nickname) setDisplayName(profile.nickname);
      } else {
        const params = new URLSearchParams(window.location.search);
        const name = params.get("name");
        if (name) setStudent(name);
      }
    };
    init();
  }, []);

  const load = async (name: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("vocabulary_words")
      .select("id, english_word, korean_meaning, part_of_speech, example_sentence, audio_url, week_label")
      .eq("student_name", name)
      .order("week_label", { ascending: false })
      .order("created_at", { ascending: true });
    setWords(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (student) load(student); }, [student]);

  // Auto-start test when navigated from homework with ?startTest=weekLabel
  useEffect(() => {
    if (loading || autoTestTriggered || words.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const startTestWeek = params.get("startTest");
    if (!startTestWeek) return;
    setAutoTestTriggered(true);
    setAutoTestWeekLabel(startTestWeek);
    const weekWords = words.filter(w => w.week_label === startTestWeek);
    const targetWords = weekWords.length > 0 ? weekWords : words;
    const shuffled = [...targetWords].sort(() => Math.random() - 0.5);
    setTestWords(shuffled.slice(0, Math.min(50, shuffled.length)));
    // Clean the URL
    const url = new URL(window.location.href);
    url.searchParams.delete("startTest");
    window.history.replaceState({}, "", url.toString());
  }, [loading, words, autoTestTriggered]);

  const byWeek = words.reduce<Record<string, VocabWord[]>>((acc, w) => {
    if (!acc[w.week_label]) acc[w.week_label] = [];
    acc[w.week_label].push(w);
    return acc;
  }, {});
  const weeks = Object.keys(byWeek).sort((a, b) => b.localeCompare(a));

  const handleStartFromPicker = (filtered: VocabWord[], mode: StudyMode) => {
    setShowRangePicker(false);
    if (mode === "study") {
      setStudyWords(filtered);
    } else {
      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      setTestWords(shuffled.slice(0, Math.min(50, shuffled.length)));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border px-3 sm:px-5 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate("/my/dashboard")}
            className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <BookOpen className="w-4 h-4 text-gold flex-shrink-0" />
          <span className="font-bold text-foreground text-sm truncate">
            {displayName || student} 님의 단어장
          </span>
          {!loading && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">{words.length}개</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {words.length > 0 && (
            <button
              onClick={() => setShowRangePicker(true)}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] sm:text-xs font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">학습 / 테스트</span>
              <span className="sm:hidden">학습</span>
            </button>
          )}
          <button onClick={() => student && load(student)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" title="새로고침">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">단어 불러오는 중...</p>
            </div>
          </div>
        ) : words.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">아직 단어장이 비어있습니다</p>
            <p className="text-xs text-muted-foreground/60">수업 후 강사가 단어를 추출하면 여기에 표시됩니다</p>
          </div>
        ) : (
          weeks.map(wk => <WeekGroup key={wk} weekLabel={wk} words={byWeek[wk]} />)
        )}
      </div>

      {/* Range Picker Modal */}
      {showRangePicker && (
        <RangePickerModal
          allWords={words}
          studentName={student}
          onStart={handleStartFromPicker}
          onClose={() => setShowRangePicker(false)}
        />
      )}

      {/* Study Mode */}
      {studyWords && studyWords.length > 0 && (
        <StudyView words={studyWords} onClose={() => setStudyWords(null)} />
      )}

      {/* Test Mode */}
      {testWords && testWords.length > 0 && (
        <VocabTestModal
          words={testWords}
          studentName={student}
          weekLabel={autoTestWeekLabel || "랜덤"}
          completedTests={0}
          scheduledAt={new Date()}
          onClose={() => setTestWords(null)}
          onTestComplete={() => {}}
        />
      )}
    </div>
  );
}
