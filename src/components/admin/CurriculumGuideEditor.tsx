import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, BookOpen, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

interface Guide {
  id: string;
  level: string;
  content: string;
  updated_at: string;
}

export default function CurriculumGuideEditor() {
  const { toast } = useToast();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState("A1");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadGuides();
  }, []);

  const loadGuides = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("curriculum_guides" as any)
      .select("*")
      .order("level");
    if (error) {
      toast({ title: "로드 실패", description: error.message, variant: "destructive" });
    } else {
      setGuides((data || []) as any);
      const first = (data || []).find((g: any) => g.level === activeLevel);
      if (first) setContent((first as any).content || "");
    }
    setLoading(false);
  };

  const selectLevel = (level: string) => {
    if (dirty) {
      if (!confirm("저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?")) return;
    }
    setActiveLevel(level);
    const guide = guides.find(g => g.level === level);
    setContent(guide?.content || "");
    setDirty(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const guide = guides.find(g => g.level === activeLevel);
    if (guide) {
      const { error } = await supabase
        .from("curriculum_guides" as any)
        .update({ content } as any)
        .eq("id", guide.id);
      if (error) {
        toast({ title: "저장 실패", description: error.message, variant: "destructive" });
      } else {
        toast({ title: `${activeLevel} 커리큘럼 가이드 저장됨 ✓` });
        setGuides(prev => prev.map(g => g.level === activeLevel ? { ...g, content, updated_at: new Date().toISOString() } : g));
        setDirty(false);
      }
    } else {
      // Insert if somehow missing
      const { error } = await supabase
        .from("curriculum_guides" as any)
        .insert({ level: activeLevel, content } as any);
      if (error) {
        toast({ title: "저장 실패", description: error.message, variant: "destructive" });
      } else {
        toast({ title: `${activeLevel} 커리큘럼 가이드 생성됨 ✓` });
        await loadGuides();
        setDirty(false);
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentGuide = guides.find(g => g.level === activeLevel);
  const hasContent = (g: Guide) => g.content.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-gold" />
            커리큘럼 가이드
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            레벨별 커리큘럼 로드맵을 작성하세요. AI 학습 목표 제안 시 참고됩니다.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="bg-gold hover:bg-gold/90 text-foreground font-bold gap-1.5"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          저장
        </Button>
      </div>

      {/* Level tabs */}
      <div className="flex gap-1.5">
        {LEVELS.map(level => {
          const guide = guides.find(g => g.level === level);
          const filled = guide && hasContent(guide);
          return (
            <button
              key={level}
              onClick={() => selectLevel(level)}
              className={cn(
                "relative px-4 py-2 rounded-lg text-sm font-bold transition-all",
                activeLevel === level
                  ? "bg-navy text-primary-foreground shadow-md"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {level}
              {filled && (
                <Check className="absolute -top-1 -right-1 w-3.5 h-3.5 text-emerald-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">{activeLevel} 레벨 가이드</span>
          {currentGuide?.updated_at && currentGuide.content.trim() && (
            <span className="text-[10px] text-muted-foreground">
              최종 수정: {new Date(currentGuide.updated_at).toLocaleDateString("ko-KR")}
            </span>
          )}
        </div>
        <textarea
          value={content}
          onChange={e => { setContent(e.target.value); setDirty(true); }}
          placeholder={`${activeLevel} 레벨 커리큘럼 가이드를 작성하세요.\n\n예시:\n[레벨 목표]\n기본 인사, 자기소개, 간단한 일상 표현을 이해하고 사용할 수 있는 수준.\n\n[모듈 진행 순서]\n1. a1_expression → 기초 표현 (인사, 리액션, 숫자)\n2. a1_조동사 → 기본 문법 패턴\n\n[모듈별 완료 기준]\n- expression: 기본 인사/리액션 표현을 대화에 자연스럽게 사용\n- 조동사: Can/Should/Will 등 기본 조동사 활용\n\n[다음 레벨 진입 조건]\n- 간단한 자기소개와 일상 질문에 1~2문장으로 답변 가능`}
          className="w-full min-h-[400px] p-4 text-sm bg-background resize-y focus:outline-none font-mono leading-relaxed"
        />
      </div>

      {/* Hint */}
      <div className="rounded-lg bg-muted/30 border border-border p-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          💡 <strong>작성 팁:</strong> AI가 학생의 수업 히스토리(사용한 자료, 주제)와 이 가이드를 함께 참고하여 다음 달 학습 목표를 제안합니다.
          레벨 목표, 모듈 진행 순서, 완료 기준, 다음 레벨 진입 조건 등을 포함하면 더 정확한 제안이 가능합니다.
        </p>
      </div>
    </div>
  );
}
