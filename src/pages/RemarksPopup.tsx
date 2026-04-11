import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Check, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function RemarksPopup() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [remarks, setRemarks] = useState("");
  const [studentName, setStudentName] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Strip HTML tags helper
  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  };

  // Load initial data
  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data } = await supabase
        .from("class_sessions")
        .select("remarks, student_name, topic")
        .eq("id", sessionId)
        .single();
      if (data) {
        setRemarks(data.remarks ? stripHtml(data.remarks) : "");
        setStudentName(data.student_name);
        setTopic(data.topic ?? "");
      }
      setLoading(false);
    };
    load();
  }, [sessionId]);

  // Realtime broadcast sync from main classroom
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`remarks-popup-sync-${sessionId}`)
      .on("broadcast", { event: "remarks" }, (payload) => {
        const text = payload?.payload?.text;
        if (typeof text === "string") setRemarks(text);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  // DB realtime fallback
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`remarks-popup-db-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "class_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const newRemarks = (payload.new as any).remarks;
          if (typeof newRemarks === "string") setRemarks(stripHtml(newRemarks));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const autoSave = useCallback(async (text: string) => {
    if (!sessionId) return;
    setSaving(true);
    const { error } = await supabase.from("class_sessions").update({ remarks: text }).eq("id", sessionId);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    // Broadcast to main classroom
    supabase.channel(`remarks-popup-sync-${sessionId}`).send({
      type: "broadcast",
      event: "remarks",
      payload: { text },
    });
  }, [sessionId]);

  const handleChange = (val: string) => {
    const clean = stripHtml(val);
    setRemarks(clean);
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => autoSave(clean), 1500);
  };

  const handleSave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    autoSave(remarks);
  };

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
      <header className="sidebar-gradient text-sidebar-foreground px-5 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-gold" />
          <span className="font-bold text-base">비고</span>
          {studentName && (
            <span className="text-sm text-sidebar-foreground/70">— {studentName}</span>
          )}
          {topic && (
            <span className="text-gold text-sm">· {topic}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-sidebar-foreground/60">저장 중...</span>}
          {saved && !saving && (
            <span className="text-xs text-success flex items-center gap-0.5">
              <Check className="w-3 h-3" />저장됨
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-5" style={{ height: "calc(100vh - 52px)" }}>
        <Textarea
          value={remarks}
          onChange={e => handleChange(e.target.value)}
          placeholder="다음 수업까지 기억할 사항을 메모하세요..."
          className="resize-none text-sm w-full h-full"
          style={{ minHeight: "calc(100vh - 90px)" }}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-bold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-md bg-primary/5 hover:bg-primary/10 disabled:opacity-40"
          >
            저장
          </button>
        </div>
      </main>
    </div>
  );
}
