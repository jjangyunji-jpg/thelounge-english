import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, Loader2, BookOpen, FolderPlus, FolderOpen, Check, X, Copy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import NotesEditor from "@/components/classroom/NotesEditor";
import MaterialAccessModal from "./MaterialAccessModal";

interface Material {
  id: string;
  category: string;
  title: string;
  content: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export default function TeachingMaterials() {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("");

  // Category management
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");

  // Edit state
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // New item
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Access modal state
  const [accessMaterial, setAccessMaterial] = useState<{ id: string; title: string } | null>(null);
  const [accessCounts, setAccessCounts] = useState<Record<string, number>>({});

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("teaching_material_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    const cats = (data as Category[]) || [];
    setCategories(cats);
    // Auto-select first category if none selected
    if (cats.length > 0 && !category) {
      setCategory(cats[0].slug);
    }
  }, []);

  const fetchMaterials = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    const { data } = await supabase
      .from("teaching_materials")
      .select("*")
      .eq("category", category)
      .order("sort_order", { ascending: true });
    const list = (data as Material[]) || [];
    setMaterials(list);
    // Load access counts per material
    if (list.length > 0) {
      const ids = list.map(m => m.id);
      const { data: links } = await supabase
        .from("teaching_material_instructors")
        .select("material_id")
        .in("material_id", ids);
      const counts: Record<string, number> = {};
      (links ?? []).forEach((l: any) => {
        counts[l.material_id] = (counts[l.material_id] ?? 0) + 1;
      });
      setAccessCounts(counts);
    } else {
      setAccessCounts({});
    }
    setLoading(false);
  }, [category]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  // ── Category CRUD ──
  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "_").replace(/^_|_$/g, "") || `cat_${Date.now()}`;
    const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
    const { error } = await supabase.from("teaching_material_categories").insert({ name, slug, sort_order: maxOrder });
    if (error) { toast({ title: "추가 실패", description: error.message, variant: "destructive" }); return; }
    toast({ title: "폴더가 추가되었습니다 ✓" });
    setNewCategoryName("");
    setAddingCategory(false);
    await fetchCategories();
    setCategory(slug);
  };

  const handleRenameCategory = async (cat: Category) => {
    const name = editCategoryName.trim();
    if (!name) return;
    const { error } = await supabase.from("teaching_material_categories").update({ name }).eq("id", cat.id);
    if (error) { toast({ title: "수정 실패", description: error.message, variant: "destructive" }); return; }
    toast({ title: "이름이 변경되었습니다 ✓" });
    setEditingCategoryId(null);
    fetchCategories();
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`"${cat.name}" 폴더와 포함된 모든 자료를 삭제하시겠습니까?`)) return;
    await supabase.from("teaching_materials").delete().eq("category", cat.slug);
    await supabase.from("teaching_material_categories").delete().eq("id", cat.id);
    toast({ title: "폴더가 삭제되었습니다" });
    if (category === cat.slug) setCategory("");
    fetchCategories();
  };

  // ── Material CRUD ──
  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    // Treat empty-ish HTML (e.g. "<p></p>") as empty
    const strippedContent = newContent.replace(/<[^>]*>/g, "").trim();
    if (!strippedContent) {
      toast({ title: "내용을 입력해주세요", variant: "destructive" });
      return;
    }
    setSaving(true);
    const maxOrder = materials.length > 0 ? Math.max(...materials.map(m => m.sort_order)) + 1 : 0;
    const { error } = await supabase.from("teaching_materials").insert({
      category,
      title: newTitle.trim(),
      content: newContent,
      sort_order: maxOrder,
    });
    if (error) { toast({ title: "추가 실패", description: error.message, variant: "destructive" }); }
    else { toast({ title: "자료가 추가되었습니다 ✓" }); setNewTitle(""); setNewContent(""); setAdding(false); fetchMaterials(); }
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editing || !editTitle.trim()) return;
    const strippedContent = editContent.replace(/<[^>]*>/g, "").trim();
    if (!strippedContent) {
      toast({ title: "내용을 입력해주세요", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("teaching_materials")
      .update({ title: editTitle.trim(), content: editContent })
      .eq("id", editing);
    if (error) { toast({ title: "수정 실패", description: error.message, variant: "destructive" }); }
    else { toast({ title: "수정 완료 ✓" }); setEditing(null); fetchMaterials(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 자료를 삭제하시겠습니까?")) return;
    await supabase.from("teaching_materials").delete().eq("id", id);
    toast({ title: "삭제 완료" });
    fetchMaterials();
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("teaching_materials").update({ is_active: !current }).eq("id", id);
    fetchMaterials();
  };

  const handleCopy = async (m: Material) => {
    setSaving(true);
    const maxOrder = materials.length > 0 ? Math.max(...materials.map(x => x.sort_order)) + 1 : 0;
    const { error } = await supabase.from("teaching_materials").insert({
      category: m.category,
      title: `${m.title} (복사)`,
      content: m.content,
      sort_order: maxOrder,
      is_active: m.is_active,
    });
    if (error) { toast({ title: "복사 실패", description: error.message, variant: "destructive" }); }
    else { toast({ title: "자료가 복사되었습니다 ✓" }); fetchMaterials(); }
    setSaving(false);
  };

  const startEdit = (m: Material) => {
    setEditing(m.id);
    setEditTitle(m.title);
    setEditContent(m.content);
  };

  const noopToggle = () => {};

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...materials];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setMaterials(updated);
    setDragIndex(null);
    setDragOverIndex(null);

    // Persist new order
    const promises = updated.map((m, i) =>
      supabase.from("teaching_materials").update({ sort_order: i }).eq("id", m.id)
    );
    await Promise.all(promises);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">수업 자료 관리</h2>
          <p className="text-sm text-muted-foreground mt-1">강사가 수업 노트에 삽입할 수 있는 자료를 관리합니다</p>
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map(cat => (
          <div key={cat.id} className="group flex items-center">
            {editingCategoryId === cat.id ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editCategoryName}
                  onChange={e => setEditCategoryName(e.target.value)}
                  className="h-8 w-32 text-sm"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleRenameCategory(cat); if (e.key === "Escape") setEditingCategoryId(null); }}
                />
                <button onClick={() => handleRenameCategory(cat)} className="p-1 rounded hover:bg-muted"><Check className="w-3.5 h-3.5 text-success" /></button>
                <button onClick={() => setEditingCategoryId(null)} className="p-1 rounded hover:bg-muted"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
              </div>
            ) : (
              <div className="flex items-center">
                <button
                  onClick={() => setCategory(cat.slug)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    category === cat.slug
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted",
                    category === cat.slug && "rounded-r-none"
                  )}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  {cat.name}
                </button>
                {category === cat.slug && (
                  <span className="flex items-center gap-0.5 bg-primary rounded-r-lg px-1 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); setEditingCategoryId(cat.id); setEditCategoryName(cat.name); }} className="p-0.5 rounded hover:bg-primary-foreground/20 text-primary-foreground" title="이름 변경">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDeleteCategory(cat); }} className="p-0.5 rounded hover:bg-primary-foreground/20 text-primary-foreground" title="삭제">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {addingCategory ? (
          <div className="flex items-center gap-1">
            <Input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="폴더 이름"
              className="h-8 w-32 text-sm"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleAddCategory(); if (e.key === "Escape") { setAddingCategory(false); setNewCategoryName(""); } }}
            />
            <button onClick={handleAddCategory} className="p-1 rounded hover:bg-muted"><Check className="w-3.5 h-3.5 text-success" /></button>
            <button onClick={() => { setAddingCategory(false); setNewCategoryName(""); }} className="p-1 rounded hover:bg-muted"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAddingCategory(true)} className="h-8 gap-1 text-xs">
            <FolderPlus className="w-3.5 h-3.5" /> 폴더 추가
          </Button>
        )}
      </div>

      {/* ── Materials for selected category ── */}
      {!category ? (
        <div className="py-12 text-center text-muted-foreground text-sm">폴더를 선택하세요</div>
      ) : (
        <>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5 bg-navy hover:bg-navy-light text-primary-foreground">
              <Plus className="w-4 h-4" /> 자료 추가
            </Button>
          </div>

          {/* Add form */}
          {adding && (
            <div className="rounded-xl border border-gold/30 bg-card p-5 space-y-3">
              <Input placeholder="자료 제목" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="text-sm" />
              <div className="rounded-lg border border-border overflow-hidden">
                <NotesEditor
                  content={newContent}
                  onChange={setNewContent}
                  editable={true}
                  placeholder="자료 내용을 입력하세요..."
                  autoCorrectEnabled={false}
                  onAutoCorrectToggle={noopToggle}
                  isAutoCorrecting={false}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewTitle(""); setNewContent(""); }}>취소</Button>
                <Button size="sm" onClick={handleAdd} disabled={saving || !newTitle.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "추가"}
                </Button>
              </div>
            </div>
          )}

          {/* Materials list */}
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : materials.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">등록된 자료가 없습니다</div>
          ) : (
            <div className="space-y-2">
              {materials.map((m, idx) => (
                <div
                  key={m.id}
                  draggable={editing !== m.id}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "rounded-lg border bg-card p-4 transition-all",
                    !m.is_active && "opacity-50",
                    dragIndex === idx && "opacity-30",
                    dragOverIndex === idx && dragIndex !== idx && "border-primary border-dashed"
                  )}
                >
                  {editing === m.id ? (
                    <div className="space-y-3">
                      <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-sm" />
                      <div className="rounded-lg border border-border overflow-hidden">
                        <NotesEditor
                          content={editContent}
                          onChange={setEditContent}
                          editable={true}
                          placeholder="자료 내용을 입력하세요..."
                          autoCorrectEnabled={false}
                          onAutoCorrectToggle={noopToggle}
                          isAutoCorrecting={false}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setEditing(null)}>취소</Button>
                        <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <GripVertical className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <BookOpen className="w-4 h-4 text-gold flex-shrink-0" />
                          <span className="font-medium text-sm text-foreground">{m.title}</span>
                          {!m.is_active && <span className="text-xs text-muted-foreground">(비활성)</span>}
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1",
                              (accessCounts[m.id] ?? 0) > 0
                                ? "bg-gold/15 text-gold border border-gold/30"
                                : "bg-destructive/10 text-destructive border border-destructive/30"
                            )}
                            title="접근 가능한 강사 수"
                          >
                            <Users className="w-2.5 h-2.5" />
                            {accessCounts[m.id] ?? 0}명
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {m.content ? m.content.replace(/<[^>]*>/g, "").slice(0, 120) + "..." : "내용 없음"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setAccessMaterial({ id: m.id, title: m.title })} className="p-1.5 rounded hover:bg-muted" title="강사 권한 설정">
                          <Users className="w-3.5 h-3.5 text-gold" />
                        </button>
                        <button onClick={() => handleToggleActive(m.id, m.is_active)} className="p-1.5 rounded hover:bg-muted" title={m.is_active ? "비활성화" : "활성화"}>
                          {m.is_active ? <Eye className="w-3.5 h-3.5 text-success" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                        <button onClick={() => startEdit(m)} className="p-1.5 rounded hover:bg-muted" title="편집">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleCopy(m)} className="p-1.5 rounded hover:bg-muted" title="복사">
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-muted" title="삭제">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <MaterialAccessModal
        open={!!accessMaterial}
        onOpenChange={(o) => { if (!o) { setAccessMaterial(null); fetchMaterials(); } }}
        materialId={accessMaterial?.id ?? null}
        materialTitle={accessMaterial?.title ?? ""}
      />
    </div>
  );
}
