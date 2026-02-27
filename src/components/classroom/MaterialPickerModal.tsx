import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Loader2, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Material {
  id: string;
  category: string;
  title: string;
  content: string;
}

interface MaterialPickerModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  book_talk: "Book Talk",
};

export default function MaterialPickerModal({ open, onClose, onInsert }: MaterialPickerModalProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Material | null>(null);

  useEffect(() => {
    if (!open) { setSelected(null); return; }
    setLoading(true);
    supabase
      .from("teaching_materials")
      .select("id, category, title, content")
      .eq("is_active", true)
      .order("category")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setMaterials((data as Material[]) || []);
        setLoading(false);
      });
  }, [open]);

  if (!open) return null;

  const grouped = materials.reduce<Record<string, Material[]>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});

  const handleInsert = () => {
    if (!selected) return;
    onInsert(selected.content);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-4 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gold" />
            <span className="font-semibold text-sm text-foreground">수업 자료 삽입</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex" style={{ height: "450px" }}>
          {/* Left: list */}
          <div className="w-56 border-r border-border flex-shrink-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="py-12 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></div>
              ) : Object.keys(grouped).length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs">등록된 자료가 없습니다</div>
              ) : (
                <div className="py-2">
                  {Object.entries(grouped).map(([cat, items]) => (
                    <div key={cat}>
                      <p className="px-4 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {CATEGORY_LABELS[cat] || cat}
                      </p>
                      {items.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setSelected(m)}
                          className={cn(
                            "w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-muted/50 transition-colors",
                            selected?.id === m.id && "bg-gold/10 text-gold-dark border-l-2 border-gold"
                          )}
                        >
                          <ChevronRight className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{m.title}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right: preview */}
          <div className="flex-1 flex flex-col min-w-0">
            {selected ? (
              <>
                <div className="px-4 py-3 border-b border-border bg-muted/20">
                  <p className="font-semibold text-sm text-foreground">{selected.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{CATEGORY_LABELS[selected.category] || selected.category}</p>
                </div>
                <ScrollArea className="flex-1">
                  <div
                    className="tiptap p-4 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: selected.content }}
                  />
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                왼쪽에서 자료를 선택하세요
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 bg-muted/20">
          <Button size="sm" variant="outline" onClick={onClose}>취소</Button>
          <Button size="sm" onClick={handleInsert} disabled={!selected} className="gap-1.5 bg-navy hover:bg-navy-light text-primary-foreground">
            <BookOpen className="w-3.5 h-3.5" /> 노트에 삽입
          </Button>
        </div>
      </div>
    </div>
  );
}
