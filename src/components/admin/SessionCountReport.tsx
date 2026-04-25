import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ClipboardList, Download, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { exportSessionCountPdf, SessionCountRow } from "@/lib/exportSessionCountPdf";
import { useToast } from "@/hooks/use-toast";

const TEST_ACCOUNTS = ["test", "test 2", "test2"];

interface SchedulePeriod {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface StudentRecord {
  student_name: string;
  student_type: string;
  status: string | null;
  group_students: string[];
}

interface SessionRow {
  student_name: string;
  scheduled_at: string;
  ended_at: string | null;
  cancellation_type: string | null;
  reschedule_origin_dates: string[] | null;
}

type FilterMode = "period" | "month";

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SessionCountReport() {
  const { toast } = useToast();
  const [mode, setMode] = useState<FilterMode>("period");
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [periodIdx, setPeriodIdx] = useState(0);
  const [monthDate, setMonthDate] = useState<Date>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Load schedule periods
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("schedule_periods")
        .select("*")
        .order("start_date", { ascending: false });
      const all = (data || []) as SchedulePeriod[];
      setPeriods(all);
      const activeIdx = all.findIndex(p => p.is_active);
      setPeriodIdx(activeIdx >= 0 ? activeIdx : 0);
    })();
  }, []);

  // Resolve current range
  const currentRange = useMemo(() => {
    if (mode === "period") {
      const p = periods[periodIdx];
      if (!p) return null;
      return {
        label: p.label,
        start: p.start_date,
        end: p.end_date,
      };
    } else {
      const y = monthDate.getFullYear();
      const m = monthDate.getMonth();
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return {
        label: `${y}년 ${m + 1}월`,
        start: ymd(start),
        end: ymd(end),
      };
    }
  }, [mode, periods, periodIdx, monthDate]);

  const loadData = useCallback(async () => {
    if (!currentRange) return;
    setLoading(true);
    const startTs = `${currentRange.start}T00:00:00+09:00`;
    const endTs = `${currentRange.end}T23:59:59+09:00`;

    const [studRes, sessRes] = await Promise.all([
      supabase
        .from("instructor_students")
        .select("student_name, student_type, status, group_students")
        .eq("status", "active"),
      supabase
        .from("class_sessions")
        .select("student_name, scheduled_at, ended_at, cancellation_type, reschedule_origin_dates")
        .gte("scheduled_at", startTs)
        .lte("scheduled_at", endTs),
    ]);
    setStudents((studRes.data || []) as StudentRecord[]);
    setSessions((sessRes.data || []) as SessionRow[]);
    setLoading(false);
  }, [currentRange]);

  useEffect(() => { loadData(); }, [loadData]);

  // Aggregate per student
  const rows = useMemo<SessionCountRow[]>(() => {
    // Dedupe students by name (transfers create duplicates)
    const dedupedStudents = Array.from(
      new Map(students.map(s => [s.student_name, s])).values()
    ).filter(s => !TEST_ACCOUNTS.includes(s.student_name));

    const byName = new Map<string, SessionRow[]>();
    sessions.forEach(s => {
      const list = byName.get(s.student_name) || [];
      list.push(s);
      byName.set(s.student_name, list);
    });

    const result: SessionCountRow[] = dedupedStudents.map(student => {
      const list = byName.get(student.student_name) || [];
      let completed = 0;
      let no_show = 0;
      let same_day_cancel = 0;
      let sick = 0;
      let instructor_cancel = 0;
      let advance_cancel = 0;
      let makeup_completed = 0;
      let scheduled = 0;

      list.forEach(s => {
        const isMakeup = Array.isArray(s.reschedule_origin_dates) && s.reschedule_origin_dates.length > 0;
        const ct = s.cancellation_type;
        if (ct === "no_show") no_show++;
        else if (ct === "student_cancel") same_day_cancel++;
        else if (ct === "sick") sick++;
        else if (ct === "instructor_cancel") instructor_cancel++;
        else if (ct === "advance_cancel") advance_cancel++;
        else if (s.ended_at) {
          if (isMakeup) makeup_completed++;
          else completed++;
        } else {
          scheduled++;
        }
      });

      const total = completed + makeup_completed + no_show + same_day_cancel + sick + instructor_cancel + advance_cancel + scheduled;

      return {
        student_name: student.student_name,
        is_corporate: student.student_type === "corporate",
        is_group: (student.group_students?.length || 0) > 0,
        completed,
        makeup_completed,
        no_show,
        same_day_cancel,
        sick,
        instructor_cancel,
        advance_cancel,
        scheduled,
        total,
      };
    }).filter(r => r.total > 0); // hide students with no sessions in range

    return result.sort((a, b) => {
      if (a.is_corporate !== b.is_corporate) return a.is_corporate ? 1 : -1;
      return a.student_name.localeCompare(b.student_name, "ko");
    });
  }, [students, sessions]);

  const regulars = rows.filter(r => !r.is_corporate);
  const corporates = rows.filter(r => r.is_corporate);

  const totals = useMemo(() => {
    const sum = (k: keyof SessionCountRow) => rows.reduce((s, r) => s + (r[k] as number), 0);
    return {
      completed: sum("completed"),
      makeup_completed: sum("makeup_completed"),
      no_show: sum("no_show"),
      same_day_cancel: sum("same_day_cancel"),
      sick: sum("sick"),
      instructor_cancel: sum("instructor_cancel"),
      advance_cancel: sum("advance_cancel"),
      scheduled: sum("scheduled"),
      total: sum("total"),
    };
  }, [rows]);

  const handleExport = async () => {
    if (!currentRange || rows.length === 0) return;
    setExporting(true);
    try {
      await exportSessionCountPdf(rows, currentRange.label, { start: currentRange.start, end: currentRange.end });
      toast({ title: "PDF 다운로드 완료" });
    } catch (e) {
      console.error(e);
      toast({ title: "PDF 생성 실패", variant: "destructive" });
    }
    setExporting(false);
  };

  const renderTable = (list: SessionCountRow[], title: string) => (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">{title} ({list.length}명)</p>
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-3 py-2 font-semibold text-foreground">학생명</th>
              <th className="px-2 py-2 font-semibold text-success text-center">완료</th>
              <th className="px-2 py-2 font-semibold text-primary text-center">보강완료</th>
              <th className="px-2 py-2 font-semibold text-warning text-center">노쇼</th>
              <th className="px-2 py-2 font-semibold text-muted-foreground text-center">당일취소</th>
              <th className="px-2 py-2 font-semibold text-muted-foreground text-center">병결</th>
              <th className="px-2 py-2 font-semibold text-muted-foreground text-center">강사취소</th>
              <th className="px-2 py-2 font-semibold text-muted-foreground text-center">사전취소</th>
              <th className="px-2 py-2 font-semibold text-muted-foreground text-center">예정</th>
              <th className="px-2 py-2 font-semibold text-foreground text-center">전체</th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.student_name} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 font-medium text-foreground">
                  {r.student_name}
                  {r.is_group && <span className="ml-1 text-[9px] text-muted-foreground">(그룹)</span>}
                </td>
                <td className="px-2 py-2 text-center font-semibold text-success">{r.completed || "-"}</td>
                <td className="px-2 py-2 text-center font-semibold text-primary">{r.makeup_completed || "-"}</td>
                <td className="px-2 py-2 text-center font-semibold text-warning">{r.no_show || "-"}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{r.same_day_cancel || "-"}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{r.sick || "-"}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{r.instructor_cancel || "-"}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{r.advance_cancel || "-"}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{r.scheduled || "-"}</td>
                <td className="px-2 py-2 text-center font-bold text-foreground">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">월별 수업 카운트</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode toggle */}
          <div className="flex items-center rounded-md border border-border overflow-hidden text-xs">
            <button
              onClick={() => setMode("period")}
              className={cn(
                "px-2.5 py-1.5 transition-colors min-h-[36px]",
                mode === "period" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              정산 기간
            </button>
            <button
              onClick={() => setMode("month")}
              className={cn(
                "px-2.5 py-1.5 transition-colors min-h-[36px]",
                mode === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              달력 월
            </button>
          </div>

          {/* Range navigation */}
          {mode === "period" ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPeriodIdx(i => Math.min(i + 1, periods.length - 1))}
                disabled={periodIdx >= periods.length - 1}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 min-h-[36px] min-w-[36px]"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="text-sm font-semibold text-foreground min-w-[120px] text-center">
                {currentRange?.label || "—"}
              </span>
              <button
                onClick={() => setPeriodIdx(i => Math.max(i - 1, 0))}
                disabled={periodIdx <= 0}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 min-h-[36px] min-w-[36px]"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs gap-1.5 min-h-[36px]">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {currentRange?.label}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={monthDate}
                  onSelect={(d) => { if (d) { setMonthDate(d); setCalendarOpen(false); } }}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Export */}
          <Button
            onClick={handleExport}
            disabled={exporting || rows.length === 0}
            size="sm"
            className="gap-1.5 min-h-[36px]"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF 다운로드
          </Button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="px-2 py-1 rounded bg-success/10 text-success font-semibold">완료 {totals.completed}</span>
        <span className="px-2 py-1 rounded bg-primary/10 text-primary font-semibold">보강완료 {totals.makeup_completed}</span>
        <span className="px-2 py-1 rounded bg-warning/10 text-warning font-semibold">노쇼 {totals.no_show}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">당일취소 {totals.same_day_cancel}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">병결 {totals.sick}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">강사취소 {totals.instructor_cancel}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">사전취소 {totals.advance_cancel}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">예정 {totals.scheduled}</span>
        <span className="px-2 py-1 rounded bg-foreground/10 text-foreground font-bold ml-auto">전체 {totals.total}</span>
      </div>

      {/* Tables */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          해당 기간에 수업 기록이 없습니다.
        </p>
      ) : (
        <div className="space-y-4">
          {regulars.length > 0 && renderTable(regulars, "정규 수강생")}
          {corporates.length > 0 && renderTable(corporates, "기업 수강생")}
        </div>
      )}
    </div>
  );
}
