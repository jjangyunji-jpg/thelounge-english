import { useState, useMemo } from "react";
import { Loader2, Sparkles, BookMarked, Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ExtractedItem {
  id: string;
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
  studentNames: string[];
  instructorName: string;
}

const TOP_N_DEFAULT = 5;

export default function KeyExpressionExtractModal({
  open, onClose, notesHtml, level, sessionId, studentNames, instructorName,
}: KeyExpressionExtractModalProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ situation_label: string; english: string; korean: string } | null>(null);

  const reset = () => {
    setItems([]);
    setHasExtracted(false);
    setEditingId(null);
    setEditDraft(null);
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
      // Top N (frequency-ordered by AI) auto-selected; rest unselected
      setItems(exprs.map((e, i) => ({
        id: `${Date.now()}-${i}`,
        situation_label: e.situation_label,
        english: e.english,
        korean: e.korean,
        selected: i < TOP_N_DEFAULT,
      })));
      setHasExtracted(true);
      toast({
        title: `${exprs.length}개 추출 완료 ✓`,
        description: `사용 빈도 상위 ${Math.min(TOP_N_DEFAULT, exprs.length)}개가 기본 선택됐어요.`,
      });
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
    if (editingId === id) { setEditingId(null); setEditDraft(null); }
  };

  const addEmpty = () => {
    const newId = `manual-${Date.now()}`;
    setItems(prev => [...prev, {
      id: newId,
      situation_label: "",
      english: "",
      korean: "",
      selected: true,
    }]);
    setEditingId(newId);
    setEditDraft({ situation_label: "", english: "", korean: "" });
  };

  const startEdit = (it: ExtractedItem) => {
    setEditingId(it.id);
    setEditDraft({ situation_label: it.situation_label, english: it.english, korean: it.korean });
  };

  const saveEdit = () => {
    if (editingId && editDraft) {
      updateItem(editingId, editDraft);
    }
    setEditingId(null);
    setEditDraft(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const allSelected = items.length > 0 && items.every(it => it.selected);
  const noneSelected = items.every(it => !it.selected);

  const toggleAll = () => {
    const next = !allSelected;
    setItems(prev => prev.map(it => ({ ...it, selected: next })));
  };

  const selectedItems = useMemo(
    () => items.filter(it => it.selected && it.english.trim() && it.korean.trim()),
    [items],
  );

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
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookMarked className="w-4 h-4 text-purple-500" />
            핵심 표현 추출 → 표현장 발행
          </DialogTitle>
          <DialogDescription className="text-xs">
            AI가 수업 노트에서 외워두면 좋은 예시 문장 10개를 사용 빈도순으로 추출합니다. 상위 5개가 기본 선택됩니다.
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
            {/* Toolbar: select all + counter */}
            {items.length > 0 && (
              <div className="flex items-center justify-between px-1 py-1.5 border-b">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Checkbox
                    checked={allSelected ? true : (noneSelected ? false : "indeterminate")}
                    onCheckedChange={toggleAll}
                  />
                  {allSelected ? "전체 해제" : "전체 선택"}
                </button>
                <p className="text-xs text-muted-foreground">
                  선택 <span className="font-semibold text-foreground">{selectedItems.length}</span> / {items.length}
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 py-2">
              {items.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  추출된 표현이 없습니다. 직접 추가해보세요.
                </p>
              ) : (
                items.map((it, idx) => {
                  const isEditing = editingId === it.id;
                  return (
                    <div
                      key={it.id}
                      className={`rounded-md border px-2 py-1.5 transition-colors ${
                        it.selected ? "bg-purple-50/40 border-purple-200" : "bg-muted/20 border-border opacity-70"
                      }`}
                    >
                      {isEditing && editDraft ? (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <Input
                              value={editDraft.situation_label}
                              onChange={(e) => setEditDraft({ ...editDraft, situation_label: e.target.value })}
                              placeholder="상황 라벨"
                              className="h-7 text-xs w-32 bg-background"
                            />
                            <Input
                              value={editDraft.english}
                              onChange={(e) => setEditDraft({ ...editDraft, english: e.target.value })}
                              placeholder="English sentence"
                              className="h-7 text-xs flex-1 bg-background"
                            />
                          </div>
                          <div className="flex gap-1.5">
                            <Input
                              value={editDraft.korean}
                              onChange={(e) => setEditDraft({ ...editDraft, korean: e.target.value })}
                              placeholder="한국어 번역"
                              className="h-7 text-xs flex-1 bg-background"
                            />
                            <Button size="icon" variant="ghost" onClick={saveEdit} className="h-7 w-7 text-green-600">
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-7 w-7 text-muted-foreground">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={it.selected}
                            onCheckedChange={(v) => updateItem(it.id, { selected: !!v })}
                          />
                          <span className="text-[10px] text-muted-foreground font-mono w-5 text-right flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-[11px] font-medium text-purple-700 bg-purple-100 rounded px-1.5 py-0.5 flex-shrink-0 min-w-0 truncate max-w-[110px]">
                            {it.situation_label || "—"}
                          </span>
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="text-sm font-medium truncate" title={it.english}>
                              {it.english || <span className="text-muted-foreground italic">English</span>}
                            </span>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="text-xs text-muted-foreground truncate" title={it.korean}>
                              {it.korean || <span className="italic">한국어</span>}
                            </span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(it)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground flex-shrink-0"
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(it.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={addEmpty}
                className="w-full h-7 text-xs gap-1.5 border-dashed mt-1"
              >
                <Plus className="w-3 h-3" />표현 직접 추가
              </Button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
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
                선택한 {selectedItems.length}개 발행
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
