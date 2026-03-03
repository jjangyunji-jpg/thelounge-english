import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Wifi, Loader2 } from "lucide-react";
import NotesEditor from "@/components/classroom/NotesEditor";
import { useToast } from "@/hooks/use-toast";

export default function ClassroomEditorFullscreen() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [notes, setNotes] = useState("");
  const [studentName, setStudentName] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
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
        .select("notes, student_name, topic, level")
        .eq("id", sessionId)
        .single();
      if (data) {
        setNotes(data.notes ?? "");
        setStudentName(data.student_name);
        setTopic(data.topic ?? "");
        setLevel(data.level ?? "");
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
        // Only accept updates from the main classroom page
        if (typeof html === "string" && source === "classroom") {
          isExternalUpdate.current = true;
          setNotes(html);
          setTimeout(() => { isExternalUpdate.current = false; }, 100);
        }
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const handleChange = (newVal: string) => {
    setNotes(newVal);

    // Don't broadcast back if this was an external update
    if (isExternalUpdate.current) return;

    // Broadcast to classroom page
    channelRef.current?.send({
      type: "broadcast",
      event: "notes-update",
      payload: { html: newVal, source: "fullscreen" },
    });

    // Auto-save to DB (debounced)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => autoSaveNotes(newVal), 1500);
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sidebar-gradient text-sidebar-foreground px-6 py-3 flex items-center justify-between shadow-lg flex-shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-gold" />
          <span className="font-bold text-base">수업 노트 에디터</span>
          {studentName && (
            <span className="text-sm text-sidebar-foreground/70">— {studentName}</span>
          )}
          {level && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground font-medium">
              {level}
            </span>
          )}
          {topic && (
            <span className="text-gold text-sm">· {topic}</span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
          connected
            ? "bg-success/20 border-success/30"
            : "bg-muted/20 border-muted-foreground/30"
        }`}>
          <Wifi className={`w-3 h-3 ${connected ? "text-success" : "text-muted-foreground"}`} />
          <span className={`text-xs font-medium ${connected ? "text-success" : "text-muted-foreground"}`}>
            {connected ? "실시간 동기화" : "연결 중..."}
          </span>
        </div>
      </header>

      {/* Full-screen editor */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto w-full">
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
        </div>
      </main>
    </div>
  );
}
