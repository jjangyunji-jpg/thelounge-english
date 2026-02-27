import { useState, useEffect } from "react";
import { Plus, GripVertical, Pencil, Trash2, Loader2, Save, X, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FeedbackCategory {
  id: string;
  key: string;
  label: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export default function FeedbackCategoryManager() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<FeedbackCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", description: "", key: "" });
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ key: "", label: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("feedback_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      toast({ title: "불러오기 실패", description: error.message, variant: "destructive" });
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  const startEdit = (cat: FeedbackCategory) => {
    setEditingId(cat.id);
    setEditForm({ label: cat.label, description: cat.description, key: cat.key });
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.label.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("feedback_categories")
      .update({ label: editForm.label.trim(), description: editForm.description.trim() })
      .eq("id", editingId);
    if (error) {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
    } else {
      setCategories(prev => prev.map(c => c.id === editingId ? { ...c, label: editForm.label.trim(), description: editForm.description.trim() } : c));
      setEditingId(null);
      toast({ title: "수정 완료" });
    }
    setSaving(false);
  };

  const handleAdd = async () => {
    if (!addForm.key.trim() || !addForm.label.trim()) {
      toast({ title: "키와 항목명은 필수입니다", variant: "destructive" });
      return;
    }
    // key must be snake_case
    const key = addForm.key.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!key) {
      toast({ title: "영문 키를 입력해주세요 (예: punctuality)", variant: "destructive" });
      return;
    }
    setSaving(true);
    const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
    const { data, error } = await supabase
      .from("feedback_categories")
      .insert({ key, label: addForm.label.trim(), description: addForm.description.trim(), sort_order: maxOrder })
      .select()
      .single();
    if (error) {
      toast({ title: "추가 실패", description: error.message, variant: "destructive" });
    } else if (data) {
      setCategories(prev => [...prev, data]);
      setAdding(false);
      setAddForm({ key: "", label: "", description: "" });
      toast({ title: "항목 추가 완료" });
    }
    setSaving(false);
  };

  const toggleActive = async (cat: FeedbackCategory) => {
    const { error } = await supabase
      .from("feedback_categories")
      .update({ is_active: !cat.is_active })
      .eq("id", cat.id);
    if (error) {
      toast({ title: "변경 실패", description: error.message, variant: "destructive" });
    } else {
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c));
    }
  };

  const handleDelete = async (cat: FeedbackCategory) => {
    if (!confirm(`"${cat.label}" 항목을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("feedback_categories").delete().eq("id", cat.id);
    if (error) {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    } else {
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      toast({ title: "삭제 완료" });
    }
  };

  const moveOrder = async (catId: string, direction: -1 | 1) => {
    const idx = categories.findIndex(c => c.id === catId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const updated = [...categories];
    const temp = updated[idx].sort_order;
    updated[idx].sort_order = updated[swapIdx].sort_order;
    updated[swapIdx].sort_order = temp;
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    setCategories(updated);

    await Promise.all([
      supabase.from("feedback_categories").update({ sort_order: updated[idx].sort_order }).eq("id", updated[idx].id),
      supabase.from("feedback_categories").update({ sort_order: updated[swapIdx].sort_order }).eq("id", updated[swapIdx].id),
    ]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="shadow-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            📋 피드백 설문 항목 관리
            <Badge variant="outline" className="text-[10px]">{categories.filter(c => c.is_active).length}개 활성</Badge>
          </CardTitle>
          <Button size="sm" className="gap-1.5 bg-navy hover:bg-navy-light text-primary-foreground h-7 text-xs" onClick={() => setAdding(true)}>
            <Plus className="w-3 h-3" /> 항목 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              cat.is_active ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"
            }`}
          >
            {/* Reorder */}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => moveOrder(cat.id, -1)}
                disabled={idx === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
              >
                <GripVertical className="w-3 h-3 rotate-180" />
              </button>
              <button
                onClick={() => moveOrder(cat.id, 1)}
                disabled={idx === categories.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
              >
                <GripVertical className="w-3 h-3" />
              </button>
            </div>

            {editingId === cat.id ? (
              <div className="flex-1 space-y-2">
                <Input
                  className="h-7 text-xs"
                  value={editForm.label}
                  onChange={(e) => setEditForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="항목명"
                />
                <Input
                  className="h-7 text-xs"
                  value={editForm.description}
                  onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="설명"
                />
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-6 text-[10px] gap-1 bg-navy text-primary-foreground" onClick={saveEdit} disabled={saving}>
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />} <Save className="w-3 h-3" /> 저장
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setEditingId(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{cat.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{cat.key}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{cat.description || "—"}</p>
              </div>
            )}

            {editingId !== cat.id && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => toggleActive(cat)} className="text-muted-foreground hover:text-foreground transition-colors">
                  {cat.is_active ? <ToggleRight className="w-5 h-5 text-[hsl(var(--success))]" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => startEdit(cat)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(cat)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add new form */}
        {adding && (
          <div className="p-3 rounded-lg border border-gold/30 bg-gold/5 space-y-2">
            <p className="text-xs font-semibold text-foreground">새 항목 추가</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">키 (영문, 예: punctuality)</Label>
                <Input className="h-7 text-xs mt-0.5" value={addForm.key} onChange={(e) => setAddForm(f => ({ ...f, key: e.target.value }))} placeholder="영문_키" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">항목명</Label>
                <Input className="h-7 text-xs mt-0.5" value={addForm.label} onChange={(e) => setAddForm(f => ({ ...f, label: e.target.value }))} placeholder="수업 만족도" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px] text-muted-foreground">설명 (학생에게 보여지는 안내문)</Label>
                <Input className="h-7 text-xs mt-0.5" value={addForm.description} onChange={(e) => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="평가 기준을 설명해주세요" />
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs gap-1 bg-navy text-primary-foreground" onClick={handleAdd} disabled={saving}>
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} 추가
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAdding(false); setAddForm({ key: "", label: "", description: "" }); }}>
                취소
              </Button>
            </div>
          </div>
        )}

        {categories.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground text-center py-6">등록된 설문 항목이 없습니다</p>
        )}
      </CardContent>
    </Card>
  );
}
