import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, Loader2, BookOpen, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface SynonymEntry {
  expression: string;
  type: "synonym" | "phrasal verb" | "idiom" | "slang";
  korean: string;
  level: string;
  example: string;
}

interface LookupResult {
  search_word?: string;
  korean_meaning: string;
  part_of_speech: string;
  example_sentence: string;
  synonyms: SynonymEntry[];
}

const TYPE_LABELS: Record<SynonymEntry["type"], { label: string; color: string }> = {
  synonym:        { label: "유의어",   color: "bg-navy/10 text-navy border-navy/20" },
  "phrasal verb": { label: "구동사",   color: "bg-gold/10 text-gold-dark border-gold/25" },
  idiom:          { label: "이디엄",   color: "bg-purple-100 text-purple-700 border-purple-200" },
  slang:          { label: "슬랭",     color: "bg-rose-100 text-rose-600 border-rose-200" },
};

interface WordLookupPanelProps {
  studentLevel?: string;
}

export default function WordLookupPanel({ studentLevel = "B1" }: WordLookupPanelProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [searchedWord, setSearchedWord] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async (word = query) => {
    const trimmed = word.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setResult(null);
    setSearchedWord(trimmed);

    try {
      const { data, error } = await supabase.functions.invoke("word-lookup", {
        body: { word: trimmed, level: studentLevel },
      });

      if (error) throw new Error(error.message);
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setResult(data);
    } catch {
      toast.error("단어 검색 실패. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }, [query, studentLevel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClear = () => {
    setQuery("");
    setResult(null);
    setSearchedWord("");
    inputRef.current?.focus();
  };

  const openNaverDict = (word?: string) => {
    const q = (word || query).trim();
    if (!q) return;
    window.open(
      `https://en.dict.naver.com/#/search?range=all&query=${encodeURIComponent(q)}`,
      "naverDict",
      "width=500,height=700,scrollbars=yes,resizable=yes"
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gold" />
          <span className="font-semibold text-sm text-foreground">단어 · 유의어 검색</span>
          <span className="text-xs text-muted-foreground">(강사 전용)</span>
        </div>
        <span className="text-xs bg-gold/15 text-gold-dark px-2 py-0.5 rounded-full font-medium border border-gold/25">
          {studentLevel} 레벨
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
        placeholder="단어 입력 (영어 또는 한국어)"
              className="pr-8 text-sm h-9"
            />
            {query && (
              <button
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => handleSearch()}
            disabled={isLoading || !query.trim()}
            className="gap-1.5 bg-navy hover:bg-navy-light text-primary-foreground h-9 px-3"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openNaverDict()}
            disabled={!query.trim()}
            className="h-9 px-2.5 text-xs gap-1"
            title="네이버 사전에서 검색"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">사전</span>
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-gold" />
            <span>AI가 단어를 분석 중입니다...</span>
          </div>
        )}

        {/* Result */}
        {result && !isLoading && (
          <div className="flex flex-col gap-3">
            {/* Word header */}
            <div className="rounded-lg bg-navy/5 border border-navy/15 px-3 py-2.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                {/* 한국어 검색 시 AI가 찾은 영어 단어 우선 표시 */}
                <span className="text-base font-bold text-foreground">
                  {result.search_word ?? searchedWord}
                </span>
                {result.search_word && result.search_word.toLowerCase() !== searchedWord.toLowerCase() && (
                  <span className="text-xs text-muted-foreground">← "{searchedWord}"</span>
                )}
                <span className="text-xs text-muted-foreground italic">{result.part_of_speech}</span>
              </div>
              <p className="text-sm font-semibold text-navy mt-0.5">{result.korean_meaning}</p>
              {result.example_sentence && (
                <p className="text-xs text-muted-foreground mt-1.5 italic leading-relaxed">
                  "{result.example_sentence}"
                </p>
              )}
            </div>

            {/* Synonyms list */}
            {result.synonyms && result.synonyms.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  유의 표현 · {result.synonyms.length}개
                </p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                  {result.synonyms.map((syn, i) => {
                    const typeStyle = TYPE_LABELS[syn.type] ?? TYPE_LABELS["synonym"];
                    return (
                      <div
                        key={i}
                        className="rounded-lg border border-border bg-muted/20 px-3 py-2 space-y-1"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{syn.expression}</span>
                          <span className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                            typeStyle.color
                          )}>
                            {typeStyle.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{syn.level}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{syn.korean}</p>
                        {syn.example && (
                          <p className="text-xs text-foreground/60 italic">"{syn.example}"</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!result && !isLoading && (
          <p className="text-xs text-muted-foreground text-center py-1 leading-relaxed">
            수업 중 나온 단어를 입력하면<br />한국어 뜻과 유의어를 즉시 확인할 수 있습니다
          </p>
        )}
      </div>
    </div>
  );
}
