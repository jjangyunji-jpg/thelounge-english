import { useEffect, useMemo, useState, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock, Filter, Activity, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LogRow {
  id: string;
  created_at: string;
  category: string;
  source_type: string;
  function_name: string | null;
  event_type: string;
  stage: string;
  student_name: string | null;
  assignment_id: string | null;
  assignment_type: string | null;
  submission_id: string | null;
  error_message: string | null;
  error_code: string | null;
  pg_details: string | null;
  pg_hint: string | null;
  stack: string | null;
  http_status: number | null;
  context: Record<string, unknown> | null;
  source: string | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  homework: "숙제",
  classroom: "수업노트",
  scheduling: "일정",
  payment: "결제",
  auth: "인증",
  admin: "관리",
  client_error: "클라이언트 크래시",
  edge_function: "엣지 함수",
  other: "기타",
};

const SOURCE_TYPE_LABEL: Record<string, string> = {
  client: "클라이언트",
  edge_function: "엣지 함수",
  database: "데이터베이스",
};

// 코드 상의 source 식별자 → 비개발자가 이해할 수 있는 화면/위치 이름
const SOURCE_LOCATION_LABEL: Record<string, string> = {
  HomeworkSubmitModal: "학생 대시보드 - 숙제 제출",
  StudentHomeworkPanel: "강사 수업노트 - 숙제 검토",
  window: "브라우저(전역 오류)",
};

// 분류 + 출처(소스 코드 위치) 를 결합해서 비개발자가 한 줄로 이해할 수 있는 라벨 생성
function buildFriendlyLabel(l: { category: string; source: string | null; function_name: string | null; source_type: string }) {
  const cat = CATEGORY_LABEL[l.category] ?? l.category;
  const where = l.source
    ? (SOURCE_LOCATION_LABEL[l.source] ?? l.source)
    : l.function_name
      ? `엣지 함수: ${l.function_name}`
      : SOURCE_TYPE_LABEL[l.source_type] ?? l.source_type;
  return `${cat} 오류 / ${where}`;
}

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
  const [stageFilter, setStageFilter] = useState<string>("error");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const hours = RANGES.find((r) => r.value === range)?.hours ?? 24;
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const { data, error } = await supabase
      .from("homework_event_logs")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (!error && data) setLogs(data as LogRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  useEffect(() => {
    if (!autoRefresh) return;
    const channel = supabase
      .channel("event_logs_admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "homework_event_logs" }, (payload) => {
        setLogs((prev) => [payload.new as LogRow, ...prev].slice(0, 2000));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [autoRefresh]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (categoryFilter !== "all" && l.category !== categoryFilter) return false;
      if (sourceTypeFilter !== "all" && l.source_type !== sourceTypeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${l.student_name ?? ""} ${l.error_message ?? ""} ${l.error_code ?? ""} ${l.function_name ?? ""} ${l.event_type ?? ""} ${l.source ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, stageFilter, categoryFilter, sourceTypeFilter, search]);

  const stats = useMemo(() => {
    const total = logs.length;
    const errors = logs.filter((l) => l.stage === "error").length;
    const success = logs.filter((l) => l.stage === "success").length;
    const affectedStudents = new Set(logs.filter((l) => l.stage === "error").map((l) => l.student_name).filter(Boolean)).size;
    const byCategory = new Map<string, number>();
    for (const l of logs) {
      if (l.stage !== "error") continue;
      byCategory.set(l.category, (byCategory.get(l.category) ?? 0) + 1);
    }
    const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total, errors, success, affectedStudents, topCategory };
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">시스템 이벤트 추적</h1>
          <p className="text-xs text-muted-foreground mt-1">클라이언트·엣지 함수·DB에서 발생하는 모든 이벤트와 오류를 실시간 모니터링 (30일 보관)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={autoRefresh ? "default" : "outline"} size="sm" onClick={() => setAutoRefresh((v) => !v)} className="gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            {autoRefresh ? "실시간 ON" : "실시간 OFF"}
          </Button>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            새로고침
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">총 이벤트</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">오류</p>
          <p className="text-2xl font-bold text-destructive mt-1">{stats.errors}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">영향 받은 학생</p>
          <p className="text-2xl font-bold mt-1">{stats.affectedStudents}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">가장 많은 오류 분류</p>
          <p className="text-lg font-bold mt-1">{stats.topCategory ? `${CATEGORY_LABEL[stats.topCategory[0]] ?? stats.topCategory[0]} (${stats.topCategory[1]})` : "—"}</p>
        </Card>
      </div>

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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 분류</SelectItem>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 출처</SelectItem>
            {Object.entries(SOURCE_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          placeholder="학생명/오류/함수명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length}건 표시</span>
      </Card>

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
                  <th className="text-left p-2 font-medium">분류 / 출처</th>
                  <th className="text-left p-2 font-medium">이벤트</th>
                  <th className="text-left p-2 font-medium">학생</th>
                  <th className="text-left p-2 font-medium">오류 메시지</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const stage = STAGE_BADGE[l.stage] ?? STAGE_BADGE.attempt;
                  const SIcon = stage.Icon;
                  const isOpen = expanded === l.id;
                  const friendly = buildFriendlyLabel(l);
                  const report = buildCopyReport(l, friendly);
                  return (
                    <Fragment key={l.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : l.id)}
                        className={cn("border-t border-border hover:bg-muted/30 cursor-pointer", l.stage === "error" && "bg-destructive/5")}
                      >
                        <td className="p-2 whitespace-nowrap font-mono text-[11px]">{fmtTime(l.created_at)}</td>
                        <td className="p-2">
                          <Badge className={cn("gap-1", stage.cls)} variant="secondary">
                            <SIcon className="w-3 h-3" />
                            {stage.label}
                          </Badge>
                        </td>
                        <td className="p-2 font-medium">{friendly}</td>
                        <td className="p-2 text-muted-foreground">{l.event_type}</td>
                        <td className="p-2 font-medium">{l.student_name ?? "—"}</td>
                        <td className="p-2 max-w-[360px]">
                          {l.error_message ? (
                            <span className="text-destructive break-words">
                              {l.error_code ? `[${l.error_code}] ` : ""}{l.error_message}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-border bg-muted/20">
                          <td colSpan={6} className="p-3">
                            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                              <p className="text-[11px] text-muted-foreground">
                                💡 아래 버튼을 눌러 오류 내용을 복사한 뒤, Lovable 채팅창에 붙여넣고 "이 오류 원인을 파악해줘"라고 보내세요.
                              </p>
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1.5 h-8"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await navigator.clipboard.writeText(report);
                                    setCopiedId(l.id);
                                    toast.success("복사 완료! Lovable 채팅에 붙여넣기 하세요");
                                    setTimeout(() => setCopiedId((cur) => (cur === l.id ? null : cur)), 2000);
                                  } catch {
                                    toast.error("복사 실패 - 브라우저 권한을 확인하세요");
                                  }
                                }}
                              >
                                {copiedId === l.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedId === l.id ? "복사됨" : "Lovable에 보낼 내용 복사"}
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                              {l.pg_details && <div><span className="font-semibold">DB 상세:</span> <span className="font-mono break-words">{l.pg_details}</span></div>}
                              {l.pg_hint && <div><span className="font-semibold">DB 힌트:</span> <span className="font-mono break-words">{l.pg_hint}</span></div>}
                              {l.http_status != null && <div><span className="font-semibold">HTTP:</span> {l.http_status}</div>}
                              {l.source && <div><span className="font-semibold">소스:</span> {l.source}</div>}
                              {l.function_name && <div><span className="font-semibold">함수명:</span> {l.function_name}</div>}
                              {l.assignment_type && <div><span className="font-semibold">숙제 타입:</span> {l.assignment_type}</div>}
                              {l.submission_id && <div><span className="font-semibold">제출 ID:</span> <span className="font-mono">{l.submission_id}</span></div>}
                              {l.context && Object.keys(l.context).length > 0 && (
                                <div className="md:col-span-2">
                                  <span className="font-semibold">컨텍스트:</span>
                                  <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-x-auto">{JSON.stringify(l.context, null, 2)}</pre>
                                </div>
                              )}
                              {l.stack && (
                                <div className="md:col-span-2">
                                  <span className="font-semibold">스택:</span>
                                  <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-x-auto whitespace-pre-wrap">{l.stack}</pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
