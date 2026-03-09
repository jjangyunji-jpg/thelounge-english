import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Survey {
  id: string;
  student_name: string;
  study_reason: string[] | null;
  study_goal: string | null;
  study_trigger: string | null;
  preferred_methods: string[] | null;
  past_methods: string | null;
  disliked_methods: string | null;
  interest_topics: string[] | null;
  english_usage_frequency: string | null;
  additional_note: string | null;
  completed_at: string | null;
  created_at: string;
}

const FREQ_LABELS: Record<string, string> = {
  daily: "거의 매일",
  weekly: "주 1~2회",
  monthly: "한 달에 몇 번",
  rarely: "거의 사용하지 않음",
};

export default function SurveyManagement() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("student_surveys")
        .select("*")
        .order("created_at", { ascending: false });
      setSurveys((data as Survey[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = surveys.filter((s) =>
    s.student_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">학생 설문 응답</h2>
        <span className="text-sm text-muted-foreground">{surveys.length}건</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="학생 이름 검색..."
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          {search ? "검색 결과가 없습니다." : "아직 설문 응답이 없습니다."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const isOpen = expandedId === s.id;
            return (
              <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isOpen ? null : s.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-foreground">{s.student_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    <Section title="🎯 영어 공부의 이유">
                      <Tags items={s.study_reason} />
                      <TextRow label="구체적 목표" value={s.study_goal} />
                      <TextRow label="시작 계기" value={s.study_trigger} />
                    </Section>

                    <Section title="📚 학습 선호도">
                      <Tags items={s.preferred_methods} />
                      <TextRow label="기존 학습 방식" value={s.past_methods} />
                      <TextRow label="싫어했던 방식" value={s.disliked_methods} />
                    </Section>

                    <Section title="🌍 관심 분야 및 현재 상황">
                      <Tags items={s.interest_topics} />
                      <TextRow label="영어 사용 빈도" value={s.english_usage_frequency ? FREQ_LABELS[s.english_usage_frequency] || s.english_usage_frequency : null} />
                      <TextRow label="추가 메모" value={s.additional_note} />
                    </Section>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="space-y-1.5 pl-1">{children}</div>
    </div>
  );
}

function Tags({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="px-2 py-0.5 bg-gold/10 text-foreground text-xs rounded-full border border-gold/30">
          {t}
        </span>
      ))}
    </div>
  );
}

function TextRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {value}
    </p>
  );
}
