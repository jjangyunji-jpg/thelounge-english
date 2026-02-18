import { useState, useEffect, useRef } from "react";
import {
  Video, VideoOff, Clock, FileText, CheckSquare,
  Save, Sparkles, ExternalLink, ChevronDown, ChevronUp,
  Plus, Trash2, ArrowLeft, Wifi, WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ClassState = "pre" | "ready" | "active" | "ended";
type Role = "instructor" | "student";

interface HomeworkItem {
  id: number;
  content: string;
  done: boolean;
}

const SESSION = {
  studentName: "김민준",
  instructorName: "Sarah Kim",
  level: "B1",
  scheduledAt: new Date(Date.now() + 5 * 60 * 1000),
  meetLink: "https://meet.google.com/abc-defg-hij",
  topic: "Business Email Writing",
};

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

export default function Classroom() {
  const [role, setRole] = useState<Role>("instructor");
  const [classState, setClassState] = useState<ClassState>("ready");
  const [meetConnected, setMeetConnected] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [notes, setNotes] = useState("");
  const [hwList, setHwList] = useState<HomeworkItem[]>([
    { id: 1, content: "이메일 초안 작성해오기", done: false },
  ]);
  const [hwInput, setHwInput] = useState("");
  const [hwOpen, setHwOpen] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (classState === "active") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [classState]);

  const msUntilClass = SESSION.scheduledAt.getTime() - now;

  const handleStartClass = () => {
    setClassState("active");
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

  const handleSave = () => {
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const handleExtractVocab = async () => {
    if (!notes.trim()) return;
    setExtracting(true);
    await new Promise((r) => setTimeout(r, 1800));
    setExtracting(false);
    setExtracted(true);
  };

  const addHw = () => {
    if (!hwInput.trim()) return;
    setHwList((prev) => [...prev, { id: Date.now(), content: hwInput, done: false }]);
    setHwInput("");
  };

  const toggleHw = (id: number) =>
    setHwList((prev) => prev.map((h) => h.id === id ? { ...h, done: !h.done } : h));

  const removeHw = (id: number) =>
    setHwList((prev) => prev.filter((h) => h.id !== id));

  const isDisabled = classState === "pre";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header className="sidebar-gradient text-sidebar-foreground px-4 py-3 flex items-center gap-4 shadow-lg">
        <a href="/" className="flex items-center gap-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">어드민</span>
        </a>

        <div className="w-px h-5 bg-sidebar-border" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sidebar-accent-foreground text-sm">{SESSION.studentName}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground font-medium">
              {SESSION.level}
            </span>
            <span className="text-sidebar-foreground/60 text-xs hidden sm:inline">with {SESSION.instructorName}</span>
            {SESSION.topic && (
              <span className="text-gold text-xs hidden md:inline">· {SESSION.topic}</span>
            )}
          </div>
        </div>

        {/* Role switcher (demo) */}
        <div className="flex gap-1 p-0.5 bg-sidebar-accent rounded-lg">
          {(["instructor", "student"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                role === r ? "bg-gold text-accent-foreground" : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
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
          <span className="text-xs text-sidebar-foreground/60">
            수업 종료 · {formatDuration(elapsed)}
          </span>
        )}
      </header>

      {/* ── MEET STATUS BANNER ───────────────────────────────────────────── */}
      {classState === "ready" && (
        <div className="bg-gold/5 border-b border-gold/20 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <WifiOff className="w-4 h-4 text-gold-dark" />
            <span className="text-gold-dark font-medium text-sm">수업 시작 버튼을 누르면 Google Meet가 자동으로 열립니다</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono hidden md:inline">{SESSION.meetLink}</span>
        </div>
      )}

      {classState === "active" && meetConnected && (
        <div className="bg-success/8 border-b border-success/20 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-success" />
            <span className="text-success font-medium text-sm">Google Meet 수업 진행 중</span>
            <span className="text-xs text-muted-foreground hidden md:inline">— Meet는 새 탭에 열려 있습니다. 이 페이지에서 노트를 작성하세요.</span>
          </div>
          <button onClick={handleJoinMeet} className="flex items-center gap-1.5 text-xs text-success hover:underline">
            <ExternalLink className="w-3 h-3" />
            <span className="hidden md:inline">{SESSION.meetLink}</span>
            <span className="md:hidden">Meet 재접속</span>
          </button>
        </div>
      )}

      {/* ── ENDED BANNER ────────────────────────────────────────────────── */}
      {classState === "ended" && (
        <div className="bg-muted/60 border-b border-border px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm text-muted-foreground">
            수업이 종료되었습니다. 총 수업 시간: <span className="font-bold text-foreground">{formatDuration(elapsed)}</span>
          </span>
          <Button
            size="sm"
            onClick={handleExtractVocab}
            disabled={extracting || extracted || !notes.trim()}
            className="gap-2 bg-navy hover:bg-navy-light text-primary-foreground text-xs h-8"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {extracting ? "AI 단어 추출 중..." : extracted ? "단어 추출 완료 ✓" : "수업 노트에서 단어 추출"}
          </Button>
        </div>
      )}

      {/* ── PRE-CLASS OVERLAY ─────────────────────────────────────────────── */}
      {classState === "pre" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-navy/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-navy" />
            </div>
            <p className="text-lg font-bold text-foreground">수업 준비 중</p>
            <p className="text-muted-foreground text-sm mt-1">수업 시작 10분 전부터 입장할 수 있습니다</p>
            <p className="text-4xl font-mono font-bold text-gold mt-4">{formatCountdown(msUntilClass)}</p>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      {classState !== "pre" && (
        <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-4 py-5 gap-5">

          {/* ── NOTES ─────────────────────────────────────────────────── */}
          <div className="flex flex-col flex-1 rounded-xl border border-border bg-card shadow-card overflow-hidden">
            {/* Notes header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
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
                onClick={handleSave}
                disabled={isDisabled || !notes.trim()}
                className={cn(
                  "h-7 text-xs gap-1.5 transition-all",
                  saveFlash && "border-success text-success"
                )}
              >
                <Save className="w-3 h-3" />
                {saveFlash ? "저장됨 ✓" : "저장"}
              </Button>
            </div>

            {/* Notes body */}
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`수업 내용을 자유롭게 타이핑하세요.\n\nToday's topic: ${SESSION.topic}\n\n- Key expressions:\n- Grammar points:\n- Notes:\n\n수업 종료 후 AI가 노트에서 단어를 자동으로 추출합니다.`}
              disabled={isDisabled}
              className="flex-1 min-h-[320px] resize-none text-sm leading-relaxed border-0 focus-visible:ring-0 bg-transparent p-4 rounded-none"
            />

            {/* Active extract shortcut */}
            {classState === "active" && role === "instructor" && (
              <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={handleExtractVocab}
                  disabled={extracting || !notes.trim()}
                  className="gap-2 bg-navy hover:bg-navy-light text-primary-foreground text-xs h-7"
                >
                  <Sparkles className="w-3 h-3" />
                  {extracting ? "추출 중..." : "단어 미리 추출"}
                </Button>
                <span className="text-xs text-muted-foreground">노트에서 단어를 AI로 바로 추출할 수 있습니다</span>
              </div>
            )}
          </div>

          {/* ── HOMEWORK ──────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            {/* HW header */}
            <button
              onClick={() => setHwOpen(!hwOpen)}
              className="w-full px-4 py-3 bg-muted/30 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-gold" />
                <span className="font-semibold text-sm text-foreground">숙제</span>
                <span className="text-xs bg-gold/15 text-gold-dark px-1.5 py-0.5 rounded-full font-medium">
                  {hwList.filter((h) => !h.done).length}건
                </span>
              </div>
              {hwOpen
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {hwOpen && (
              <div className="p-4 space-y-3">
                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    value={hwInput}
                    onChange={(e) => setHwInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addHw()}
                    placeholder="숙제 내용을 입력하고 Enter..."
                    disabled={isDisabled}
                    className="h-9 text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={addHw}
                    disabled={!hwInput.trim() || isDisabled}
                    className="h-9 px-3 bg-navy hover:bg-navy-light text-primary-foreground"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* List */}
                {hwList.length > 0 ? (
                  <div className="space-y-2">
                    {hwList.map((hw) => (
                      <div key={hw.id} className="flex items-center gap-3 py-1.5 group">
                        <button
                          onClick={() => toggleHw(hw.id)}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all",
                            hw.done
                              ? "bg-success border-success"
                              : "border-muted-foreground hover:border-navy"
                          )}
                        >
                          {hw.done && <span className="text-success-foreground text-xs font-bold">✓</span>}
                        </button>
                        <span className={cn("flex-1 text-sm", hw.done && "line-through text-muted-foreground")}>
                          {hw.content}
                        </span>
                        <button
                          onClick={() => removeHw(hw.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">숙제를 입력해주세요</p>
                )}

                {/* Save & notify */}
                {(classState === "active" || classState === "ended") && hwList.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-navy hover:bg-navy-light text-primary-foreground gap-1.5"
                      onClick={handleSave}
                    >
                      <Save className="w-3 h-3" />
                      숙제 저장 & 학생 알림 발송
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
