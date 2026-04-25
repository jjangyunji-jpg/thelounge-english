import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ClipboardList, Download, Calendar as CalendarIcon, Loader2, Pencil, ExternalLink, AlertCircle } from "lucide-react";
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
  carryover_direction: "prev" | "next" | null;
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
  const [monthDate, setMonthDate] = useState<Date>(() => {
    // KST 기준: 매월 1~10일은 전월을 기본으로 표시 (이월/정산 확정 기간)
    const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    if (kstNow.getDate() <= 10) {
      return new Date(kstNow.getFullYear(), kstNow.getMonth() - 1, 1);
    }
    return new Date(kstNow.getFullYear(), kstNow.getMonth(), 1);
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [pauses, setPauses] = useState<StudentPause[]>([]);
  const [prevCarryoverByStudent, setPrevCarryoverByStudent] = useState<Map<string, number>>(new Map());
  const [billableOverrides, setBillableOverrides] = useState<Map<string, number>>(new Map());
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
      // KST 기준: 매월 1~10일은 전월을 우선 (해당 월의 period가 없으면 active로 fallback)
      const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const targetDate = kstNow.getDate() <= 10
        ? new Date(kstNow.getFullYear(), kstNow.getMonth() - 1, 15)
        : kstNow;
      const targetStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
      const containingIdx = all.findIndex(p => p.start_date <= targetStr && p.end_date >= targetStr);
      const activeIdx = all.findIndex(p => p.is_active);
      setPeriodIdx(containingIdx >= 0 ? containingIdx : (activeIdx >= 0 ? activeIdx : 0));
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
      .select("student_name, scheduled_at, ended_at, cancellation_type, reschedule_origin_dates, instructor_name, is_carryover, carryover_direction")
      .gte("scheduled_at", startTs)
      .lte("scheduled_at", endTs)
      .then(r => r);
    // Sessions rescheduled FROM within this period to outside it.
    // Fetch sessions in a wide window (±60 days around current period) that have any reschedule origin,
    // then filter client-side for origins inside currentRange.
    const wideStart = new Date(`${currentRange.start}T00:00:00+09:00`);
    wideStart.setDate(wideStart.getDate() - 60);
    const wideEnd = new Date(`${currentRange.end}T23:59:59+09:00`);
    wideEnd.setDate(wideEnd.getDate() + 60);
    const sessOriginPromise = supabase
      .from("class_sessions")
      .select("student_name, scheduled_at, ended_at, cancellation_type, reschedule_origin_dates, instructor_name, is_carryover, carryover_direction")
      .gte("scheduled_at", wideStart.toISOString())
      .lte("scheduled_at", wideEnd.toISOString())
      .not("reschedule_origin_dates", "eq", "{}")
      .then(r => r);

    // Previous period: fetch carryovers that were NOT actually conducted (still pending) → deduct from this month's billable
    const prevPromise = previousRange
      ? supabase
          .from("class_sessions")
          .select("student_name, is_carryover, carryover_direction, cancellation_type, ended_at, scheduled_at, reschedule_origin_dates")
          .gte("scheduled_at", `${previousRange.start}T00:00:00+09:00`)
          .lte("scheduled_at", `${previousRange.end}T23:59:59+09:00`)
          .then(r => r)
      : Promise.resolve({ data: [] as { student_name: string; is_carryover: boolean; carryover_direction: "prev" | "next" | null; cancellation_type: string | null; ended_at: string | null; scheduled_at: string; reschedule_origin_dates: string[] | null }[] });

    const overridePromise = supabase
      .from("billable_overrides")
      .select("student_name, billable_count")
      .eq("period_start", currentRange.start)
      .eq("period_end", currentRange.end)
      .then(r => r);

    const results = await Promise.all([studPromise, pausePromise, sessInRangePromise, prevPromise, sessOriginPromise, overridePromise]);
    setStudents((results[0].data || []) as StudentRecord[]);
    setPauses((results[1].data || []) as StudentPause[]);

    // Merge sessions: in-range + those whose origin falls in range (and scheduled_at is outside).
    // Also exclude in-range sessions whose origin is in a DIFFERENT period (they belong to the original month's report).
    const inRange = (results[2].data || []) as SessionRow[];
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
      const prevRows = (results[3].data || []) as { student_name: string; is_carryover: boolean; carryover_direction: "prev" | "next" | null; cancellation_type: string | null; ended_at: string | null; scheduled_at: string; reschedule_origin_dates: string[] | null }[];
      prevRows.forEach(r => {
        // Carryover deduction (전월에서 이번 달로 차감되는 케이스):
        // 1) instructor_cancel: 강사 사정 취소는 다음달 보강 보장 → 차감
        // 2) carryover_direction = 'next': 전월에 명시적으로 '다음달 이월'로 표시한 세션 → 차감
        if (r.cancellation_type === "instructor_cancel") {
          prevMap.set(r.student_name, (prevMap.get(r.student_name) || 0) + 1);
        } else if (r.carryover_direction === "next") {
          prevMap.set(r.student_name, (prevMap.get(r.student_name) || 0) + 1);
        }
      });
    }
    setPrevCarryoverByStudent(prevMap);

    const ovMap = new Map<string, number>();
    const ovRows = (results[5]?.data || []) as { student_name: string; billable_count: number }[];
    ovRows.forEach(o => ovMap.set(o.student_name, o.billable_count));
    setBillableOverrides(ovMap);

    setLoading(false);
  }, [currentRange, previousRange]);

  useEffect(() => { loadData(); }, [loadData]);

  // Aggregate per student
  const rows = useMemo<(SessionCountRow & { instructor_name: string; billable_overridden: boolean; computed_billable: number })[]>(() => {
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
      let carryover = 0;     // 당월 → 다음달 이월 (next)
      let carryover_in = 0;  // 전월 → 당월 이월 (prev)
      // 보강 카운트: 완료 + 예정된(미완료) 보강 모두 포함
      let makeup = 0;
      // 보강 매칭이 잡히지 않은 병결 건수 (UI에 ⚠ 아이콘 표시용)
      let sick_unmatched = 0;

      // 보강 origin 날짜 집합 (KST) — 매칭된 보강이 있는지 확인용
      const makeupOriginDates = new Set<string>();
      list.forEach(s => {
        const kstDateStr = getKstDate(s.scheduled_at);
        const origins = Array.isArray(s.reschedule_origin_dates) ? s.reschedule_origin_dates : [];
        const isMakeup = origins.some(d => d !== kstDateStr) && !matchesRegularSchedule(s, student);
        if (!isMakeup) return;
        // 취소된 보강(노쇼/당일취소 등)은 매칭으로 인정하지 않음
        if (s.cancellation_type) return;
        origins.forEach(d => { if (d !== kstDateStr) makeupOriginDates.add(d); });
      });

      list.forEach(s => {
        // KST 날짜로 변환하여 origin과 비교하고, 현재 정규 요일/시간과 일치하면 단순 일정 변경 이력으로 간주
        const kstDateStr = getKstDate(s.scheduled_at);
        const origins = Array.isArray(s.reschedule_origin_dates) ? s.reschedule_origin_dates : [];
        const isMakeup = origins.some(d => d !== kstDateStr) && !matchesRegularSchedule(s, student);
        const ct = s.cancellation_type;
        const direction = s.carryover_direction ?? (s.is_carryover ? "prev" : null);

        // 이월 마크 카운트 (취소 카테고리와 독립, 진행 여부 무관)
        // 강사취소(instructor_cancel)는 자동 다음달 보강 보장이므로 이월(당월)에 자동 포함
        if (direction === "next" || ct === "instructor_cancel") carryover++;
        if (direction === "prev") carryover_in++;

        // 보강 카운트: 완료/예정 무관하게 보강 세션이면 +1 (단, 취소된 보강은 제외)
        if (isMakeup && !ct) makeup++;

        // 분류 우선순위:
        // 1) 취소 카테고리가 있으면 해당 카테고리로 분류 (이월 여부와 독립)
        // 2) 완료(ended_at) → 완료 +1, 보강이면 보강 카운트는 위에서 이미 처리됨
        // 3) 미진행 prev 이월 → 이월(전월) 컬럼만
        // 4) 미진행 next 이월 → 이월(당월) 컬럼만
        // 5) 미진행 보강 → 보강 카운트는 위에서, 추가 분류는 안 함 (예정에도 미체크에도 안 들어감)
        // 6) 시간 지남 → 미체크
        // 7) 그 외 → 예정
        if (ct === "no_show") no_show++;
        else if (ct === "student_cancel") same_day_cancel++;
        else if (ct === "sick") {
          sick++;
          // 이 병결 원본의 KST 날짜에 매칭되는 보강이 없으면 unmatched
          if (!makeupOriginDates.has(kstDateStr)) sick_unmatched++;
        }
        else if (ct === "instructor_cancel") instructor_cancel++;
        else if (ct === "advance_cancel") advance_cancel++;
        else if (s.ended_at) {
          completed++;
          if (isMakeup) makeup_completed++;
        } else if (direction === "prev") {
          // 미진행 전월 이월 — '이월(전월)' 컬럼에만 카운트
        } else if (direction === "next") {
          // 당월 이월 처리된 세션은 미체크/예정에 포함하지 않음
        } else if (new Date(s.scheduled_at).getTime() < Date.now()) {
          // 미진행 + 시간 지남 → 미체크 (보강도 동일하게 미체크 처리)
          unchecked++;
        } else {
          // 미진행 + 미래 → 예정 (보강 미진행 세션도 예정에 포함)
          scheduled++;
        }
      });

      // 새 정의: 전체 = 완료 + 노쇼 + 당일취소 - 이월(전월)
      // (완료에는 이미 보강 완료 + 이월(전월) 완료가 모두 포함됨)
      const total = completed + no_show + same_day_cancel - carryover_in;
      const prev_carryover_in = prevCarryoverByStudent.get(student.student_name) || 0;
      // 실수업 = 완료 (보강·이월 완료가 모두 합쳐진 값)
      const actual_lessons = completed;
      // Billable = base monthly count (4) - previous month's carryovers (next + instructor cancel)
      // All students pay for 4 sessions per month by default
      const BASE_MONTHLY_COUNT = 4;
      const computed_billable = Math.max(0, BASE_MONTHLY_COUNT - prev_carryover_in);
      const overrideVal = billableOverrides.get(student.student_name);
      const billable_overridden = overrideVal !== undefined;
      const billable = billable_overridden ? overrideVal! : computed_billable;

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
        makeup,
        sick_unmatched,
        no_show,
        same_day_cancel,
        sick,
        instructor_cancel,
        advance_cancel,
        unchecked,
        scheduled,
        carryover,
        carryover_in,
        prev_carryover_in,
        actual_lessons,
        billable,
        billable_overridden,
        computed_billable,
        total,
      };
    }).filter(r =>
      r.total > 0 ||
      r.prev_carryover_in > 0 ||
      r.carryover_in > 0 ||
      r.scheduled > 0 ||
      r.unchecked > 0 ||
      r.carryover > 0
    );

    return result.sort((a, b) => {
      if (a.is_corporate !== b.is_corporate) return a.is_corporate ? 1 : -1;
      if (a.instructor_name !== b.instructor_name) return a.instructor_name.localeCompare(b.instructor_name, "ko");
      return a.student_name.localeCompare(b.student_name, "ko");
    });
  }, [students, sessions, pauses, prevCarryoverByStudent, billableOverrides, currentRange]);

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
      makeup: sum("makeup"),
      sick_unmatched: sum("sick_unmatched"),
      no_show: sum("no_show"),
      same_day_cancel: sum("same_day_cancel"),
      sick: sum("sick"),
      instructor_cancel: sum("instructor_cancel"),
      advance_cancel: sum("advance_cancel"),
      unchecked: sum("unchecked"),
      scheduled: sum("scheduled"),
      carryover: sum("carryover"),
      carryover_in: sum("carryover_in"),
      prev_carryover_in: sum("prev_carryover_in"),
      actual_lessons: sum("actual_lessons"),
      billable: rows.reduce((s, r) => s + (r.is_corporate ? 0 : r.billable), 0),
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
      billable: list.reduce((s, r) => s + (r.is_corporate ? 0 : r.billable), 0),
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
                <th className="px-2 py-2 font-semibold text-accent-foreground text-center bg-accent/10" title="당월에서 다음달로 이월">이월(당월)</th>
                <th className="px-2 py-2 font-semibold text-accent-foreground text-center bg-accent/10" title="전월에서 당월로 이월된 수업">이월(전월)</th>
                <th className="px-2 py-2 font-semibold text-muted-foreground text-center bg-muted/30" title="전월의 '당월 이월(next)' + 강사취소 → 당월 결제에서 차감">전월차감</th>
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
                        title="강사 수업노트 열기 (새 탭)"
                        onClick={() => window.open(`/my/classnote?name=${encodeURIComponent(r.student_name)}&sidebar=open`, "_blank", "noopener,noreferrer")}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center font-semibold text-success">{r.completed || "-"}</td>
                  <td className="px-2 py-2 text-center font-semibold text-primary">{r.makeup || "-"}</td>
                  <td className="px-2 py-2 text-center font-semibold text-warning">{r.no_show || "-"}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{r.same_day_cancel || "-"}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">
                    {r.sick ? (
                      <span className="inline-flex items-center gap-0.5">
                        {r.sick}
                        {r.sick_unmatched ? (
                          <span title={`보강이 아직 잡히지 않은 병결 ${r.sick_unmatched}건`} className="text-warning font-bold">⚠</span>
                        ) : null}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{r.instructor_cancel || "-"}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{r.advance_cancel || "-"}</td>
                  <td className="px-2 py-2 text-center font-semibold text-warning">{r.unchecked || "-"}</td>
                  <td className="px-2 py-2 text-center font-semibold text-accent-foreground bg-accent/5">{r.carryover || "-"}</td>
                  <td className="px-2 py-2 text-center font-semibold text-accent-foreground bg-accent/5">{r.carryover_in || "-"}</td>
                  <td className="px-2 py-2 text-center font-semibold text-muted-foreground bg-muted/20">{r.prev_carryover_in ? `-${r.prev_carryover_in}` : "-"}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{r.scheduled || "-"}</td>
                  <td className={cn(
                    "px-2 py-2 text-center font-bold",
                    r.total !== r.billable ? "text-warning bg-warning/10" : "text-foreground"
                  )} title={r.total !== r.billable ? `전체(${r.total}) ≠ 결제대상(${r.billable})` : undefined}>
                    {r.total !== r.billable && r.total + r.scheduled !== r.billable ? `⚠ ${r.total}` : r.total}
                  </td>
                  <td className="px-2 py-2 text-center font-bold text-success bg-success/5">{r.actual_lessons}</td>
                  <td className={cn(
                    "px-2 py-2 text-center font-bold bg-primary/5",
                    r.is_corporate
                      ? "text-muted-foreground"
                      : r.billable_overridden
                        ? "text-warning bg-warning/10"
                        : r.total !== r.billable
                          ? "text-warning bg-warning/10"
                          : "text-primary"
                  )} title={
                    r.is_corporate
                      ? "기업 수강생은 결제대상 미산정"
                      : r.billable_overridden
                        ? `자동값 ${r.computed_billable} → 수동 ${r.billable}`
                        : (r.total !== r.billable ? `전체(${r.total}) ≠ 결제대상(${r.billable})` : (r.billable !== 4 ? `결제대상이 4회가 아님 (${r.billable}회)` : undefined))
                  }>
                    {r.is_corporate ? (
                      <span className="text-muted-foreground/40">—</span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-1">
                        {r.billable !== 4 && (
                          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                        {r.billable}
                      </span>
                    )}
                  </td>
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
        <span className="px-2 py-1 rounded bg-primary/10 text-primary font-semibold">보강 {totals.makeup}</span>
        <span className="px-2 py-1 rounded bg-warning/10 text-warning font-semibold">노쇼 {totals.no_show}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">당일취소 {totals.same_day_cancel}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">
          병결 {totals.sick}
          {totals.sick_unmatched ? <span className="text-warning ml-0.5" title={`보강 미배정 ${totals.sick_unmatched}건`}>⚠</span> : null}
        </span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">강사취소 {totals.instructor_cancel}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">사전취소 {totals.advance_cancel}</span>
        <span className="px-2 py-1 rounded bg-warning/10 text-warning font-semibold">미체크 {totals.unchecked}</span>
        <span className="px-2 py-1 rounded bg-accent/15 text-accent-foreground font-semibold border border-accent/30">이월(당월) {totals.carryover}</span>
        <span className="px-2 py-1 rounded bg-accent/15 text-accent-foreground font-semibold border border-accent/30">이월(전월) {totals.carryover_in}</span>
        <span className="px-2 py-1 rounded bg-muted/40 text-muted-foreground font-semibold">전월차감 -{totals.prev_carryover_in}</span>
        <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-semibold">예정 {totals.scheduled}</span>
        <span className="px-2 py-1 rounded bg-foreground/10 text-foreground font-bold">전체 {totals.total}</span>
        <span className="px-2 py-1 rounded bg-success/15 text-success font-bold ml-auto">실수업 {totals.actual_lessons}</span>
        <span className="px-2 py-1 rounded bg-primary text-primary-foreground font-bold">결제대상 {totals.billable}</span>
      </div>

      <p className="text-[10px] text-muted-foreground -mt-2">
        💡 <span className="font-semibold">전체</span> = 완료 + 노쇼 + 당일 − 이월(전월) · <span className="font-semibold">실수업</span> = 완료 (보강·이월(전월) 완료 포함) · <span className="font-semibold">이월(당월)</span> = 수동 next 토글 + 강사취소 자동 합산 · <span className="font-semibold">결제대상</span> = 4 − 이월(전월) · <span className="text-warning font-semibold">⚠ 전체 ≠ 결제대상이면 표시</span>
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
          computedBillable={rows.find(r => r.student_name === editingStudent)?.computed_billable}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
