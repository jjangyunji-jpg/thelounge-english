import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Sparkles, Wand2, ArrowLeft, Check } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";

const DIALOGUE_STORAGE_KEY_BASE = "dialogue_generator_last_input";
const getStorageKey = (studentName?: string) => {
  const key = (studentName || "").trim();
  return key ? `${DIALOGUE_STORAGE_KEY_BASE}::${key}` : DIALOGUE_STORAGE_KEY_BASE;
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DialogueGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
  defaultLevel?: string;
  defaultStudentName?: string;
}

type Step = "input" | "preview";

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
  const [revising, setRevising] = useState(false);

  const [step, setStep] = useState<Step>("input");
  const [dialogueHtml, setDialogueHtml] = useState("");
  const [revisionInstruction, setRevisionInstruction] = useState("");

  // Restore last inputs when modal opens (per-student)
  useEffect(() => {
    if (!open) return;
    // Reset to input step on open
    setStep("input");
    setDialogueHtml("");
    setRevisionInstruction("");
    try {
      const storageKey = getStorageKey(defaultStudentName);
      let saved = localStorage.getItem(storageKey);
      if (!saved && storageKey !== DIALOGUE_STORAGE_KEY_BASE) {
        saved = localStorage.getItem(DIALOGUE_STORAGE_KEY_BASE);
      }
      if (saved) {
        const data = JSON.parse(saved);
        if (typeof data.situation === "string") setSituation(data.situation);
        if (typeof data.speakers === "string") setSpeakers(data.speakers);
        if (typeof data.student === "string" && data.student) setStudent(data.student);
        if (typeof data.level === "string") setLevel(data.level);
        if (typeof data.mustInclude === "string") setMustInclude(data.mustInclude);
        if (typeof data.tone === "string") setTone(data.tone);
      }
    } catch {
      // ignore
    }
  }, [open, defaultStudentName]);

  const cleanDialogue = (raw: string) =>
    raw.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-dialogue", {
        body: { situation, speakers, student, level, mustInclude, tone },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const cleaned = cleanDialogue(data.dialogue || "");

      // Save inputs for next time (per-student)
      try {
        localStorage.setItem(
          getStorageKey(defaultStudentName),
          JSON.stringify({ situation, speakers, student, level, mustInclude, tone }),
        );
      } catch {
        // ignore quota errors
      }

      setDialogueHtml(cleaned);
      setStep("preview");
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

  const handleRevise = async () => {
    if (!revisionInstruction.trim()) {
      toast({
        title: "수정 지시문을 입력해주세요",
        description: "예: 아이 나이를 13살로 바꿔줘",
        variant: "destructive",
      });
      return;
    }
    setRevising(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-dialogue", {
        body: {
          situation,
          speakers,
          student,
          level,
          mustInclude,
          tone,
          previousDialogue: dialogueHtml,
          revisionInstruction,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const cleaned = cleanDialogue(data.dialogue || "");
      setDialogueHtml(cleaned);
      setRevisionInstruction("");
      toast({ title: "AI 수정 완료 ✓" });
    } catch (err: any) {
      toast({
        title: "수정 실패",
        description: err.message || "Dialogue 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setRevising(false);
    }
  };

  const handleInsert = () => {
    if (!dialogueHtml.trim()) return;
    onInsert(dialogueHtml);
    toast({ title: "Dialogue 삽입 완료 ✓" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={step === "preview" ? "max-w-3xl max-h-[90vh] overflow-y-auto" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-4 h-4 text-gold" />
            Dialogue 생성
            {step === "preview" && (
              <span className="text-xs text-muted-foreground font-normal">— 미리보기 / 수정</span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === "input"
              ? "입력한 내용을 바탕으로 자연스러운 영어 대화를 생성합니다. 빈칸은 자동으로 채워집니다."
              : "결과를 직접 편집하거나 AI에게 일부 수정을 요청한 뒤 노트에 삽입하세요."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
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
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {/* Editable preview */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                생성된 Dialogue (HTML 직접 편집 가능)
              </Label>
              <Textarea
                value={dialogueHtml}
                onChange={(e) => setDialogueHtml(e.target.value)}
                className="font-mono text-xs h-64 resize-y"
                disabled={revising}
              />
            </div>

            {/* Rendered preview */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">미리보기</Label>
              <div
                className="border rounded-md p-3 max-h-64 overflow-y-auto bg-muted/30 text-sm prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: dialogueHtml }}
              />
            </div>

            {/* AI revision input */}
            <div className="space-y-1 border-t pt-3">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Wand2 className="w-3 h-3 text-gold" />
                AI에게 수정 요청
              </Label>
              <Textarea
                placeholder="예: 아이 나이를 13살로 바꿔줘 / 더 짧게 만들어줘 / 더 격식있는 톤으로 / 카페 대신 식당 배경으로"
                value={revisionInstruction}
                onChange={(e) => setRevisionInstruction(e.target.value)}
                className="resize-none h-16 text-sm"
                disabled={revising}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={handleRevise}
                disabled={revising || !revisionInstruction.trim()}
              >
                {revising ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    AI가 수정 중...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    AI로 수정하기
                  </>
                )}
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setStep("input")}
                disabled={revising}
              >
                <ArrowLeft className="w-4 h-4" />
                다시 생성
              </Button>
              <Button
                className="flex-1 bg-navy hover:bg-navy-light text-primary-foreground gap-2"
                onClick={handleInsert}
                disabled={revising || !dialogueHtml.trim()}
              >
                <Check className="w-4 h-4" />
                노트에 삽입
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
