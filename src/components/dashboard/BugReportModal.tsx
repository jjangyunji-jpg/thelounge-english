import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bug, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  role: string;
}

const CATEGORIES = [
  { value: "bug", label: "버그 신고", icon: Bug, desc: "오류나 정상 동작하지 않는 기능" },
  { value: "improvement", label: "개선 제안", icon: Lightbulb, desc: "더 나은 서비스를 위한 아이디어" },
] as const;

export default function BugReportModal({ open, onClose, userName, role }: BugReportModalProps) {
  const { toast } = useToast();
  const [category, setCategory] = useState<string>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("로그인이 필요합니다");

      const { error } = await supabase.from("support_requests").insert({
        user_id: session.user.id,
        user_name: userName,
        role,
        category,
        title: title.trim(),
        description: description.trim(),
      });
      if (error) throw error;
      toast({ title: "제출 완료", description: "소중한 의견 감사합니다. 빠르게 검토하겠습니다." });
      setTitle("");
      setDescription("");
      setCategory("bug");
      onClose();
    } catch (e: any) {
      toast({ title: "제출 실패", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">버그 신고 / 개선 제안</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Category */}
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-colors",
                  category === c.value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                )}
              >
                <c.icon className="w-4 h-4" />
                <span className="font-semibold">{c.label}</span>
                <span className="text-[10px] text-muted-foreground">{c.desc}</span>
              </button>
            ))}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs">제목</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={category === "bug" ? "어떤 문제가 발생했나요?" : "어떤 개선이 필요한가요?"}
              className="text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">상세 내용</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={category === "bug" ? "문제 상황을 자세히 설명해주세요 (어떤 화면에서, 어떤 동작을 했을 때)" : "개선 아이디어를 자세히 설명해주세요"}
              rows={4}
              className="text-sm resize-none"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !description.trim() || submitting}
            className="w-full"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            제출하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
