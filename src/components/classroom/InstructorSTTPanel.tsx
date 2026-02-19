import { useState, useCallback, useRef } from "react";
import { useScribe } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Mic, MicOff, Sparkles, CheckCircle2, AlertCircle,
  Volume2, RotateCcw, BookOpen, Wand2, Loader2
} from "lucide-react";
import { toast } from "sonner";

interface ErrorItem {
  original: string;
  corrected: string;
  explanation: string;
}

interface SynonymItem {
  word: string;
  alternatives: string[];
  example?: string;
}

interface AIResult {
  corrected?: string;
  errors?: ErrorItem[];
  synonyms?: SynonymItem[];
  score?: number;
  feedback?: string;
}

interface InstructorSTTPanelProps {
  disabled?: boolean;
}

export default function InstructorSTTPanel({ disabled = false }: InstructorSTTPanelProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<"all" | "correct" | "synonyms">("all");
  const lastCommittedRef = useRef("");

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    onPartialTranscript: () => {},
    onCommittedTranscript: (data) => {
      lastCommittedRef.current = data.text;
    },
  });

  const handleStart = useCallback(async () => {
    if (disabled) return;
    setIsConnecting(true);
    setAiResult(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) {
        throw new Error("STT 토큰 발급 실패");
      }

      await scribe.connect({
        token: data.token,
        commitStrategy: "vad" as any,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "연결 실패";
      toast.error(msg);
    } finally {
      setIsConnecting(false);
    }
  }, [scribe, disabled]);

  const handleStop = useCallback(async () => {
    await scribe.disconnect();
  }, [scribe]);

  const handleAnalyze = useCallback(async (mode: "all" | "correct" | "synonyms") => {
    // Combine all committed transcripts
    const fullText = scribe.committedTranscripts.map((t) => t.text).join(" ").trim();
    if (!fullText) {
      toast.error("분석할 텍스트가 없습니다");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisMode(mode);
    setAiResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-correct", {
        body: { text: fullText, mode },
      });

      if (error) throw new Error(error.message);
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setAiResult(data);
    } catch (err) {
      toast.error("AI 분석 실패. 잠시 후 다시 시도하세요.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [scribe.committedTranscripts]);

  const handleReset = useCallback(() => {
    scribe.disconnect();
    setAiResult(null);
  }, [scribe]);

  const fullTranscript = scribe.committedTranscripts.map((t) => t.text).join(" ");
  const hasTranscript = fullTranscript.trim().length > 0;

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-gold" />
          <span className="font-semibold text-sm text-foreground">실시간 STT · AI 교정</span>
          <span className="text-xs text-muted-foreground">(강사 전용)</span>
          {scribe.isConnected && (
            <span className="flex items-center gap-1 text-xs text-success">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              녹음 중
            </span>
          )}
        </div>
        {hasTranscript && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="h-6 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            초기화
          </Button>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Mic controls */}
        <div className="flex items-center gap-2">
          {!scribe.isConnected ? (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={isConnecting || disabled}
              className="gap-2 bg-navy hover:bg-navy-light text-primary-foreground text-xs h-8"
            >
              {isConnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
              {isConnecting ? "연결 중..." : "녹음 시작"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleStop}
              className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs h-8"
            >
              <MicOff className="w-3.5 h-3.5" />
              녹음 중지
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {disabled ? "수업 시작 후 사용 가능" : "학생이 말하는 동안 녹음하세요"}
          </span>
        </div>

        {/* Live partial transcript */}
        {scribe.isConnected && scribe.partialTranscript && (
          <div className="rounded-lg bg-gold/5 border border-gold/20 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Volume2 className="w-3 h-3 text-gold animate-pulse" />
              <span className="text-xs text-gold-dark font-medium">실시간 인식 중...</span>
            </div>
            <p className="text-sm text-foreground/80 italic">{scribe.partialTranscript}</p>
          </div>
        )}

        {/* Committed transcripts */}
        {hasTranscript && (
          <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 max-h-32 overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-1 font-medium">인식된 텍스트</p>
            <p className="text-sm text-foreground leading-relaxed">{fullTranscript}</p>
          </div>
        )}

        {/* AI Analysis buttons */}
        {hasTranscript && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => handleAnalyze("all")}
              disabled={isAnalyzing}
              className="gap-1.5 bg-navy hover:bg-navy-light text-primary-foreground text-xs h-7"
            >
              {isAnalyzing && analysisMode === "all" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
              전체 분석
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAnalyze("correct")}
              disabled={isAnalyzing}
              className="gap-1.5 text-xs h-7 border-navy/30 text-navy hover:bg-navy/5"
            >
              {isAnalyzing && analysisMode === "correct" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              문법 교정
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAnalyze("synonyms")}
              disabled={isAnalyzing}
              className="gap-1.5 text-xs h-7 border-gold/40 text-gold-dark hover:bg-gold/5"
            >
              {isAnalyzing && analysisMode === "synonyms" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <BookOpen className="w-3 h-3" />
              )}
              유의어 제안
            </Button>
          </div>
        )}

        {/* AI Result */}
        {isAnalyzing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Sparkles className="w-4 h-4 text-gold animate-pulse" />
            AI가 분석 중입니다...
          </div>
        )}

        {aiResult && !isAnalyzing && (
          <div className="space-y-3">
            {/* Score + feedback */}
            {aiResult.score !== undefined && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-navy/5 border border-navy/15">
                <div className="text-center">
                  <div className={cn(
                    "text-xl font-bold",
                    aiResult.score >= 8 ? "text-success" : aiResult.score >= 5 ? "text-gold-dark" : "text-destructive"
                  )}>
                    {aiResult.score}/10
                  </div>
                  <div className="text-xs text-muted-foreground">자연성</div>
                </div>
                {aiResult.feedback && (
                  <p className="text-sm text-foreground flex-1">{aiResult.feedback}</p>
                )}
              </div>
            )}

            {/* Corrected version */}
            {aiResult.corrected && (
              <div className="rounded-lg bg-success/5 border border-success/20 px-3 py-2">
                <p className="text-xs font-medium text-success mb-1">✓ 교정된 문장</p>
                <p className="text-sm text-foreground">{aiResult.corrected}</p>
              </div>
            )}

            {/* Errors */}
            {aiResult.errors && aiResult.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-destructive" />
                  교정 포인트 ({aiResult.errors.length}건)
                </p>
                {aiResult.errors.map((err, i) => (
                  <div key={i} className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="line-through text-destructive/70">"{err.original}"</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium text-success">"{err.corrected}"</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{err.explanation}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Synonyms */}
            {aiResult.synonyms && aiResult.synonyms.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-gold" />
                  유의어 제안
                </p>
                {aiResult.synonyms.map((syn, i) => (
                  <div key={i} className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gold-dark">"{syn.word}"</span>
                      <span className="text-muted-foreground text-xs">→</span>
                      <div className="flex flex-wrap gap-1.5">
                        {syn.alternatives.map((alt, j) => (
                          <span key={j} className="px-2 py-0.5 rounded-full bg-gold/15 text-gold-dark text-xs font-medium border border-gold/25">
                            {alt}
                          </span>
                        ))}
                      </div>
                    </div>
                    {syn.example && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{syn.example}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!scribe.isConnected && !hasTranscript && !isConnecting && (
          <p className="text-xs text-muted-foreground text-center py-2">
            녹음을 시작하면 학생의 영어 발화를 실시간으로 텍스트로 변환합니다
          </p>
        )}
      </div>
    </div>
  );
}
