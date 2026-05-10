import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Check } from "lucide-react";

interface Instructor {
  id: string;
  name: string;
  active: boolean;
}

interface CategoryAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorySlug: string | null;
  categoryName: string;
}

export default function CategoryAccessModal({ open, onOpenChange, categorySlug, categoryName }: CategoryAccessModalProps) {
  const { toast } = useToast();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !categorySlug) return;
    const load = async () => {
      setLoading(true);
      const [{ data: instr }, { data: links }] = await Promise.all([
        supabase.from("instructors").select("id, name, active").eq("active", true).order("name"),
        supabase.from("teaching_category_instructors").select("instructor_id").eq("category", categorySlug),
      ]);
      setInstructors((instr as Instructor[]) ?? []);
      setSelected(new Set((links ?? []).map((l: any) => l.instructor_id)));
      setLoading(false);
    };
    load();
  }, [open, categorySlug]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(instructors.map(i => i.id)));
  const clearAll = () => setSelected(new Set());

  const handleSave = async () => {
    if (!categorySlug) return;
    setSaving(true);
    const { error: delErr } = await supabase
      .from("teaching_category_instructors")
      .delete()
      .eq("category", categorySlug);
    if (delErr) {
      toast({ title: "저장 실패", description: delErr.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    if (selected.size > 0) {
      const rows = Array.from(selected).map(instructor_id => ({ category: categorySlug, instructor_id }));
      const { error: insErr } = await supabase.from("teaching_category_instructors").insert(rows);
      if (insErr) {
        toast({ title: "저장 실패", description: insErr.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    toast({ title: "권한이 저장되었습니다 ✓", description: `${selected.size}명의 강사가 이 폴더에 접근 가능합니다` });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-gold" /> 폴더 접근 권한
          </DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-medium text-foreground">{categoryName}</span> 폴더 — 선택된 강사/관리자만 이 폴더의 자료를 수업 노트에 삽입할 수 있습니다. 관리자(Reina 등)도 강사로 수업할 경우 반드시 체크하세요.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : instructors.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">활성 강사가 없습니다</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{selected.size} / {instructors.length}명 선택됨</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-primary hover:underline">전체 선택</button>
                <span className="text-muted-foreground">·</span>
                <button onClick={clearAll} className="text-muted-foreground hover:underline">초기화</button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {instructors.map(i => (
                <label
                  key={i.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox checked={selected.has(i.id)} onCheckedChange={() => toggle(i.id)} />
                  <span className="text-sm text-foreground flex-1">{i.name}</span>
                  {selected.has(i.id) && <Check className="w-3.5 h-3.5 text-success" />}
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>취소</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || loading} className="gold-gradient text-accent-foreground font-bold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
