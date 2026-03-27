import { useState } from "react";
import { Loader2, MessageCircle, Sparkles } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DialogueGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
  defaultLevel?: string;
  defaultStudentName?: string;
}

export default function DialogueGeneratorModal({
  open,
  onClose,
  onInsert,
  defaultLevel = "B1",
  defaultStudentName = "",
}: DialogueGeneratorModalProps) {
  const { toast } = useToast();
  const [situation, setSituation] = useState("");
  const [speakers, setSpeakers] = useState("");
  const [student, setStudent] = useState(defaultStudentName);
  const [level, setLevel] = useState(defaultLevel);
  const [mustInclude, setMustInclude] = useState("");
  const [tone, setTone] = useState("Casual");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-dialogue", {
        body: { situation, speakers, student, level, mustInclude, tone },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const dialogue = data.dialogue || "";
      // Clean up markdown artifacts if any
      const cleaned = dialogue
        .replace(/```html\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      onInsert(cleaned);
      toast({ title: "Dialogue 삽입 완료 ✓" });
      onClose();
      // Reset form
      setSituation("");
      setSpeakers("");
      setMustInclude("");
    } catch (err: any) {
      toast({
        title: "생성 실패",
        description: err.message || "Dialogue 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-4 h-4 text-gold" />
            Dialogue 생성
          </DialogTitle>
          <DialogDescription className="text-xs">
            입력한 내용을 바탕으로 자연스러운 영어 대화를 생성합니다. 빈칸은 자동으로 채워집니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Situation</Label>
            <Textarea
              placeholder="대화의 배경 상황 (예: Ordering coffee at a café)"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              className="resize-none h-16 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Speakers</Label>
            <Input
              placeholder="대화 참여자 (예: A barista and a customer)"
              value={speakers}
              onChange={(e) => setSpeakers(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Student</Label>
            <Input
              placeholder="학생 정보 (예: 30대 직장인, 이름 민수)"
              value={student}
              onChange={(e) => setStudent(e.target.value)}
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
              <Label className="text-xs text-muted-foreground">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Casual">Casual</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                  <SelectItem value="Formal">Formal</SelectItem>
                  <SelectItem value="Slang">Slang</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Must Include</Label>
            <Textarea
              placeholder="포함할 표현, 단어, 문법 (예: I was wondering if..., would you mind...)"
              value={mustInclude}
              onChange={(e) => setMustInclude(e.target.value)}
              className="resize-none h-16 text-sm"
            />
          </div>

          <Button
            className="w-full bg-navy hover:bg-navy-light text-primary-foreground gap-2"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Dialogue 생성
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
