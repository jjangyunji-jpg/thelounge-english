import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Trash2, Plus, Check, X, Pencil, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  level_test_id: string;
  category: string;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  is_active: boolean;
}

interface Attempt {
  id: string;
  student_name: string;
  score: number;
  passed: boolean;
  submitted_at: string;
  total_questions: number;
  correct_count: number;
}

export default function LevelTestManagement() {
  const { toast } = useToast();
  const [tests, setTests] = useState<LevelTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(30);
  const [focus, setFocus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Question>>({});
  const [tab, setTab] = useState<"questions" | "attempts">("questions");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("level_tests").select("*").order("level");
      setTests((data ?? []) as any);
      if (data && data.length > 0) setSelectedTestId(data[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedTestId) return;
    refresh();
  }, [selectedTestId]);

  const refresh = async () => {
    if (!selectedTestId) return;
    const [{ data: q }, { data: a }] = await Promise.all([
      supabase.from("level_test_questions").select("*").eq("level_test_id", selectedTestId).order("category").order("created_at"),
      supabase.from("level_test_attempts").select("*").eq("level_test_id", selectedTestId).order("submitted_at", { ascending: false }).limit(200),
    ]);
    setQuestions((q ?? []) as any);
    setAttempts((a ?? []) as any);
  };

  const selectedTest = tests.find((t) => t.id === selectedTestId);

  const handleGenerate = async () => {
    if (!selectedTest) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-level-test", {
        body: { level: selectedTest.level, count, focus },
      });
      if (error) throw error;
      const generated = (data?.questions ?? []) as any[];
      if (generated.length === 0) throw new Error("AI가 문제를 생성하지 못했습니다.");
      const rows = generated.map((q) => ({
        level_test_id: selectedTest.id,
        category: q.category ?? "",
        question: q.question,
        choices: q.choices,
        correct_index: q.correct_index,
        explanation: q.explanation ?? "",
      }));
      const { error: insErr } = await supabase.from("level_test_questions").insert(rows);
      if (insErr) throw insErr;
      toast({ title: `${rows.length}개 문제 생성 완료` });
      await refresh();
    } catch (e: any) {
      toast({ title: "생성 실패", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 문제를 삭제할까요?")) return;
    const { error } = await supabase.from("level_test_questions").delete().eq("id", id);
    if (error) toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    else refresh();
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setEditDraft({ ...q });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from("level_test_questions")
      .update({
        category: editDraft.category,
        question: editDraft.question,
        choices: editDraft.choices,
        correct_index: editDraft.correct_index,
        explanation: editDraft.explanation,
      })
      .eq("id", editingId);
    if (error) toast({ title: "수정 실패", description: error.message, variant: "destructive" });
    else {
      setEditingId(null);
      refresh();
    }
  };

  const updateTestField = async (field: keyof LevelTest, value: any) => {
    if (!selectedTest) return;
    const { error } = await supabase.from("level_tests").update({ [field]: value }).eq("id", selectedTest.id);
    if (!error) {
      setTests((prev) => prev.map((t) => (t.id === selectedTest.id ? { ...t, [field]: value } : t)));
    }
  };

  const categoryStats = questions.reduce<Record<string, number>>((acc, q) => {
    const k = q.category || "(미분류)";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">레벨 테스트</h1>
        <p className="text-xs text-muted-foreground mt-1">AI로 객관식 문제 풀을 생성·관리하고 응시 결과를 확인합니다.</p>
      </div>

      {/* Test selector */}
      <div className="flex flex-wrap gap-2">
        {tests.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTestId(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              selectedTestId === t.id
                ? "bg-gold text-accent-foreground border-gold"
                : "border-border text-foreground hover:bg-muted"
            }`}
          >
            {t.level} · {t.title}
          </button>
        ))}
      </div>

      {selectedTest && (
        <>
          {/* Test settings */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground">합격 기준 (%)</label>
                <Input
                  type="number"
                  value={selectedTest.pass_threshold}
                  onChange={(e) => updateTestField("pass_threshold", Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">응시당 출제 문항 수</label>
                <Input
                  type="number"
                  value={selectedTest.question_count}
                  onChange={(e) => updateTestField("question_count", Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">활성화</label>
                <select
                  value={selectedTest.is_active ? "1" : "0"}
                  onChange={(e) => updateTestField("is_active", e.target.value === "1")}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="1">활성</option>
                  <option value="0">비활성</option>
                </select>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              총 문제: <span className="font-semibold text-foreground">{questions.length}개</span> ·{" "}
              {Object.entries(categoryStats).map(([k, v]) => (
                <span key={k} className="mr-2">{k}: {v}</span>
              ))}
            </div>
          </div>

          {/* AI generate */}
          <div className="rounded-lg border border-gold/40 bg-gold/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold" />
              <span className="font-semibold text-sm">AI 문제 생성</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A1: 6개 시제(현재/현재진행/미래/과거/현재완료 경험·계속) 균형 출제, 작문·실사용 중심.
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-[11px] text-muted-foreground">생성 개수</label>
                <Input type="number" value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-8 w-24 text-sm" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] text-muted-foreground">추가 지시(선택)</label>
                <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="예: 카페·여행 상황 위주" className="h-8 text-sm" />
              </div>
              <Button onClick={handleGenerate} disabled={generating} size="sm" className="bg-gold text-accent-foreground hover:bg-gold/90 h-8 gap-1.5">
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                생성
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setTab("questions")}
              className={`px-3 py-2 text-sm font-medium ${tab === "questions" ? "border-b-2 border-gold text-foreground" : "text-muted-foreground"}`}
            >문제 풀 ({questions.length})</button>
            <button
              onClick={() => setTab("attempts")}
              className={`px-3 py-2 text-sm font-medium ${tab === "attempts" ? "border-b-2 border-gold text-foreground" : "text-muted-foreground"}`}
            >응시 이력 ({attempts.length})</button>
          </div>

          {/* Questions list */}
          {tab === "questions" && (
            <div className="space-y-2">
              {questions.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">아직 문제가 없습니다. 위에서 AI로 생성하세요.</p>
              )}
              {questions.map((q, idx) => {
                const isEditing = editingId === q.id;
                return (
                  <div key={q.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground">#{idx + 1}</span>
                        {isEditing ? (
                          <Input
                            value={editDraft.category ?? ""}
                            onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                            className="h-6 w-32 text-[11px]"
                          />
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{q.category || "(미분류)"}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} className="text-green-600 hover:text-green-700"><Save className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(q)} className="text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(q.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <Textarea
                        value={editDraft.question ?? ""}
                        onChange={(e) => setEditDraft((d) => ({ ...d, question: e.target.value }))}
                        className="text-sm h-16"
                      />
                    ) : (
                      <p className="text-sm text-foreground">{q.question}</p>
                    )}

                    <div className="space-y-1">
                      {(isEditing ? (editDraft.choices ?? q.choices) : q.choices).map((c, ci) => {
                        const isCorrect = (isEditing ? editDraft.correct_index : q.correct_index) === ci;
                        return (
                          <div key={ci} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${isCorrect ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900" : "bg-muted/50"}`}>
                            <button
                              type="button"
                              onClick={() => isEditing && setEditDraft((d) => ({ ...d, correct_index: ci }))}
                              disabled={!isEditing}
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${isCorrect ? "bg-green-500 border-green-500" : "border-muted-foreground"}`}
                            >
                              {isCorrect && <Check className="w-2.5 h-2.5 text-white" />}
                            </button>
                            {isEditing ? (
                              <Input
                                value={c}
                                onChange={(e) => {
                                  const next = [...(editDraft.choices ?? q.choices)];
                                  next[ci] = e.target.value;
                                  setEditDraft((d) => ({ ...d, choices: next }));
                                }}
                                className="h-6 text-xs flex-1"
                              />
                            ) : (
                              <span className="flex-1">{String.fromCharCode(65 + ci)}. {c}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {isEditing ? (
                      <Textarea
                        value={editDraft.explanation ?? ""}
                        onChange={(e) => setEditDraft((d) => ({ ...d, explanation: e.target.value }))}
                        placeholder="해설"
                        className="text-xs h-12"
                      />
                    ) : q.explanation ? (
                      <p className="text-[11px] text-muted-foreground italic">💡 {q.explanation}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* Attempts */}
          {tab === "attempts" && (
            <div className="space-y-1.5">
              {attempts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">아직 응시 이력이 없습니다.</p>
              )}
              {attempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-foreground truncate">{a.student_name}</span>
                    <span className="text-muted-foreground">{new Date(a.submitted_at).toLocaleString("ko-KR")}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-muted-foreground">{a.correct_count}/{a.total_questions}</span>
                    <span className={`font-bold ${a.passed ? "text-green-600" : "text-amber-600"}`}>{a.score}%</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${a.passed ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
                      {a.passed ? "통과" : "미통과"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
