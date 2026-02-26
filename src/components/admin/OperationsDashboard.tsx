import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap, DollarSign, TrendingUp, Activity, Mic, BookOpen,
  RefreshCw, AlertCircle, CheckCircle2, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Mock data (추후 실제 API로 교체 가능) ───────────────────────────────────
const THIS_MONTH = "2026년 2월";

const aiUsage = [
  {
    service: "단어·유의어 검색",
    model: "google/gemini-2.5-flash-lite",
    calls: 142,
    tokens: 113_600,
    estimatedKRW: 460,
    icon: BookOpen,
    color: "text-navy",
    bg: "bg-navy/8",
    status: "정상",
  },
  {
    service: "문장 교정 분석",
    model: "google/gemini-3-flash-preview",
    calls: 98,
    tokens: 78_400,
    estimatedKRW: 390,
    icon: RefreshCw,
    color: "text-gold-dark",
    bg: "bg-gold/8",
    status: "정상",
  },
  {
    service: "음성 변환 (STT)",
    model: "ElevenLabs Scribe",
    calls: 87,
    tokens: null,
    estimatedKRW: 0,
    icon: Mic,
    color: "text-success",
    bg: "bg-success/8",
    status: "정상",
    note: "무료 플랜 포함",
  },
];

const fixedCosts = [
  { label: "Lovable 플랜", amount: "Pro", unit: "월정액", krw: null, note: "프론트엔드·백엔드 호스팅" },
  { label: "Lovable AI 크레딧", amount: "사용량", unit: "월 기본 제공", krw: null, note: "무료 사용량 내 운영 중" },
  { label: "ElevenLabs STT", amount: "무료 플랜", unit: "월 10,000분", krw: 0, note: "현재 사용량: 약 43분" },
];

const monthlyLog = [
  { date: "2026-02-19", event: "단어 검색 모델 gemini-2.5-flash-lite로 최종 변경", type: "변경" },
  { date: "2026-02-18", event: "STT 패널 오류 수정 및 재배포", type: "수정" },
  { date: "2026-02-15", event: "단어·유의어 검색 기능 출시", type: "신규" },
  { date: "2026-02-10", event: "AI 문장 교정 기능 출시", type: "신규" },
  { date: "2026-02-01", event: "서비스 오픈 (The Lounge English v1.0)", type: "신규" },
];

const totalEstimatedKRW = aiUsage.reduce((sum, s) => sum + s.estimatedKRW, 0);

const typeColor: Record<string, string> = {
  신규: "bg-success/10 text-success border-success/20",
  변경: "bg-gold/10 text-gold-dark border-gold/25",
  수정: "bg-navy/10 text-navy border-navy/20",
};
// ────────────────────────────────────────────────────────────────────────────

export default function OperationsDashboard() {
  const [refreshed] = useState(new Date().toLocaleString("ko-KR"));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">운영 대시보드</h1>
          <p className="text-muted-foreground text-sm mt-1">{THIS_MONTH} 서비스 운영 비용 현황</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Clock className="w-3.5 h-3.5" />
          {refreshed} 기준
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card border-border">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-navy/8 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-navy" />
            </div>
            <p className="text-2xl font-bold text-foreground">{aiUsage.reduce((s, x) => s + x.calls, 0)}</p>
            <p className="text-muted-foreground text-xs mt-0.5">이번달 AI 호출</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-gold/8 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5 text-gold-dark" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {(aiUsage.reduce((s, x) => s + (x.tokens ?? 0), 0) / 1000).toFixed(0)}K
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">총 토큰 사용</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-success/8 flex items-center justify-center mb-3">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              ₩{totalEstimatedKRW.toLocaleString()}
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">AI 예상 사용료</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border">
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-lg bg-success/8 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <p className="text-2xl font-bold text-success">정상</p>
            <p className="text-muted-foreground text-xs mt-0.5">전체 서비스 상태</p>
          </CardContent>
        </Card>
      </div>

      {/* AI 서비스별 사용량 */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-gold" />
            AI 서비스별 사용량
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {aiUsage.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.service} className="flex items-center gap-4 p-3 rounded-lg bg-muted/40">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                    <Icon className={cn("w-4 h-4", item.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.service}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.model}</p>
                    {item.note && (
                      <p className="text-xs text-success mt-0.5">{item.note}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{item.calls}회</p>
                    {item.tokens && (
                      <p className="text-xs text-muted-foreground">
                        {(item.tokens / 1000).toFixed(0)}K 토큰
                      </p>
                    )}
                    <p className="text-xs font-medium text-navy">
                      {item.estimatedKRW > 0 ? `≈ ₩${item.estimatedKRW.toLocaleString()}` : "₩0"}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <span className="flex items-center gap-1 text-xs text-success font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {item.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 고정 운영 비용 */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gold" />
            인프라 · 플랜 비용
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {fixedCosts.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{item.amount}</p>
                  <p className="text-xs text-muted-foreground">{item.unit}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 이번달 AI 합계 */}
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">이번달 AI 사용료 합계</p>
              <p className="text-xs text-muted-foreground">추정치 · 실제 청구 기준 아님</p>
            </div>
            <p className="text-lg font-bold text-navy">≈ ₩{totalEstimatedKRW.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      {/* 변경 이력 */}
      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-gold" />
            이번달 운영 이력
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {monthlyLog.map((log, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">{log.date}</span>
                <span className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 mt-0.5",
                  typeColor[log.type]
                )}>
                  {log.type}
                </span>
                <p className="text-sm text-foreground leading-snug">{log.event}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 안내 */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
        <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          AI 사용료는 Lovable AI 게이트웨이 기준 추정치입니다. 정확한 청구액은 Lovable 설정 → 워크스페이스 → 사용량에서 확인하세요.
          ElevenLabs STT는 현재 무료 플랜 범위 내에서 운영 중입니다.
        </p>
      </div>
    </div>
  );
}
