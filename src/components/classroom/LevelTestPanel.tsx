import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, Loader2, Play, RotateCcw, Award, Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LevelTest {
  id: string;
  level: string;
  title: string;
  description: string | null;
  pass_threshold: number;
  question_count: number;
  is_active: boolean;
}
interface Question {
  id: string;
  category: string;
  question: string;
  choices: string[];
}
interface GradedAnswer {
  question_id: string;
  category: string;
  question: string;
  picked: number;
  correct: number;
  explanation: string | null;
  is_correct: boolean;
}
interface Activation {
  id: string;
  level_test_id: string;
  activated_at: string;
  passed_at: string | null;
  best_score: number;
  attempt_count: number;
  current_set: number;
}
interface Attempt {
  id: string;
  score: number;
  passed: boolean;
  total_questions: number;
  correct_count: number;
  submitted_at: string;
  answers: any[];
}

interface Props {
  studentName: string;
  role: "student" | "instructor";
  instructorName?: string;
}

export default function LevelTestPanel({ studentName, role, instructorName }: Props) {
  const { toast } = useToast();
  const [tests, setTests] = useState<LevelTest[]>([]);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [testModal, setTestModal] = useState<{ test: LevelTest; questions: Question[] } | null>(null);
  const [historyModal, setHistoryModal] = useState<LevelTest | null>(null);

  const refresh = async () => {
    const [{ data: t }, { data: a }, { data: at }] = await Promise.all([
      supabase.from("level_tests").select("*").eq("is_active", true).order("level"),
      supabase.from("level_test_activations").select("*").eq("student_name", studentName),
      supabase.from("level_test_attempts").select("*").eq("student_name", studentName).order("submitted_at", { ascending: false }),
    ]);
    setTests((t ?? []) as any);
    setActivations((a ?? []) as any);
    setAttempts((at ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [studentName]);

  const activeTests = useMemo(() => {
    const ids = new Set(activations.map((a) => a.level_test_id));
    return tests.filter((t) => ids.has(t.id));
  }, [tests, activations]);

  const inactiveTests = useMemo(() => {
    const ids = new Set(activations.map((a) => a.level_test_id));
    return tests.filter((t) => !ids.has(t.id));
  }, [tests, activations]);

  const startTest = async (test: LevelTest) => {
    const act = activations.find((a) => a.level_test_id === test.id);
    const currentSet = act?.current_set ?? 1;
    const { data: pool } = await supabase
      .from("level_test_questions_safe" as any)
      .select("id, category, question, choices, set_number")
      .eq("level_test_id", test.id)
      .eq("set_number", currentSet);
    if (!pool || pool.length === 0) {
      toast({ title: "문제 없음", description: `Set ${currentSet} 문제가 아직 준비되지 않았습니다.`, variant: "destructive" });
      return;
    }
    // Shuffle and pick
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(test.question_count, pool.length));
    setTestModal({ test, questions: shuffled as any });
  };

  const handleActivate = async (test: LevelTest) => {
    const { error } = await supabase.from("level_test_activations").insert({
      student_name: studentName,
      level_test_id: test.id,
      activated_by: instructorName ?? null,
    });
    if (error) toast({ title: "활성화 실패", description: error.message, variant: "destructive" });
    else { toast({ title: `${test.title} 활성화` }); refresh(); }
  };

  const handleDeactivate = async (act: Activation) => {
    if (!confirm("이 시험을 비활성화할까요? (응시 이력은 유지됩니다)")) return;
    const { error } = await supabase.from("level_test_activations").delete().eq("id", act.id);
    if (!error) refresh();
  };

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  if (tests.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/30">
        <ClipboardCheck className="w-4 h-4 text-gold" />
        <span className="font-semibold text-sm text-foreground">레벨 테스트</span>
      </div>
      <div className="p-4 space-y-2">
        {activeTests.length === 0 && role === "student" && (
          <p className="text-xs text-muted-foreground">아직 응시 가능한 테스트가 없습니다. 강사가 자료를 마치면 활성화해드립니다.</p>
        )}
        {activeTests.map((t) => {
          const act = activations.find((a) => a.level_test_id === t.id)!;
          const passed = !!act.passed_at;
          const myAttempts = attempts.filter((at) => at.score !== null);
          const passedAttempt = myAttempts.find((at) => at.passed);
          return (
            <div key={t.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{t.title}</span>
                    {passed ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 font-semibold inline-flex items-center gap-1">
                        <Award className="w-3 h-3" /> 통과
                      </span>
                    ) : act.attempt_count > 0 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-semibold">
                        진행중 · 최고 {act.best_score}%
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">미응시</span>
                    )}
                  </div>
                  {t.description && <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    합격 {t.pass_threshold}% · {t.question_count}문제 · 응시 {act.attempt_count}회 · 현재 Set {act.current_set ?? 1}
                  </p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {role === "student" && !passed && (
                    <Button size="sm" onClick={() => startTest(t)} className="bg-gold text-accent-foreground hover:bg-gold/90 h-8 gap-1.5 text-xs">
                      {act.attempt_count === 0 ? <Play className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
                      {act.attempt_count === 0 ? "응시" : "다시 응시"}
                    </Button>
                  )}
                  {role === "student" && passed && passedAttempt && (
                    <span className="text-xs text-green-600 font-bold">{passedAttempt.score}%</span>
                  )}
                  {role === "instructor" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setHistoryModal(t)} className="h-7 text-[11px] gap-1">
                        <Eye className="w-3 h-3" /> 결과 보기
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeactivate(act)} className="h-6 text-[10px] text-muted-foreground hover:text-destructive gap-1">
                        <Trash2 className="w-3 h-3" /> 비활성화
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Instructor: activate buttons for not-yet-activated tests */}
        {role === "instructor" && inactiveTests.length > 0 && (
          <div className="pt-2 border-t border-border space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">활성화 가능한 테스트</p>
            {inactiveTests.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant="outline"
                onClick={() => handleActivate(t)}
                className="w-full justify-start h-8 text-xs gap-1.5"
              >
                <Plus className="w-3 h-3" /> {t.title} 활성화
              </Button>
            ))}
          </div>
        )}
      </div>

      {testModal && (
        <TestRunnerModal
          test={testModal.test}
          questions={testModal.questions}
          studentName={studentName}
          activation={activations.find((a) => a.level_test_id === testModal.test.id)!}
          onClose={() => { setTestModal(null); refresh(); }}
        />
      )}

      {historyModal && (
        <AttemptHistoryModal
          test={historyModal}
          attempts={attempts.filter((a) => true)}
          studentName={studentName}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </div>
  );
}

// ─── Test Runner Modal ─────────────────────────────────────────────
function TestRunnerModal({
  test, questions, studentName, activation, onClose,
}: {
  test: LevelTest;
  questions: Question[];
  studentName: string;
  activation: Activation;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<number[]>(() => questions.map(() => -1));
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt] = useState(() => new Date().toISOString());
  const [result, setResult] = useState<{ score: number; correct_count: number; total: number; passed: boolean; answers: GradedAnswer[] } | null>(null);

  const current = questions[index];
  const picked = picks[index];

  const choose = (i: number) => {
    setPicks((p) => p.map((v, idx) => (idx === index ? i : v)));
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      submit();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("grade-level-test", {
        body: {
          test_id: test.id,
          picks: questions.map((q, i) => ({ question_id: q.id, picked: picks[i] })),
          started_at: startedAt,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as any);
      setDone(true);
    } catch (e: any) {
      toast({ title: "제출 실패", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const score = result?.score ?? 0;
  const correctCount = result?.correct_count ?? 0;
  const passed = result?.passed ?? false;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="w-4 h-4 text-gold" />
            {test.title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {done ? "테스트 완료!" : `${index + 1} / ${questions.length} · 합격 ${test.pass_threshold}%`}
          </DialogDescription>
        </DialogHeader>

        {!done && current && (
          <div className="space-y-3">
            {current.category && (
              <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{current.category}</span>
            )}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm text-foreground whitespace-pre-line">{current.question}</p>
            </div>
            <div className="space-y-1.5">
              {current.choices.map((c, ci) => {
                const isPick = picked === ci;
                return (
                  <button
                    key={ci}
                    onClick={() => choose(ci)}
                    className={cn(
                      "w-full text-left rounded-lg border-2 p-2.5 text-sm transition-all",
                      isPick ? "border-gold bg-gold/10" : "border-border hover:border-gold/40 hover:bg-muted/30",
                    )}
                  >
                    <span className="text-[10px] font-bold text-muted-foreground mr-2">{String.fromCharCode(65 + ci)}.</span>
                    {c}
                  </button>
                );
              })}
            </div>
            <Button onClick={next} disabled={picked < 0 || submitting} className="w-full bg-gold text-accent-foreground hover:bg-gold/90">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : index + 1 >= questions.length ? "제출하고 결과 보기" : "다음 문제"}
            </Button>
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setIndex((i) => Math.max(0, i - 1))} className="w-full text-xs">
                이전 문제
              </Button>
            )}
          </div>
        )}

        {done && result && (
          <div className="py-4 space-y-3">
            <div className="text-center space-y-2">
              <div className={cn("text-5xl font-bold", passed ? "text-green-500" : "text-amber-500")}>{score}%</div>
              <p className="text-sm text-muted-foreground">정답 {correctCount} / {result.total}</p>
              <div className={cn("rounded-lg p-3 text-sm font-semibold",
                passed ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                       : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
              )}>
                {passed ? "🎉 축하합니다! 합격하셨어요." : `합격까지 ${test.pass_threshold - score}% 부족합니다. 다시 도전해보세요!`}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground">📋 문제별 결과</p>
              {result.answers.map((ans, i) => {
                const q = questions.find((qq) => qq.id === ans.question_id);
                return (
                  <div key={ans.question_id} className={cn("rounded-lg border p-2.5 text-xs", ans.is_correct ? "border-green-300 bg-green-50/50 dark:bg-green-950/10" : "border-red-300 bg-red-50/50 dark:bg-red-950/10")}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground">Q{i + 1}</span>
                      {ans.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{ans.category}</span>}
                      <span className={cn("text-[10px] font-bold ml-auto", ans.is_correct ? "text-green-600" : "text-red-600")}>
                        {ans.is_correct ? "정답" : "오답"}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground/80 mb-1">{ans.question}</p>
                    <p className="text-[10px] text-muted-foreground">
                      선택: {ans.picked >= 0 && q ? `${String.fromCharCode(65 + ans.picked)}. ${q.choices[ans.picked] ?? ""}` : "-"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      정답: {ans.correct >= 0 && q ? `${String.fromCharCode(65 + ans.correct)}. ${q.choices[ans.correct] ?? ""}` : "-"}
                    </p>
                    {ans.explanation && (
                      <p className="text-[10px] text-foreground/70 mt-1 pt-1 border-t border-border/50">💡 {ans.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <Button onClick={onClose} className="w-full">완료</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Attempt History Modal (instructor) ──────────────────────────────
function AttemptHistoryModal({
  test, attempts, studentName, onClose,
}: {
  test: LevelTest;
  attempts: Attempt[];
  studentName: string;
  onClose: () => void;
}) {
  const filtered = attempts; // already filtered by student in parent fetch

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">{studentName} · {test.title} 응시 이력</DialogTitle>
          <DialogDescription className="text-xs">총 {filtered.length}회 · 합격 기준 {test.pass_threshold}%</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">아직 응시 이력이 없습니다.</p>}
          {filtered.map((a) => (
            <details key={a.id} className="rounded-lg border border-border bg-card">
              <summary className="cursor-pointer px-3 py-2 flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{new Date(a.submitted_at).toLocaleString("ko-KR")}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">{a.correct_count}/{a.total_questions}</span>
                  <span className={cn("font-bold", a.passed ? "text-green-600" : "text-amber-600")}>{a.score}%</span>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded", a.passed ? "bg-green-100 text-green-700 dark:bg-green-950/40" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40")}>
                    {a.passed ? "통과" : "미통과"}
                  </span>
                </span>
              </summary>
              <div className="border-t border-border p-3 space-y-2 text-xs">
                {(a.answers ?? []).map((ans: any, i: number) => (
                  <div key={i} className={cn("rounded p-2", ans.is_correct ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20")}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground">Q{i + 1}</span>
                      {ans.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{ans.category}</span>}
                      <span className={cn("text-[10px] font-bold ml-auto", ans.is_correct ? "text-green-600" : "text-red-600")}>
                        {ans.is_correct ? "정답" : "오답"}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground/80">{ans.question}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      선택: {ans.picked >= 0 ? String.fromCharCode(65 + ans.picked) : "-"} · 정답: {String.fromCharCode(65 + ans.correct)}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
