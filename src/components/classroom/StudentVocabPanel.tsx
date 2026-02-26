import { useState, useEffect, useRef } from "react";
import {
  Volume2, Loader2, Square, ChevronDown, ChevronUp, BookOpen,
  RefreshCw, ClipboardCheck, History, Download,
  CheckCircle2, XCircle, Mic, Type,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import VocabTestModal from "@/components/classroom/VocabTestModal";
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

function WordRow({ word }: { word: VocabWord }) {
  const [expanded, setExpanded] = useState(false);
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

function WeekGroup({ weekLabel, words }: { weekLabel: string; words: VocabWord[] }) {
  const [open, setOpen] = useState(true);
  const pretty = weekLabel.replace(/(\d{4})-W(\d{2})/, (_, y, w) => `${y}년 ${parseInt(w)}주차`);
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)}
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
export default function StudentVocabPanel({
  studentName,
  scheduledAt,
  sessionId,
}: {
  studentName: string;
  scheduledAt: Date;
  sessionId: string;
}) {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [completedTests, setCompletedTests] = useState(0);
  const [loadingTests, setLoadingTests] = useState(true);
  const [testHistory, setTestHistory] = useState<TestRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Use the session's word week label instead of current calendar week
  const sessionWeekLabel = words.length > 0 ? words[0].week_label : getWeekLabel();
  const canTest = words.length >= 5;

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

  const loadTestCount = async () => {
    setLoadingTests(true);
    const { data } = await supabase
      .from("vocabulary_tests")
      .select("id, week_label, type, score, total, completed_at")
      .eq("student_name", studentName)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });
    const all = (data ?? []) as TestRecord[];
    setTestHistory(all);
    setCompletedTests(all.filter((t) => t.week_label === sessionWeekLabel).length);
    setLoadingTests(false);
  };

  useEffect(() => { load(); loadTestCount(); }, [studentName, sessionId]);

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

  const fmtWeek = (wl: string | null) =>
    wl ? wl.replace(/(\d{4})-W(\d{2})/, (_, y, w) => `${y}년 ${parseInt(w)}주차`) : "-";

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

        {/* Test & PDF Button Section */}
        {!loading && currentWeekWords.length >= 5 && (
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2 bg-muted/10">
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardCheck className="w-3.5 h-3.5 text-gold flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  단어 테스트 ({completedTests}회 완료)
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  현재 주차 단어로 실력을 확인하세요
                </p>
              </div>
            </div>

            {!loadingTests && (
              <Button
                size="sm"
                onClick={() => setTestModalOpen(true)}
                disabled={!canTest}
                className="h-7 text-xs flex-shrink-0 gap-1 bg-navy hover:bg-navy-light text-primary-foreground"
              >
                <ClipboardCheck className="w-3 h-3" />
                테스트
              </Button>
            )}
          </div>
        )}

        {/* PDF Export */}
        {!loading && words.length > 0 && (
          <div className="px-3 py-2 border-b border-border flex items-center justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => exportWordsPdf(words, studentName)}
            >
              <Download className="w-3 h-3" />
              PDF 다운로드
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
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                        pct == null ? "bg-muted" : pct >= 80 ? "bg-success/15" : pct >= 60 ? "bg-gold/15" : "bg-destructive/10"
                      )}>
                        {t.type === "audio"
                          ? <Mic className={cn("w-3 h-3", pct != null && pct >= 80 ? "text-success" : pct != null && pct >= 60 ? "text-gold" : "text-destructive")} />
                          : <Type className={cn("w-3 h-3", pct != null && pct >= 80 ? "text-success" : pct != null && pct >= 60 ? "text-gold" : "text-destructive")} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{fmtWeek(t.week_label)} · {i + 1 === testHistory.length ? "1회차" : `${testHistory.length - i}회차`}</p>
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
    </>
  );
}
