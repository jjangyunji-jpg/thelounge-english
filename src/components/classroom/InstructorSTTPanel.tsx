import { useState, useCallback, useRef, useEffect } from "react";
import { useScribe } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Mic, MicOff, Sparkles, CheckCircle2, AlertCircle,
  Volume2, RotateCcw, BookOpen, Wand2, Loader2, Monitor
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

type AudioMode = "mic" | "system";

interface InstructorSTTPanelProps {
  disabled?: boolean;
  autoStart?: boolean; // 수업 시작 시 자동 녹음
}

export default function InstructorSTTPanel({
  disabled = false,
  autoStart = false,
}: InstructorSTTPanelProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<"all" | "correct" | "synonyms">("all");
  const [audioMode, setAudioMode] = useState<AudioMode>("system");
  const autoStartedRef = useRef(false);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    onPartialTranscript: () => {},
    onCommittedTranscript: () => {},
  });

  // ── 시스템 오디오: isConnected가 true가 된 후에 캡처 시작 ────────────────
  useEffect(() => {
    if (scribe.isConnected && audioMode === "system" && systemStreamRef.current) {
      const cleanup = startSystemAudioCapture(systemStreamRef.current, scribe.sendAudio);
      audioCleanupRef.current = cleanup;
    }
    if (!scribe.isConnected) {
      audioCleanupRef.current?.();
      audioCleanupRef.current = null;
    }
  }, [scribe.isConnected, audioMode, scribe.sendAudio]);

  // ── 연결 핵심 로직 ────────────────────────────────────────────────────────
  const connectWithStream = useCallback(async (stream: MediaStream) => {
    const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
    if (error || !data?.token) throw new Error("STT 토큰 발급 실패");

    // 시스템 오디오 stream 보관 (isConnected useEffect에서 사용)
    systemStreamRef.current = stream;

    await scribe.connect(
      audioMode === "mic"
        ? {
            token: data.token,
            commitStrategy: "vad" as any,
            microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          }
        : {
            token: data.token,
            commitStrategy: "vad" as any,
            audioFormat: "pcm_s16le" as any,
            sampleRate: 16000,
          }
    );

    // stream이 끊기면 자동 disconnect
    stream.getAudioTracks().forEach((t) => {
      t.onended = () => scribe.disconnect();
    });
  }, [scribe, audioMode]);

  // ── 마이크 녹음 시작 ──────────────────────────────────────────────────────
  const handleStart = useCallback(async (mode: AudioMode = audioMode) => {
    if (disabled) return;
    setIsConnecting(true);
    setAiResult(null);

    try {
      let stream: MediaStream;

      if (mode === "mic") {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        // 시스템 오디오: 브라우저 탭 or 화면 오디오 캡처
        try {
          stream = await (navigator.mediaDevices as any).getDisplayMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
            video: false, // 영상 불필요
          });
        } catch (e) {
          // getDisplayMedia는 video 없이 실패하는 브라우저가 있음 → video 포함 후 제거
          stream = await (navigator.mediaDevices as any).getDisplayMedia({
            audio: true,
            video: true,
          });
          // 비디오 트랙 즉시 중지
          stream.getVideoTracks().forEach((t: MediaStreamTrack) => {
            t.stop();
            stream.removeTrack(t);
          });
        }

        if (!stream.getAudioTracks().length) {
          throw new Error(
            "오디오 공유가 선택되지 않았습니다. 화면 공유 시 '오디오 공유' 체크박스를 선택해주세요."
          );
        }
      }

      await connectWithStream(stream);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "연결 실패";
      toast.error(msg);
    } finally {
      setIsConnecting(false);
    }
  }, [disabled, audioMode, connectWithStream]);

  // ── 자동 시작 (수업 시작 시) ──────────────────────────────────────────────
  useEffect(() => {
    if (autoStart && !disabled && !scribe.isConnected && !autoStartedRef.current) {
      autoStartedRef.current = true;
      handleStart(audioMode);
    }
    // disabled가 다시 true가 되면 reset
    if (disabled) autoStartedRef.current = false;
  }, [autoStart, disabled, scribe.isConnected, handleStart, audioMode]);

  const handleStop = useCallback(async () => {
    await scribe.disconnect();
  }, [scribe]);

  const handleAnalyze = useCallback(async (mode: "all" | "correct" | "synonyms") => {
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
    } catch {
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
              {audioMode === "system" ? "시스템 오디오 인식 중" : "녹음 중"}
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
        {/* Audio Mode Selector */}
        {!scribe.isConnected && (
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg self-start">
            <button
              onClick={() => setAudioMode("system")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                audioMode === "system"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Monitor className="w-3 h-3" />
              시스템 오디오
            </button>
            <button
              onClick={() => setAudioMode("mic")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                audioMode === "mic"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Mic className="w-3 h-3" />
              마이크
            </button>
          </div>
        )}

        {/* Mode description */}
        {!scribe.isConnected && !disabled && (
          <>
            {audioMode === "system" ? (
              <div className="rounded-lg bg-gold/8 border border-gold/30 px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-semibold text-gold-dark flex items-center gap-1.5">
                  ⚠️ 시스템 오디오 사용 전 필독
                </p>
                <ol className="text-xs text-foreground/80 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>캡처 시작 버튼을 누르면 화면 공유 팝업이 열립니다.</li>
                  <li>팝업에서 <span className="font-semibold text-foreground">Google Meet 탭</span>을 선택하세요.</li>
                  <li>반드시 <span className="font-semibold text-foreground">"탭의 오디오 공유"</span> 체크박스를 활성화하세요.</li>
                  <li>이 옵션이 없으면 학생 목소리가 캡처되지 않습니다.</li>
                </ol>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                마이크로 주변 소리를 녹음합니다. 이어폰 사용 시 학생 목소리가 잘 안 잡힐 수 있습니다.
              </p>
            )}
          </>
        )}

        {/* Mic controls */}
        <div className="flex items-center gap-2">
          {!scribe.isConnected ? (
            <Button
              size="sm"
              onClick={() => handleStart(audioMode)}
              disabled={isConnecting || disabled}
              className="gap-2 bg-navy hover:bg-navy-light text-primary-foreground text-xs h-8"
            >
              {isConnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : audioMode === "system" ? (
                <Monitor className="w-3.5 h-3.5" />
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
              {isConnecting
                ? "연결 중..."
                : autoStart && !disabled
                ? "자동 연결됨"
                : audioMode === "system"
                ? "오디오 캡처 시작"
                : "녹음 시작"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleStop}
              className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs h-8"
            >
              <MicOff className="w-3.5 h-3.5" />
              중지
            </Button>
          )}
          {disabled && (
            <span className="text-xs text-muted-foreground">수업 시작 후 사용 가능</span>
          )}
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

            {aiResult.corrected && (
              <div className="rounded-lg bg-success/5 border border-success/20 px-3 py-2">
                <p className="text-xs font-medium text-success mb-1">✓ 교정된 문장</p>
                <p className="text-sm text-foreground">{aiResult.corrected}</p>
              </div>
            )}

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
        {!scribe.isConnected && !hasTranscript && !isConnecting && !disabled && (
          <p className="text-xs text-muted-foreground text-center py-1">
            {autoStart ? "수업이 시작되면 자동으로 오디오 캡처가 시작됩니다" : "캡처를 시작하면 학생의 영어 발화를 실시간으로 텍스트로 변환합니다"}
          </p>
        )}
      </div>
    </div>
  );
}

// ── 시스템 오디오 → PCM → Scribe 수동 전송 ──────────────────────────────────
function startSystemAudioCapture(
  stream: MediaStream,
  sendAudio: (base64: string) => void
): () => void {
  try {
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    const source = audioCtx.createMediaStreamSource(stream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    let active = true;

    processor.onaudioprocess = (e) => {
      if (!active) return;
      const float32 = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
      }
      // base64로 변환 후 전송
      const bytes = new Uint8Array(int16.buffer);
      let binary = "";
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      const base64 = btoa(binary);
      sendAudio(base64);
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);

    // cleanup 함수 반환
    return () => {
      active = false;
      processor.disconnect();
      source.disconnect();
      audioCtx.close();
    };
  } catch (err) {
    console.error("System audio capture error:", err);
    toast.error("시스템 오디오 캡처 실패. 마이크 모드를 사용해주세요.");
    return () => {};
  }
}
