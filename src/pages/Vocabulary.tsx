import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Volume2, Loader2, Square, ChevronDown, ChevronUp,
  ChevronLeft, RefreshCw, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import VocabTestModal from "@/components/classroom/VocabTestModal";

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
  return label.replace(/(\d{4})-W(\d{2})/, (_, y, w) => `${y}년 ${parseInt(w)}주차`);
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

export default function Vocabulary() {
  const navigate = useNavigate();
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<string>("정유리");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showTest, setShowTest] = useState(false);

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

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vocabulary_words")
      .select("id, english_word, korean_meaning, part_of_speech, example_sentence, audio_url, week_label")
      .eq("student_name", student)
      .order("week_label", { ascending: false })
      .order("created_at", { ascending: true });
    setWords(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [student]);

  const byWeek = words.reduce<Record<string, VocabWord[]>>((acc, w) => {
    if (!acc[w.week_label]) acc[w.week_label] = [];
    acc[w.week_label].push(w);
    return acc;
  }, {});
  const weeks = Object.keys(byWeek).sort((a, b) => b.localeCompare(a));

  // 랜덤 테스트용: 전체 단어에서 50개 선택
  const testWords = (() => {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(50, shuffled.length));
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate("/my/dashboard")}
            className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gold" />
            <span className="font-bold text-foreground text-sm">
              {displayName || student} 님의 단어장
            </span>
            {!loading && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy/10 text-navy font-semibold">{words.length}개</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {words.length > 0 && (
            <button
              onClick={() => setShowTest(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-navy text-primary-foreground text-xs font-semibold hover:bg-navy-light transition-colors"
            >
              <Brain className="w-3.5 h-3.5" />
              랜덤 테스트
            </button>
          )}
          <button onClick={load} className="text-muted-foreground hover:text-foreground transition-colors" title="새로고침">
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

      {/* Random Test Modal */}
      {showTest && testWords.length > 0 && (
        <VocabTestModal
          words={testWords}
          studentName={student}
          weekLabel="전체"
          completedTests={0}
          scheduledAt={new Date()}
          onClose={() => setShowTest(false)}
          onTestComplete={() => {}}
        />
      )}
    </div>
  );
}
