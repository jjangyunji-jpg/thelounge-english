import { Sparkles, Target, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  studentName: string;
  level: string;
  currentPeriodLabel: string;
  currentTopics: string[];
  suggestedTopics: string[];
  suggestedGoals: string;
  onTopicsChange: (topics: string[]) => void;
  onGoalsChange: (goals: string) => void;
  onSaveTopics: () => void;
  onApplyGoals: () => void;
}

export default function SessionGoalsSuggestionView({
  studentName,
  level,
  currentPeriodLabel,
  currentTopics,
  suggestedTopics,
  suggestedGoals,
  onTopicsChange,
  onGoalsChange,
  onSaveTopics,
  onApplyGoals,
}: Props) {
  const maxRows = Math.max(currentTopics.length, suggestedTopics.length, 1);

  const updateTopic = (index: number, value: string) => {
    const newTopics = [...suggestedTopics];
    newTopics[index] = value;
    onTopicsChange(newTopics);
  };

  return (
    <div className="space-y-4">
      {/* AI Learning Goals */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <p className="text-sm font-semibold text-foreground">AI 추천 학습 목표</p>
        </div>
        <textarea
          value={suggestedGoals}
          onChange={(e) => onGoalsChange(e.target.value)}
          className="w-full h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          onClick={onApplyGoals}
          disabled={!suggestedGoals.trim()}
          size="sm"
          className="w-full bg-gold hover:bg-gold/90 text-foreground font-bold"
        >
          <Target className="w-3.5 h-3.5 mr-1.5" /> 학습 목표에 적용
        </Button>
      </div>

      {/* Session Topics */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-navy" />
          <p className="text-sm font-semibold text-foreground">수업 목표 설정</p>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-2 gap-3">
          <p className="text-xs font-medium text-muted-foreground text-center">
            {currentPeriodLabel} (이번 기간)
          </p>
          <p className="text-xs font-medium text-muted-foreground text-center">
            다음 기간
          </p>
        </div>

        {/* Rows */}
        <div className="space-y-1.5">
          {Array.from({ length: maxRows }).map((_, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 items-center">
              {/* Current period (read-only) */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                <input
                  readOnly
                  value={currentTopics[i] || "—"}
                  className="w-full text-xs px-2 py-1.5 rounded border border-border bg-muted/50 text-muted-foreground truncate"
                />
              </div>
              {/* Next period (editable) */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                <input
                  value={suggestedTopics[i] || ""}
                  onChange={(e) => updateTopic(i, e.target.value)}
                  placeholder={`${i + 1}회차 주제`}
                  className="w-full text-xs px-2 py-1.5 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={onSaveTopics}
          disabled={suggestedTopics.every(t => !t?.trim())}
          size="sm"
          className="w-full bg-navy hover:bg-navy-light text-primary-foreground font-bold"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" /> 수업 목표 저장
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        AI가 제안한 목표를 자유롭게 수정할 수 있습니다. '학습 목표'는 장기 목표에, '수업 목표'는 회차별 주제에 반영됩니다.
      </p>
    </div>
  );
}
