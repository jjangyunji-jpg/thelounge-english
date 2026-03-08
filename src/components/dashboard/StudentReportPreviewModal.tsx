import { useState } from "react";
import { Loader2, FileText, Sparkles, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StudentInfo {
  student_name: string;
  level: string | null;
  learning_objective: string | null;
}

interface Props {
  instructorName: string;
  students: StudentInfo[];
  periodId: string;
  periodLabel: string;
  periodStartDate?: string;
  periodEndDate?: string;
  onComplete: () => void;
  onClose: () => void;
}

export default function StudentReportPreviewModal({
  instructorName,
  students,
  periodId,
  periodLabel,
  periodStartDate,
  periodEndDate,
  onComplete,
  onClose,
}: Props) {
  const { toast } = useToast();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [reports, setReports] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState<Set<string>>(new Set());

  const student = students[currentIdx];
  const report = reports[student.student_name] || "";

  const generateReport = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-student-report", {
        body: {
          student_name: student.student_name,
          instructor_name: instructorName,
          period_id: periodId,
          period_label: periodLabel,
          period_start: periodStartDate,
          period_end: periodEndDate,
          save: false,
        },
      });
      if (error) throw error;
      const content = data?.report || "";
      setReports((prev) => ({ ...prev, [student.student_name]: content }));
      setGenerated((prev) => new Set(prev).add(student.student_name));
    } catch (e: any) {
      toast({ title: "리포트 생성 실패", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const saveReport = async (studentName: string): Promise<boolean> => {
    const content = reports[studentName]?.trim();
    if (!content) return true; // skip empty

    const { error } = await supabase.from("student_reports" as any).upsert(
      {
        instructor_name: instructorName,
        student_name: studentName,
        period_id: periodId,
        period_label: periodLabel,
        content,
        is_read: false,
      } as any,
      { onConflict: "instructor_name,student_name,period_id" }
    );

    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: `${studentName} 리포트 저장됨 ✓` });
    return true;
  };

  const handleNext = async () => {
    setSaving(true);
    const saved = await saveReport(student.student_name);
    setSaving(false);
    if (saved) {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    const saved = await saveReport(student.student_name);
    setSaving(false);
    if (saved) onComplete();
  };

  const handleSkipAll = () => {
    onComplete();
  };

  const totalSteps = students.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy to-navy-light p-5">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-gold" />
            <span className="text-[10px] font-bold text-gold uppercase tracking-widest">학생 리포트</span>
          </div>
          <p className="text-primary-foreground font-bold text-lg">{periodLabel} 학습 리포트</p>
          <p className="text-primary-foreground/70 text-xs mt-1">
            {student.student_name} ({currentIdx + 1}/{totalSteps})
          </p>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4">
          <div className="flex gap-1">
            {students.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${i <= currentIdx ? "bg-gold" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span className="font-semibold">레벨:</span> {student.level || "B1"}
            </div>
            {student.learning_objective && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="font-semibold flex-shrink-0">학습 목표:</span>
                <span className="line-clamp-2">{student.learning_objective}</span>
              </div>
            )}
          </div>

          {!generated.has(student.student_name) ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-14 h-14 rounded-xl bg-navy/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-navy" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">AI 리포트 생성</p>
                <p className="text-xs text-muted-foreground mt-1">
                  수업 이력을 기반으로 학생에게 전달할<br />월간 학습 리포트를 자동 생성합니다.
                </p>
              </div>
              <Button
                onClick={generateReport}
                disabled={generating}
                className="bg-navy hover:bg-navy-light text-primary-foreground gap-1.5"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {generating ? "생성 중..." : "리포트 생성하기"}
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                리포트 내용 <span className="font-normal">(수정 가능)</span>
              </p>
              <textarea
                value={report}
                onChange={(e) =>
                  setReports((prev) => ({ ...prev, [student.student_name]: e.target.value }))
                }
                className="w-full h-48 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
              />
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateReport}
                  disabled={generating}
                  className="gap-1 text-xs"
                >
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  다시 생성
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <Button variant="ghost" onClick={handleSkipAll} className="text-muted-foreground text-xs">
            건너뛰기
          </Button>
          <div className="flex-1" />
          {currentIdx > 0 && (
            <Button variant="outline" onClick={() => setCurrentIdx((i) => i - 1)}>
              이전
            </Button>
          )}
          {currentIdx < totalSteps - 1 ? (
            <Button
              onClick={handleNext}
              disabled={saving || !generated.has(student.student_name)}
              className="bg-navy hover:bg-navy-light text-primary-foreground gap-1"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              저장 & 다음
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={saving || !generated.has(student.student_name)}
              className="bg-gold hover:bg-gold/90 text-foreground font-bold gap-1"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Check className="w-3.5 h-3.5" />
              저장 완료
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
