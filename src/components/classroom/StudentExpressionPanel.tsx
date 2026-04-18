import { useEffect, useState } from "react";
import {
  BookMarked, Loader2, Sparkles, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, History, GraduationCap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ExpressionTestModal, { KeyExpressionItem } from "@/components/classroom/ExpressionTestModal";

interface ExpressionRow extends KeyExpressionItem {
  created_at: string;
  session_id: string | null;
}

interface TestResultRow {
  id: string;
  expression_id: string;
  is_correct: boolean;
  score: number;
  student_answer: string;
  ai_feedback: string | null;
  created_at: string;
}

// ── Flashcard Study View (한국어 → 영어) ──────────────────────────────────────
function StudyView({
  expressions, onClose,
}: { expressions: ExpressionRow[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [shuffled] = useState(() => [...expressions].sort(() => Math.random() - 0.5));
  const ex = shuffled[idx];
  if (!ex) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">{idx + 1} / {shuffled.length}</span>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">닫기</button>
        </div>
        <div className="p-6 text-center space-y-4 min-h-[220px] flex flex-col items-center justify-center">
          {ex.situation_label && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
              {ex.situation_label}
            </span>
          )}
          <p className="text-lg font-medium text-foreground">{ex.korean}</p>
          {showAnswer ? (
            <div className="space-y-1 pt-2 border-t border-border w-full">
              <p className="text-base font-semibold text-purple-600 pt-3">{ex.english}</p>
            </div>
          ) : (
            <button
              onClick={() => setShowAnswer(true)}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
            >
              영문장 보기
            </button>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-2">
          <Button size="sm" variant="outline"
            onClick={() => { setIdx((i) => Math.max(0, i - 1)); setShowAnswer(false); }}
            disabled={idx === 0} className="flex-1 text-xs"
          >
            이전
          </Button>
          <Button size="sm"
            onClick={() => {
              if (idx < shuffled.length - 1) { setIdx((i) => i + 1); setShowAnswer(false); }
              else onClose();
            }}
            className="flex-1 text-xs bg-purple-500 hover:bg-purple-600 text-white"
          >
            {idx === shuffled.length - 1 ? "완료" : "다음"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Single Expression Row ─────────────────────────────────────────────────────
function ExpressionRowItem({ ex }: { ex: ExpressionRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2.5 hover:bg-muted/30 transition-colors flex items-start gap-2"
      >
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {ex.situation_label && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
                {ex.situation_label}
              </span>
            )}
            <span className="text-sm font-medium text-foreground break-words">{ex.english}</span>
          </div>
          {open && (
            <p className="text-xs text-muted-foreground pt-1">{ex.korean}</p>
          )}
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
    </div>
  );
}

// ── Test History Detail ───────────────────────────────────────────────────────
function TestHistoryDetail({
  results, expressions, onClose,
}: { results: TestResultRow[]; expressions: ExpressionRow[]; onClose: () => void }) {
  const exMap = new Map(expressions.map((e) => [e.id, e]));
  const total = results.length;
  const correct = results.filter((r) => r.is_correct).length;
  const avg = total > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / total) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div>
            <p className="font-bold text-sm text-foreground">최근 테스트 기록</p>
            <p className="text-[10px] text-muted-foreground">정답 {correct}/{total} • 평균 {avg}점</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">아직 테스트 기록이 없습니다.</p>
          ) : results.map((r) => {
            const ex = exMap.get(r.expression_id);
            return (
              <div key={r.id} className={cn("rounded-lg p-3 border text-sm space-y-1",
                r.is_correct ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
              )}>
                <div className="flex items-center gap-2">
                  {r.is_correct
                    ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                  <span className="text-xs font-medium text-foreground line-clamp-1">
                    {ex?.korean ?? "(삭제된 표현)"}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{r.score}점</span>
                </div>
                <div className="pl-6 space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">
                    모범: <span className="font-medium text-foreground">{ex?.english ?? "-"}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    내 답: <span className="font-mono">{r.student_answer || "(미입력)"}</span>
                  </p>
                  {r.ai_feedback && (
                    <p className="text-[11px] text-muted-foreground italic">"{r.ai_feedback}"</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-border">
          <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white" size="sm" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function StudentExpressionPanel({
  studentName, sessionId,
}: { studentName: string; sessionId: string }) {
  const [expressions, setExpressions] = useState<ExpressionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [testOpen, setTestOpen] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [results, setResults] = useState<TestResultRow[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("key_expressions")
      .select("id, situation_label, english, korean, created_at, session_id")
      .eq("student_name", studentName)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    setExpressions((data ?? []) as ExpressionRow[]);
    setLoading(false);
  };

  const loadResults = async () => {
    if (expressions.length === 0) { setResults([]); return; }
    const ids = expressions.map((e) => e.id);
    const { data } = await supabase
      .from("key_expression_test_results")
      .select("id, expression_id, is_correct, score, student_answer, ai_feedback, created_at")
      .eq("student_name", studentName)
      .in("expression_id", ids)
      .order("created_at", { ascending: false })
      .limit(100);
    setResults((data ?? []) as TestResultRow[]);
  };

  useEffect(() => { load(); }, [studentName, sessionId]);
  useEffect(() => { if (!loading) loadResults(); }, [expressions]);

  const canTest = expressions.length >= 1;

  // 회차 수: 10분 이내 답변을 1회차로 그룹핑 (results는 created_at desc로 정렬됨)
  const sessionCount = (() => {
    if (results.length === 0) return 0;
    const sorted = [...results].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    let count = 1;
    let prev = new Date(sorted[0].created_at).getTime();
    const TEN_MIN = 10 * 60 * 1000;
    for (let i = 1; i < sorted.length; i++) {
      const curr = new Date(sorted[i].created_at).getTime();
      if (curr - prev > TEN_MIN) count++;
      prev = curr;
    }
    return count;
  })();

  // 표현별 최신 정답률: 표현마다 가장 최근 결과 1건만 집계
  const latestByExpression = new Map<string, TestResultRow>();
  for (const r of results) {
    // results는 desc 정렬이므로 첫 등장 = 최신
    if (!latestByExpression.has(r.expression_id)) {
      latestByExpression.set(r.expression_id, r);
    }
  }
  const attemptedCount = latestByExpression.size;
  const latestCorrect = Array.from(latestByExpression.values()).filter((r) => r.is_correct).length;

  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookMarked className="w-3.5 h-3.5 text-purple-500" />
            <span className="font-semibold text-xs text-foreground">핵심 표현</span>
            {!loading && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                {expressions.length}개
              </span>
            )}
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            title="테스트 기록"
          >
            <History className="w-3 h-3" />
            {completedTests}회
          </button>
        </div>

        {/* Action buttons */}
        {!loading && expressions.length > 0 && (
          <div className="px-3 py-2 border-b border-border bg-muted/10 flex gap-1.5">
            <Button
              size="sm" variant="outline"
              onClick={() => setStudyOpen(true)}
              className="flex-1 h-7 text-[11px] gap-1"
            >
              <GraduationCap className="w-3 h-3" />학습
            </Button>
            <Button
              size="sm"
              onClick={() => setTestOpen(true)}
              disabled={!canTest}
              className="flex-1 h-7 text-[11px] gap-1 bg-purple-500 hover:bg-purple-600 text-white"
            >
              <Sparkles className="w-3 h-3" />테스트
            </Button>
          </div>
        )}

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : expressions.length === 0 ? (
            <div className="text-center py-8 px-3 space-y-2">
              <BookMarked className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-xs text-muted-foreground">
                이 수업에서 발행된 표현이 아직 없습니다.
              </p>
            </div>
          ) : (
            expressions.map((ex) => <ExpressionRowItem key={ex.id} ex={ex} />)
          )}
        </div>
      </div>

      {studyOpen && (
        <StudyView expressions={expressions} onClose={() => setStudyOpen(false)} />
      )}

      <ExpressionTestModal
        open={testOpen}
        onClose={() => { setTestOpen(false); loadResults(); }}
        expressions={expressions.map((e) => ({
          id: e.id, situation_label: e.situation_label, english: e.english, korean: e.korean,
        }))}
        studentName={studentName}
      />

      {historyOpen && (
        <TestHistoryDetail
          results={results}
          expressions={expressions}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}
