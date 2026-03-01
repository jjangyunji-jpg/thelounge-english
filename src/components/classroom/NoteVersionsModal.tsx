import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, Clock } from "lucide-react";

interface NoteVersion {
  id: string;
  notes: string | null;
  topic: string | null;
  saved_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string;
  onRestore: (notes: string, topic: string) => void;
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").slice(0, 200);
}

export default function NoteVersionsModal({ open, onOpenChange, sessionId, onRestore }: Props) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !sessionId) return;
    setLoading(true);
    supabase
      .from("class_session_note_versions" as any)
      .select("id, notes, topic, saved_at")
      .eq("session_id", sessionId)
      .order("saved_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setVersions((data as any as NoteVersion[]) || []);
        setLoading(false);
      });
  }, [open, sessionId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" />
            노트 버전 히스토리
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <p className="text-xs text-muted-foreground p-4">불러오는 중...</p>
          ) : versions.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4">저장된 이전 버전이 없습니다.</p>
          ) : (
            <div className="space-y-2 p-1">
              {versions.map((v) => (
                <div key={v.id} className="rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.saved_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] gap-1"
                      onClick={() => {
                        if (confirm("이 버전으로 복원하시겠습니까? 현재 노트는 자동 백업됩니다.")) {
                          onRestore(v.notes || "", v.topic || "");
                          onOpenChange(false);
                        }
                      }}
                    >
                      <RotateCcw className="w-3 h-3" />
                      복원
                    </Button>
                  </div>
                  {v.topic && <p className="text-xs font-medium text-foreground mb-1">주제: {v.topic}</p>}
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {v.notes ? stripHtml(v.notes) : "(빈 노트)"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
