import { useEffect, useState } from "react";
import { Loader2, Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY_BASE = "opic_generator_last_input";
const getStorageKey = (studentName?: string) => {
  const key = (studentName || "").trim();
  return key ? `${STORAGE_KEY_BASE}::${key}` : STORAGE_KEY_BASE;
};

interface OpicGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
  defaultLevel?: string;
  defaultStudentName?: string;
}

export default function OpicGeneratorModal({
  open,
  onClose,
  onInsert,
  defaultLevel = "B2",
  defaultStudentName = "",
}: OpicGeneratorModalProps) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState(defaultLevel);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    try {
      const storageKey = getStorageKey(defaultStudentName);
      let saved = localStorage.getItem(storageKey);
      if (!saved && storageKey !== STORAGE_KEY_BASE) {
        saved = localStorage.getItem(STORAGE_KEY_BASE);
      }
      if (saved) {
        const data = JSON.parse(saved);
        if (typeof data.topic === "string") setTopic(data.topic);
        if (typeof data.level === "string") setLevel(data.level);
      }
    } catch {
      // ignore
    }
  }, [open, defaultStudentName]);

  const handleGenerate = async () => {
    if (topic.length > 200) {
      toast({ title: "주제가 너무 깁니다.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-opic", {
        body: { topic: topic.trim(), level },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const html = (data.html || "")
        .replace(/```html\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      try {
        localStorage.setItem(
          getStorageKey(defaultStudentName),
          JSON.stringify({ topic, level }),
        );
      } catch {
        // ignore
      }

      onInsert(html);
      toast({ title: `OPIc 자료 삽입 완료 ✓ (주제: ${data.topic || ""})` });
      onClose();
    } catch (err: any) {
      toast({
        title: "생성 실패",
        description: err.message || "OPIc 자료 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mic className="w-4 h-4 text-sky-600" />
            OPIc 수업 자료 생성
          </DialogTitle>
          <DialogDescription className="text-xs">
            OPIc 주제 중 하나로 묘사 · 경험 · 의견 3개 질문과 AL 레벨 모범 답안을 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              주제 (선택 — 비우면 OPIc 주제 중 자동 선택, 여러 개는 쉼표로 구분 → 랜덤 1개)
            </Label>
            <Input
              placeholder="예: travel, movies, restaurants"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={200}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Level (질문 어휘 난이도)</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A2">A2 - Elementary</SelectItem>
                <SelectItem value="B1">B1 - Intermediate</SelectItem>
                <SelectItem value="B2">B2 - Upper-Intermediate</SelectItem>
                <SelectItem value="C1">C1 - Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full bg-sky-600 hover:bg-sky-700 text-primary-foreground gap-2"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중... (10~20초 소요)
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                OPIc 자료 생성
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
