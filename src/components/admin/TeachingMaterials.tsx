import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, Loader2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Material {
  id: string;
  category: string;
  title: string;
  content: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: "book_talk", label: "Book Talk" },
];

export default function TeachingMaterials() {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("book_talk");

  // Edit state
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // New item
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("teaching_materials")
      .select("*")
      .eq("category", category)
      .order("sort_order", { ascending: true });
    setMaterials((data as Material[]) || []);
    setLoading(false);
  }, [category]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const maxOrder = materials.length > 0 ? Math.max(...materials.map(m => m.sort_order)) + 1 : 0;
    const { error } = await supabase.from("teaching_materials").insert({
      category,
      title: newTitle.trim(),
      content: newContent.trim(),
      sort_order: maxOrder,
    });
    if (error) { toast({ title: "추가 실패", description: error.message, variant: "destructive" }); }
    else { toast({ title: "자료가 추가되었습니다 ✓" }); setNewTitle(""); setNewContent(""); setAdding(false); fetchMaterials(); }
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editing || !editTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("teaching_materials")
      .update({ title: editTitle.trim(), content: editContent.trim() })
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

  const startEdit = (m: Material) => {
    setEditing(m.id);
    setEditTitle(m.title);
    setEditContent(m.content);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">수업 자료 관리</h2>
          <p className="text-sm text-muted-foreground mt-1">강사가 수업 노트에 삽입할 수 있는 자료를 관리합니다</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5 bg-navy hover:bg-navy-light text-primary-foreground">
            <Plus className="w-4 h-4" /> 자료 추가
          </Button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border border-gold/30 bg-card p-5 space-y-3">
          <Input placeholder="자료 제목" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="text-sm" />
          <Textarea placeholder="자료 내용 (HTML 가능)" value={newContent} onChange={e => setNewContent(e.target.value)} rows={10} className="text-sm font-mono" />
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
          {materials.map(m => (
            <div key={m.id} className={cn("rounded-lg border bg-card p-4", !m.is_active && "opacity-50")}>
              {editing === m.id ? (
                <div className="space-y-3">
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-sm" />
                  <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={10} className="text-sm font-mono" />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>취소</Button>
                    <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-gold flex-shrink-0" />
                      <span className="font-medium text-sm text-foreground">{m.title}</span>
                      {!m.is_active && <span className="text-xs text-muted-foreground">(비활성)</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {m.content ? m.content.replace(/<[^>]*>/g, "").slice(0, 120) + "..." : "내용 없음"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggleActive(m.id, m.is_active)} className="p-1.5 rounded hover:bg-muted" title={m.is_active ? "비활성화" : "활성화"}>
                      {m.is_active ? <Eye className="w-3.5 h-3.5 text-success" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    <button onClick={() => startEdit(m)} className="p-1.5 rounded hover:bg-muted" title="편집">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
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
    </div>
  );
}
