import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import CorporateReportPreviewModal from "./CorporateReportPreviewModal";
import SessionCountReport from "./SessionCountReport";
import AiProgramBudget from "./AiProgramBudget";
import { Receipt, Loader2, ChevronLeft, ChevronRight, Check, Phone, Building2, Plus, Minus, X, FileText, ClipboardList, CheckCircle, RefreshCw, Pencil, BarChart3, CheckSquare, Download, PauseCircle, UserMinus, UserPlus, AlertCircle, Trash2, Settings2, RotateCcw, Wallet, Store, TrendingDown, Sparkles, Gift, PieChart } from "lucide-react";
import { fetchAiProgramTotals, type AiTotals } from "@/lib/aiProgramTotals";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const TEST_ACCOUNTS = ["test", "test 2", "test2"];
const LESSON_PRICE = 50000;
const GROUP_LESSON_PRICE = 70000;

interface StudentRecord {
  student_name: string;
  schedules: string | null;
  student_type: string;
  status: string | null;
  group_students: string[];
  start_date: string | null;
  pause_start: string | null;
  pause_end: string | null;
  end_date: string | null;
  cash_payment: boolean;
  corporate_rate: number | null;
  tax_invoice: boolean;
  corporate_role: string | null;
  corporate_account: string | null;
}

const STORE_FEE_RATE = 0.0495; // 스마트스토어 수수료 4.95%
const BIZ_INCOME_TAX_RATE = 0.033; // 사업소득 원천징수 3.3%

interface ScheduleSlot { day: string; time: string; frequency?: string; }

interface CashReceipt {
  student_name: string;
  receipt_type: string;
  receipt_number: string;
  recurring: boolean;
  recurring_attendance: boolean;
}

interface PaymentConfirmation {
  id: string;
  student_name: string;
  month: string;
  confirmed: boolean;
  note: string | null;
}

interface PrepaidCredit {
  id: string;
  student_name: string;
  total_sessions: number;
  used_sessions: number;
  note: string | null;
  created_at: string;
}

interface PrepaidDeduction {
  student_name: string;
  month: string;
  deducted_sessions: number;
}

interface AttendanceRequest {
  id: string;
  user_name: string;
  description: string;
  status: string;
  created_at: string;
}

const calcBaseLessons = (raw: string | null): number => {
  if (!raw) return 4;
  try {
    const slots: ScheduleSlot[] = JSON.parse(raw);
    if (slots.length === 0) return 4;
    return slots.reduce((sum, slot) => {
      const freq = slot.frequency || "weekly";
      return sum + (freq === "weekly" ? 4 : 2);
    }, 0);
  } catch { return 4; }
};

export default function CashReceiptManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [receipts, setReceipts] = useState<CashReceipt[]>([]);
  const [confirmations, setConfirmations] = useState<PaymentConfirmation[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Map<string, number>>(new Map());
  const [billableCounts, setBillableCounts] = useState<Map<string, number>>(new Map());
  const [corpSessionCounts, setCorpSessionCounts] = useState<Map<string, number>>(new Map());
  const [prepaidCredits, setPrepaidCredits] = useState<PrepaidCredit[]>([]);
  const [deductions, setDeductions] = useState<PrepaidDeduction[]>([]);
  const [creditModal, setCreditModal] = useState<{ name: string; existing?: PrepaidCredit } | null>(null);
  const [creditInput, setCreditInput] = useState({ sessions: "", note: "" });
  const [reportPreview, setReportPreview] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState<string | null>(null);
  const [attendanceRequests, setAttendanceRequests] = useState<AttendanceRequest[]>([]);
  const [feeOverrides, setFeeOverrides] = useState<Map<string, number>>(new Map());
  const [editingFee, setEditingFee] = useState<string | null>(null);
  const [editingFeeValue, setEditingFeeValue] = useState("");
  const [deductModal, setDeductModal] = useState<string | null>(null);
  const [deductCount, setDeductCount] = useState("");
  const [activeTab, setActiveTab] = useState<"count" | "payment" | "ai" | "budget" | "summary">("count");
  const [pauseRanges, setPauseRanges] = useState<Map<string, { start: string; end: string | null }[]>>(new Map());
  const [refundFlags, setRefundFlags] = useState<Set<string>>(new Set());
  const [renewalWithdrawn, setRenewalWithdrawn] = useState<Set<string>>(new Set());
  // Per-month cash payment override map (true = cash this month, false = store this month, undefined = use student default)
  const [cashOverrides, setCashOverrides] = useState<Map<string, boolean>>(new Map());
  // Per-month tax-invoice override for corporate students (true = 계산서 발급, false = 사업소득 3.3%, undefined = use student default)
  const [taxOverrides, setTaxOverrides] = useState<Map<string, boolean>>(new Map());
  // Per-month remark text per student (free-form 비고)
  const [remarks, setRemarks] = useState<Map<string, string>>(new Map());
  const [remarkDrafts, setRemarkDrafts] = useState<Map<string, string>>(new Map());
  // AI program totals + manual store reward for the current month — used in 예산 요약 tab
  const [aiTotals, setAiTotals] = useState<AiTotals>({ count: 0, gross: 0, net: 0, fee: 0 });
  const [storeReward, setStoreReward] = useState<{ amount: number; note: string | null } | null>(null);
  const [rewardEdit, setRewardEdit] = useState<{ amount: string; note: string } | null>(null);
  const [rewardSaving, setRewardSaving] = useState(false);

  // Receipt management state
  const [receiptModal, setReceiptModal] = useState<{ mode: "create" | "edit"; data?: CashReceipt } | null>(null);
  const [receiptInput, setReceiptInput] = useState<{ student_name: string; receipt_type: string; receipt_number: string; recurring: boolean; recurring_attendance: boolean }>({ student_name: "", receipt_type: "phone", receipt_number: "", recurring: false, recurring_attendance: false });
  const [showAllReceipts, setShowAllReceipts] = useState(false);

  // Attendance request management state
  const [attendModal, setAttendModal] = useState<{ mode: "create" | "edit"; data?: AttendanceRequest } | null>(null);
  const [attendInput, setAttendInput] = useState<{ user_name: string; period_text: string }>({ user_name: "", period_text: "" });

  interface SchedulePeriod { id: string; label: string; start_date: string; end_date: string; is_active: boolean; }
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [periodIdx, setPeriodIdx] = useState(0);
  const currentPeriod = periods[periodIdx] || null;
  const periodKey = currentPeriod?.id || "";
  const periodLabel = currentPeriod?.label || "";

  const prevPeriod = () => setPeriodIdx(i => Math.min(i + 1, periods.length - 1));
  const nextPeriod = () => setPeriodIdx(i => Math.max(i - 1, 0));

  const periodStart = currentPeriod ? `${currentPeriod.start_date}T00:00:00+09:00` : "";
  const periodEnd = currentPeriod ? `${currentPeriod.end_date}T23:59:59+09:00` : "";

  // Calendar month range for corporate students — POSTPAID: current period (e.g. April)
  // bills the PREVIOUS calendar month's sessions (March). Always shift back by 1 month.
  const corpAnchor = currentPeriod ? new Date(currentPeriod.start_date) : new Date();
  const corpAnchorYear = corpAnchor.getFullYear();
  const corpAnchorMon = corpAnchor.getMonth() + 1; // 1-12 of the period (billing) month
  // Previous month (the month whose sessions are being billed)
  const corpMon = corpAnchorMon === 1 ? 12 : corpAnchorMon - 1;
  const corpYear = corpAnchorMon === 1 ? corpAnchorYear - 1 : corpAnchorYear;
  const corpMonthStart = `${corpYear}-${String(corpMon).padStart(2, "0")}-01T00:00:00+09:00`;
  const corpNextMon = corpMon === 12 ? 1 : corpMon + 1;
  const corpNextYear = corpMon === 12 ? corpYear + 1 : corpYear;
  const corpMonthEnd = `${corpNextYear}-${String(corpNextMon).padStart(2, "0")}-01T00:00:00+09:00`;
  const corpMonthLabel = `${corpYear}년 ${corpMon}월`;

  // AI program month key: derived from current period's start_date (YYYY-MM)
  const aiMonthKey = currentPeriod ? currentPeriod.start_date.slice(0, 7) : "";
  const aiMonthLabel = currentPeriod ? `${corpAnchorYear}년 ${corpAnchorMon}월` : "";

  // Load periods first, then data
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("schedule_periods").select("*").order("start_date", { ascending: false });
      const all = (data || []) as SchedulePeriod[];
      setPeriods(all);
      const activeIdx = all.findIndex(p => p.is_active);
      setPeriodIdx(activeIdx >= 0 ? activeIdx : 0);
    })();
  }, []);

  const loadData = useCallback(async () => {
    if (!currentPeriod) return;
    setLoading(true);

    // Find previous period for carryover deduction (same logic as SessionCountReport)
    const sortedPeriods = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const curIdx = sortedPeriods.findIndex(p => p.id === currentPeriod.id);
    const prevPeriodRange = curIdx > 0 ? sortedPeriods[curIdx - 1] : null;
    const prevStart = prevPeriodRange ? `${prevPeriodRange.start_date}T00:00:00+09:00` : "";
    const prevEnd = prevPeriodRange ? `${prevPeriodRange.end_date}T23:59:59+09:00` : "";

    const [studRes, receiptRes, confRes, sessRes, corpSessRes, creditRes, dedRes, attendRes, rescheduledOutRes, pauseRes, prevSessRes, billableOvRes] = await Promise.all([
      // Fetch all (active + paused + inactive) so we can show breakdown counts
      supabase.from("instructor_students").select("id, student_name, schedules, student_type, status, group_students, start_date, pause_start, pause_end, end_date, cash_payment, corporate_rate, tax_invoice, corporate_role, corporate_account"),
      supabase.from("cash_receipts" as any).select("student_name, receipt_type, receipt_number, recurring, recurring_attendance"),
      supabase.from("payment_confirmations" as any).select("*").eq("month", periodKey),
      // Regular: period-based — also fetch reschedule_origin_dates
      supabase.from("class_sessions").select("student_name, scheduled_at, reschedule_origin_dates").gte("scheduled_at", periodStart).lte("scheduled_at", periodEnd),
      // Corporate: calendar month-based
      supabase.from("class_sessions").select("student_name, scheduled_at, reschedule_origin_dates").gte("scheduled_at", corpMonthStart).lt("scheduled_at", corpMonthEnd),
      supabase.from("prepaid_credits" as any).select("*"),
      supabase.from("prepaid_deductions" as any).select("*").eq("month", periodKey),
      supabase.from("support_requests").select("id, user_name, description, status, created_at").eq("category", "attendance").order("created_at", { ascending: false }),
      // Sessions rescheduled OUT of this period (scheduled outside but origin date possibly in this period)
      supabase.from("class_sessions").select("student_name, scheduled_at, reschedule_origin_dates")
        .not("reschedule_origin_dates", "eq", "{}")
        .or(`scheduled_at.lt.${periodStart},scheduled_at.gt.${periodEnd}`),
      supabase.from("student_pauses").select("student_id, pause_start, pause_end"),
      // Previous period sessions for carryover-in deduction
      prevPeriodRange
        ? supabase.from("class_sessions")
            .select("student_name, is_carryover, carryover_direction, cancellation_type")
            .gte("scheduled_at", prevStart).lte("scheduled_at", prevEnd)
        : Promise.resolve({ data: [] as { student_name: string; is_carryover: boolean; carryover_direction: string | null; cancellation_type: string | null }[] }),
      // Billable count overrides for this period
      supabase.from("billable_overrides").select("student_name, billable_count")
        .eq("period_start", currentPeriod.start_date).eq("period_end", currentPeriod.end_date),
    ]);
    const studData = (studRes.data || []) as (StudentRecord & { id: string })[];
    setStudents(studData);
    setReceipts((receiptRes.data as any as CashReceipt[]) || []);
    const confs = (confRes.data as any as PaymentConfirmation[]) || [];
    setConfirmations(confs);
    setPrepaidCredits((creditRes.data as any as PrepaidCredit[]) || []);
    setDeductions((dedRes.data as any as PrepaidDeduction[]) || []);
    setAttendanceRequests((attendRes.data as any as AttendanceRequest[]) || []);

    // Renewal withdrawals for current period
    supabase.from("renewal_confirmations")
      .select("student_name, decision")
      .eq("period_id", currentPeriod.id)
      .eq("decision", "withdraw")
      .then(({ data }) => setRenewalWithdrawn(new Set((data || []).map((r: any) => r.student_name))));

    // Build pauses by student_name (resolved via instructor_students.id)
    const idToName = new Map(studData.map(s => [s.id, s.student_name]));
    const pauseMap = new Map<string, { start: string; end: string | null }[]>();
    ((pauseRes.data || []) as { student_id: string; pause_start: string; pause_end: string | null }[]).forEach(p => {
      const name = idToName.get(p.student_id);
      if (!name) return;
      const arr = pauseMap.get(name) || [];
      arr.push({ start: p.pause_start, end: p.pause_end });
      pauseMap.set(name, arr);
    });
    setPauseRanges(pauseMap);

    // Extract fee overrides + refund flags + cash overrides from confirmation notes
    const overrides = new Map<string, number>();
    const refunds = new Set<string>();
    const cashOv = new Map<string, boolean>();
    const taxOv = new Map<string, boolean>();
    const remarkMap = new Map<string, string>();
    confs.forEach(c => {
      if (c.note) {
        try {
          const parsed = JSON.parse(c.note);
          if (typeof parsed.fee_override === "number") {
            overrides.set(c.student_name, parsed.fee_override);
          }
          if (parsed.refund === true) {
            refunds.add(c.student_name);
          }
          if (typeof parsed.cash_override === "boolean") {
            cashOv.set(c.student_name, parsed.cash_override);
          }
          if (typeof parsed.tax_invoice_override === "boolean") {
            taxOv.set(c.student_name, parsed.tax_invoice_override);
          }
          if (typeof parsed.remark === "string" && parsed.remark.trim()) {
            remarkMap.set(c.student_name, parsed.remark);
          }
        } catch { /* not JSON, ignore */ }
      }
    });
    setFeeOverrides(overrides);
    setRefundFlags(refunds);
    setCashOverrides(cashOv);
    setTaxOverrides(taxOv);
    setRemarks(remarkMap);
    setRemarkDrafts(new Map(remarkMap));

    // Count sessions per student, attributing rescheduled sessions to their original period
    const pStart = currentPeriod.start_date;
    const pEnd = currentPeriod.end_date;
    const counts = new Map<string, number>();

    // 1) Sessions scheduled within this period
    (sessRes.data || []).forEach((s: any) => {
      const origins: string[] = Array.isArray(s.reschedule_origin_dates) ? s.reschedule_origin_dates : [];
      if (origins.length > 0) {
        const lastOrigin = origins[origins.length - 1];
        if (lastOrigin >= pStart && lastOrigin <= pEnd) {
          counts.set(s.student_name, (counts.get(s.student_name) || 0) + 1);
        }
        // Original date outside this period — skip, belongs to another period
      } else {
        counts.set(s.student_name, (counts.get(s.student_name) || 0) + 1);
      }
    });

    // 2) Sessions rescheduled OUT (scheduled outside this period but origin in this period)
    (rescheduledOutRes.data || []).forEach((s: any) => {
      const origins: string[] = Array.isArray(s.reschedule_origin_dates) ? s.reschedule_origin_dates : [];
      if (origins.length > 0) {
        const lastOrigin = origins[origins.length - 1];
        if (lastOrigin >= pStart && lastOrigin <= pEnd) {
          counts.set(s.student_name, (counts.get(s.student_name) || 0) + 1);
        }
      }
    });

    setSessionCounts(counts);

    const corpCounts = new Map<string, number>();
    (corpSessRes.data || []).forEach((s: any) => {
      corpCounts.set(s.student_name, (corpCounts.get(s.student_name) || 0) + 1);
    });
    setCorpSessionCounts(corpCounts);

    // Compute billable count map (same formula as SessionCountReport):
    // billable = override ?? max(0, 4 - prev_carryover_in)
    // prev_carryover_in = prev period sessions where cancellation_type='instructor_cancel' OR carryover_direction='next'
    const prevCarryMap = new Map<string, number>();
    ((prevSessRes.data || []) as { student_name: string; carryover_direction: string | null; cancellation_type: string | null }[]).forEach(r => {
      if (r.cancellation_type === "instructor_cancel" || r.carryover_direction === "next") {
        prevCarryMap.set(r.student_name, (prevCarryMap.get(r.student_name) || 0) + 1);
      }
    });
    const ovMap = new Map<string, number>();
    ((billableOvRes.data || []) as { student_name: string; billable_count: number }[]).forEach(o => {
      ovMap.set(o.student_name, o.billable_count);
    });
    const BASE = 4;
    const billable = new Map<string, number>();
    studData.forEach(s => {
      const ov = ovMap.get(s.student_name);
      if (ov !== undefined) {
        billable.set(s.student_name, ov);
      } else {
        const prev = prevCarryMap.get(s.student_name) || 0;
        billable.set(s.student_name, Math.max(0, BASE - prev));
      }
    });
    setBillableCounts(billable);

    setLoading(false);
  }, [currentPeriod, periodKey, periodStart, periodEnd, corpMonthStart, corpMonthEnd, periods]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load AI program totals + store reward whenever the period changes
  const aiMonthKeyForEffect = currentPeriod ? currentPeriod.start_date.slice(0, 7) : "";
  const loadSummaryExtras = useCallback(async () => {
    if (!aiMonthKeyForEffect) return;
    const [totals, rewardRes] = await Promise.all([
      fetchAiProgramTotals(aiMonthKeyForEffect),
      supabase.from("store_rewards" as any).select("amount, note").eq("month", aiMonthKeyForEffect).maybeSingle(),
    ]);
    setAiTotals(totals);
    const r = (rewardRes.data as unknown) as { amount: number; note: string | null } | null;
    setStoreReward(r ? { amount: r.amount, note: r.note } : { amount: 0, note: null });
  }, [aiMonthKeyForEffect]);
  useEffect(() => { loadSummaryExtras(); }, [loadSummaryExtras]);

  const saveStoreReward = async () => {
    if (!aiMonthKeyForEffect || !rewardEdit) return;
    const amount = Math.max(0, parseInt(rewardEdit.amount.replace(/[^0-9]/g, ""), 10) || 0);
    setRewardSaving(true);
    const { error } = await supabase.from("store_rewards" as any).upsert(
      { month: aiMonthKeyForEffect, amount, note: rewardEdit.note?.trim() || null },
      { onConflict: "month" }
    );
    setRewardSaving(false);
    if (error) {
      toast({ title: "리워드 저장 실패", description: error.message, variant: "destructive" });
      return;
    }
    setStoreReward({ amount, note: rewardEdit.note?.trim() || null });
    setRewardEdit(null);
    toast({ title: "스마트스토어 리워드가 저장되었습니다." });
  };


  const confMap = new Map(confirmations.map(c => [c.student_name, c]));
  const creditMap = new Map(prepaidCredits.map(c => [c.student_name, c]));
  const dedMap = new Map(deductions.map(d => [d.student_name, d]));
  const receiptMap = new Map(receipts.map(r => [r.student_name, r]));

  // Deduplicate by student_name (transfers / re-registrations create multiple records for the same student).
  // Priority:
  //   1) Prefer ACTIVE records over inactive (so re-registered students don't get hidden by an old inactive row)
  //   2) Within the same status, prefer the EARLIEST start_date so "신규" badge and period filtering
  //      reflect when the student actually started.
  const deduped = Array.from(
    students.reduce((map, s) => {
      const existing = map.get(s.student_name);
      if (!existing) { map.set(s.student_name, s); return map; }
      const existingActive = existing.status === "active";
      const currentActive = s.status === "active";
      if (currentActive && !existingActive) { map.set(s.student_name, s); return map; }
      if (!currentActive && existingActive) return map;
      // Same activeness — pick earliest start_date
      const a = existing.start_date || "9999-12-31";
      const b = s.start_date || "9999-12-31";
      if (b < a) map.set(s.student_name, s);
      return map;
    }, new Map<string, StudentRecord>()).values()
  );

  // Filter helpers based on the currently selected period
  const pStartDate = currentPeriod?.start_date || "";
  const pEndDate = currentPeriod?.end_date || "";
  const isPauseCoveringPeriod = (start: string, end: string | null) => {
    if (!pStartDate || !pEndDate) return false;
    return start <= pStartDate && (!end || end >= pEndDate);
  };
  const isWithinPeriod = (s: StudentRecord) => {
    // Exclude students who haven't started yet by the end of this period (e.g. enrolled May → not in April list)
    if (s.start_date && pEndDate && s.start_date > pEndDate) return false;
    // Exclude students whose pause fully covers the period — check inline pause fields…
    if (s.pause_start && isPauseCoveringPeriod(s.pause_start, s.pause_end)) return false;
    // …and also any pause range stored in student_pauses table
    const ranges = pauseRanges.get(s.student_name) || [];
    if (ranges.some(r => isPauseCoveringPeriod(r.start, r.end))) return false;
    return true;
  };

  // Non-corporate students for breakdown counts (active / paused / withdrawn)
  const nonCorpStudents = deduped.filter(s => s.student_type !== "corporate" && !TEST_ACCOUNTS.includes(s.student_name));

  const isPausedOnPeriod = (s: StudentRecord) => {
    if (s.pause_start && isPauseCoveringPeriod(s.pause_start, s.pause_end)) return true;
    const ranges = pauseRanges.get(s.student_name) || [];
    return ranges.some(r => isPauseCoveringPeriod(r.start, r.end));
  };

  // Regular = active + within period (DON'T hide paused/withdrawn that already have confirmation/receipts —
  // they show as a row with a refund badge so admins can track them).
  // Include any student that EITHER (a) is currently active and within period, OR
  // (b) has any payment_confirmation/cash_receipt for this period (so existing records remain visible).
  const regularStudents = nonCorpStudents
    .filter(s => {
      const baseEligible = s.status === "active" && isWithinPeriod(s);
      const hasConfRecord = confMap.has(s.student_name);
      // Inactive students who were still active during this period (end_date after period end)
      // — they should appear in past period views as billable.
      const wasActiveInPastPeriod =
        s.status === "inactive" &&
        s.end_date && pEndDate && s.end_date > pEndDate &&
        (!s.start_date || !pEndDate || s.start_date <= pEndDate);
      return baseEligible || hasConfRecord || wasActiveInPastPeriod;
    })
    .sort((a, b) => a.student_name.localeCompare(b.student_name, "ko"));

  // Helper: total session count for a non-corporate student in this period (billable or raw).
  const periodSessionCount = (name: string): number => {
    if (billableCounts.has(name)) return billableCounts.get(name) || 0;
    return sessionCounts.get(name) || 0;
  };

  // Paused = full-period pause OR (active status but 0 sessions in this period AND a current pause covers part of it)
  const pausedStudents = nonCorpStudents
    .filter(s => {
      // Must have started by end of period
      if (s.start_date && pEndDate && s.start_date > pEndDate) return false;
      // Original: full-period pause
      if (isPausedOnPeriod(s)) return true;
      // Carry-over rule (cnt=0 + currently paused)
      const cnt = periodSessionCount(s.student_name);
      if (cnt === 0 && s.status === "active") {
        const today = new Date().toISOString().slice(0, 10);
        const inlinePauseActive = s.pause_start && s.pause_start <= today && (!s.pause_end || s.pause_end >= today);
        if (inlinePauseActive) return true;
      }
      return false;
    })
    .sort((a, b) => a.student_name.localeCompare(b.student_name, "ko"));

  // Withdrawn = inactive AND (end_date in period OR no end_date but 0 sessions in period)
  const withdrawnStudents = nonCorpStudents
    .filter(s => {
      if (s.status !== "inactive") return false;
      if (s.end_date && pStartDate && pEndDate && s.end_date >= pStartDate && s.end_date <= pEndDate) return true;
      // Inactive but end_date outside period — only count if they had ZERO sessions this period
      // (i.e. the withdrawal effectively applies to this billing month)
      const cnt = periodSessionCount(s.student_name);
      if (cnt === 0) return true;
      return false;
    })
    .sort((a, b) => a.student_name.localeCompare(b.student_name, "ko"));

  // New = active AND start_date falls within the selected period (first month of class)
  const newStudents = nonCorpStudents
    .filter(s => s.status === "active")
    .filter(s => {
      if (!s.start_date || !pStartDate || !pEndDate) return false;
      return s.start_date >= pStartDate && s.start_date <= pEndDate;
    })
    .sort((a, b) => a.student_name.localeCompare(b.student_name, "ko"));

  const corporateStudents = deduped
    .filter(s => s.student_type === "corporate" && !TEST_ACCOUNTS.includes(s.student_name))
    .filter(isWithinPeriod)
    .sort((a, b) => a.student_name.localeCompare(b.student_name, "ko"));

  const toggleConfirm = async (studentName: string) => {
    const existing = confMap.get(studentName);
    const nowIso = new Date().toISOString();
    if (existing) {
      // Toggle confirmed flag locally first, then persist
      const next = !existing.confirmed;
      setConfirmations(prev => prev.map(c => c.id === existing.id ? { ...c, confirmed: next } : c));
      await supabase.from("payment_confirmations" as any).update({ confirmed: next, confirmed_at: next ? nowIso : null } as any).eq("id", existing.id);
    } else {
      const { data } = await supabase.from("payment_confirmations" as any).insert({ student_name: studentName, month: periodKey, confirmed: true, confirmed_at: nowIso } as any).select().single();
      if (data) setConfirmations(prev => [...prev, data as unknown as PaymentConfirmation]);
    }
  };

  // Deduct specified sessions from prepaid balance
  const deductMonth = async (studentName: string, customCount?: number) => {
    const credit = creditMap.get(studentName);
    if (!credit) return;
    const remaining = credit.total_sessions - credit.used_sessions;
    const toDeduct = customCount ?? Math.min(calcBaseLessons(students.find(s => s.student_name === studentName)?.schedules || null), remaining);
    if (toDeduct <= 0) { toast({ title: "차감 불가", description: "잔여 횟수가 없습니다.", variant: "destructive" }); return; }
    if (toDeduct > remaining) { toast({ title: "차감 불가", description: `잔여 ${remaining}회보다 많습니다.`, variant: "destructive" }); return; }

    const existingDed = dedMap.get(studentName);
    if (existingDed) {
      toast({ title: "이미 차감됨", description: `${periodLabel} 이미 ${existingDed.deducted_sessions}회 차감됨` }); return;
    }
    const { data: newDed } = await supabase.from("prepaid_deductions" as any).insert({ student_name: studentName, month: periodKey, deducted_sessions: toDeduct } as any).select().single();
    await supabase.from("prepaid_credits" as any).update({ used_sessions: credit.used_sessions + toDeduct, updated_at: new Date().toISOString() } as any).eq("id", credit.id);
    // Optimistic local update
    if (newDed) setDeductions(prev => [...prev, newDed as unknown as PrepaidDeduction]);
    setPrepaidCredits(prev => prev.map(c => c.id === credit.id ? { ...c, used_sessions: c.used_sessions + toDeduct } : c));
    toast({ title: `${toDeduct}회 차감 완료` });
    setDeductModal(null);
    setDeductCount("");
  };

  // Undo deduction
  const undoDeduct = async (studentName: string) => {
    const ded = dedMap.get(studentName);
    const credit = creditMap.get(studentName);
    if (!ded || !credit) return;
    await supabase.from("prepaid_deductions" as any).delete().eq("student_name", studentName).eq("month", periodKey);
    await supabase.from("prepaid_credits" as any).update({ used_sessions: Math.max(0, credit.used_sessions - ded.deducted_sessions), updated_at: new Date().toISOString() } as any).eq("id", credit.id);
    // Optimistic local update
    setDeductions(prev => prev.filter(d => !(d.student_name === studentName && d.month === periodKey)));
    setPrepaidCredits(prev => prev.map(c => c.id === credit.id ? { ...c, used_sessions: Math.max(0, c.used_sessions - ded.deducted_sessions) } : c));
    toast({ title: "차감 취소 완료" });
  };

  const savePrepaidCredit = async () => {
    if (!creditModal) return;
    const sessions = parseInt(creditInput.sessions);
    if (isNaN(sessions) || sessions <= 0) { toast({ title: "유효한 횟수를 입력하세요", variant: "destructive" }); return; }

    if (creditModal.existing) {
      // Add to existing
      await supabase.from("prepaid_credits" as any).update({
        total_sessions: creditModal.existing.total_sessions + sessions,
        note: creditInput.note || creditModal.existing.note,
        updated_at: new Date().toISOString(),
      } as any).eq("id", creditModal.existing.id);
    } else {
      await supabase.from("prepaid_credits" as any).insert({
        student_name: creditModal.name,
        total_sessions: sessions,
        used_sessions: 0,
        note: creditInput.note || null,
      } as any);
    }
    toast({ title: `선결제 ${sessions}회 등록 완료` });
    setCreditModal(null);
    setCreditInput({ sessions: "", note: "" });
    loadData();
  };

  const getFee = (s: StudentRecord) => {
    const override = feeOverrides.get(s.student_name);
    if (override !== undefined) return override;
    // Use billable count (= 결제대상) from session count report logic, not raw session count.
    // Falls back to raw session count if billable hasn't loaded yet.
    const count = billableCounts.has(s.student_name)
      ? (billableCounts.get(s.student_name) || 0)
      : (sessionCounts.get(s.student_name) || 0);
    return count * LESSON_PRICE;
  };

  const hasOverride = (name: string) => feeOverrides.has(name);

  // Helper: parse existing note JSON safely
  const parseNote = (note: string | null): Record<string, any> => {
    if (!note) return {};
    try { return JSON.parse(note); } catch { return {}; }
  };

  const saveFeeOverride = async (studentName: string, fee: number) => {
    const existing = confMap.get(studentName);
    const baseNote = existing ? parseNote(existing.note) : {};
    const noteData = JSON.stringify({ ...baseNote, fee_override: fee });
    if (existing) {
      await supabase.from("payment_confirmations" as any).update({ note: noteData } as any).eq("id", existing.id);
    } else {
      await supabase.from("payment_confirmations" as any).insert({ student_name: studentName, month: periodKey, confirmed: false, note: noteData } as any);
    }
    setEditingFee(null);
    setEditingFeeValue("");
    loadData();
  };

  const clearFeeOverride = async (studentName: string) => {
    const existing = confMap.get(studentName);
    if (existing) {
      const base = parseNote(existing.note);
      delete base.fee_override;
      const next = Object.keys(base).length > 0 ? JSON.stringify(base) : null;
      await supabase.from("payment_confirmations" as any).update({ note: next } as any).eq("id", existing.id);
    }
    loadData();
  };

  const toggleRefund = async (studentName: string) => {
    const existing = confMap.get(studentName);
    const base = existing ? parseNote(existing.note) : {};
    const next = !base.refund;
    if (next) base.refund = true; else delete base.refund;
    const noteData = Object.keys(base).length > 0 ? JSON.stringify(base) : null;
    if (existing) {
      await supabase.from("payment_confirmations" as any).update({ note: noteData } as any).eq("id", existing.id);
    } else if (next) {
      await supabase.from("payment_confirmations" as any).insert({ student_name: studentName, month: periodKey, confirmed: false, note: noteData } as any);
    }
    toast({ title: next ? "환불 표시 추가됨" : "환불 표시 제거됨" });
    loadData();
  };

  // Save free-form remark (비고) per student per month into payment_confirmations.note JSON
  const saveRemark = async (studentName: string, value: string) => {
    const trimmed = value.trim();
    const existing = confMap.get(studentName);
    const base = existing ? parseNote(existing.note) : {};
    if (trimmed) base.remark = trimmed;
    else delete base.remark;
    const noteData = Object.keys(base).length > 0 ? JSON.stringify(base) : null;
    if (existing) {
      await supabase.from("payment_confirmations" as any).update({ note: noteData } as any).eq("id", existing.id);
    } else if (trimmed) {
      await supabase.from("payment_confirmations" as any).insert({ student_name: studentName, month: periodKey, confirmed: false, note: noteData } as any);
    }
    setRemarks(prev => {
      const next = new Map(prev);
      if (trimmed) next.set(studentName, trimmed);
      else next.delete(studentName);
      return next;
    });
    loadData();
  };

  const isCashPayment = (s: StudentRecord): boolean => {
    const override = cashOverrides.get(s.student_name);
    if (override !== undefined) return override;
    return s.cash_payment === true;
  };
  // Whether this row has a per-month override (different from student default)
  const hasCashOverride = (name: string) => cashOverrides.has(name);

  // Cycle: default → opposite (override) → default (clear override) → ...
  // 3-state click: store-default → cash(override) → store(override) → store-default(clear)
  const cycleCashPayment = async (s: StudentRecord) => {
    const studentDefault = s.cash_payment === true;
    const currentOverride = cashOverrides.get(s.student_name);
    let nextOverride: boolean | null;
    if (currentOverride === undefined) {
      // No override → flip default
      nextOverride = !studentDefault;
    } else if (currentOverride !== studentDefault) {
      // Has override that flipped → switch to "explicit same as default" (still treated as override so it shows badge)
      nextOverride = studentDefault;
    } else {
      // Override already matches default → clear override
      nextOverride = null;
    }

    const existing = confMap.get(s.student_name);
    const base = existing ? parseNote(existing.note) : {};
    if (nextOverride === null) delete base.cash_override;
    else base.cash_override = nextOverride;
    const noteData = Object.keys(base).length > 0 ? JSON.stringify(base) : null;

    if (existing) {
      await supabase.from("payment_confirmations" as any).update({ note: noteData } as any).eq("id", existing.id);
    } else if (noteData) {
      await supabase.from("payment_confirmations" as any).insert({ student_name: s.student_name, month: periodKey, confirmed: false, note: noteData } as any);
    }
    loadData();
  };

  // Toggle student-level default (instructor_students.cash_payment)
  const toggleStudentCashDefault = async (s: StudentRecord) => {
    const next = !s.cash_payment;
    await supabase.from("instructor_students").update({ cash_payment: next }).eq("student_name", s.student_name);
    toast({ title: next ? `${s.student_name} — 항상 현금결제로 설정` : `${s.student_name} — 항상 스토어결제로 설정` });
    loadData();
  };

  // ===== Corporate tax-invoice toggle (계산서 발급 vs 사업소득 3.3% 공제) =====
  // Resolve effective tax-invoice status: per-month override → student default
  const isTaxInvoice = (s: StudentRecord): boolean => {
    const override = taxOverrides.get(s.student_name);
    if (override !== undefined) return override;
    return s.tax_invoice === true;
  };
  const hasTaxOverride = (name: string) => taxOverrides.has(name);

  // 3-state click cycle (mirrors cycleCashPayment)
  const cycleTaxInvoice = async (s: StudentRecord) => {
    const studentDefault = s.tax_invoice === true;
    const currentOverride = taxOverrides.get(s.student_name);
    let nextOverride: boolean | null;
    if (currentOverride === undefined) nextOverride = !studentDefault;
    else if (currentOverride !== studentDefault) nextOverride = studentDefault;
    else nextOverride = null;

    const existing = confMap.get(s.student_name);
    const base = existing ? parseNote(existing.note) : {};
    if (nextOverride === null) delete base.tax_invoice_override;
    else base.tax_invoice_override = nextOverride;
    const noteData = Object.keys(base).length > 0 ? JSON.stringify(base) : null;

    if (existing) {
      await supabase.from("payment_confirmations" as any).update({ note: noteData } as any).eq("id", existing.id);
    } else if (noteData) {
      await supabase.from("payment_confirmations" as any).insert({ student_name: s.student_name, month: periodKey, confirmed: false, note: noteData } as any);
    }
    loadData();
  };

  // Toggle student-level tax-invoice default
  const toggleStudentTaxDefault = async (s: StudentRecord) => {
    const next = !s.tax_invoice;
    await supabase.from("instructor_students").update({ tax_invoice: next } as any).eq("student_name", s.student_name);
    toast({ title: next ? `${s.student_name} — 항상 계산서 발급` : `${s.student_name} — 항상 사업소득 3.3%` });
    loadData();
  };


  const openReceiptCreate = () => {
    setReceiptInput({ student_name: "", receipt_type: "phone", receipt_number: "", recurring: false, recurring_attendance: false });
    setReceiptModal({ mode: "create" });
  };
  const openReceiptEdit = (r: CashReceipt) => {
    setReceiptInput({ student_name: r.student_name, receipt_type: r.receipt_type, receipt_number: r.receipt_number, recurring: r.recurring, recurring_attendance: r.recurring_attendance });
    setReceiptModal({ mode: "edit", data: r });
  };
  const saveReceipt = async () => {
    if (!receiptInput.student_name.trim()) { toast({ title: "학생명을 입력하세요", variant: "destructive" }); return; }
    const payload = {
      student_name: receiptInput.student_name.trim(),
      receipt_type: receiptInput.receipt_type,
      receipt_number: receiptInput.receipt_number.trim(),
      recurring: receiptInput.recurring,
      recurring_attendance: receiptInput.recurring_attendance,
    };
    if (receiptModal?.mode === "edit" && receiptModal.data) {
      // Find by student_name (no id field on type) — match exact original record
      const orig = receiptModal.data;
      // Delete original then insert if name changed; otherwise upsert by student_name
      if (orig.student_name !== payload.student_name) {
        // student_name is the natural key in the table — delete the old row and insert a new one
        await supabase.from("cash_receipts" as any).delete().eq("student_name", orig.student_name);
        await supabase.from("cash_receipts" as any).insert(payload as any);
      } else {
        await supabase.from("cash_receipts" as any).update(payload as any).eq("student_name", orig.student_name);
      }
      toast({ title: "현금영수증 정보 수정됨" });
    } else {
      // Create — upsert by student_name in case row exists
      const { error } = await supabase.from("cash_receipts" as any).upsert(payload as any, { onConflict: "student_name" } as any);
      if (error) { toast({ title: "저장 실패", description: error.message, variant: "destructive" }); return; }
      toast({ title: "현금영수증 정보 추가됨" });
    }
    setReceiptModal(null);
    loadData();
  };
  const deleteReceipt = async (studentName: string) => {
    if (!confirm(`${studentName}의 현금영수증 정보를 삭제하시겠습니까?`)) return;
    await supabase.from("cash_receipts" as any).delete().eq("student_name", studentName);
    toast({ title: "삭제됨" });
    loadData();
  };

  // ========== Attendance Request CRUD ==========
  const openAttendCreate = () => {
    setAttendInput({ user_name: "", period_text: "" });
    setAttendModal({ mode: "create" });
  };
  const openAttendEdit = (req: AttendanceRequest) => {
    const periodLine = req.description.split("\n").find(l => l.startsWith("출석 기간:"));
    const periodText = periodLine ? periodLine.replace("출석 기간: ", "") : "";
    setAttendInput({ user_name: req.user_name, period_text: periodText });
    setAttendModal({ mode: "edit", data: req });
  };
  const saveAttendRequest = async () => {
    if (!attendInput.user_name.trim()) { toast({ title: "학생명을 입력하세요", variant: "destructive" }); return; }
    const description = `출석 기간: ${attendInput.period_text.trim() || "-"}`;
    if (attendModal?.mode === "edit" && attendModal.data) {
      await supabase.from("support_requests").update({
        user_name: attendInput.user_name.trim(),
        description,
      }).eq("id", attendModal.data.id);
      toast({ title: "출석증 요청 수정됨" });
    } else {
      // Need user_id — use current admin's id as a fallback so RLS passes
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "로그인이 필요합니다", variant: "destructive" }); return; }
      const { error } = await supabase.from("support_requests").insert({
        user_id: session.user.id,
        user_name: attendInput.user_name.trim(),
        role: "student",
        category: "attendance",
        title: "출석증 요청",
        description,
        status: "open",
      });
      if (error) { toast({ title: "추가 실패", description: error.message, variant: "destructive" }); return; }
      toast({ title: "출석증 요청 추가됨" });
    }
    setAttendModal(null);
    loadData();
  };
  const deleteAttendRequest = async (id: string, name: string) => {
    if (!confirm(`${name}의 출석증 요청을 삭제하시겠습니까?`)) return;
    await supabase.from("support_requests").delete().eq("id", id);
    toast({ title: "삭제됨" });
    loadData();
  };

  // Per-session rate for a corporate student: explicit corporate_rate column overrides
  // group/individual default. (Group default 70k, individual default 50k.)
  const getCorpRate = (s: StudentRecord): number => {
    if (typeof s.corporate_rate === "number" && s.corporate_rate > 0) return s.corporate_rate;
    return s.group_students?.length > 0 ? GROUP_LESSON_PRICE : LESSON_PRICE;
  };
  const getCorpFee = (s: StudentRecord) => {
    const count = corpSessionCounts.get(s.student_name) || 0;
    return count * getCorpRate(s);
  };

  const openCorpReport = async (s: StudentRecord) => {
    setReportLoading(s.student_name);
    try {
      const { prepareReportData } = await import("@/lib/exportCorporateReportPdf");
      const startDate = `${corpYear}-${String(corpMon).padStart(2, "0")}-01`;
      const lastDay = new Date(corpYear, corpMon, 0).getDate();
      const endDate = `${corpYear}-${String(corpMon).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const label = corpMonthLabel;
      const { data: sessData } = await supabase
        .from("class_sessions")
        .select("scheduled_at,student_name,topic,notes,level,ended_at,group_students")
        .eq("student_name", s.student_name)
        .gte("scheduled_at", startDate + "T00:00:00+09:00")
        .lte("scheduled_at", endDate + "T23:59:59+09:00")
        .order("scheduled_at");
      // Get instructor info
      const { data: studentInfo } = await supabase
        .from("instructor_students")
        .select("instructor_name, learning_objective")
        .eq("student_name", s.student_name)
        .single();
      let objs: string[] = [];
      try { objs = JSON.parse(studentInfo?.learning_objective || "[]"); } catch { objs = studentInfo?.learning_objective ? [studentInfo.learning_objective] : []; }
      const groupStudents = (sessData || []).find(sess => sess.group_students?.length > 0)?.group_students || [];
      const previewData = await prepareReportData(
        sessData || [],
        { studentName: s.student_name, instructorName: studentInfo?.instructor_name || "", learningObjective: objs.join(", "), groupStudents },
        { label, start_date: startDate, end_date: endDate },
      );
      previewData.totalFee = getCorpFee(s);
      setReportPreview(previewData);
    } catch (e) {
      console.error(e);
    }
    setReportLoading(null);
  };

  const confirmedCount = regularStudents.filter(s => confMap.get(s.student_name)?.confirmed).length;
  const totalFee = regularStudents.reduce((sum, s) => sum + getFee(s), 0);

  const handleDownloadPdf = async () => {
    try {
      const { exportPaymentListPdf } = await import("@/lib/exportPaymentListPdf");
      await exportPaymentListPdf({
        periodLabel: periodLabel || "수강생 리스트",
        rows: regularStudents.map(s => ({
          student_name: s.student_name,
          fee: getFee(s),
          session_count: billableCounts.has(s.student_name)
            ? (billableCounts.get(s.student_name) || 0)
            : (sessionCounts.get(s.student_name) || 0),
        })),
      });
      toast({ title: "PDF 다운로드 완료" });
    } catch (e) {
      console.error(e);
      toast({ title: "PDF 생성 실패", variant: "destructive" });
    }
  };

  const renderStudentRow = (s: StudentRecord, isCorporate = false) => {
    const conf = confMap.get(s.student_name);
    const isConfirmed = conf?.confirmed || false;
    const count = isCorporate
      ? (corpSessionCounts.get(s.student_name) || 0)
      : (billableCounts.has(s.student_name) ? (billableCounts.get(s.student_name) || 0) : (sessionCounts.get(s.student_name) || 0));
    const fee = isCorporate ? null : getFee(s);
    const isOverridden = !isCorporate && hasOverride(s.student_name);
    const credit = creditMap.get(s.student_name);
    const ded = dedMap.get(s.student_name);
    const hasPrepaid = !!credit && (credit.total_sessions - credit.used_sessions) > 0;
    const isRefund = !isCorporate && refundFlags.has(s.student_name);
    const isInactive = s.status === "inactive";

    return (
      <tr key={s.student_name} className={cn("border-b border-border last:border-0 transition-colors",
        isRefund ? "bg-destructive/5" : isConfirmed ? "bg-primary/5" : "hover:bg-muted/30"
      )}>
        <td className="px-4 py-3 text-center">
          <button
            onClick={() => toggleConfirm(s.student_name)}
            className={cn("w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer",
              isConfirmed ? "bg-primary border-primary text-primary-foreground hover:opacity-80" : "border-muted-foreground/30 hover:border-primary/50"
            )}
            title={isConfirmed ? "클릭하여 확인 해제" : "클릭하여 확인"}
          >
            {isConfirmed && <Check className="w-3.5 h-3.5" />}
          </button>
        </td>
        <td className="px-4 py-3">
          <span className={cn("font-medium", isConfirmed ? "text-muted-foreground line-through" : "text-foreground")}>
            {s.student_name}
          </span>
          {s.group_students?.length > 0 && (
            <span className="ml-1.5 text-[10px] text-muted-foreground">(그룹 {s.group_students.length + 1}인)</span>
          )}
          {(() => {
            const isNew = s.start_date && currentPeriod && s.start_date >= currentPeriod.start_date && s.start_date <= currentPeriod.end_date;
            if (isNew) return <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-semibold">신규</span>;
            return null;
          })()}
          {(() => {
            const today = new Date().toISOString().slice(0, 10);
            const isPaused = s.pause_start && (!s.pause_end || s.pause_end >= today) && s.pause_start <= today;
            if (isPaused) return <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-semibold">휴강</span>;
            return null;
          })()}
          {isInactive && (
            <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">퇴원</span>
          )}
          {renewalWithdrawn.has(s.student_name) && (
            <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold" title="모달에서 다음 달 연장을 거부함">
              🚪 연장거부
            </span>
          )}
          {!isCorporate && (() => {
            const isCash = isCashPayment(s);
            const overridden = hasCashOverride(s.student_name);
            return (
              <button
                onClick={() => cycleCashPayment(s)}
                onContextMenu={(e) => { e.preventDefault(); toggleStudentCashDefault(s); }}
                className={cn(
                  "ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold transition-colors inline-flex items-center gap-0.5",
                  isCash
                    ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
                    : "bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:text-blue-400"
                )}
                title={`${isCash ? "현금(이체)" : "스토어"} ${overridden ? "(이번 달 오버라이드)" : "(기본)"} — 클릭: 이번 달 변경 / 우클릭: 학생 기본값 변경`}
              >
                {isCash ? "현금" : "스토어"}{overridden ? "*" : ""}
              </button>
            );
          })()}
          {!isCorporate && (
            <button
              onClick={() => toggleRefund(s.student_name)}
              className={cn(
                "ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold transition-colors",
                isRefund
                  ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                  : "border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
              )}
              title={isRefund ? "환불 표시 — 클릭하여 제거" : "환불 표시 추가"}
            >
              {isRefund ? "환불" : "환불 표시"}
            </button>
          )}
          {isCorporate && (() => {
            const isInvoice = isTaxInvoice(s);
            const overridden = hasTaxOverride(s.student_name);
            return (
              <button
                onClick={() => cycleTaxInvoice(s)}
                onContextMenu={(e) => { e.preventDefault(); toggleStudentTaxDefault(s); }}
                className={cn(
                  "ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold transition-colors inline-flex items-center gap-0.5",
                  isInvoice
                    ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400"
                    : "bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-400"
                )}
                title={`${isInvoice ? "계산서 발급(전액 지급)" : "사업소득 3.3% 공제"} ${overridden ? "(이번 달 오버라이드)" : "(기본)"} — 클릭: 이번 달 변경 / 우클릭: 학생 기본값 변경`}
              >
                {isInvoice ? "계산서" : "3.3%"}{overridden ? "*" : ""}
              </button>
            );
          })()}
          {isCorporate && (
            <span
              className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium"
              title={`회당 단가 (그룹 기본 70,000 / 개별 기본 50,000)`}
            >
              ₩{getCorpRate(s).toLocaleString()}/회
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {isCorporate ? (
            <div>
              <span className={cn("font-semibold", isConfirmed ? "text-muted-foreground" : "text-foreground")}>₩{getCorpFee(s).toLocaleString()}</span>
            </div>
          ) : editingFee === s.student_name ? (
            <div className="flex items-center gap-1 justify-end">
              <input
                type="number"
                value={editingFeeValue}
                onChange={e => setEditingFeeValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const val = parseInt(editingFeeValue);
                    if (!isNaN(val) && val >= 0) saveFeeOverride(s.student_name, val);
                  }
                  if (e.key === "Escape") { setEditingFee(null); setEditingFeeValue(""); }
                }}
                autoFocus
                className="w-24 rounded border border-primary/50 bg-background px-2 py-1 text-xs text-right text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder="수업료"
              />
              <button
                onClick={() => {
                  const val = parseInt(editingFeeValue);
                  if (!isNaN(val) && val >= 0) saveFeeOverride(s.student_name, val);
                }}
                className="text-primary hover:text-primary/80"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setEditingFee(null); setEditingFeeValue(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 justify-end group/fee">
              <div className="flex items-center gap-1">
                {fee !== 200000 && (
                  <span className="relative group/feealert" title={`기준 수강료(₩200,000)와 다릅니다 — 현재 ₩${fee!.toLocaleString()}`}>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  </span>
                )}
                <span className={cn("font-semibold", isConfirmed ? "text-muted-foreground" : "text-foreground")}>₩{fee!.toLocaleString()}</span>
              </div>
              {isOverridden && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-semibold cursor-pointer"
                  title="수동 수정됨 — 클릭하여 초기화"
                  onClick={() => clearFeeOverride(s.student_name)}
                >
                  수정
                </span>
              )}
              <button
                onClick={() => { setEditingFee(s.student_name); setEditingFeeValue(String(fee || 0)); }}
                className="opacity-0 group-hover/fee:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
                title="수업료 수정"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {credit ? (
              <>
                <div className="text-xs group/credit relative cursor-default" title={credit.note || undefined}>
                  <span className="font-semibold text-foreground">{credit.total_sessions - credit.used_sessions}</span>
                  <span className="text-muted-foreground">/{credit.total_sessions}회</span>
                  {credit.note && (
                    <div className="absolute bottom-full left-0 mb-1 hidden group-hover/credit:block z-10 px-2 py-1 rounded bg-popover border border-border shadow-md text-[10px] text-popover-foreground whitespace-nowrap max-w-[200px] truncate">
                      {credit.note}
                    </div>
                  )}
                </div>
                {ded ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium cursor-default" title={`${ded.deducted_sessions}회 차감됨 (클릭하여 취소)`} onClick={() => undoDeduct(s.student_name)}>
                    -{ded.deducted_sessions} 차감완료
                  </span>
                ) : (
                  <button
                    onClick={() => { setDeductModal(s.student_name); setDeductCount(String(calcBaseLessons(s.schedules))); }}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    차감
                  </button>
                )}
                <button
                  onClick={() => { setCreditModal({ name: s.student_name, existing: credit }); setCreditInput({ sessions: "", note: credit.note || "" }); }}
                  className="text-muted-foreground hover:text-foreground"
                  title="충전"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => { setCreditModal({ name: s.student_name }); setCreditInput({ sessions: "", note: "" }); }}
                className="text-[10px] px-2 py-1 rounded border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                선결제 등록
              </button>
            )}
            {isCorporate && (
              <button
                onClick={() => openCorpReport(s)}
                disabled={reportLoading === s.student_name}
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground hover:bg-accent/80 transition-colors flex items-center gap-0.5"
                title="기업 보고서"
              >
                {reportLoading === s.student_name ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            value={remarkDrafts.get(s.student_name) ?? remarks.get(s.student_name) ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setRemarkDrafts(prev => { const n = new Map(prev); n.set(s.student_name, v); return n; });
            }}
            onBlur={(e) => {
              const v = e.target.value;
              if ((remarks.get(s.student_name) ?? "") !== v.trim()) saveRemark(s.student_name, v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setRemarkDrafts(prev => { const n = new Map(prev); n.set(s.student_name, remarks.get(s.student_name) ?? ""); return n; });
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="비고"
            className="w-full min-w-[140px] rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </td>
      </tr>
    );
  };

  // ========== Budget calculations (정규 only, 환불 제외) ==========
  // 선결제 처리 규칙:
  //  - 선결제 등록 달(creditMap.created_at이 현재 period 안): fee 대신 total_sessions × LESSON_PRICE를 1회 입금으로 반영 (스토어 분류, 선결제 뱃지)
  //  - 선결제 등록 이후 달(created_at < period_start): 리스트에는 표시하되 금액 0 + "선결제(차감)" 뱃지 (합계에 반영 안 됨)
  //  - 선결제 없음: 기존 getFee 사용
  type BudgetRow = { name: string; fee: number; isPrepaid?: boolean; isPrepaidDeducted?: boolean };
  const budgetRows: BudgetRow[] = [];
  const budgetEligible = regularStudents.filter(s => !refundFlags.has(s.student_name));
  for (const s of budgetEligible) {
    const credit = creditMap.get(s.student_name);
    if (credit) {
      const createdDate = (credit.created_at || "").slice(0, 10);
      const isRegisteredThisPeriod = createdDate >= pStartDate && createdDate <= pEndDate;
      if (isRegisteredThisPeriod) {
        // 선결제 등록 달: 총액 일시 반영
        budgetRows.push({ name: s.student_name, fee: credit.total_sessions * LESSON_PRICE, isPrepaid: true });
      } else {
        // 이후 달: 리스트에 표시하되 금액 0 (합계에 미반영)
        budgetRows.push({ name: s.student_name, fee: 0, isPrepaidDeducted: true });
      }
      continue;
    }
    budgetRows.push({ name: s.student_name, fee: getFee(s) });
  }
  const budgetCashRows = budgetRows.filter(r => {
    const stu = budgetEligible.find(s => s.student_name === r.name);
    return stu ? isCashPayment(stu) : false;
  });
  const budgetStoreRows = budgetRows.filter(r => {
    const stu = budgetEligible.find(s => s.student_name === r.name);
    return stu ? !isCashPayment(stu) : false;
  });
  const budgetCashTotal = budgetCashRows.reduce((s, r) => s + r.fee, 0);
  const budgetStoreTotal = budgetStoreRows.reduce((s, r) => s + r.fee, 0);
  const budgetStoreNet = Math.round(budgetStoreTotal * (1 - STORE_FEE_RATE));
  const budgetStoreFee = budgetStoreTotal - budgetStoreNet;
  const budgetGrossTotal = budgetCashTotal + budgetStoreTotal;
  const budgetNetTotal = budgetCashTotal + budgetStoreNet;
  // 선결제 차감(=금액 미반영)된 학생 수 — UI 안내용
  const prepaidExcludedCount = budgetRows.filter(r => r.isPrepaidDeducted).length;

  // ===== 기업 수강생 예산 (당월 수업 회수 × 학생별 단가, 후불 가정 — 결제 시점은 다음 달이지만 발생액 기준으로 표시) =====
  type CorpBudgetRow = { name: string; sessions: number; rate: number; gross: number; net: number; isInvoice: boolean };
  const corpBudgetRows: CorpBudgetRow[] = corporateStudents.map(s => {
    const sessions = corpSessionCounts.get(s.student_name) || 0;
    const rate = getCorpRate(s);
    const gross = sessions * rate;
    const isInvoice = isTaxInvoice(s);
    const net = isInvoice ? gross : Math.round(gross * (1 - BIZ_INCOME_TAX_RATE));
    return { name: s.student_name, sessions, rate, gross, net, isInvoice };
  }).filter(r => r.sessions > 0); // 회수 0인 기업 학생은 예산에 노출 안 함

  const corpInvoiceRows = corpBudgetRows.filter(r => r.isInvoice);
  const corpTaxRows = corpBudgetRows.filter(r => !r.isInvoice);
  const corpInvoiceTotal = corpInvoiceRows.reduce((s, r) => s + r.gross, 0);
  const corpTaxGrossTotal = corpTaxRows.reduce((s, r) => s + r.gross, 0);
  const corpTaxNetTotal = corpTaxRows.reduce((s, r) => s + r.net, 0);
  const corpTaxFeeTotal = corpTaxGrossTotal - corpTaxNetTotal;
  const corpGrossTotal = corpInvoiceTotal + corpTaxGrossTotal;
  const corpNetTotal = corpInvoiceTotal + corpTaxNetTotal;
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">결제확인</h2>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "count" | "payment" | "ai" | "budget" | "summary")} className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="count" className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            월별 수업 카운트
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" />
            일대일 수업
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            AI 프로그램
          </TabsTrigger>
          <TabsTrigger value="budget" className="flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" />
            예산 관리
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5" />
            예산 요약
          </TabsTrigger>
        </TabsList>

        {/* AI Programs Tab */}
        <TabsContent value="ai" className="mt-4 space-y-4">
          <AiProgramBudget monthKey={aiMonthKey} monthLabel={aiMonthLabel} onChange={loadSummaryExtras} />
        </TabsContent>

        {/* Tab 1: Session Count Report */}
        <TabsContent value="count" className="mt-4">
          <SessionCountReport />
        </TabsContent>

        {/* Tab 2: Payment Confirmation */}
        <TabsContent value="payment" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (<>
          {/* Period Navigation */}
          <div className="flex items-center justify-end gap-3">
            <button onClick={prevPeriod} disabled={periodIdx >= periods.length - 1} className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">{periodLabel || "—"}</span>
            <button onClick={nextPeriod} disabled={periodIdx <= 0} className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">정규 수강생</p>
              <p className="text-xl font-bold text-foreground mt-1">{regularStudents.length}명</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                확인 완료 <span className="text-primary font-semibold">{confirmedCount}</span> / {regularStudents.length}
              </p>
            </div>
            <div className="relative group rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <UserPlus className="w-3 h-3" /> 신규생
              </p>
              <p className="text-xl font-bold text-success mt-1">{newStudents.length}명</p>
              <p className="text-xs text-muted-foreground mt-0.5">{periodLabel} 신규 등록</p>
              {newStudents.length > 0 && (
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 hidden group-hover:block w-max max-w-[260px] rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                  <p className="font-semibold mb-1 text-success">신규생 ({newStudents.length}명)</p>
                  <p className="leading-relaxed whitespace-normal break-keep">
                    {newStudents.map(s => s.student_name).join(", ")}
                  </p>
                </div>
              )}
            </div>
            <div className="relative group rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <PauseCircle className="w-3 h-3" /> 휴강생
              </p>
              <p className="text-xl font-bold text-warning mt-1">{pausedStudents.length}명</p>
              <p className="text-xs text-muted-foreground mt-0.5">{periodLabel} 전체 휴강</p>
              {pausedStudents.length > 0 && (
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 hidden group-hover:block w-max max-w-[260px] rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                  <p className="font-semibold mb-1 text-warning">휴강생 ({pausedStudents.length}명)</p>
                  <p className="leading-relaxed whitespace-normal break-keep">
                    {pausedStudents.map(s => s.student_name).join(", ")}
                  </p>
                </div>
              )}
            </div>
            <div className="relative group rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <UserMinus className="w-3 h-3" /> 퇴원생
              </p>
              <p className="text-xl font-bold text-muted-foreground mt-1">{withdrawnStudents.length}명</p>
              <p className="text-xs text-muted-foreground mt-0.5">{periodLabel} 퇴원</p>
              {withdrawnStudents.length > 0 && (
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 hidden group-hover:block w-max max-w-[260px] rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                  <p className="font-semibold mb-1 text-muted-foreground">퇴원생 ({withdrawnStudents.length}명)</p>
                  <p className="leading-relaxed whitespace-normal break-keep">
                    {withdrawnStudents.map(s => s.student_name).join(", ")}
                  </p>
                </div>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">예상 수강료 합계</p>
              <p className="text-xl font-bold text-foreground mt-1">₩{totalFee.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">기업 수강생 별도</p>
            </div>
          </div>

      {/* Regular Students Table */}
      {regularStudents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground">정규 수강생</p>
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors"
              title={`${periodLabel} 수강생 리스트 PDF 다운로드`}
            >
              <Download className="w-3 h-3" />
              PDF 다운로드
            </button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="w-12 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">학생명</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">수강료</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">선결제</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">비고</th>
                </tr>
              </thead>
              <tbody>
                {regularStudents.map(s => renderStudentRow(s))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Corporate Students Table */}
      {corporateStudents.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">기업 수강생 <span className="font-normal">({corpMonthLabel} 기준)</span></p>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="w-12 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">학생명</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">수강료</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">선결제</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">비고</th>
                </tr>
              </thead>
              <tbody>
                {corporateStudents.map(s => renderStudentRow(s, true))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cash Receipts Table — always show with add/edit/delete */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground">현금영수증 정보</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAllReceipts(v => !v)}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors"
              title="전체(자동발급/매달 포함) 보기 토글"
            >
              <Settings2 className="w-3 h-3" />
              {showAllReceipts ? "필터링" : "전체 관리"}
            </button>
            <button
              onClick={openReceiptCreate}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3 h-3" /> 추가
            </button>
          </div>
        </div>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">학생명</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">유형</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">번호</th>
                <th className="text-center px-4 py-3 font-semibold text-foreground">자동발급</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(showAllReceipts ? receipts : receipts.filter(r => r.receipt_number)).map((r, i) => (
                <tr key={`${r.student_name}-${i}`} className="border-b border-border last:border-0 hover:bg-muted/30 group/row">
                  <td className="px-4 py-3 font-medium text-foreground">{r.student_name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs font-medium">
                      {r.receipt_type === "phone" ? <><Phone className="w-3 h-3 text-primary" /> 휴대폰</> : <><Building2 className="w-3 h-3 text-amber-500" /> 사업자</>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{r.receipt_number || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {r.recurring && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          <RefreshCw className="w-3 h-3" /> 영수증
                        </span>
                      )}
                      {r.recurring_attendance && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent/40 text-accent-foreground font-medium">
                          <RefreshCw className="w-3 h-3" /> 출석증
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <button onClick={() => openReceiptEdit(r)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary" title="수정">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteReceipt(r.student_name)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive" title="삭제">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(showAllReceipts ? receipts : receipts.filter(r => r.receipt_number)).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">등록된 현금영수증 정보가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recurring Attendance Requests (auto-issue list) */}
      {receipts.some(r => r.recurring_attendance) && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">출석증 매달 자동 발급 대상</p>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="divide-y divide-border">
              {receipts.filter(r => r.recurring_attendance).map((r, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30">
                  <span className="font-medium text-foreground">{r.student_name}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    <RefreshCw className="w-3 h-3" /> 매달 자동
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Attendance Certificate Requests — always show with add/edit/delete */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground">출석증 요청</p>
          <button
            onClick={openAttendCreate}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3 h-3" /> 추가
          </button>
        </div>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">학생명</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">출석 기간</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">요청일</th>
                <th className="text-center px-4 py-3 font-semibold text-foreground">상태</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {attendanceRequests.map((req) => {
                const periodLine = req.description.split("\n").find(l => l.startsWith("출석 기간:"));
                const periodText = periodLine ? periodLine.replace("출석 기간: ", "") : "-";
                const isResolved = req.status === "resolved";
                return (
                  <tr key={req.id} className={cn("border-b border-border last:border-0 transition-colors group/row", isResolved ? "bg-primary/5" : "hover:bg-muted/30")}>
                    <td className="px-4 py-3 font-medium text-foreground">{req.user_name}</td>
                    <td className="px-4 py-3 text-foreground">{periodText}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(req.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isResolved ? (
                        <button
                          onClick={async () => {
                            await supabase.from("support_requests").update({ status: "open", resolved_at: null }).eq("id", req.id);
                            toast({ title: "발급 완료 해제됨" });
                            loadData();
                          }}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20"
                          title="발급 완료 취소"
                        >
                          <CheckCircle className="w-3 h-3" /> 발급완료
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            await supabase.from("support_requests").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", req.id);
                            toast({ title: "출석증 발급 완료 처리됨" });
                            loadData();
                          }}
                          className="text-[10px] px-2 py-1 rounded bg-accent text-accent-foreground hover:bg-accent/80 transition-colors font-medium"
                        >
                          발급 완료
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button onClick={() => openAttendEdit(req)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary" title="수정">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteAttendRequest(req.id, req.user_name)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive" title="삭제">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {attendanceRequests.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">등록된 출석증 요청이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
          </>)}
        </TabsContent>

        {/* Tab 3: Budget Management */}
        <TabsContent value="budget" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (<>
          {/* Period Navigation */}
          <div className="flex items-center justify-end gap-3">
            <button onClick={prevPeriod} disabled={periodIdx >= periods.length - 1} className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">{periodLabel || "—"}</span>
            <button onClick={nextPeriod} disabled={periodIdx <= 0} className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            정규 수강생 기준 · 환불 표시된 학생은 제외 · 결제대상 회수 × 50,000원으로 자동 산출
            <br />
            <span className="text-purple-700 dark:text-purple-400">선결제 학생은 등록 달에 총액 일시 반영(스토어), 이후 달은 리스트에는 표시되나 금액은 반영되지 않음</span>
            {prepaidExcludedCount > 0 && (
              <span className="ml-1 text-muted-foreground">· 이번 달 선결제 차감 학생 {prepaidExcludedCount}명</span>
            )}
          </p>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Receipt className="w-3 h-3" /> 총 수입 (예상)
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">₩{budgetGrossTotal.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{budgetEligible.length}명 합산</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Wallet className="w-3 h-3 text-amber-600" /> 현금 (이체)
              </p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">₩{budgetCashTotal.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{budgetCashRows.length}명 · 수수료 없음</p>
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Store className="w-3 h-3 text-blue-600" /> 스마트스토어 결제
              </p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">₩{budgetStoreTotal.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{budgetStoreRows.length}명 · 수수료 4.95% 차감 전</p>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/5 p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-success" /> 실수령 합계
              </p>
              <p className="text-2xl font-bold text-success mt-1">₩{budgetNetTotal.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">현금 + 스토어 실수령</p>
            </div>
          </div>

          {/* Store fee breakdown */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Store className="w-4 h-4 text-blue-600" /> 스마트스토어 수수료 내역
              </p>
              <span className="text-[10px] text-muted-foreground">수수료율 4.95%</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">결제 총액</p>
                <p className="font-semibold text-foreground">₩{budgetStoreTotal.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">수수료 (4.95%)</p>
                <p className="font-semibold text-destructive">-₩{budgetStoreFee.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">실수령</p>
                <p className="font-semibold text-success">₩{budgetStoreNet.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Detailed Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cash list */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Wallet className="w-3 h-3 text-amber-600" /> 현금 (이체) 결제 — {budgetCashRows.length}명
              </p>
              <div className="border border-border rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-foreground text-xs">학생명</th>
                      <th className="text-right px-3 py-2 font-semibold text-foreground text-xs">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetCashRows.length === 0 ? (
                      <tr><td colSpan={2} className="px-3 py-6 text-center text-xs text-muted-foreground">현금결제 학생이 없습니다.</td></tr>
                    ) : budgetCashRows.map(r => (
                      <tr key={r.name} className={cn("border-b border-border last:border-0 hover:bg-muted/30", r.isPrepaidDeducted && "opacity-70")}>
                        <td className="px-3 py-2 text-foreground">
                          {r.name}
                          {r.isPrepaid && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">선결제</span>
                          )}
                          {r.isPrepaidDeducted && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">선결제 (차감)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">
                          {r.isPrepaidDeducted ? <span className="text-muted-foreground">—</span> : <>₩{r.fee.toLocaleString()}</>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {budgetCashRows.length > 0 && (
                    <tfoot className="bg-amber-500/10 border-t border-border">
                      <tr>
                        <td className="px-3 py-2 text-xs font-semibold text-foreground">합계</td>
                        <td className="px-3 py-2 text-right font-bold text-amber-700 dark:text-amber-400">₩{budgetCashTotal.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Store list */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Store className="w-3 h-3 text-blue-600" /> 스마트스토어 결제 — {budgetStoreRows.length}명
              </p>
              <div className="border border-border rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-foreground text-xs">학생명</th>
                      <th className="text-right px-3 py-2 font-semibold text-foreground text-xs">결제액</th>
                      <th className="text-right px-3 py-2 font-semibold text-foreground text-xs">실수령</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetStoreRows.length === 0 ? (
                      <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">스토어 결제 학생이 없습니다.</td></tr>
                    ) : budgetStoreRows.map(r => {
                      const net = r.isPrepaidDeducted ? 0 : Math.round(r.fee * (1 - STORE_FEE_RATE));
                      return (
                        <tr key={r.name} className={cn("border-b border-border last:border-0 hover:bg-muted/30", r.isPrepaidDeducted && "opacity-70")}>
                          <td className="px-3 py-2 text-foreground">
                            {r.name}
                            {r.isPrepaid && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">선결제</span>
                            )}
                            {r.isPrepaidDeducted && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">선결제 (차감)</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                            {r.isPrepaidDeducted ? <span>—</span> : <>₩{r.fee.toLocaleString()}</>}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-foreground">
                            {r.isPrepaidDeducted ? <span className="text-muted-foreground">—</span> : <>₩{net.toLocaleString()}</>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {budgetStoreRows.length > 0 && (
                    <tfoot className="bg-blue-500/10 border-t border-border">
                      <tr>
                        <td className="px-3 py-2 text-xs font-semibold text-foreground">합계</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">₩{budgetStoreTotal.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700 dark:text-blue-400">₩{budgetStoreNet.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* ===== Corporate (기업) Section ===== */}
          <div className="pt-4 mt-2 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">기업 결제 — {corpMonthLabel}</h3>
              <span className="text-[10px] text-muted-foreground">후불 (당월 발생액 기준 · 입금은 다음 달)</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> 기업 총 발생액
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">₩{corpGrossTotal.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{corpBudgetRows.length}명 합산</p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3 text-emerald-600" /> 계산서 발급 (전액)
                </p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">₩{corpInvoiceTotal.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{corpInvoiceRows.length}명 · 공제 없음</p>
              </div>
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-rose-600" /> 사업소득 3.3%
                </p>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">₩{corpTaxGrossTotal.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{corpTaxRows.length}명 · 공제 전</p>
              </div>
              <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-success" /> 기업 실수령 합계
                </p>
                <p className="text-2xl font-bold text-success mt-1">₩{corpNetTotal.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">계산서 + 3.3% 공제 후</p>
              </div>
            </div>

            {/* 사업소득 공제 내역 */}
            {corpTaxRows.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-rose-600" /> 사업소득 3.3% 공제 내역
                  </p>
                  <span className="text-[10px] text-muted-foreground">공제율 3.3%</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">발생 총액</p>
                    <p className="font-semibold text-foreground">₩{corpTaxGrossTotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">공제 (3.3%)</p>
                    <p className="font-semibold text-destructive">-₩{corpTaxFeeTotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">실수령</p>
                    <p className="font-semibold text-success">₩{corpTaxNetTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 기업 학생 리스트 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 계산서 발급 */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-emerald-600" /> 계산서 발급 — {corpInvoiceRows.length}명
                </p>
                <div className="border border-border rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-foreground text-xs">학생명</th>
                        <th className="text-right px-3 py-2 font-semibold text-foreground text-xs">회수</th>
                        <th className="text-right px-3 py-2 font-semibold text-foreground text-xs">단가</th>
                        <th className="text-right px-3 py-2 font-semibold text-foreground text-xs">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corpInvoiceRows.length === 0 ? (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">계산서 발급 학생이 없습니다.</td></tr>
                      ) : corpInvoiceRows.map(r => (
                        <tr key={r.name} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 text-foreground">{r.name}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground text-xs">{r.sessions}회</td>
                          <td className="px-3 py-2 text-right text-muted-foreground text-xs">₩{r.rate.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-medium text-foreground">₩{r.gross.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    {corpInvoiceRows.length > 0 && (
                      <tfoot className="bg-emerald-500/10 border-t border-border">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-foreground">합계</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700 dark:text-emerald-400">₩{corpInvoiceTotal.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* 사업소득 3.3% */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-rose-600" /> 사업소득 3.3% — {corpTaxRows.length}명
                </p>
                <div className="border border-border rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-foreground text-xs">학생명</th>
                        <th className="text-right px-3 py-2 font-semibold text-foreground text-xs">회수</th>
                        <th className="text-right px-3 py-2 font-semibold text-foreground text-xs">발생액</th>
                        <th className="text-right px-3 py-2 font-semibold text-foreground text-xs">실수령</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corpTaxRows.length === 0 ? (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">3.3% 공제 학생이 없습니다.</td></tr>
                      ) : corpTaxRows.map(r => (
                        <tr key={r.name} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 text-foreground">
                            {r.name}
                            <span className="ml-1.5 text-[9px] text-muted-foreground">×{r.sessions}회 · ₩{r.rate.toLocaleString()}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground text-xs">{r.sessions}회</td>
                          <td className="px-3 py-2 text-right text-muted-foreground text-xs">₩{r.gross.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-medium text-foreground">₩{r.net.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    {corpTaxRows.length > 0 && (
                      <tfoot className="bg-rose-500/10 border-t border-border">
                        <tr>
                          <td className="px-3 py-2 text-xs font-semibold text-foreground">합계</td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground">₩{corpTaxGrossTotal.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-bold text-rose-700 dark:text-rose-400">₩{corpTaxNetTotal.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* ===== AI Program Section ===== */}
          <AiProgramBudget monthKey={aiMonthKey} monthLabel={aiMonthLabel} onChange={loadSummaryExtras} />

          <p className="text-[10px] text-muted-foreground">
            💡 결제 확인 탭의 학생 이름 옆 결제수단 뱃지(현금/스토어 또는 계산서/3.3%)를 <span className="font-semibold">클릭</span>하면 이번 달만 변경, <span className="font-semibold">우클릭</span>하면 학생 기본값을 변경합니다.
          </p>
          </>)}
        </TabsContent>

        {/* Tab 4: 예산 요약 — Aggregated totals across regular + corporate + AI programs */}
        <TabsContent value="summary" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (() => {
            const rewardAmount = storeReward?.amount || 0;
            const totalIncome = budgetGrossTotal + corpGrossTotal + aiTotals.gross;
            const cashTotal = budgetCashTotal + corpNetTotal;
            const storeGrossAll = budgetStoreTotal + aiTotals.gross;
            const storeNetAll = budgetStoreNet + aiTotals.net - rewardAmount;
            const feeTotal = budgetStoreFee + aiTotals.fee;
            return (
              <>
                {/* Period Navigation */}
                <div className="flex items-center justify-end gap-3">
                  <button onClick={prevPeriod} disabled={periodIdx >= periods.length - 1} className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">{periodLabel || "—"}</span>
                  <button onClick={nextPeriod} disabled={periodIdx <= 0} className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  정규 수업 + 기업 수업 + AI 프로그램의 모든 수입을 합산한 요약입니다. 기업 수업은 전월 수업 기준 후불, AI 프로그램은 당월 결제 기준입니다.
                </p>

                {/* 1) 총 수입 (예상) */}
                <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-primary" /> 총 수입 (예상)
                    </p>
                    <span className="text-[10px] text-muted-foreground">정규 + 기업 + AI 프로그램</span>
                  </div>
                  <p className="text-3xl font-bold text-primary mt-2">₩{totalIncome.toLocaleString()}</p>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                    <div className="rounded-md bg-card border border-border p-2">
                      <p className="text-muted-foreground">정규 수업</p>
                      <p className="font-semibold text-foreground">₩{budgetGrossTotal.toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-card border border-border p-2">
                      <p className="text-muted-foreground">기업 발생액</p>
                      <p className="font-semibold text-foreground">₩{corpGrossTotal.toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-card border border-border p-2">
                      <p className="text-muted-foreground">AI 프로그램</p>
                      <p className="font-semibold text-foreground">₩{aiTotals.gross.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* 2 ~ 5 grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 2) 현금 (이체) */}
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-amber-600" /> 현금 (이체)
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">₩{cashTotal.toLocaleString()}</p>
                    <div className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                      <p>· 정규 현금/이체 ₩{budgetCashTotal.toLocaleString()}</p>
                      <p>· 기업 결제 실수령 ₩{corpNetTotal.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* 3) 스마트스토어 결제 */}
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-blue-600" /> 스마트스토어 결제
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">₩{storeGrossAll.toLocaleString()}</p>
                    <div className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                      <p>· 정규 스토어 ₩{budgetStoreTotal.toLocaleString()}</p>
                      <p>· AI 프로그램 ₩{aiTotals.gross.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* 4) 스마트스토어 실수령액 */}
                  <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <TrendingDown className="w-4 h-4 text-success" /> 스마트스토어 실수령액
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-success mt-1">₩{storeNetAll.toLocaleString()}</p>
                    <div className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                      <p>· 정규 실수령 ₩{budgetStoreNet.toLocaleString()}</p>
                      <p>· AI 실수령 ₩{aiTotals.net.toLocaleString()}</p>
                      {rewardAmount > 0 && <p>· 리워드 차감 -₩{rewardAmount.toLocaleString()}</p>}
                    </div>
                  </div>

                  {/* 5) 수수료 */}
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <TrendingDown className="w-4 h-4 text-rose-600" /> 수수료 (4.95%)
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">-₩{feeTotal.toLocaleString()}</p>
                    <div className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                      <p>· 정규 스토어 수수료 ₩{budgetStoreFee.toLocaleString()}</p>
                      <p>· AI 프로그램 수수료 ₩{aiTotals.fee.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* 6) 스마트스토어 리워드 (수동입력) */}
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-purple-600" /> 스마트스토어 리워드 — {aiMonthLabel || "—"}
                      <span className="text-[10px] text-muted-foreground font-normal">(수동입력 · 실수령액에서 차감됨)</span>
                    </p>
                    {rewardEdit === null && (
                      <button
                        onClick={() => setRewardEdit({ amount: String(storeReward?.amount || ""), note: storeReward?.note || "" })}
                        className="text-[11px] px-2 py-1 rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" /> {storeReward && storeReward.amount > 0 ? "수정" : "입력"}
                      </button>
                    )}
                  </div>
                  {rewardEdit !== null ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground">리워드 금액 (원)</label>
                          <input
                            type="text"
                            value={rewardEdit.amount}
                            onChange={e => setRewardEdit(prev => prev && { ...prev, amount: e.target.value })}
                            placeholder="예: 12000"
                            inputMode="numeric"
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground">메모 (선택)</label>
                          <input
                            type="text"
                            value={rewardEdit.note}
                            onChange={e => setRewardEdit(prev => prev && { ...prev, note: e.target.value })}
                            placeholder="예: 4월 스토어팜 적립금"
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setRewardEdit(null)} disabled={rewardSaving} className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors">
                          취소
                        </button>
                        <button onClick={saveStoreReward} disabled={rewardSaving} className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1">
                          {rewardSaving && <Loader2 className="w-3 h-3 animate-spin" />}저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">₩{(storeReward?.amount || 0).toLocaleString()}</p>
                      {storeReward?.note && (
                        <p className="text-[11px] text-muted-foreground mt-1">{storeReward.note}</p>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  💡 정규 수업 금액은 결제 확인 탭의 결제수단(현금/스토어) 설정을 따릅니다. 기업 수업 금액은 전월 수업 회수와 학생별 단가, 계산서/3.3% 설정에 따라 산출됩니다. AI 프로그램은 구독자 관리에서 등록한 수강생의 결제 여부에 따라 합산됩니다.
                </p>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Deduction Count Modal */}
      {deductModal && (() => {
        const credit = creditMap.get(deductModal);
        const remaining = credit ? credit.total_sessions - credit.used_sessions : 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeductModal(null)}>
            <div className="bg-card rounded-xl shadow-xl border border-border w-[300px] mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">선결제 차감 — {deductModal}</h3>
                <button onClick={() => setDeductModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-xs text-muted-foreground">잔여 <span className="font-semibold text-foreground">{remaining}회</span> 중 차감할 횟수를 입력하세요.</p>
                <input
                  type="number"
                  value={deductCount}
                  onChange={e => setDeductCount(e.target.value)}
                  min={1}
                  max={remaining}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="차감 횟수"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const val = parseInt(deductCount);
                      if (!isNaN(val) && val > 0) deductMonth(deductModal, val);
                    }
                  }}
                />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setDeductModal(null)} className="flex-1 py-2.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">취소</button>
                  <button
                    onClick={() => {
                      const val = parseInt(deductCount);
                      if (!isNaN(val) && val > 0) deductMonth(deductModal, val);
                    }}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {deductCount ? `${deductCount}회 차감` : "차감"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Prepaid Credit Modal */}
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCreditModal(null)}>
          <div className="bg-card rounded-xl shadow-xl border border-border w-[340px] mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">
                선결제 {creditModal.existing ? "추가 충전" : "등록"} — {creditModal.name}
              </h3>
              <button onClick={() => setCreditModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {creditModal.existing && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">기존 총 횟수</span>
                    <span className="font-semibold text-foreground">{creditModal.existing.total_sessions}회</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">사용 횟수</span>
                    <span className="font-semibold text-foreground">{creditModal.existing.used_sessions}회</span>
                  </div>
                  <div className="flex justify-between mt-1 pt-1 border-t border-border">
                    <span className="text-muted-foreground">잔여 횟수</span>
                    <span className="font-bold text-primary">{creditModal.existing.total_sessions - creditModal.existing.used_sessions}회</span>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-foreground">{creditModal.existing ? "추가 충전 횟수" : "선결제 횟수"}</label>
                <input
                  type="number"
                  value={creditInput.sessions}
                  onChange={e => setCreditInput(prev => ({ ...prev, sessions: e.target.value }))}
                  placeholder="예: 20"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">메모 (선택)</label>
                <input
                  type="text"
                  value={creditInput.note}
                  onChange={e => setCreditInput(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="예: 3개월치 선결제"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setCreditModal(null)} className="flex-1 py-2.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                  취소
                </button>
                <button onClick={savePrepaidCredit} className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  {creditModal.existing ? "추가 충전" : "등록"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Corporate Report Preview Modal */}
      {reportPreview && (
        <CorporateReportPreviewModal
          data={reportPreview}
          onClose={() => setReportPreview(null)}
          onDownload={async (finalData) => {
            const { exportCorporateReportPdf } = await import("@/lib/exportCorporateReportPdf");
            await exportCorporateReportPdf(finalData);
            toast({ title: "수업 보고서 다운로드 완료 ✓" });
            setReportPreview(null);
          }}
        />
      )}

      {/* Cash Receipt Add/Edit Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setReceiptModal(null)}>
          <div className="bg-card rounded-xl shadow-xl border border-border w-[360px] mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">현금영수증 정보 {receiptModal.mode === "edit" ? "수정" : "추가"}</h3>
              <button onClick={() => setReceiptModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">학생명</label>
                <input
                  type="text"
                  value={receiptInput.student_name}
                  onChange={e => setReceiptInput(prev => ({ ...prev, student_name: e.target.value }))}
                  placeholder="홍길동"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">유형</label>
                <select
                  value={receiptInput.receipt_type}
                  onChange={e => setReceiptInput(prev => ({ ...prev, receipt_type: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="phone">휴대폰</option>
                  <option value="business">사업자</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">번호</label>
                <input
                  type="text"
                  value={receiptInput.receipt_number}
                  onChange={e => setReceiptInput(prev => ({ ...prev, receipt_number: e.target.value }))}
                  placeholder="010-0000-0000 / 사업자번호"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" checked={receiptInput.recurring} onChange={e => setReceiptInput(prev => ({ ...prev, recurring: e.target.checked }))} />
                매달 자동 영수증 발급
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" checked={receiptInput.recurring_attendance} onChange={e => setReceiptInput(prev => ({ ...prev, recurring_attendance: e.target.checked }))} />
                매달 자동 출석증 발급
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setReceiptModal(null)} className="flex-1 py-2.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">취소</button>
                <button onClick={saveReceipt} className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  {receiptModal.mode === "edit" ? "수정" : "추가"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Request Add/Edit Modal */}
      {attendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAttendModal(null)}>
          <div className="bg-card rounded-xl shadow-xl border border-border w-[360px] mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">출석증 요청 {attendModal.mode === "edit" ? "수정" : "추가"}</h3>
              <button onClick={() => setAttendModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">학생명</label>
                <input
                  type="text"
                  value={attendInput.user_name}
                  onChange={e => setAttendInput(prev => ({ ...prev, user_name: e.target.value }))}
                  placeholder="홍길동"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">출석 기간</label>
                <input
                  type="text"
                  value={attendInput.period_text}
                  onChange={e => setAttendInput(prev => ({ ...prev, period_text: e.target.value }))}
                  placeholder="예: 2026-04-01 ~ 2026-04-30"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setAttendModal(null)} className="flex-1 py-2.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">취소</button>
                <button onClick={saveAttendRequest} className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  {attendModal.mode === "edit" ? "수정" : "추가"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
