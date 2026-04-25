import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ClipboardList, Download, Calendar as CalendarIcon, Loader2, Pencil, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { exportSessionCountPdf, SessionCountRow } from "@/lib/exportSessionCountPdf";
import { useToast } from "@/hooks/use-toast";
import SessionEditModal from "./SessionEditModal";

const TEST_ACCOUNTS = ["test", "test 2", "test2"];

interface SchedulePeriod {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface StudentRecord {
  id: string;
  student_name: string;
  student_type: string;
  status: string | null;
  group_students: string[];
  instructor_name: string | null;
  schedules: string | null;
}

interface StudentPause {
  student_id: string;
  pause_start: string;
  pause_end: string | null;
}

interface SessionRow {
  student_name: string;
  scheduled_at: string;
  ended_at: string | null;
  cancellation_type: string | null;
  reschedule_origin_dates: string[] | null;
  instructor_name: string | null;
  is_carryover: boolean;
}

type FilterMode = "period" | "month";

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getKstDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function getKstWeekday(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });
}

function getKstTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function parseSchedules(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as { day?: string; time?: string }[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isWithinPause(date: string, pauses: StudentPause[]) {
  return pauses.some(pause => date >= pause.pause_start && (!pause.pause_end || date <= pause.pause_end));
}

function matchesRegularSchedule(session: SessionRow, student: StudentRecord) {
  const scheduleItems = parseSchedules(student.schedules);
  if (scheduleItems.length === 0) return false;
  const weekday = getKstWeekday(session.scheduled_at);
  const time = getKstTime(session.scheduled_at);
  return scheduleItems.some(item => item.day === weekday && item.time === time);
}

// Compute the immediately preceding range (used to fetch previous month's carryover counts)
function getPreviousRange(start: string, end: string): { start: string; end: string } {
  // start/end are YYYY-MM-DD (KST calendar dates)
  const startD = new Date(`${start}T00:00:00+09:00`);
  const prevEnd = new Date(startD.getTime() - 24 * 60 * 60 * 1000);
  const endD = new Date(`${end}T00:00:00+09:00`);
  // length = days
  const lengthMs = endD.getTime() - startD.getTime();
  const prevStart = new Date(prevEnd.getTime() - lengthMs);
  return { start: ymd(prevStart), end: ymd(prevEnd) };
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
  const [pauses, setPauses] = useState<StudentPause[]>([]);
  const [prevCarryoverByStudent, setPrevCarryoverByStudent] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);

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

  const currentRange = useMemo(() => {
    if (mode === "period") {
      const p = periods[periodIdx];
      if (!p) return null;
      return { label: p.label, start: p.start_date, end: p.end_date };
    } else {
      const y = monthDate.getFullYear();
      const m = monthDate.getMonth();
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return { label: `${y}년 ${m + 1}월`, start: ymd(start), end: ymd(end) };
    }
  }, [mode, periods, periodIdx, monthDate]);

  // Determine previous range:
  //  - mode=period: previous schedule_period (one index up since list is desc)
  //  - mode=month: previous calendar month
  const previousRange = useMemo(() => {
    if (!currentRange) return null;
    if (mode === "period") {
      const prev = periods[periodIdx + 1];
      if (prev) return { start: prev.start_date, end: prev.end_date };
      return getPreviousRange(currentRange.start, currentRange.end);
    } else {
      const y = monthDate.getFullYear();
      const m = monthDate.getMonth();
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { start: ymd(start), end: ymd(end) };
    }
  }, [mode, currentRange, periods, periodIdx, monthDate]);

  const loadData = useCallback(async () => {
    if (!currentRange) return;
    setLoading(true);
    const startTs = `${currentRange.start}T00:00:00+09:00`;
    const endTs = `${currentRange.end}T23:59:59+09:00`;

    const studPromise = supabase
      .from("instructor_students")
      .select("id, student_name, student_type, status, group_students, instructor_name, schedules")
      .eq("status", "active")
      .then(r => r);

    const pausePromise = supabase
      .from("student_pauses")
      .select("student_id, pause_start, pause_end")
      .lte("pause_start", currentRange.end)
      .or(`pause_end.is.null,pause_end.gte.${currentRange.start}`)
      .then(r => r);

    // Fetch sessions whose scheduled_at is in range OR whose original (pre-reschedule) date is in range.
    // This ensures sessions moved OUT of the period (e.g., 4/2 → 4/30) are still counted in the original month.
    const sessInRangePromise = supabase
      .from("class_sessions")
      .select("student_name, scheduled_at, ended_at, cancellation_type, reschedule_origin_dates, instructor_name, is_carryover")
      .gte("scheduled_at", startTs)
      .lte("scheduled_at", endTs)
      .then(r => r);
    // Sessions rescheduled FROM within this period to outside it
    const sessOriginPromise = supabase
      .from("class_sessions")
      .select("student_name, scheduled_at, ended_at, cancellation_type, reschedule_origin_dates, instructor_name, is_carryover")
      .overlaps("reschedule_origin_dates", [currentRange.start, currentRange.end])
      // overlaps with two endpoints isn't sufficient — fetch broader and filter client-side below
      .then(r => r);

    // Previous period: fetch carryovers that were NOT actually conducted (still pending) → deduct from this month's billable
    const prevPromise = previousRange
      ? supabase
          .from("class_sessions")
          .select("student_name, is_carryover, cancellation_type, ended_at, scheduled_at, reschedule_origin_dates")
          .gte("scheduled_at", `${previousRange.start}T00:00:00+09:00`)
          .lte("scheduled_at", `${previousRange.end}T23:59:59+09:00`)
          .then(r => r)
      : Promise.resolve({ data: [] as { student_name: string; is_carryover: boolean; cancellation_type: string | null; ended_at: string | null; scheduled_at: string; reschedule_origin_dates: string[] | null }[] });

    const results = await Promise.all([studPromise, pausePromise, sessInRangePromise, prevPromise, sessOriginPromise]);
    setStudents((results[0].data || []) as StudentRecord[]);
    setPauses((results[1].data || []) as StudentPause[]);

    // Merge sessions: in-range + those whose origin falls in range (and scheduled_at is outside).
    // Also exclude in-range sessions whose origin is in a DIFFERENT period (they belong to the original month's report).
    const inRangeFiltered = inRange.filter(s => {
      const origins = Array.isArray(s.reschedule_origin_dates) ? s.reschedule_origin_dates : [];
      if (origins.length === 0) return true;
      // If any origin date falls within current period, this session belongs here.
      // If all origins are outside current period, this session should be reported in its origin month.
      return origins.some(d => d >= currentRange.start && d <= currentRange.end);
    });
    const originExtras = ((results[4].data || []) as SessionRow[]).filter(s => {
      const inAlready = inRangeFiltered.some(x => x.student_name === s.student_name && x.scheduled_at === s.scheduled_at);
      if (inAlready) return false;
      const origins = Array.isArray(s.reschedule_origin_dates) ? s.reschedule_origin_dates : [];
      return origins.some(d => d >= currentRange.start && d <= currentRange.end);
    });
    setSessions([...inRangeFiltered, ...originExtras]);

    const prevMap = new Map<string, number>();
    if (results[3]) {
      const prevRows = (results[3].data || []) as { student_name: string; is_carryover: boolean; cancellation_type: string | null; ended_at: string | null; scheduled_at: string; reschedule_origin_dates: string[] | null }[];
      // Exclude sessions that were rescheduled OUT of the previous period (they'll be counted in their new month)
      prevRows.forEach(r => {
        // Carryover deduction applies only when the session was NOT actually conducted
        // (no ended_at, no cancellation handled this month).
        // Instructor cancel: always deducts (it's a guaranteed make-up next month).
        // is_carryover: deducts only if still pending (not completed in previous month).
        const isPending = !r.ended_at && !r.cancellation_type;
        if (r.cancellation_type === "instructor_cancel") {
          prevMap.set(r.student_name, (prevMap.get(r.student_name) || 0) + 1);
        } else if (r.is_carryover && isPending) {
          prevMap.set(r.student_name, (prevMap.get(r.student_name) || 0) + 1);
        }
      });
    }
    setPrevCarryoverByStudent(prevMap);

    setLoading(false);
  }, [currentRange, previousRange]);

  useEffect(() => { loadData(); }, [loadData]);

  // Aggregate per student
  const rows = useMemo<(SessionCountRow & { instructor_name: string })[]>(() => {
    const dedupedStudents = Array.from(
      new Map(students.map(s => [s.student_name, s])).values()
    ).filter(s => !TEST_ACCOUNTS.includes(s.student_name));

    const byName = new Map<string, SessionRow[]>();
    sessions.forEach(s => {
      const list = byName.get(s.student_name) || [];
      list.push(s);
      byName.set(s.student_name, list);
    });

    const result = dedupedStudents.map(student => {
      const studentPauses = pauses.filter(p => p.student_id === student.id);
      const isFullyPaused = currentRange
        ? studentPauses.some(p => p.pause_start <= currentRange.start && (!p.pause_end || p.pause_end >= currentRange.end))
        : false;
      const list = isFullyPaused
        ? []
        : (byName.get(student.student_name) || []).filter(s => !isWithinPause(getKstDate(s.scheduled_at), studentPauses));
      let completed = 0, no_show = 0, same_day_cancel = 0, sick = 0;
      let instructor_cancel = 0, advance_cancel = 0, makeup_completed = 0, scheduled = 0, unchecked = 0;
      let carryover = 0;

      list.forEach(s => {
        // KST 날짜로 변환하여 origin과 비교하고, 현재 정규 요일/시간과 일치하면 단순 일정 변경 이력으로 간주
        const kstDateStr = getKstDate(s.scheduled_at);
        const origins = Array.isArray(s.reschedule_origin_dates) ? s.reschedule_origin_dates : [];
        const isMakeup = origins.some(d => d !== kstDateStr) && !matchesRegularSchedule(s, student);
        const ct = s.cancellation_type;
        if (s.is_carryover) carryover++;
        if (ct === "no_show") no_show++;
        else if (ct === "student_cancel") same_day_cancel++;
        else if (ct === "sick") sick++;
        else if (ct === "instructor_cancel") instructor_cancel++;
        else if (ct === "advance_cancel") advance_cancel++;
        else if (s.ended_at) {
          if (isMakeup) makeup_completed++;
          else completed++;
        } else if (s.is_carryover) {
          // 이월 처리된 세션은 미체크/예정에 포함하지 않음 (이월 컬럼으로만 집계)
        } else if (new Date(s.scheduled_at).getTime() < Date.now()) {
          unchecked++;
        } else {
          scheduled++;
        }
      });

      const total = completed + makeup_completed + no_show + same_day_cancel + sick + instructor_cancel + advance_cancel + unchecked + scheduled + carryover;
      const prev_carryover_in = prevCarryoverByStudent.get(student.student_name) || 0;
      // Actual lessons conducted (settlement-eligible base): completed + makeup + no-show
      const actual_lessons = completed + makeup_completed + no_show;
      // Billable = base monthly count (4) - previous month's carryovers (carryover flag + instructor cancel)
      // All students pay for 4 sessions per month by default
      const BASE_MONTHLY_COUNT = 4;
      const billable = Math.max(0, BASE_MONTHLY_COUNT - prev_carryover_in);

      // Pick instructor by majority of sessions IN THIS RANGE (handles transfer-pending duplicates correctly)
      const instructorCounts = new Map<string, number>();
      list.forEach(s => {
        const name = s.instructor_name?.trim();
        if (!name) return;
        instructorCounts.set(name, (instructorCounts.get(name) || 0) + 1);
      });
      let dominantInstructor: string | null = null;
      let maxCount = 0;
      instructorCounts.forEach((count, name) => {
        if (count > maxCount) { maxCount = count; dominantInstructor = name; }
      });

      return {
        student_name: student.student_name,
        is_corporate: student.student_type === "corporate",
        is_group: (student.group_students?.length || 0) > 0,
        instructor_name: dominantInstructor || student.instructor_name || "(미배정)",
        completed,
        makeup_completed,
        no_show,
        same_day_cancel,
        sick,
        instructor_cancel,
        advance_cancel,
        unchecked,
        scheduled,
        carryover,
        prev_carryover_in,
        actual_lessons,
        billable,
        total,
      };
    }).filter(r => r.total > 0 || r.prev_carryover_in > 0);

    return result.sort((a, b) => {
      if (a.is_corporate !== b.is_corporate) return a.is_corporate ? 1 : -1;
      if (a.instructor_name !== b.instructor_name) return a.instructor_name.localeCompare(b.instructor_name, "ko");
      return a.student_name.localeCompare(b.student_name, "ko");
    });
  }, [students, sessions, pauses, prevCarryoverByStudent, currentRange]);

  // Group by instructor within each segment
  const groupByInstructor = (list: typeof rows) => {
    const map = new Map<string, typeof rows>();
    list.forEach(r => {
      const arr = map.get(r.instructor_name) || [];
      arr.push(r);
      map.set(r.instructor_name, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "ko"));
  };

  const regularGroups = useMemo(() => groupByInstructor(rows.filter(r => !r.is_corporate)), [rows]);
  const corporateGroups = useMemo(() => groupByInstructor(rows.filter(r => r.is_corporate)), [rows]);

  const totals = useMemo(() => {
    const sum = (k: keyof SessionCountRow) => rows.reduce((s, r) => s + ((r[k] as number) || 0), 0);
    return {
      completed: sum("completed"),
      makeup_completed: sum("makeup_completed"),
      no_show: sum("no_show"),
      same_day_cancel: sum("same_day_cancel"),
      sick: sum("sick"),
      instructor_cancel: sum("instructor_cancel"),
      advance_cancel: sum("advance_cancel"),
      unchecked: sum("unchecked"),
      scheduled: sum("scheduled"),
      carryover: sum("carryover"),
      prev_carryover_in: sum("prev_carryover_in"),
      actual_lessons: sum("actual_lessons"),
      billable: sum("billable"),
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

  const renderInstructorGroup = (instructorName: string, list: typeof rows) => {
    const groupTotals = {
      actual_lessons: list.reduce((s, r) => s + r.actual_lessons, 0),
      billable: list.reduce((s, r) => s + r.billable, 0),
      total: list.reduce((s, r) => s + r.total, 0),
    };
    return (
      <div key={instructorName} className="space-y-1">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-foreground">
            <span className="text-primary">{instructorName}</span>
            <span className="text-muted-foreground ml-1.5">
              ({list.length}명 · 결제 {groupTotals.billable} / 실수업 {groupTotals.actual_lessons} / 전체 {groupTotals.total})
            </span>
          </p>
        </div>
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-3 py-2 font-semibold text-foreground">학생명</th>
                <th className="px-2 py-2 font-semibold text-success text-center">완료</th>
                <th className="px-2 py-2 font-semibold text-primary text-center">보강</th>
                <th className="px-2 py-2 font-semibold text-warning text-center">노쇼</th>
                <th className="px-2 py-2 font-semibold text-muted-foreground text-center">당일</th>
                <th className="px-2 py-2 font-semibold text-muted-foreground text-center">병결</th>
                <th className="px-2 py-2 font-semibold text-muted-foreground text-center">강사취소</th>
                <th className="px-2 py-2 font-semibold text-muted-foreground text-center">사전</th>
                <th className="px-2 py-2 font-semibold text-warning text-center">미체크</th>
                <th className="px-2 py-2 font-semibold text-accent-foreground text-center bg-accent/10">이월(당월)</th>
                <th className="px-2 py-2 font-semibold text-accent-foreground text-center bg-accent/10">이월(전월)</th>
                <th className="px-2 py-2 font-semibold text-muted-foreground text-center">예정</th>
                <th className="px-2 py-2 font-semibold text-foreground text-center">전체</th>
                <th className="px-2 py-2 font-semibold text-success text-center bg-success/5">실수업</th>
                <th className="px-2 py-2 font-semibold text-primary text-center bg-primary/5">결제대상</th>
                <th className="px-2 py-2 font-semibold text-foreground text-center w-10">편집</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => (
                <tr key={r.student_name} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{r.student_name}</span>
                      {r.is_group && <span className="text-[9px] text-muted-foreground">(그룹)</span>}
                      <button
                        type="button"
                        title="학생 대시보드 열기 (새 탭)"
                        onClick={() => window.open(`/t/student-dashboard?student_name=${encodeURIComponent(r.student_name)}`, "_blank", "noopener,noreferrer")}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center font-semibold text-success">{r.completed || "-"}</td>
                  <td className="px-2 py-2 text-center font-semibold text-primary">{r.makeup_completed || "-"}</td>
                  <td className="px-2 py-2 text-center font-semibold text-warning">{r.no_show || "-"}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{r.same_day_cancel || "-"}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{r.sick || "-"}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{r.instructor_cancel || "-"}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{r.advance_cancel || "-"}</td>
                  <td className="px-2 py-2 text-center font-semibold text-warning">{r.unchecked || "-"}</td>
                  <td className="px-2 py-2 text-center font-semibold text-accent-foreground bg-accent/5">{r.carryover || "-"}</td>
                  <td className="px-2 py-2 text-center font-semibold text-accent-foreground bg-accent/5">{r.prev_carryover_in ? `-${r.prev_carryover_in}` : "-"}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{r.scheduled || "-"}</td>
                  <td className="px-2 py-2 text-center font-bold text-foreground">{r.total}</td>
                  <td className="px-2 py-2 text-center font-bold text-success bg-success/5">{r.actual_lessons}</td>
                  <td className="px-2 py-2 text-center font-bold text-primary bg-primary/5">{r.billable}</td>
                  <td className="px-1 py-1 text-center">
                    <button
                      onClick={() => setEditingStudent(r.student_name)}
                      className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors min-h-[28px] min-w-[28px] inline-flex items-center justify-center"
                      title="수업 상태 수정"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSegment = (groups: ReturnType<typeof groupByInstructor>, title: string) => (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        {title} · 강사 {groups.length}명 · 학생 {groups.reduce((s, [, list]) => s + list.length, 0)}명
      </p>
      <div className="space-y-3">
        {groups.map(([name, list]) => renderInstructorGroup(name, list))}
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

      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="px-2 py-1 rounded bg-success/10 text-success font-semibold">완료 {totals.completed}</span>
        <span className="px-2 py-1 rounded bg-primary/10 text-primary font-semibold">보강완료 {totals.makeup_completed}</span>
        <span className="px-2 py-1 rounded bg-warning/10 text-warning font-semibold">노쇼 {totals.no_show}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">당일취소 {totals.same_day_cancel}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">병결 {totals.sick}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">강사취소 {totals.instructor_cancel}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">사전취소 {totals.advance_cancel}</span>
        <span className="px-2 py-1 rounded bg-warning/10 text-warning font-semibold">미체크 {totals.unchecked}</span>
        <span className="px-2 py-1 rounded bg-accent/15 text-accent-foreground font-semibold border border-accent/30">이월(당월) {totals.carryover}</span>
        <span className="px-2 py-1 rounded bg-accent/15 text-accent-foreground font-semibold border border-accent/30">전월차감 -{totals.prev_carryover_in}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">예정 {totals.scheduled}</span>
        <span className="px-2 py-1 rounded bg-foreground/10 text-foreground font-bold">전체 {totals.total}</span>
        <span className="px-2 py-1 rounded bg-success/15 text-success font-bold ml-auto">실수업 {totals.actual_lessons}</span>
        <span className="px-2 py-1 rounded bg-primary text-primary-foreground font-bold">결제대상 {totals.billable}</span>
      </div>

      <p className="text-[10px] text-muted-foreground -mt-2">
        💡 결제대상 = 4회(기본 월 결제) - 전월 차감(이월 + 강사취소) · 실수업 = 완료+보강+노쇼 · 미체크는 수업 시간이 지났지만 상태가 저장되지 않은 항목
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          해당 기간에 수업 기록이 없습니다.
        </p>
      ) : (
        <div className="space-y-6">
          {regularGroups.length > 0 && renderSegment(regularGroups, "정규 수강생")}
          {corporateGroups.length > 0 && renderSegment(corporateGroups, "기업 수강생")}
        </div>
      )}

      {editingStudent && currentRange && (
        <SessionEditModal
          open={!!editingStudent}
          onClose={() => setEditingStudent(null)}
          studentName={editingStudent}
          rangeStart={currentRange.start}
          rangeEnd={currentRange.end}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
