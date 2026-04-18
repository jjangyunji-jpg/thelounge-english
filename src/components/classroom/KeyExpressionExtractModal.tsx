import { useState } from "react";
import { Loader2, Sparkles, BookMarked, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ExtractedItem {
  id: string; // local id
  situation_label: string;
  english: string;
  korean: string;
  selected: boolean;
}

interface KeyExpressionExtractModalProps {
  open: boolean;
  onClose: () => void;
  notesHtml: string;
  level: string;
  sessionId: string;
  /** All recipients (primary + group members). */
  studentNames: string[];
  instructorName: string;
}

export default function KeyExpressionExtractModal({
  open, onClose, notesHtml, level, sessionId, studentNames, instructorName,
}: KeyExpressionExtractModalProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);

  const reset = () => {
    setItems([]);
    setHasExtracted(false);
  };

  const handleExtract = async () => {
    if (!notesHtml || notesHtml.replace(/<[^>]+>/g, "").trim().length < 20) {
      toast({
        title: "수업 노트가 너무 짧습니다",
        description: "수업 노트 내용을 먼저 작성해주세요.",
        variant: "destructive",
      });
      return;
    }
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-key-expressions", {
        body: { notes: notesHtml, level },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const exprs = (data?.expressions ?? []) as Array<{ situation_label: string; english: string; korean: string }>;
      if (exprs.length === 0) {
        toast({ title: "추출된 표현이 없습니다", description: "수업 노트에 외울 만한 표현이 충분하지 않은 것 같아요.", variant: "destructive" });
        setHasExtracted(true);
        return;
      }
      setItems(exprs.map((e, i) => ({
        id: `${Date.now()}-${i}`,
        situation_label: e.situation_label,
        english: e.english,
        korean: e.korean,
        selected: true,
      })));
      setHasExtracted(true);
      toast({ title: `${exprs.length}개 추출 완료 ✓`, description: "검토 후 발행해주세요." });
    } catch (err: any) {
      toast({ title: "추출 실패", description: err.message || "잠시 후 다시 시도해주세요.", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const updateItem = (id: string, patch: Partial<ExtractedItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const addEmpty = () => {
    setItems(prev => [...prev, {
      id: `manual-${Date.now()}`,
      situation_label: "",
      english: "",
      korean: "",
      selected: true,
    }]);
  };

  const selectedItems = items.filter(it => it.selected && it.english.trim() && it.korean.trim());

  const handlePublish = async () => {
    if (selectedItems.length === 0) {
      toast({ title: "발행할 표현을 선택해주세요", variant: "destructive" });
      return;
    }
    if (studentNames.length === 0) {
      toast({ title: "수신할 학생이 없습니다", variant: "destructive" });
      return;
    }
    setPublishing(true);
    try {
      const rows = studentNames.flatMap(name =>
        selectedItems.map(it => ({
          student_name: name,
          session_id: sessionId || null,
          situation_label: it.situation_label.trim(),
          english: it.english.trim(),
          korean: it.korean.trim(),
          created_by_instructor: instructorName,
        })),
      );
      const { error } = await supabase.from("key_expressions").insert(rows);
      if (error) throw error;
      toast({
        title: "표현장 발행 완료 ✓",
        description: `${studentNames.length}명에게 ${selectedItems.length}개 표현이 전달되었습니다.`,
      });
      reset();
      onClose();
    } catch (err: any) {
      toast({ title: "발행 실패", description: err.message || "잠시 후 다시 시도해주세요.", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookMarked className="w-4 h-4 text-purple-500" />
            핵심 표현 추출 → 표현장 발행
          </DialogTitle>
          <DialogDescription className="text-xs">
            수업 노트에서 학생이 외워두면 좋을 문장 5~10개를 AI가 추출합니다. 검토 후 발행하세요.
            {studentNames.length > 1 && (
              <span className="block mt-1 text-purple-600 font-medium">
                그룹 수업: {studentNames.length}명에게 동시 발행됩니다.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!hasExtracted ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              현재 수업 노트에서 핵심 표현을 추출합니다.
            </p>
            <Button
              onClick={handleExtract}
              disabled={extracting}
              className="bg-purple-500 hover:bg-purple-600 text-white gap-2"
            >
              {extracting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />추출 중... (10~20초)</>
              ) : (
                <><Sparkles className="w-4 h-4" />AI로 추출하기</>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {items.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  추출된 표현이 없습니다. 직접 추가해보세요.
                </p>
              ) : (
                items.map((it) => (
                  <div
                    key={it.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      it.selected ? "bg-purple-50/50 border-purple-200" : "bg-muted/30 border-border opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={it.selected}
                        onCheckedChange={(v) => updateItem(it.id, { selected: !!v })}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-1.5">
                        <Input
                          value={it.situation_label}
                          onChange={(e) => updateItem(it.id, { situation_label: e.target.value })}
                          placeholder="상황 라벨 (예: 회의 미루기)"
                          className="h-7 text-xs font-medium bg-background"
                        />
                        <Textarea
                          value={it.english}
                          onChange={(e) => updateItem(it.id, { english: e.target.value })}
                          placeholder="English sentence"
                          className="resize-none h-12 text-sm bg-background"
                        />
                        <Textarea
                          value={it.korean}
                          onChange={(e) => updateItem(it.id, { korean: e.target.value })}
                          placeholder="한국어 번역"
                          className="resize-none h-12 text-sm bg-background"
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeItem(it.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={addEmpty}
                className="w-full h-8 text-xs gap-1.5 border-dashed"
              >
                <Plus className="w-3 h-3" />표현 직접 추가
              </Button>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                선택됨: <span className="font-semibold text-foreground">{selectedItems.length}</span>개
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleExtract}
                  disabled={extracting}
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                >
                  {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  다시 추출
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={publishing || selectedItems.length === 0}
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-purple-500 hover:bg-purple-600 text-white"
                >
                  {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookMarked className="w-3 h-3" />}
                  표현장 발행
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
