import { useState, useEffect, useRef } from "react";
import { Volume2, Loader2, Square, ChevronDown, ChevronUp, BookOpen, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface VocabWord {
  id: string;
  english_word: string;
  korean_meaning: string;
  part_of_speech: string | null;
  example_sentence: string | null;
  audio_url: string | null;
  week_label: string;
}

// ── TTS Button ────────────────────────────────────────────────────────────────
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

    if (word.audio_url) {
      const audio = new Audio(word.audio_url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.play();
      setPlaying(true);
      return;
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
      audio.play();
      setPlaying(true);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); play(); }}
      disabled={loading}
      className="flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--navy)/0.08)] hover:bg-[hsl(var(--navy)/0.18)] transition-colors flex-shrink-0"
      title="발음 듣기"
    >
      {loading ? (
        <Loader2 className="w-3 h-3 text-navy animate-spin" />
      ) : playing ? (
        <Square className="w-2.5 h-2.5 text-navy fill-navy" />
      ) : (
        <Volume2 className="w-3 h-3 text-navy" />
      )}
    </button>
  );
}

// ── Word Row ──────────────────────────────────────────────────────────────────
function WordRow({ word }: { word: VocabWord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border/50 last:border-0">
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors group"
        onClick={() => setExpanded((v) => !v)}
      >
        <TTSButton word={word} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-medium text-sm text-foreground truncate">{word.english_word}</span>
          {word.part_of_speech && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium flex-shrink-0 hidden sm:inline">
              {word.part_of_speech}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0 max-w-[90px] truncate">
          {word.korean_meaning}
        </span>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
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

// ── Week Group ────────────────────────────────────────────────────────────────
function WeekGroup({ weekLabel, words }: { weekLabel: string; words: VocabWord[] }) {
  const [open, setOpen] = useState(true);

  // 주차 라벨 포맷: "2026-W08" → "2026년 8주차"
  const pretty = weekLabel.replace(/(\d{4})-W(\d{2})/, (_, y, w) => `${y}년 ${parseInt(w)}주차`);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{pretty}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{words.length}개</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && words.map((w) => <WordRow key={w.id} word={w} />)}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function StudentVocabPanel({ studentName }: { studentName: string }) {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vocabulary_words")
      .select("id, english_word, korean_meaning, part_of_speech, example_sentence, audio_url, week_label")
      .eq("student_name", studentName)
      .order("week_label", { ascending: false })
      .order("created_at", { ascending: true });
    setWords(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [studentName]);

  // 주차별 그룹
  const byWeek = words.reduce<Record<string, VocabWord[]>>((acc, w) => {
    if (!acc[w.week_label]) acc[w.week_label] = [];
    acc[w.week_label].push(w);
    return acc;
  }, {});
  const weeks = Object.keys(byWeek).sort((a, b) => b.localeCompare(a));

  return (
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
        <button
          onClick={load}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="새로고침"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : words.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-4">
            <BookOpen className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">아직 단어장이 비어있습니다</p>
            <p className="text-[11px] text-muted-foreground/60">수업 후 강사가 단어를 추출하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div>
            {weeks.map((wk) => (
              <WeekGroup key={wk} weekLabel={wk} words={byWeek[wk]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
