import { useState } from "react";
import { BookOpen, ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface StudentSurveyProps {
  studentName: string;
  onComplete: () => void;
}

const STUDY_REASONS = [
  "업무/비즈니스",
  "해외 여행",
  "유학/이민 준비",
  "자기 개발",
  "시험 준비 (토익, 토플 등)",
  "외국인 친구/연인과 소통",
  "영화/드라마/콘텐츠 이해",
  "기타",
];

const PREFERRED_METHODS = [
  "자유로운 프리토킹",
  "교재/커리큘럼 기반 수업",
  "뉴스/기사 토론",
  "롤플레이/상황극",
  "문법 중심 학습",
  "어휘/표현 확장",
  "발음/억양 교정",
  "쓰기(에세이/일기) 첨삭",
  "영상/팟캐스트 활용",
];

const INTEREST_TOPICS = [
  "일상 생활/소소한 대화",
  "비즈니스/경제",
  "여행/문화",
  "엔터테인먼트 (영화/음악/드라마)",
  "기술/IT",
  "건강/운동",
  "음식/요리",
  "시사/사회 이슈",
  "예술/디자인",
  "스포츠",
];

const USAGE_FREQUENCY = [
  { value: "daily", label: "거의 매일" },
  { value: "weekly", label: "주 1~2회" },
  { value: "monthly", label: "한 달에 몇 번" },
  { value: "rarely", label: "거의 사용하지 않음" },
];

const SECTIONS = [
  { id: 0, title: "영어 공부의 이유와 목적", emoji: "🎯" },
  { id: 1, title: "학습 선호도", emoji: "📚" },
  { id: 2, title: "관심 분야 및 현재 상황", emoji: "🌍" },
];

export default function StudentSurvey({ studentName, onComplete }: StudentSurveyProps) {
  const { toast } = useToast();
  const [section, setSection] = useState(0);
  const [saving, setSaving] = useState(false);

  // Section 1
  const [studyReason, setStudyReason] = useState<string[]>([]);
  const [studyGoal, setStudyGoal] = useState("");
  const [studyTrigger, setStudyTrigger] = useState("");

  // Section 2
  const [preferredMethods, setPreferredMethods] = useState<string[]>([]);
  const [pastMethods, setPastMethods] = useState("");
  const [dislikedMethods, setDislikedMethods] = useState("");

  // Section 3
  const [interestTopics, setInterestTopics] = useState<string[]>([]);
  const [usageFrequency, setUsageFrequency] = useState("");
  const [additionalNote, setAdditionalNote] = useState("");

  const toggleArrayItem = (arr: string[], item: string, setter: (v: string[]) => void) => {
    setter(arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item]);
  };

  const canProceed = () => {
    if (section === 0) return studyReason.length > 0;
    if (section === 1) return preferredMethods.length > 0;
    if (section === 2) return interestTopics.length > 0 && usageFrequency !== "";
    return true;
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("로그인이 필요합니다.");

      const { error } = await supabase.from("student_surveys").insert({
        user_id: session.user.id,
        student_name: studentName,
        study_reason: studyReason,
        study_goal: studyGoal.trim() || null,
        study_trigger: studyTrigger.trim() || null,
        preferred_methods: preferredMethods,
        past_methods: pastMethods.trim() || null,
        disliked_methods: dislikedMethods.trim() || null,
        interest_topics: interestTopics,
        english_usage_frequency: usageFrequency || null,
        additional_note: additionalNote.trim() || null,
        completed_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({ title: "설문이 완료되었습니다! 감사합니다 😊" });
      onComplete();
    } catch (e: unknown) {
      toast({
        title: "저장 실패",
        description: e instanceof Error ? e.message : "다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderCheckboxGrid = (
    options: string[],
    selected: string[],
    setter: (v: string[]) => void,
    columns: number = 2
  ) => (
    <div className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {options.map((opt) => (
        <label
          key={opt}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm cursor-pointer transition-all",
            selected.includes(opt)
              ? "border-gold bg-gold/10 text-foreground font-medium"
              : "border-border text-muted-foreground hover:bg-muted/50"
          )}
        >
          <Checkbox
            checked={selected.includes(opt)}
            onCheckedChange={() => toggleArrayItem(selected, opt, setter)}
          />
          {opt}
        </label>
      ))}
    </div>
  );

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center shadow-gold mx-auto mb-3">
          <BookOpen className="w-7 h-7 text-accent-foreground" />
        </div>
        <h1 className="text-lg font-bold text-foreground">{studentName}님, 반갑습니다!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          맞춤형 수업을 위해 몇 가지 질문에 답해주세요
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {SECTIONS.map((s, i) => (
          <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-full h-1.5 rounded-full transition-colors",
                i <= section ? "bg-gold" : "bg-muted"
              )}
            />
            <span className={cn(
              "text-[10px] transition-colors",
              i <= section ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {s.emoji} {s.title}
            </span>
          </div>
        ))}
      </div>

      {/* Section Content */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
        {section === 0 && (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                영어를 공부하는 이유는 무엇인가요? <span className="text-gold">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">복수 선택 가능</p>
              {renderCheckboxGrid(STUDY_REASONS, studyReason, setStudyReason)}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                영어 공부를 통해 이루고 싶은 구체적인 목표가 있나요?
              </Label>
              <Textarea
                value={studyGoal}
                onChange={(e) => setStudyGoal(e.target.value)}
                placeholder="예: 해외 출장에서 영어로 프레젠테이션하기, 원어민과 자연스럽게 대화하기"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                영어 공부를 시작하게 된 계기가 있나요?
              </Label>
              <Textarea
                value={studyTrigger}
                onChange={(e) => setStudyTrigger(e.target.value)}
                placeholder="예: 최근 해외 여행에서 소통이 안 돼서, 회사에서 영어 사용 기회가 늘어서"
                rows={3}
              />
            </div>
          </>
        )}

        {section === 1 && (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                어떤 학습 방식을 좋아하시나요? <span className="text-gold">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">복수 선택 가능</p>
              {renderCheckboxGrid(PREFERRED_METHODS, preferredMethods, setPreferredMethods)}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                기존에 영어를 공부했던 방식이 있다면 알려주세요
              </Label>
              <Textarea
                value={pastMethods}
                onChange={(e) => setPastMethods(e.target.value)}
                placeholder="예: 학원 그룹 수업, 전화영어, 독학(유튜브), 1:1 과외 등"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                이전 학습에서 싫어했거나 효과 없었던 방식이 있나요?
              </Label>
              <Textarea
                value={dislikedMethods}
                onChange={(e) => setDislikedMethods(e.target.value)}
                placeholder="예: 문법만 반복하는 수업, 교재 읽기만 하는 수업, 숙제가 너무 많은 방식"
                rows={3}
              />
            </div>
          </>
        )}

        {section === 2 && (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                관심 있는 대화 주제를 골라주세요 <span className="text-gold">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">복수 선택 가능</p>
              {renderCheckboxGrid(INTEREST_TOPICS, interestTopics, setInterestTopics)}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                현재 일상에서 영어를 얼마나 사용하시나요? <span className="text-gold">*</span>
              </Label>
              <RadioGroup value={usageFrequency} onValueChange={setUsageFrequency} className="space-y-2">
                {USAGE_FREQUENCY.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm cursor-pointer transition-all",
                      usageFrequency === opt.value
                        ? "border-gold bg-gold/10 text-foreground font-medium"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value={opt.value} />
                    {opt.label}
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                추가로 전달하고 싶은 내용이 있으면 자유롭게 적어주세요
              </Label>
              <Textarea
                value={additionalNote}
                onChange={(e) => setAdditionalNote(e.target.value)}
                placeholder="수업에 대한 기대, 걱정, 궁금한 점 등 무엇이든 좋습니다"
                rows={3}
              />
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-5">
        <Button
          variant="outline"
          onClick={() => setSection((s) => s - 1)}
          disabled={section === 0}
          className="gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          이전
        </Button>

        {section < 2 ? (
          <Button
            onClick={() => setSection((s) => s + 1)}
            disabled={!canProceed()}
            className="gap-1.5 gold-gradient text-accent-foreground font-bold shadow-gold"
          >
            다음
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canProceed() || saving}
            className="gap-1.5 gold-gradient text-accent-foreground font-bold shadow-gold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            설문 완료
          </Button>
        )}
      </div>
    </div>
  );
}
