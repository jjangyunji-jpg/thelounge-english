import { useEffect, useState } from "react";
import { Loader2, Lightbulb, Sparkles } from "lucide-react";
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

const STORAGE_KEY_BASE = "insight_generator_last_input";
const getStorageKey = (studentName?: string) => {
  const key = (studentName || "").trim();
  return key ? `${STORAGE_KEY_BASE}::${key}` : STORAGE_KEY_BASE;
};

interface InsightGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
  defaultLevel?: string;
  defaultStudentName?: string;
}

export default function InsightGeneratorModal({
  open,
  onClose,
  onInsert,
  defaultLevel = "B1",
  defaultStudentName = "",
}: InsightGeneratorModalProps) {
  const { toast } = useToast();
  const [profession, setProfession] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState(defaultLevel);
  const [duration, setDuration] = useState("40");
  const [generating, setGenerating] = useState(false);

  // Restore last inputs per-student when modal opens
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
        if (typeof data.profession === "string") setProfession(data.profession);
        if (typeof data.topic === "string") setTopic(data.topic);
        if (typeof data.level === "string") setLevel(data.level);
        if (typeof data.duration === "string") setDuration(data.duration);
      }
    } catch {
      // ignore
    }
  }, [open, defaultStudentName]);

  const handleGenerate = async () => {
    const trimmedProfession = profession.trim();
    if (!trimmedProfession) {
      toast({ title: "직업/직무를 입력해주세요.", variant: "destructive" });
      return;
    }
    if (trimmedProfession.length > 300 || topic.length > 500) {
      toast({ title: "입력이 너무 깁니다.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insight", {
        body: {
          profession: trimmedProfession,
          topic: topic.trim(),
          level,
          duration,
        },
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
          JSON.stringify({ profession: trimmedProfession, topic, level, duration }),
        );
      } catch {
        // ignore quota errors
      }

      onInsert(html);
      toast({ title: "Insight 자료 삽입 완료 ✓" });
      onClose();
    } catch (err: any) {
      toast({
        title: "생성 실패",
        description: err.message || "Insight 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = !generating && profession.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="w-4 h-4 text-purple-600" />
            Insight 수업 자료 생성
          </DialogTitle>
          <DialogDescription className="text-xs">
            학생의 직업/직무 관련 개념 설명, 핵심 단어, Discussion Questions를 자동 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">직업 / 직무 *</Label>
            <Input
              placeholder="예: Bond manager at investment bank"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              maxLength={300}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">관심 주제 (선택)</Label>
            <Input
              placeholder="예: ESG investing, leadership, AI in finance"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Level (CEFR)</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A1">A1 - Beginner</SelectItem>
                  <SelectItem value="A2">A2 - Elementary</SelectItem>
                  <SelectItem value="B1">B1 - Intermediate</SelectItem>
                  <SelectItem value="B2">B2 - Upper-Intermediate</SelectItem>
                  <SelectItem value="C1">C1 - Advanced</SelectItem>
                  <SelectItem value="C2">C2 - Proficiency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">수업 시간</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="40">40 min</SelectItem>
                  <SelectItem value="50">50 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full bg-purple-600 hover:bg-purple-700 text-primary-foreground gap-2"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중... (10~20초 소요)
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Insight 자료 생성
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
