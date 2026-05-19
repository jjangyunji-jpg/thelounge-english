import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Sparkles, AlertCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenReport: () => void;
}

type Msg = { role: "user" | "assistant"; content: string };

const FAQS = [
  "숙제를 어떻게 제출하나요?",
  "수업을 취소하거나 변경하려면?",
  "보강은 어떻게 신청하나요?",
  "단어시험은 어디서 보나요?",
  "수업노트는 어디서 확인하나요?",
  "결제 / 현금영수증은 어떻게 하나요?",
];

/** Render simple markdown: **bold**, *italic*, and line breaks. */
function renderMarkdown(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, li) => {
    const parts = line.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
    return (
      <span key={li}>
        {parts.map((p, i) => {
          if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
            return <strong key={i} className="font-bold">{p.slice(2, -2)}</strong>;
          }
          if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
            return <em key={i}>{p.slice(1, -1)}</em>;
          }
          return <span key={i}>{p}</span>;
        })}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

const WELCOME: Msg = {
  role: "assistant",
  content:
    "안녕하세요! 프로그램 사용 중 궁금한 점을 도와드릴게요. 아래 자주 묻는 질문을 누르거나 직접 입력해 주세요. 해결이 안 되면 하단의 '운영진에 신고하기' 버튼을 이용해 주세요.",
};

export default function StudentHelpModal({ open, onClose, onOpenReport }: Props) {
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([WELCOME]);
      setInput("");
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("student-help-chat", {
        body: { messages: next.filter((m) => m !== WELCOME) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "assistant", content: data?.reply || "응답을 받지 못했습니다." }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "죄송합니다. 답변을 가져오지 못했습니다. 잠시 후 다시 시도하시거나 하단의 '운영진에 신고하기' 버튼으로 문의해 주세요.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border">
          <DialogTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            도움말 챗봇
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <div ref={scrollRef} className="h-[360px] overflow-y-auto px-4 py-3 space-y-3 bg-muted/20">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground"
                )}
              >
                {renderMarkdown(m.content)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-xl px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {/* FAQ chips — show on welcome and after each assistant reply */}
          {!loading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
            <div className="pt-2 space-y-1.5">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {messages.length === 1 ? "자주 묻는 질문" : "또 궁금한 점이 있으신가요?"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FAQS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-[11px] px-2.5 py-1.5 rounded-full bg-card border border-border hover:bg-muted text-foreground transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-3 py-2.5 border-t border-border bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="궁금한 점을 입력하세요"
              disabled={loading}
              className="text-sm h-9"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>

        {/* Report fallback */}
        <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">해결되지 않으셨나요?</p>
          <button
            onClick={() => {
              onClose();
              onOpenReport();
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-destructive hover:underline"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            운영진에 신고하기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
