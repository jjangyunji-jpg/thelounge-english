import { useEffect, useState } from "react";
import { Loader2, Newspaper, Sparkles } from "lucide-react";

const NEWS_STORAGE_KEY_BASE = "news_lesson_generator_last_input";
const getStorageKey = (studentName?: string) => {
  const key = (studentName || "").trim();
  return key ? `${NEWS_STORAGE_KEY_BASE}::${key}` : NEWS_STORAGE_KEY_BASE;
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NewsLessonGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
  defaultLevel?: string;
  defaultStudentName?: string;
}

export default function NewsLessonGeneratorModal({
  open,
  onClose,
  onInsert,
  defaultLevel = "B1",
  defaultStudentName = "",
}: NewsLessonGeneratorModalProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"text" | "url">("text");
  const [articleText, setArticleText] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [level, setLevel] = useState(defaultLevel);
  const [duration, setDuration] = useState("40");
  const [generating, setGenerating] = useState(false);

  // Restore last inputs when modal opens
  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(NEWS_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.inputMode === "text" || data.inputMode === "url") setInputMode(data.inputMode);
        if (typeof data.articleText === "string") setArticleText(data.articleText);
        if (typeof data.articleUrl === "string") setArticleUrl(data.articleUrl);
        if (typeof data.level === "string") setLevel(data.level);
        if (typeof data.duration === "string") setDuration(data.duration);
      }
    } catch {
      // ignore
    }
  }, [open]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const body: Record<string, string> = { level, duration };
      if (inputMode === "text") {
        body.articleText = articleText;
      } else {
        body.articleUrl = articleUrl;
      }

      const { data, error } = await supabase.functions.invoke("generate-news-lesson", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const html = (data.html || "")
        .replace(/```html\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      // Save inputs for next time
      try {
        localStorage.setItem(
          NEWS_STORAGE_KEY,
          JSON.stringify({ inputMode, articleText, articleUrl, level, duration }),
        );
      } catch {
        // ignore quota errors
      }

      onInsert(html);
      toast({ title: "수업 자료 삽입 완료 ✓" });
      onClose();
    } catch (err: any) {
      toast({
        title: "생성 실패",
        description: err.message || "수업 자료 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate =
    !generating && (inputMode === "text" ? articleText.trim().length > 0 : articleUrl.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Newspaper className="w-4 h-4 text-navy" />
            News Talk 수업 자료 생성
          </DialogTitle>
          <DialogDescription className="text-xs">
            뉴스 기사를 바탕으로 Vocabulary, Summary, Keywords, Guided Questions 자료를 자동 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "text" | "url")}>
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="text" className="text-xs">기사 원문 붙여넣기</TabsTrigger>
              <TabsTrigger value="url" className="text-xs">URL 입력</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="mt-2">
              <Textarea
                placeholder="기사 원문을 붙여넣으세요..."
                value={articleText}
                onChange={(e) => setArticleText(e.target.value)}
                className="resize-none h-32 text-sm"
              />
            </TabsContent>
            <TabsContent value="url" className="mt-2">
              <Input
                type="url"
                placeholder="https://www.example.com/article..."
                value={articleUrl}
                onChange={(e) => setArticleUrl(e.target.value)}
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                일부 사이트는 접근이 제한될 수 있습니다. 원문 붙여넣기를 권장합니다.
              </p>
            </TabsContent>
          </Tabs>

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
            className="w-full bg-navy hover:bg-navy-light text-primary-foreground gap-2"
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
                수업 자료 생성
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
