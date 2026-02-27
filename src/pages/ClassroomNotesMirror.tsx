import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

export default function ClassroomNotesMirror() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [notes, setNotes] = useState("");
  const [studentName, setStudentName] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Initial load
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

  // Realtime broadcast for live content + scroll (instant, no DB delay)
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`mirror-sync-${sessionId}`)
      .on("broadcast", { event: "content" }, (payload) => {
        const html = payload?.payload?.html;
        if (typeof html === "string") setNotes(html);
      })
      .on("broadcast", { event: "scroll" }, (payload) => {
        const ratio = payload?.payload?.ratio;
        if (typeof ratio === "number" && contentRef.current) {
          const el = contentRef.current;
          const maxScroll = el.scrollHeight - el.clientHeight;
          el.scrollTop = ratio * maxScroll;
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  // Fallback: DB realtime for topic changes or if broadcast missed
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`notes-mirror-db-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "class_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const newNotes = (payload.new as any).notes;
          if (typeof newNotes === "string") setNotes(newNotes);
          const newTopic = (payload.new as any).topic;
          if (typeof newTopic === "string") setTopic(newTopic);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

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
        <p className="text-muted-foreground animate-pulse">노트 불러오는 중...</p>
      </div>
    );
  }

  const isHtml = notes.startsWith("<") || notes.includes("<p>") || notes.includes("<table");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Compact header */}
      <header className="sidebar-gradient text-sidebar-foreground px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-gold" />
          <span className="font-bold text-base">수업 노트</span>
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
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/20 border border-success/30">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-medium text-success">실시간 동기화</span>
        </div>
      </header>

      {/* Notes content - scrollable with sync */}
      <main ref={contentRef} className="flex-1 max-w-4xl w-full mx-auto px-8 py-6 overflow-y-auto" style={{ height: "calc(100vh - 56px)" }}>
        {isHtml ? (
          <div
            className="tiptap notes-mirror-content text-base leading-relaxed text-foreground"
            dangerouslySetInnerHTML={{ __html: notes }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground font-mono">
            {notes || (
              <span className="text-muted-foreground italic">
                강사가 수업 노트를 작성하면 여기에 실시간으로 표시됩니다...
              </span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
