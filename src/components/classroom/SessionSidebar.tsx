import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { FileText, ChevronLeft, ChevronRight, ChevronDown, Search, X, Download, Calendar, Trash2 } from "lucide-react";

interface SessionItem {
  id: string;
  scheduled_at: string;
  topic: string | null;
  notes?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  cancellation_type?: string | null;
  cancellation_resolution?: string | null;
  reschedule_origin_dates?: string[] | null;
}

const CANCEL_BADGES: Record<string, { label: string; cls: string }> = {
  no_show: { label: "미참석", cls: "bg-warning/15 text-warning" },
  student_cancel: { label: "당일 취소", cls: "bg-destructive/15 text-destructive" },
  sick: { label: "병결", cls: "bg-muted text-muted-foreground" },
  instructor_cancel: { label: "강사 취소", cls: "bg-muted text-muted-foreground" },
  advance_cancel: { label: "사전 취소", cls: "bg-muted text-muted-foreground" },
};

const RESOLUTION_BADGES: Record<string, { label: string; cls: string }> = {
  makeup: { label: "보강", cls: "bg-gold/15 text-gold" },
  carry_over: { label: "이월", cls: "bg-muted text-muted-foreground" },
  refund: { label: "환불", cls: "bg-muted text-muted-foreground" },
  cancel: { label: "취소", cls: "bg-destructive/15 text-destructive" },
};

interface SessionSidebarProps {
  sessions: SessionItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
  initialOpen?: boolean;
  showFutureSection?: boolean;
  onDownloadAllPdf?: (periodMonths: number | null) => void;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
}

/** YYYY-MM-DD in KST */
function kstDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** "M월 D일" from YYYY-MM-DD */
function fmtShortKor(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}

/** Strip HTML tags and return plain text */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Get a snippet around the first match of query in text */
function getSnippet(text: string, query: string, contextLen = 30): string | null {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return null;

  const start = Math.max(0, idx - contextLen);
  const end = Math.min(text.length, idx + query.length + contextLen);
  let snippet = "";
  if (start > 0) snippet += "…";
  snippet += text.slice(start, end);
  if (end < text.length) snippet += "…";
  return snippet;
}

/** Check if a session is deletable: no notes, not started, not ended */
function isDeletable(s: SessionItem): boolean {
  const hasNotes = s.notes && s.notes.replace(/<[^>]*>/g, "").trim().length > 0;
  return !hasNotes && !s.started_at && !s.ended_at;
}

export default function SessionSidebar({
  sessions,
  selectedId,
  onSelect,
  onDelete,
  loading,
  initialOpen = false,
  showFutureSection = true,
  onDownloadAllPdf,
}: SessionSidebarProps) {
  const [collapsed, setCollapsed] = useState(!initialOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [showFuture, setShowFuture] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  // Build map: KST date → session, and set of dates that have been "moved away"
  const { sessionByDate, movedFromDates } = useMemo(() => {
    const byDate = new Map<string, SessionItem>();
    const moved = new Set<string>();
    for (const s of sessions) {
      byDate.set(kstDateKey(s.scheduled_at), s);
    }
    for (const s of sessions) {
      for (const orig of s.reschedule_origin_dates ?? []) {
        const key = typeof orig === "string" ? orig.slice(0, 10) : orig;
        moved.add(key);
      }
    }
    return { sessionByDate: byDate, movedFromDates: moved };
  }, [sessions]);

  // Hide sessions whose KST date has been moved away to a later date
  const visibleSessions = useMemo(
    () => sessions.filter(s => !movedFromDates.has(kstDateKey(s.scheduled_at))),
    [sessions, movedFromDates]
  );

  // For a given session, look up direct origins only (one hop) and collect cancellation labels.
  // If the origin session was deleted (not in sessionByDate), still record the date with no label
  // so the 보강 badge and date subtitle still appear.
  const getOriginChain = (s: SessionItem): { date: string; label: string | null }[] => {
    const chain: { date: string; label: string | null }[] = [];
    for (const orig of s.reschedule_origin_dates ?? []) {
      const key = typeof orig === "string" ? orig.slice(0, 10) : orig;
      const originSess = sessionByDate.get(key);
      const label =
        originSess?.cancellation_type && CANCEL_BADGES[originSess.cancellation_type]
          ? CANCEL_BADGES[originSess.cancellation_type].label
          : null;
      chain.push({ date: key, label });
    }
    return chain;
  };

  const pastSessions = useMemo(() => visibleSessions.filter(s => new Date(s.scheduled_at) <= now), [visibleSessions, now]);
  const futureSessions = useMemo(() => visibleSessions.filter(s => new Date(s.scheduled_at) > now), [visibleSessions, now]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return null;

    const results: { session: SessionItem; snippet: string }[] = [];
    for (const s of sessions) {
      if (!s.notes) continue;
      const plainText = stripHtml(s.notes);
      const snippet = getSnippet(plainText, q);
      if (snippet) {
        results.push({ session: s, snippet });
      }
    }
    return results;
  }, [searchQuery, sessions]);

  const highlightQuery = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-gold/30 text-foreground rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const renderSessionItem = (s: SessionItem) => {
    const canDelete = onDelete && isDeletable(s);
    const originChain = getOriginChain(s);
    const isMakeup = originChain.length > 0;
    return (
      <div
        key={s.id}
        className={cn(
          "group relative w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors",
          selectedId === s.id && "bg-gold/10 border-l-2 border-l-gold"
        )}
      >
        <button
          onClick={() => onSelect(s.id)}
          className="w-full text-left"
        >
          <div className="flex items-center gap-1 pr-5 flex-wrap">
            <p className="text-[11px] font-semibold text-foreground leading-tight">
              {fmtDate(s.scheduled_at)}
            </p>
            {s.cancellation_type && CANCEL_BADGES[s.cancellation_type] && (
              <span className={cn(
                "inline-flex items-center px-1.5 py-0 rounded text-[8px] font-semibold leading-relaxed flex-shrink-0",
                CANCEL_BADGES[s.cancellation_type].cls
              )}>
                {CANCEL_BADGES[s.cancellation_type].label}
              </span>
            )}
            {/* Inherited badges from cancelled origin(s) */}
            {originChain.map((o, i) =>
              o.label ? (
                <span
                  key={`${o.date}-${i}`}
                  className={cn(
                    "inline-flex items-center px-1.5 py-0 rounded text-[8px] font-semibold leading-relaxed flex-shrink-0",
                    "bg-muted text-muted-foreground"
                  )}
                >
                  {o.label}
                </span>
              ) : null
            )}
            {isMakeup && (
              <span className={cn(
                "inline-flex items-center px-1.5 py-0 rounded text-[8px] font-semibold leading-relaxed flex-shrink-0",
                RESOLUTION_BADGES.makeup.cls
              )}>
                {RESOLUTION_BADGES.makeup.label}
              </span>
            )}
            {s.cancellation_resolution && RESOLUTION_BADGES[s.cancellation_resolution] && (
              <span className={cn(
                "inline-flex items-center px-1.5 py-0 rounded text-[8px] font-semibold leading-relaxed flex-shrink-0",
                RESOLUTION_BADGES[s.cancellation_resolution].cls
              )}>
                {RESOLUTION_BADGES[s.cancellation_resolution].label}
              </span>
            )}
          </div>
          {originChain.length > 0 && (
            <p className="text-[9px] text-muted-foreground/80 mt-0.5 leading-tight">
              {originChain.map(o => o.label ? `(${fmtShortKor(o.date)} 수업 ${o.label})` : `(${fmtShortKor(o.date)} 수업)`).join(" ")}
            </p>
          )}
          {s.topic && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate pr-5">
              {s.topic}
            </p>
          )}
        </button>
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(s.id);
            }}
            title="이 수업 삭제"
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex-shrink-0 border-r border-border bg-muted/20 flex flex-col transition-all duration-200 overflow-hidden",
        collapsed ? "w-10" : "w-52"
      )}
    >
      {/* Toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center justify-center h-10 border-b border-border hover:bg-muted/50 transition-colors"
        title={collapsed ? "사이드바 열기" : "사이드바 닫기"}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        ) : (
          <div className="flex items-center gap-1.5 px-3 w-full">
            <FileText className="w-3.5 h-3.5 text-gold flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground flex-1">이전 수업</span>
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        )}
      </button>

      {/* Download All PDF */}
      {!collapsed && onDownloadAllPdf && (
        <div className="px-2 py-2 border-b border-border">
          <div className="relative">
            <button
              onClick={() => setShowDownloadMenu(v => !v)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Download className="w-3 h-3 flex-shrink-0" />
              <span>전체 노트 다운로드</span>
              <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", showDownloadMenu && "rotate-180")} />
            </button>
            {showDownloadMenu && (
              <div className="mt-1 rounded-md border border-border bg-card shadow-md overflow-hidden">
                {[
                  { label: "최근 1개월", months: 1 },
                  { label: "최근 3개월", months: 3 },
                  { label: "전체", months: null },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      setShowDownloadMenu(false);
                      onDownloadAllPdf(opt.months);
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] hover:bg-muted/50 transition-colors flex items-center gap-2"
                  >
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      {!collapsed && (
        <div className="px-2 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchActive(!!e.target.value.trim());
              }}
              placeholder="노트 검색…"
              className="w-full pl-6 pr-6 py-1.5 text-[11px] rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchActive(false); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search Results */}
      {!collapsed && searchActive && searchResults !== null && (
        <div className="flex-1 overflow-y-auto">
          {searchResults.length === 0 ? (
            <p className="text-[10px] text-muted-foreground px-3 py-4 text-center">
              검색 결과 없음
            </p>
          ) : (
            <>
              <div className="px-3 py-1.5 bg-muted/30 border-b border-border">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {searchResults.length}개 수업에서 발견
                </span>
              </div>
              {searchResults.map(({ session: s, snippet }) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelect(s.id);
                    setSearchQuery("");
                    setSearchActive(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors",
                    selectedId === s.id && "bg-gold/10 border-l-2 border-l-gold"
                  )}
                >
                  <p className="text-[11px] font-semibold text-foreground leading-tight">
                    {fmtDate(s.scheduled_at)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed break-words line-clamp-3">
                    {highlightQuery(snippet, searchQuery.trim())}
                  </p>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Session list (hidden during search) */}
      {!collapsed && !searchActive && (
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">로딩 중…</p>
          )}
          {!loading && sessions.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">수업 없음</p>
          )}
          {!loading && (
            <>
              {/* Future sessions toggle — top */}
              {showFutureSection && futureSessions.length > 0 && (
                <>
                  <button
                    onClick={() => setShowFuture(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border text-[10px] text-muted-foreground hover:bg-muted/60 transition-colors"
                  >
                    <span className="font-medium">예정된 수업 ({futureSessions.length})</span>
                    <ChevronDown className={cn("w-3 h-3 transition-transform", showFuture && "rotate-180")} />
                  </button>
                  {showFuture && futureSessions.map(renderSessionItem)}
                </>
              )}

              {/* Past & today sessions */}
              {pastSessions.map(renderSessionItem)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
