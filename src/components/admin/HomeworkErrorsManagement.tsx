import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock, Filter, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogRow {
  id: string;
  created_at: string;
  event_type: string;
  stage: string;
  student_name: string | null;
  assignment_id: string | null;
  assignment_type: string | null;
  submission_id: string | null;
  error_message: string | null;
  error_code: string | null;
  context: Record<string, unknown> | null;
  source: string | null;
}

const EVENT_LABEL: Record<string, string> = {
  autosave: "자동저장",
  draft_save: "임시저장",
  submit: "제출",
  storage_audio_upload: "음성 업로드",
  storage_file_upload: "파일 업로드",
  prefill: "초기 로드",
};

const STAGE_BADGE: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  attempt: { label: "시도", cls: "bg-muted text-muted-foreground", Icon: Clock },
  success: { label: "성공", cls: "bg-success/15 text-success", Icon: CheckCircle2 },
  error: { label: "오류", cls: "bg-destructive/15 text-destructive", Icon: AlertCircle },
};

const RANGES = [
  { value: "1h", label: "최근 1시간", hours: 1 },
  { value: "24h", label: "최근 24시간", hours: 24 },
  { value: "7d", label: "최근 7일", hours: 24 * 7 },
  { value: "30d", label: "최근 30일", hours: 24 * 30 },
];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function HomeworkErrorsManagement() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>("24h");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = async () => {
    setLoading(true);
    const hours = RANGES.find((r) => r.value === range)?.hours ?? 24;
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const { data, error } = await supabase
      .from("homework_event_logs")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (!error && data) setLogs(data as LogRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  // Realtime subscription
  useEffect(() => {
    if (!autoRefresh) return;
    const channel = supabase
      .channel("homework_event_logs_admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "homework_event_logs" }, (payload) => {
        setLogs((prev) => [payload.new as LogRow, ...prev].slice(0, 1000));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [autoRefresh]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (eventFilter !== "all" && l.event_type !== eventFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${l.student_name ?? ""} ${l.error_message ?? ""} ${l.assignment_type ?? ""} ${l.source ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, stageFilter, eventFilter, search]);

  const stats = useMemo(() => {
    const total = logs.length;
    const errors = logs.filter((l) => l.stage === "error").length;
    const success = logs.filter((l) => l.stage === "success").length;
    const attempts = logs.filter((l) => l.stage === "attempt").length;
    const submitAttempts = logs.filter((l) => (l.event_type === "submit" || l.event_type === "draft_save") && l.stage === "attempt").length;
    const submitErrors = logs.filter((l) => (l.event_type === "submit" || l.event_type === "draft_save") && l.stage === "error").length;
    const rate = submitAttempts > 0 ? Math.round((1 - submitErrors / submitAttempts) * 100) : 100;
    const affectedStudents = new Set(logs.filter((l) => l.stage === "error").map((l) => l.student_name).filter(Boolean)).size;
    return { total, errors, success, attempts, rate, affectedStudents };
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">숙제 제출 오류 추적</h1>
          <p className="text-xs text-muted-foreground mt-1">학생 측 일기·숙제 제출/저장 이벤트를 실시간으로 모니터링합니다 (30일 보관)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
            className="gap-1.5"
          >
            <Activity className="w-3.5 h-3.5" />
            {autoRefresh ? "실시간 ON" : "실시간 OFF"}
          </Button>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            새로고침
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">총 이벤트</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">오류</p>
          <p className="text-2xl font-bold text-destructive mt-1">{stats.errors}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">성공</p>
          <p className="text-2xl font-bold text-success mt-1">{stats.success}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">제출 성공률</p>
          <p className={cn("text-2xl font-bold mt-1", stats.rate >= 95 ? "text-success" : stats.rate >= 80 ? "text-gold" : "text-destructive")}>{stats.rate}%</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">영향 받은 학생</p>
          <p className="text-2xl font-bold mt-1">{stats.affectedStudents}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 단계</SelectItem>
            <SelectItem value="attempt">시도</SelectItem>
            <SelectItem value="success">성공</SelectItem>
            <SelectItem value="error">오류</SelectItem>
          </SelectContent>
        </Select>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 이벤트</SelectItem>
            {Object.entries(EVENT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          placeholder="학생명/오류메시지 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length}건 표시</span>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">표시할 이벤트가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left p-2 font-medium">시각</th>
                  <th className="text-left p-2 font-medium">단계</th>
                  <th className="text-left p-2 font-medium">이벤트</th>
                  <th className="text-left p-2 font-medium">학생</th>
                  <th className="text-left p-2 font-medium">숙제 타입</th>
                  <th className="text-left p-2 font-medium">오류 메시지</th>
                  <th className="text-left p-2 font-medium">출처</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const stage = STAGE_BADGE[l.stage] ?? STAGE_BADGE.attempt;
                  const SIcon = stage.Icon;
                  return (
                    <tr key={l.id} className={cn("border-t border-border hover:bg-muted/30", l.stage === "error" && "bg-destructive/5")}>
                      <td className="p-2 whitespace-nowrap font-mono text-[11px]">{fmtTime(l.created_at)}</td>
                      <td className="p-2">
                        <Badge className={cn("gap-1", stage.cls)} variant="secondary">
                          <SIcon className="w-3 h-3" />
                          {stage.label}
                        </Badge>
                      </td>
                      <td className="p-2">{EVENT_LABEL[l.event_type] ?? l.event_type}</td>
                      <td className="p-2 font-medium">{l.student_name ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{l.assignment_type ?? "—"}</td>
                      <td className="p-2 max-w-[360px]">
                        {l.error_message ? (
                          <span className="text-destructive break-words" title={l.error_message}>
                            {l.error_code ? `[${l.error_code}] ` : ""}{l.error_message}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="p-2 text-muted-foreground">{l.source ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
