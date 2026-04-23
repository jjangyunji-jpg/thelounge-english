import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Search, FileText, Loader2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

interface Material {
  id: string;
  title: string;
  category: string;
  content: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface MaterialPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (content: string) => void;
}

export default function MaterialPickerModal({ open, onOpenChange, onInsert }: MaterialPickerModalProps) {
  const [search, setSearch] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedId(null);
    loadCategories();
    loadMaterials();
  }, [open]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from("teaching_material_categories")
      .select("id, name, slug")
      .order("sort_order", { ascending: true });
    setCategories(data ?? []);
  };

  const loadMaterials = async (q?: string, cat?: string | null) => {
    setLoading(true);
    let query = supabase
      .from("teaching_materials")
      .select("id, title, category, content")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (q?.trim()) {
      query = query.ilike("title", `%${q.trim()}%`);
    }
    if (cat) {
      query = query.eq("category", cat);
    }
    const { data } = await query.limit(50);
    setMaterials(data ?? []);
    setLoading(false);
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    loadMaterials(val, selectedCategory);
  };

  const handleCategoryFilter = (slug: string | null) => {
    setSelectedCategory(slug);
    loadMaterials(search, slug);
  };

  const getCategoryName = (slug: string) => {
    return categories.find(c => c.slug === slug)?.name ?? slug;
  };

  const selectedMaterial = materials.find(m => m.id === selectedId);

  const handleInsert = () => {
    if (!selectedMaterial) return;
    onInsert(selectedMaterial.content);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gold" />
            수업 자료 삽입
          </DialogTitle>
        </DialogHeader>

        {/* Category filter tabs */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleCategoryFilter(null)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                !selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              전체
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryFilter(cat.slug)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  selectedCategory === cat.slug ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <FolderOpen className="w-3 h-3" />
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="자료 제목 검색..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border border-border rounded-lg divide-y divide-border">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {search ? "검색 결과가 없습니다" : "등록된 자료가 없습니다"}
            </div>
          ) : (
            materials.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                  selectedId === m.id && "bg-gold/10 border-l-2 border-l-gold"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">{m.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {getCategoryName(m.category)}
                  </span>
                </div>
                {selectedId === m.id && m.content && (
                  <div
                    className="tiptap mt-2 text-xs text-muted-foreground max-h-32 overflow-y-auto border-t border-border pt-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.content.slice(0, 500)) }}
                  />
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            size="sm"
            disabled={!selectedId}
            onClick={handleInsert}
            className="gold-gradient text-accent-foreground font-bold"
          >
            노트에 삽입
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}