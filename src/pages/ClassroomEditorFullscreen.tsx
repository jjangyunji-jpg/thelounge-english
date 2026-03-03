import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Wifi, Loader2, Video, VideoOff, ExternalLink } from "lucide-react";
import NotesEditor from "@/components/classroom/NotesEditor";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ClassState = "ready" | "active" | "ended";

export default function ClassroomEditorFullscreen() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [notes, setNotes] = useState("");
  const [studentName, setStudentName] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [classState, setClassState] = useState<ClassState>("ready");
  const { toast } = useToast();

  const editorRef = useRef<any>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);
  const isExternalUpdate = useRef(false);

  // Load initial data
  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data } = await supabase
        .from("class_sessions")
        .select("notes, student_name, topic, level, meet_link, started_at, ended_at")
        .eq("id", sessionId)
        .single();
      if (data) {
        setNotes(data.notes ?? "");
        setStudentName(data.student_name);
        setTopic(data.topic ?? "");
        setLevel(data.level ?? "");
        // Try session meet_link, fallback to instructor_students
        let link = data.meet_link ?? "";
        if (!link) {
          const { data: isData } = await supabase
            .from("instructor_students")
            .select("meet_link")
            .eq("student_name", data.student_name)
            .maybeSingle();
          link = isData?.meet_link ?? "";
        }
        setMeetLink(link);
        // Determine class state
        if (data.ended_at) setClassState("ended");
        else if (data.started_at) setClassState("active");
      }
      setLoading(false);
    };
    load();
  }, [sessionId]);

  // Auto-save to DB
  const autoSaveNotes = useCallback(async (text: string) => {
    if (!sessionId || !text.trim()) return;
    await supabase.from("class_sessions").update({ notes: text.trim() }).eq("id", sessionId);
  }, [sessionId]);

  // Broadcast channel for bidirectional sync
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`editor-sync-${sessionId}`)
      .on("broadcast", { event: "notes-update" }, (payload) => {
        const html = payload?.payload?.html;
        const source = payload?.payload?.source;
        if (typeof html === "string" && source === "classroom") {
          isExternalUpdate.current = true;
          setNotes(html);
          setTimeout(() => { isExternalUpdate.current = false; }, 100);
        }
      })
      .on("broadcast", { event: "class-state" }, (payload) => {
        const state = payload?.payload?.state;
        if (state) setClassState(state);
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const handleChange = (newVal: string) => {
    setNotes(newVal);
    if (isExternalUpdate.current) return;

    channelRef.current?.send({
      type: "broadcast",
      event: "notes-update",
      payload: { html: newVal, source: "fullscreen" },
    });

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => autoSaveNotes(newVal), 1500);
  };

  // Class control handlers
  const handleStartClass = async () => {
    setClassState("active");
    if (meetLink) window.open(meetLink, "_blank", "noopener,noreferrer");
    if (sessionId) {
      await supabase.from("class_sessions").update({ started_at: new Date().toISOString() }).eq("id", sessionId);
    }
    channelRef.current?.send({ type: "broadcast", event: "class-state", payload: { state: "active" } });
  };

  const handleJoinMeet = () => {
    if (meetLink) {
      const w = window.open(meetLink, "_blank", "noopener,noreferrer");
      if (!w) toast({ title: "팝업이 차단됐습니다", variant: "destructive" });
    }
  };

  const handleEndClass = async () => {
    setClassState("ended");
    if (sessionId) {
      await supabase.from("class_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId);
    }
    channelRef.current?.send({ type: "broadcast", event: "class-state", payload: { state: "ended" } });
  };

  // Save on unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!sessionId || !notes.trim()) return;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/class_sessions?id=eq.${sessionId}`;
      const body = JSON.stringify({ notes: notes.trim() });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        "Prefer": "return=minimal",
      };
      fetch(url, { method: "PATCH", headers, body, keepalive: true }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId, notes]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">세션 ID가 필요합니다.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Compact Header */}
      <header className="sidebar-gradient text-sidebar-foreground px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gold" />
          <span className="font-bold text-sm">수업 노트</span>
          {studentName && (
            <span className="text-xs text-sidebar-foreground/70">— {studentName}</span>
          )}
          {level && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground font-medium">
              {level}
            </span>
          )}
          {topic && (
            <span className="text-gold text-xs">· {topic}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Session controls */}
          {classState === "ready" && (
            <Button size="sm" onClick={handleStartClass}
              className="h-7 text-xs gold-gradient text-accent-foreground font-bold shadow-gold hover:opacity-90 gap-1"
            >
              <Video className="w-3.5 h-3.5" />수업 시작
            </Button>
          )}
          {classState === "active" && (
            <>
              <Button size="sm" variant="outline" onClick={handleJoinMeet}
                className="h-7 text-xs border-gold/50 text-gold hover:bg-gold/10 gap-1"
              >
                <ExternalLink className="w-3 h-3" />Meet 재접속
              </Button>
              <Button size="sm" onClick={handleEndClass}
                className="h-7 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1"
              >
                <VideoOff className="w-3.5 h-3.5" />수업 종료
              </Button>
            </>
          )}
          {classState === "ended" && (
            <span className="text-xs text-sidebar-foreground/60">수업 종료됨</span>
          )}

          {/* Sync indicator */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${
            connected
              ? "bg-[hsl(var(--success)/0.2)] border-[hsl(var(--success)/0.3)]"
              : "bg-muted/20 border-muted-foreground/30"
          }`}>
            <Wifi className={`w-3 h-3 ${connected ? "text-[hsl(var(--success))]" : "text-muted-foreground"}`} />
            <span className={connected ? "text-[hsl(var(--success))]" : "text-muted-foreground"}>
              {connected ? "동기화" : "연결 중..."}
            </span>
          </div>
        </div>
      </header>

      {/* Full-screen editor — no max-width, fills entire viewport */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-6 py-2 h-full">
          <NotesEditor
            content={notes}
            onChange={handleChange}
            editable={true}
            placeholder={`수업 내용을 자유롭게 타이핑하세요...\n\nToday's topic: ${topic}`}
            editorRef={editorRef}
            autoCorrectEnabled={false}
            onAutoCorrectToggle={() => {}}
            isAutoCorrecting={false}
          />
        </div>
      </main>
    </div>
  );
}
