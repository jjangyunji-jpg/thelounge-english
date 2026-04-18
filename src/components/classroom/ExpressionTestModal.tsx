import { useState, useMemo } from "react";
import { Loader2, Sparkles, Check, X, ArrowRight, BookMarked, ListChecks, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface KeyExpressionItem {
  id: string;
  situation_label: string;
  english: string;
  korean: string;
}

interface ExpressionTestModalProps {
  open: boolean;
  onClose: () => void;
  expressions: KeyExpressionItem[];
  studentName: string;
}

interface AttemptResult {
  is_correct: boolean;
  score: number;
  feedback: string;
  student_answer: string;
}

type Phase = "confirm" | "testing";
type TestMode = "writing" | "choice";

export default function ExpressionTestModal({
  open, onClose, expressions, studentName,
}: ExpressionTestModalProps) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [mode, setMode] = useState<TestMode>("writing");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [done, setDone] = useState(false);

  const ordered = useMemo(() => {
    return [...expressions].sort(() => Math.random() - 0.5);
  }, [expressions, open]);

  const current = ordered[index];

  // Build 4 choices for current question (multiple-choice mode)
  const choices = useMemo(() => {
    if (!current || mode !== "choice") return [] as string[];
    const distractorPool = expressions
      .filter((e) => e.id !== current.id)
      .map((e) => e.english);
    const distractors = [...distractorPool].sort(() => Math.random() - 0.5).slice(0, 3);
    return [current.english, ...distractors].sort(() => Math.random() - 0.5);
  }, [current, mode, expressions]);

  const reset = () => {
    setPhase("confirm");
    setIndex(0);
    setAnswer("");
    setSelectedChoice(null);
    setResult(null);
    setResults([]);
    setDone(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const startTest = (m: TestMode) => {
    setMode(m);
    setPhase("testing");
    setIndex(0);
    setAnswer("");
    setSelectedChoice(null);
    setResult(null);
    setResults([]);
    setDone(false);
  };

  const handleSubmitWriting = async () => {
    if (!current || !answer.trim()) return;
    setEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke("evaluate-expression-answer", {
        body: {
          korean: current.korean,
          target_english: current.english,
          student_answer: answer.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const r: AttemptResult = {
        is_correct: !!data.is_correct,
        score: data.score ?? 0,
        feedback: data.feedback ?? "",
        student_answer: answer.trim(),
      };
      setResult(r);
      setResults(prev => [...prev, r]);
      await supabase.from("key_expression_test_results").insert({
        expression_id: current.id,
        student_name: studentName,
        student_answer: r.student_answer,
        is_correct: r.is_correct,
        score: r.score,
        ai_feedback: r.feedback,
      });
    } catch (err: any) {
      toast({ title: "채점 실패", description: err.message || "잠시 후 다시 시도해주세요.", variant: "destructive" });
    } finally {
      setEvaluating(false);
    }
  };

  const handleSubmitChoice = async (choice: string) => {
    if (!current || selectedChoice) return;
    setSelectedChoice(choice);
    const isCorrect = choice === current.english;
    const r: AttemptResult = {
      is_correct: isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect ? "정답입니다!" : `정답은 "${current.english}" 입니다.`,
      student_answer: choice,
    };
    setResult(r);
    setResults(prev => [...prev, r]);
    try {
      await supabase.from("key_expression_test_results").insert({
        expression_id: current.id,
        student_name: studentName,
        student_answer: r.student_answer,
        is_correct: r.is_correct,
        score: r.score,
        ai_feedback: r.feedback,
      });
    } catch {/* silent */}
  };

  const handleNext = () => {
    if (index + 1 >= ordered.length) {
      setDone(true);
      return;
    }
    setIndex(i => i + 1);
    setAnswer("");
    setSelectedChoice(null);
    setResult(null);
  };

  if (!current && !done && phase === "testing") {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>표현 테스트</DialogTitle>
            <DialogDescription>테스트할 표현이 없습니다.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const correctCount = results.filter(r => r.is_correct).length;
  const avgScore = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookMarked className="w-4 h-4 text-purple-500" />
            핵심 표현 테스트
          </DialogTitle>
          <DialogDescription className="text-xs">
            {phase === "confirm"
              ? `총 ${ordered.length}개 표현 · 모드를 선택하세요`
              : done
              ? "테스트 완료!"
              : `${index + 1} / ${ordered.length} • ${mode === "choice" ? "한국어를 보고 알맞은 영어 표현을 고르세요." : "한국어 문장을 영어로 작문해보세요."}`}
          </DialogDescription>
        </DialogHeader>

        {/* ── Confirm: mode selection ── */}
        {phase === "confirm" && (
          <div className="space-y-3 py-2">
            <button
              onClick={() => startTest("choice")}
              className="w-full rounded-xl border-2 border-purple-200 hover:border-purple-400 bg-purple-50/50 hover:bg-purple-50 p-4 text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <ListChecks className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">객관식 (4지선다)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">한국어를 보고 알맞은 영어 표현을 고르세요</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => startTest("writing")}
              disabled={ordered.length < 1}
              className="w-full rounded-xl border-2 border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 p-4 text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <PencilLine className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">주관식 (영작)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">한국어 문장을 직접 영어로 작문 · AI 채점</p>
                </div>
              </div>
            </button>
            {ordered.length < 4 && (
              <p className="text-[10px] text-muted-foreground text-center">
                ※ 객관식은 표현이 4개 이상일 때 가장 잘 작동합니다
              </p>
            )}
          </div>
        )}

        {/* ── Done: results ── */}
        {phase === "testing" && done && (
          <div className="py-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-purple-500">{avgScore}점</div>
              <p className="text-sm text-muted-foreground">
                정답 <span className="font-semibold text-foreground">{correctCount}</span> / {ordered.length}개
              </p>
            </div>
            <div className="rounded-lg bg-purple-50 p-3">
              <p className="text-xs text-purple-900">
                {avgScore >= 80
                  ? "훌륭해요! 표현을 잘 외우고 계세요 👏"
                  : avgScore >= 60
                  ? "좋아요! 틀린 표현은 다시 한 번 살펴보세요."
                  : "괜찮아요. 반복하면 곧 익숙해집니다 💪"}
              </p>
            </div>
            <Button onClick={handleClose} className="w-full bg-purple-500 hover:bg-purple-600 text-white">
              완료
            </Button>
          </div>
        )}

        {/* ── Testing ── */}
        {phase === "testing" && !done && current && (
          <div className="space-y-3">
            {current.situation_label && (
              <div className="inline-block px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-semibold">
                {current.situation_label}
              </div>
            )}
            <div className="rounded-lg border-2 border-purple-200 bg-purple-50/50 p-4">
              <p className="text-base font-medium text-foreground">{current.korean}</p>
            </div>

            {/* Choice mode */}
            {mode === "choice" && (
              <div className="space-y-2">
                {choices.map((c, i) => {
                  const isSelected = selectedChoice === c;
                  const isAnswer = c === current.english;
                  const showState = !!selectedChoice;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSubmitChoice(c)}
                      disabled={!!selectedChoice}
                      className={cn(
                        "w-full text-left rounded-lg border-2 p-3 text-sm transition-all",
                        !showState && "border-border hover:border-purple-300 hover:bg-purple-50/50",
                        showState && isAnswer && "border-green-400 bg-green-50",
                        showState && isSelected && !isAnswer && "border-amber-400 bg-amber-50",
                        showState && !isSelected && !isAnswer && "border-border opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground w-4">{String.fromCharCode(65 + i)}.</span>
                        <span className="flex-1 text-foreground">{c}</span>
                        {showState && isAnswer && <Check className="w-4 h-4 text-green-600" />}
                        {showState && isSelected && !isAnswer && <X className="w-4 h-4 text-amber-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Writing mode */}
            {mode === "writing" && (
              <>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="영어로 작문해보세요..."
                  className="resize-none h-20 text-sm"
                  disabled={!!result}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !result) {
                      e.preventDefault();
                      handleSubmitWriting();
                    }
                  }}
                />
                {result && (
                  <div
                    className={`rounded-lg p-3 space-y-2 ${
                      result.is_correct ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.is_correct ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <X className="w-4 h-4 text-amber-600" />
                      )}
                      <span className={`text-xs font-bold ${result.is_correct ? "text-green-700" : "text-amber-700"}`}>
                        {result.is_correct ? "정답" : "다시 한 번"} • {result.score}점
                      </span>
                    </div>
                    <div className="text-xs space-y-1">
                      <div>
                        <span className="text-muted-foreground">모범 답안: </span>
                        <span className="font-medium text-foreground">{current.english}</span>
                      </div>
                      {result.feedback && (
                        <p className="text-foreground/80 italic">"{result.feedback}"</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Choice mode feedback (compact) */}
            {mode === "choice" && result && !result.is_correct && (
              <div className="rounded-lg p-2 bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                정답: <span className="font-semibold">{current.english}</span>
              </div>
            )}

            <div className="flex gap-2">
              {mode === "writing" && !result ? (
                <Button
                  onClick={handleSubmitWriting}
                  disabled={evaluating || !answer.trim()}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white gap-2"
                >
                  {evaluating ? <><Loader2 className="w-4 h-4 animate-spin" />AI 채점 중...</> : <><Sparkles className="w-4 h-4" />제출 (AI 채점)</>}
                </Button>
              ) : result ? (
                <Button
                  onClick={handleNext}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white gap-2"
                >
                  {index + 1 >= ordered.length ? "결과 보기" : <>다음 문제<ArrowRight className="w-4 h-4" /></>}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
