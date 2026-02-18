import { useState, useEffect, useRef } from "react";
import {
  Video, VideoOff, Clock, BookOpen, FileText, CheckSquare,
  Save, Sparkles, ExternalLink, ChevronDown, ChevronUp,
  Plus, Trash2, ArrowLeft, Wifi, WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
type ClassState = "pre" | "ready" | "active" | "ended";
type Role = "instructor" | "student";

interface VocabItem {
  id: number;
  word: string;
  meaning: string;
  example: string;
}

interface HomeworkItem {
  id: number;
  content: string;
  done: boolean;
}

// ─── Mock Session ─────────────────────────────────────────────────────────────
const SESSION = {
  studentName: "김민준",
  instructorName: "Sarah Kim",
  level: "B1",
  scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // 5분 후 (ready 상태 시연)
  meetLink: "https://meet.google.com/abc-defg-hij",
  topic: "Business Email Writing",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Classroom() {
  const [role, setRole] = useState<Role>("instructor");
  const [classState, setClassState] = useState<ClassState>("ready"); // start in "ready" for demo
  const [meetConnected, setMeetConnected] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [notes, setNotes] = useState("");
  const [vocabWord, setVocabWord] = useState("");
  const [vocabList, setVocabList] = useState<VocabItem[]>([
    { id: 1, word: "follow up", meaning: "후속 조치를 취하다", example: "I'll follow up with an email." },
  ]);
  const [hwList, setHwList] = useState<HomeworkItem[]>([
    { id: 1, content: "이메일 초안 작성해오기", done: false },
  ]);
  const [hwInput, setHwInput] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [hwOpen, setHwOpen] = useState(true);
  const [saveFlash, setSaveFlash] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (classState === "active") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [classState]);

  const msUntilClass = SESSION.scheduledAt.getTime() - now;
  const isReady = msUntilClass <= 10 * 60 * 1000; // within 10 min

  const handleStartClass = () => {
    setClassState("active");
    // Open Google Meet in new tab
    window.open(SESSION.meetLink, "_blank", "noopener,noreferrer");
    setMeetConnected(true);
  };

  const handleEndClass = () => {
    setClassState("ended");
    setMeetConnected(false);
  };

  const handleJoinMeet = () => {
    window.open(SESSION.meetLink, "_blank", "noopener,noreferrer");
    setMeetConnected(true);
  };

  const handleSaveNote = () => {
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const handleExtractVocab = async () => {
    if (!notes.trim()) return;
    setExtracting(true);
    // Simulate AI extraction
    await new Promise((r) => setTimeout(r, 1800));
    const aiExtracted: VocabItem[] = [
      { id: Date.now() + 1, word: "delegate", meaning: "위임하다; 대표자", example: "She delegated the task to her team." },
      { id: Date.now() + 2, word: "concise", meaning: "간결한, 명료한", example: "Please write a concise summary." },
    ];
    setVocabList((prev) => [...prev, ...aiExtracted]);
    setExtracting(false);
    setExtracted(true);
  };

  const addVocab = () => {
    if (!vocabWord.trim()) return;
    setVocabList((prev) => [
      ...prev,
      { id: Date.now(), word: vocabWord, meaning: "", example: "" },
    ]);
    setVocabWord("");
  };

  const removeVocab = (id: number) => setVocabList((prev) => prev.filter((v) => v.id !== id));

  const addHw = () => {
    if (!hwInput.trim()) return;
    setHwList((prev) => [...prev, { id: Date.now(), content: hwInput, done: false }]);
    setHwInput("");
  };

  const toggleHw = (id: number) => setHwList((prev) => prev.map((h) => h.id === id ? { ...h, done: !h.done } : h));
  const removeHw = (id: number) => setHwList((prev) => prev.filter((h) => h.id !== id));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <header className="sidebar-gradient text-sidebar-foreground px-4 py-3 flex items-center gap-4 shadow-lg">
        {/* Back */}
        <a href="/" className="flex items-center gap-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">어드민</span>
        </a>

        <div className="w-px h-5 bg-sidebar-border" />

        {/* Session info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sidebar-accent-foreground text-sm">
              {SESSION.studentName}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground font-medium">
              {SESSION.level}
            </span>
            <span className="text-sidebar-foreground/60 text-xs hidden sm:inline">
              with {SESSION.instructorName}
            </span>
            {SESSION.topic && (
              <span className="text-gold text-xs hidden md:inline">· {SESSION.topic}</span>
            )}
          </div>
        </div>

        {/* Role switcher (demo only) */}
        <div className="flex gap-1 p-0.5 bg-sidebar-accent rounded-lg">
          {(["instructor", "student"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                role === r
                  ? "bg-gold text-accent-foreground"
                  : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
              )}
            >
              {r === "instructor" ? "강사" : "학생"}
            </button>
          ))}
        </div>

        {/* Meet status */}
        {meetConnected && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/20 border border-success/30">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-success hidden sm:inline">Meet 연결됨</span>
          </div>
        )}

        {/* Timer */}
        {classState === "active" && (
          <div className="flex items-center gap-1.5 text-gold font-mono text-sm font-bold">
            <Clock className="w-4 h-4" />
            {formatDuration(elapsed)}
          </div>
        )}

        {/* Class controls */}
        {classState === "pre" && (
          <div className="flex items-center gap-2">
            <div className="text-xs text-sidebar-foreground/60">
              수업까지 <span className="text-gold font-mono font-bold">{formatCountdown(msUntilClass)}</span>
            </div>
            <Button size="sm" disabled className="h-8 text-xs bg-sidebar-accent/50 text-sidebar-foreground/40 cursor-not-allowed">
              수업 시작 (10분 전 활성)
            </Button>
          </div>
        )}

        {classState === "ready" && (
          <Button
            size="sm"
            onClick={handleStartClass}
            className="h-8 text-xs gold-gradient text-accent-foreground font-bold shadow-gold hover:opacity-90 gap-1.5"
          >
            <Video className="w-3.5 h-3.5" />
            수업 시작
          </Button>
        )}

        {classState === "active" && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleJoinMeet}
              className="h-8 text-xs border-gold/50 text-gold hover:bg-gold/10 gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Meet 재접속</span>
            </Button>
            {role === "instructor" && (
              <Button
                size="sm"
                onClick={handleEndClass}
                className="h-8 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
              >
                <VideoOff className="w-3.5 h-3.5" />
                수업 종료
              </Button>
            )}
          </div>
        )}

        {classState === "ended" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-sidebar-foreground/60">수업 종료됨</span>
            <Badge variant="secondary" className="text-xs">저장됨</Badge>
          </div>
        )}
      </header>

      {/* ── PRE-CLASS BANNER ─────────────────────────────────────────────── */}
      {classState === "pre" && (
        <div className="bg-navy/5 border-b border-border px-6 py-10 text-center">
          <div className="w-16 h-16 rounded-full bg-navy/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-navy" />
          </div>
          <p className="text-lg font-bold text-foreground">수업 준비 중</p>
          <p className="text-muted-foreground text-sm mt-1">수업 시작 10분 전부터 입장할 수 있습니다</p>
          <p className="text-3xl font-mono font-bold text-gold mt-4">{formatCountdown(msUntilClass)}</p>
        </div>
      )}

      {/* ── ENDED BANNER ────────────────────────────────────────────────── */}
      {classState === "ended" && (
        <div className="bg-muted/60 border-b border-border px-6 py-4 flex items-center justify-center gap-4">
          <span className="text-sm text-muted-foreground">수업이 종료되었습니다. 총 수업 시간: <span className="font-bold text-foreground">{formatDuration(elapsed)}</span></span>
          <Button
            size="sm"
            onClick={handleExtractVocab}
            disabled={extracting || extracted || !notes.trim()}
            className="gap-2 bg-navy hover:bg-navy-light text-primary-foreground h-8 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {extracting ? "AI 단어 추출 중..." : extracted ? "단어 추출 완료 ✓" : "수업 종료 및 단어 추출"}
          </Button>
        </div>
      )}

      {/* ── MEET PROMPT (ready state) ────────────────────────────────────── */}
      {classState === "ready" && !meetConnected && (
        <div className="bg-gold/5 border-b border-gold/20 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <WifiOff className="w-4 h-4 text-gold-dark" />
            <span className="text-gold-dark font-medium">수업 시작 버튼을 누르면 Google Meet가 자동으로 열립니다</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">{SESSION.meetLink}</span>
        </div>
      )}

      {/* ── ACTIVE MEET BANNER ───────────────────────────────────────────── */}
      {classState === "active" && meetConnected && (
        <div className="bg-success/8 border-b border-success/20 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Wifi className="w-4 h-4 text-success" />
            <span className="text-success font-medium">Google Meet 수업 중</span>
            <span className="text-xs text-muted-foreground">— Meet가 새 탭에서 열려 있습니다. 이 페이지에서 수업 노트를 작성하세요.</span>
          </div>
          <button
            onClick={handleJoinMeet}
            className="flex items-center gap-1.5 text-xs text-success hover:underline font-medium"
          >
            <ExternalLink className="w-3 h-3" />
            {SESSION.meetLink}
          </button>
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* ── LEFT: NOTES ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col border-r border-border min-h-0">
          {/* Notes header */}
          <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gold" />
              <span className="font-semibold text-sm text-foreground">수업 노트</span>
              {classState === "active" && (
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveNote}
              disabled={classState === "pre" || !notes.trim()}
              className={cn(
                "h-7 text-xs gap-1.5 transition-all",
                saveFlash && "border-success text-success"
              )}
            >
              <Save className="w-3 h-3" />
              {saveFlash ? "저장됨 ✓" : "저장"}
            </Button>
          </div>

          {/* Notes textarea */}
          <div className="flex-1 p-4">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                classState === "pre"
                  ? "수업이 시작되면 노트를 작성할 수 있습니다..."
                  : "수업 내용을 자유롭게 타이핑하세요.\n\n예:\n- Today's topic: Business Emails\n- Key phrases: I am writing to inquire about...\n- Grammar: present perfect for updates\n\n수업 종료 후 AI가 단어를 자동으로 추출합니다."
              }
              disabled={classState === "pre"}
              className={cn(
                "h-full min-h-[300px] lg:min-h-0 resize-none text-sm leading-relaxed border-0 focus-visible:ring-0 bg-transparent p-0",
                classState === "pre" && "text-muted-foreground/50"
              )}
            />
          </div>

          {/* Extract button (active) */}
          {classState === "active" && role === "instructor" && (
            <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center gap-3">
              <Button
                size="sm"
                onClick={handleExtractVocab}
                disabled={extracting || !notes.trim()}
                className="gap-2 bg-navy hover:bg-navy-light text-primary-foreground text-xs h-8"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {extracting ? "AI 추출 중..." : "단어 자동 추출"}
              </Button>
              <span className="text-xs text-muted-foreground">노트에서 단어를 AI가 자동으로 단어장에 추가합니다</span>
            </div>
          )}
        </div>

        {/* ── RIGHT: VOCAB + HOMEWORK ──────────────────────────────────── */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col border-t lg:border-t-0 border-border">
          {/* VOCAB */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gold" />
                <span className="font-semibold text-sm text-foreground">단어장</span>
                <span className="text-xs bg-navy/10 text-navy px-1.5 py-0.5 rounded-full font-medium">
                  {vocabList.length}
                </span>
              </div>
              {extracted && (
                <span className="text-xs text-gold font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI 추출됨
                </span>
              )}
            </div>

            {/* Vocab input */}
            <div className="px-3 py-2.5 border-b border-border bg-muted/20 flex gap-2">
              <Input
                value={vocabWord}
                onChange={(e) => setVocabWord(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addVocab()}
                placeholder="단어 직접 입력..."
                disabled={classState === "pre"}
                className="h-7 text-xs flex-1"
              />
              <Button
                size="sm"
                onClick={addVocab}
                disabled={!vocabWord.trim() || classState === "pre"}
                className="h-7 px-2.5 text-xs bg-navy hover:bg-navy-light text-primary-foreground"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>

            {/* Vocab list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
              {vocabList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center pt-6">
                  단어를 입력하거나 AI 추출을 사용하세요
                </p>
              ) : (
                vocabList.map((v) => (
                  <div key={v.id} className="p-2.5 rounded-lg border border-border bg-card group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-navy">{v.word}</p>
                        {v.meaning && (
                          <p className="text-xs text-muted-foreground mt-0.5">{v.meaning}</p>
                        )}
                        {v.example && (
                          <p className="text-xs text-foreground/60 mt-1 italic">"{v.example}"</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeVocab(v.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* HOMEWORK */}
          <div className="border-t border-border">
            <button
              onClick={() => setHwOpen(!hwOpen)}
              className="w-full px-4 py-3 bg-card flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-gold" />
                <span className="font-semibold text-sm text-foreground">숙제</span>
                <span className="text-xs bg-gold/15 text-gold-dark px-1.5 py-0.5 rounded-full font-medium">
                  {hwList.filter((h) => !h.done).length}건
                </span>
              </div>
              {hwOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
            </button>

            {hwOpen && (
              <div className="px-3 pb-3 space-y-2 bg-muted/10">
                {/* HW input */}
                <div className="flex gap-2 pt-1">
                  <Input
                    value={hwInput}
                    onChange={(e) => setHwInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addHw()}
                    placeholder="숙제 추가..."
                    disabled={classState === "pre"}
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={addHw}
                    disabled={!hwInput.trim() || classState === "pre"}
                    className="h-7 px-2.5 text-xs bg-navy hover:bg-navy-light text-primary-foreground"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                {/* HW list */}
                <div className="space-y-1.5">
                  {hwList.map((hw) => (
                    <div key={hw.id} className="flex items-start gap-2 group">
                      <button
                        onClick={() => toggleHw(hw.id)}
                        className={cn(
                          "mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all",
                          hw.done
                            ? "bg-success border-success"
                            : "border-muted-foreground hover:border-navy"
                        )}
                      >
                        {hw.done && <span className="text-success-foreground text-xs font-bold">✓</span>}
                      </button>
                      <span className={cn("flex-1 text-xs leading-relaxed", hw.done && "line-through text-muted-foreground")}>
                        {hw.content}
                      </span>
                      <button
                        onClick={() => removeHw(hw.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive mt-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {hwList.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">숙제 없음</p>
                  )}
                </div>

                {/* Save HW */}
                {(classState === "active" || classState === "ended") && hwList.length > 0 && (
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs bg-navy hover:bg-navy-light text-primary-foreground mt-1 gap-1.5"
                    onClick={handleSaveNote}
                  >
                    <Save className="w-3 h-3" />
                    숙제 저장 & 학생 알림 발송
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
