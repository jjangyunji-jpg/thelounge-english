import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, RotateCcw, ChevronLeft, ChevronRight, Check, Loader2, Plus, X, AlertCircle, AlertTriangle, CalendarX } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

interface AvailableSlot {
  id: string;
  instructor_name: string;
  slot_date: string;
  slot_time: string;
  status: string;
}

interface ClassSession {
  id: string;
  scheduled_at: string;
  topic: string | null;
  instructor_name: string;
  group_students: string[];
  cancellation_type?: string | null;
  cancellation_resolution?: string | null;
  reschedule_origin_dates?: string[] | null;
}

interface MakeupReq {
  id: string;
  student_name: string;
  instructor_name: string;
  original_session_id: string | null;
  slot_id: string;
  request_type: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  reject_reason: string | null;
  rejection_code?: string | null;
  urgent_reason?: string | null;
  original_scheduled_at?: string | null;
}

interface SchedulePeriod {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
}

// 24시간 미만 신청 시 인정되는 예외 사유 (sick 카테고리로 통합)
const SICK_EXCEPTION_LABEL = "본인 병가 · 갑작스러운 회의·야근 · 직계가족 긴급 상황";

const REJECTION_LABELS: Record<string, string> = {
  within_48h: "24시간 이내 요청입니다",
  within_24h: "24시간 이내 요청입니다",
  not_urgent: "예외 사유로 인정되지 않습니다",
  no_slots: "가능한 슬롯이 없습니다",
  repeated_change: "반복 변경으로 제한되었습니다",
};

function fmtDateKo(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}. ${d.getDate()}(${DAYS_KO[d.getDay()]})`;
}
function fmtTimeKo(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const displayH = h <= 12 ? h : h - 12;
  return `${period} ${displayH}:${String(m).padStart(2, "0")}`;
}
function fmtSessionDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" });
}
function fmtSessionTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
}

interface MakeupRequestModalProps {
  studentName: string;
  instructorName: string;
  groupStudents: string[];
  onClose: () => void;
}

type Step =
  | "type"           // STEP 1: 보강 유형 선택
  | "session"        // 일정 변경: 어떤 수업을 변경할지
  | "urgent"         // 48시간 미달 시 긴급 사유 선택
  | "calendar"       // STEP 3: 슬롯 선택
  | "no_slots"       // 슬롯 없음 안내
  | "confirm";       // STEP 4: 최종 확인

export default function MakeupRequestModal({ studentName, instructorName, groupStudents, onClose }: MakeupRequestModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [cancelledSessions, setCancelledSessions] = useState<ClassSession[]>([]);
  const [myRequests, setMyRequests] = useState<MakeupReq[]>([]);
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);

  const [step, setStep] = useState<Step>("type");
  const [requestType, setRequestType] = useState<"reschedule" | "extra" | "makeup">("reschedule");
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [selectedCancelledSession, setSelectedCancelledSession] = useState<ClassSession | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [urgentReason, setUrgentReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  useEffect(() => {
    (async () => {
      if (!instructorName) { setLoading(false); return; }
      const now = new Date();

      const { data: studentInstructorsData } = await supabase
        .from("instructor_students")
        .select("instructor_name")
        .eq("student_name", studentName);
      const instructorNames = Array.from(
        new Set([
          instructorName,
          ...((studentInstructorsData || []).map((r: any) => r.instructor_name).filter(Boolean) as string[]),
        ])
      );

      const [slotsRes, sessionsRes, reqsRes, groupSessRes, cancelledRes, periodsRes] = await Promise.all([
        supabase.from("instructor_available_slots").select("*")
          .in("instructor_name", instructorNames).in("status", ["open", "booked"])
          .gte("slot_date", todayStr).order("slot_date").order("slot_time"),
        supabase.from("class_sessions").select("id, scheduled_at, topic, instructor_name, group_students, reschedule_origin_dates")
          .eq("student_name", studentName).gte("scheduled_at", now.toISOString())
          .is("started_at", null).order("scheduled_at"),
        supabase.from("makeup_requests").select("*")
          .eq("student_name", studentName).order("created_at", { ascending: false }).limit(30),
        supabase.from("class_sessions").select("id, scheduled_at, topic, instructor_name, group_students, reschedule_origin_dates")
          .contains("group_students", [studentName]).gte("scheduled_at", now.toISOString())
          .is("started_at", null).order("scheduled_at"),
        supabase.from("class_sessions").select("id, scheduled_at, topic, instructor_name, group_students, cancellation_type, cancellation_resolution")
          .eq("student_name", studentName)
          .eq("cancellation_resolution", "makeup")
          .order("scheduled_at", { ascending: false })
          .limit(20),
        supabase.from("schedule_periods").select("id, label, start_date, end_date")
          .eq("is_active", true).order("start_date"),
      ]);

      const sessionMap = new Map<string, ClassSession>();
      for (const s of (sessionsRes.data || [])) sessionMap.set(s.id, s as ClassSession);
      for (const s of (groupSessRes.data || [])) sessionMap.set(s.id, s as ClassSession);

      setSlots((slotsRes.data || []) as AvailableSlot[]);
      setSessions(Array.from(sessionMap.values()).sort((a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      ));
      setMyRequests((reqsRes.data || []) as MakeupReq[]);
      setPeriods((periodsRes.data || []) as SchedulePeriod[]);

      const allReqs = (reqsRes.data || []) as MakeupReq[];
      const linkedSessionIds = new Set(
        allReqs
          .filter(r => r.status === "pending" || r.status === "approved")
          .map(r => r.original_session_id)
          .filter(Boolean)
      );
      const filteredCancelled = ((cancelledRes.data || []) as ClassSession[])
        .filter(s => !linkedSessionIds.has(s.id));
      setCancelledSessions(filteredCancelled);

      setLoading(false);
    })();
  }, []);

  // Helper: which schedule_period a given KST date falls into
  const periodOfDate = (kstDate: string): SchedulePeriod | null =>
    periods.find(p => kstDate >= p.start_date && kstDate <= p.end_date) || null;

  // 일정 변경 가능한 모든 미래 수업 (48h 컷오프 없이 — 컷오프는 선택 후 자동 분기)
  const reschedulableSessions = useMemo(() => {
    return sessions.filter(s => new Date(s.scheduled_at).getTime() > Date.now());
  }, [sessions]);

  const activePeriod = useMemo<SchedulePeriod | null>(() => {
    const originIso =
      requestType === "reschedule" ? selectedSession?.scheduled_at :
      requestType === "makeup" ? selectedCancelledSession?.scheduled_at :
      null;
    if (!originIso) return null;
    const originDate = new Date(originIso).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    return periodOfDate(originDate);
  }, [requestType, selectedSession, selectedCancelledSession, periods]);

  const targetInstructorName = useMemo(() => {
    if (requestType === "reschedule" && selectedSession) return selectedSession.instructor_name;
    if (requestType === "makeup" && selectedCancelledSession) return selectedCancelledSession.instructor_name;
    return instructorName;
  }, [requestType, selectedSession, selectedCancelledSession, instructorName]);

  const visibleSlots = useMemo(() => {
    let result = slots.filter(s => s.instructor_name === targetInstructorName);
    if (activePeriod) {
      result = result.filter(s => s.slot_date >= activePeriod.start_date && s.slot_date <= activePeriod.end_date);
    }
    return result;
  }, [slots, targetInstructorName, activePeriod]);

  const slotDates = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of visibleSlots) {
      if (!map.has(s.slot_date)) map.set(s.slot_date, []);
      map.get(s.slot_date)!.push(s);
    }
    return map;
  }, [visibleSlots]);

  const dateSlots = useMemo(() => {
    if (!selectedDate) return [];
    return slotDates.get(selectedDate) || [];
  }, [selectedDate, slotDates]);

  // 가용 슬롯 (open + 내 pending 제외)이 하나라도 있는지
  const hasAnyAvailableSlot = useMemo(() => {
    const pendingSlotIds = new Set(myRequests.filter(r => r.status === "pending").map(r => r.slot_id));
    return visibleSlots.some(s => s.status === "open" && !pendingSlotIds.has(s.id));
  }, [visibleSlots, myRequests]);

  // 긴급 보강 사용 횟수 (현재 active period 기준, pending+approved+rejected 제외 cancelled/changed 제외)
  const urgentUsedInActivePeriod = useMemo(() => {
    if (!activePeriod) return 0;
    return myRequests.filter(r => {
      if (!r.urgent_reason) return false;
      if (r.status === "cancelled" || r.status === "changed" || r.status === "rejected") return false;
      // 원본 수업이 같은 기간에 속하는지
      const origIso = r.original_scheduled_at;
      if (!origIso) return false;
      const origDate = new Date(origIso).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
      return origDate >= activePeriod.start_date && origDate <= activePeriod.end_date;
    }).length;
  }, [myRequests, activePeriod]);

  const urgentLimitReached = urgentUsedInActivePeriod >= 1;

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startOffset = firstDay.getDay();
    const cells: { day: number; date: string; inMonth: boolean }[] = [];
    const prevLastDay = new Date(calYear, calMonth, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevLastDay - i;
      const m = calMonth === 0 ? 11 : calMonth - 1;
      const y = calMonth === 0 ? calYear - 1 : calYear;
      cells.push({ day: d, date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push({ day: d, date: `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: true });
    }
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const m = calMonth === 11 ? 0 : calMonth + 1;
        const y = calMonth === 11 ? calYear + 1 : calYear;
        cells.push({ day: d, date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: false });
      }
    }
    return cells;
  }, [calYear, calMonth]);

  const pendingRequests = myRequests.filter(r => r.status === "pending");
  const pastRequests = myRequests.filter(r => r.status !== "pending").slice(0, 5);
  const slotCountForDate = (dateStr: string) => slotDates.get(dateStr)?.length || 0;

  // 선택된 reschedule 수업이 24시간 이내인지
  const isWithin24h = (iso: string) => new Date(iso).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  // 수업 선택 → 48시간 분기
  const proceedFromSession = (s: ClassSession) => {
    setSelectedSession(s);
    const d = new Date(s.scheduled_at);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setSelectedDate(null);
    setSelectedSlot(null);
    if (isWithin24h(s.scheduled_at)) {
      setUrgentReason(null);
      setStep("urgent");
    } else {
      setStep("calendar");
    }
  };

  const enterCalendarFromUrgent = () => {
    if (!urgentReason || urgentLimitReached) return;
    setStep("calendar");
  };

  const handleKeepOriginal = () => {
    if (!confirm("기존 수업 일정 그대로 진행됩니다. 보강 신청을 종료할까요?")) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedSlot) return;
    if (requestType === "reschedule" && !selectedSession) return;
    if (requestType === "makeup" && !selectedCancelledSession) return;
    if (requestType === "reschedule" && selectedSession && isWithin24h(selectedSession.scheduled_at) && !urgentReason) {
      toast({ title: "긴급 사유를 선택해주세요", variant: "destructive" });
      setStep("urgent");
      return;
    }

    if (activePeriod && (selectedSlot.slot_date < activePeriod.start_date || selectedSlot.slot_date > activePeriod.end_date)) {
      toast({
        title: "수업 기간을 벗어났습니다",
        description: `${activePeriod.label} 수업은 ${activePeriod.label} 일정 안에서만 보강이 가능합니다.`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: updated, error: updateErr } = await supabase
        .from("instructor_available_slots")
        .update({ status: "booked" })
        .eq("id", selectedSlot.id)
        .eq("status", "open")
        .select("id");

      if (updateErr || !updated || updated.length === 0) {
        toast({ title: "이미 예약된 시간입니다", description: "다른 사람이 먼저 신청했습니다.", variant: "destructive" });
        const { data: fresh } = await supabase.from("instructor_available_slots").select("*")
          .eq("instructor_name", targetInstructorName).in("status", ["open", "booked"])
          .gte("slot_date", todayStr).order("slot_date").order("slot_time");
        setSlots(prev => [
          ...prev.filter(s => s.instructor_name !== targetInstructorName),
          ...((fresh || []) as AvailableSlot[]),
        ]);
        setSelectedSlot(null);
        setSelectedDate(null);
        setStep("calendar");
        setSubmitting(false);
        return;
      }

      // 기존 pending 정리 (changed)
      const targetSessionId = requestType === "reschedule"
        ? selectedSession!.id
        : requestType === "makeup"
        ? selectedCancelledSession!.id
        : null;
      const sameTargetPending = myRequests.filter(r =>
        r.status === "pending" &&
        (targetSessionId ? r.original_session_id === targetSessionId : r.request_type === "extra" && !r.original_session_id)
      );
      for (const existing of sameTargetPending) {
        await supabase.from("makeup_requests")
          .update({ status: "changed", resolved_at: new Date().toISOString() } as any)
          .eq("id", existing.id);
        if (existing.slot_id) {
          await supabase.from("instructor_available_slots")
            .update({ status: "open" }).eq("id", existing.slot_id);
        }
      }

      const insertData: any = {
        student_name: studentName,
        instructor_name: selectedSlot.instructor_name || targetInstructorName,
        original_session_id: requestType === "reschedule"
          ? selectedSession!.id
          : requestType === "makeup"
          ? selectedCancelledSession!.id
          : null,
        slot_id: selectedSlot.id,
        request_type: requestType === "makeup" ? "extra" : requestType,
        group_students: groupStudents,
      };
      if (requestType === "reschedule" && selectedSession) {
        insertData.original_scheduled_at = selectedSession.scheduled_at;
        if (urgentReason) insertData.urgent_reason = urgentReason;
      }
      if (requestType === "makeup" && selectedCancelledSession) {
        insertData.original_scheduled_at = selectedCancelledSession.scheduled_at;
      }

      const { error } = await supabase.from("makeup_requests").insert(insertData as any);
      if (error) throw error;
      toast({ title: "보강 신청 완료!", description: "강사의 승인을 기다려주세요." });
      onClose();
    } catch (e: any) {
      toast({ title: "신청 실패", description: e.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleCancel = async (reqId: string, slotId: string) => {
    const { error } = await supabase.from("makeup_requests")
      .update({ status: "cancelled", resolved_at: new Date().toISOString() } as any)
      .eq("id", reqId);
    if (!error) {
      await supabase.from("instructor_available_slots").update({ status: "open" }).eq("id", slotId);
      toast({ title: "신청이 취소되었습니다." });
      setMyRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: "cancelled" } : r));
    }
  };

  const goBack = () => {
    if (step === "confirm") setStep("calendar");
    else if (step === "calendar") {
      if (requestType === "reschedule") {
        if (selectedSession && isWithin24h(selectedSession.scheduled_at)) setStep("urgent");
        else setStep("session");
      } else if (requestType === "makeup") {
        setSelectedCancelledSession(null);
        setStep("type");
      } else {
        setStep("type");
      }
    }
    else if (step === "no_slots") setStep("calendar");
    else if (step === "urgent") setStep("session");
    else if (step === "session") setStep("type");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card w-full max-w-md max-h-[85vh] rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {step !== "type" && (
              <button onClick={goBack} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <RotateCcw className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">보강 신청</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : (
            <>
              {/* Pending */}
              {pendingRequests.length > 0 && step === "type" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">대기 중인 신청</p>
                  {pendingRequests.map(r => (
                    <div key={r.id} className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {r.request_type === "extra" ? "추가 보강" : "일정 변경"} · 승인 대기
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(r.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" })} 신청
                        </p>
                      </div>
                      <button onClick={() => handleCancel(r.id, r.slot_id)}
                        className="text-[11px] text-destructive hover:underline font-medium">취소</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Past */}
              {pastRequests.length > 0 && step === "type" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">이전 신청 내역</p>
                  {pastRequests.map(r => {
                    const isFutureApproved = r.status === "approved";
                    const isCancelRequested = r.status === "cancel_requested";
                    const rejectionLabel = r.rejection_code ? REJECTION_LABELS[r.rejection_code] : null;
                    // Find the booked slot to determine 48h cutoff
                    const bookedSlot = slots.find(s => s.id === r.slot_id);
                    let slotISO: string | null = bookedSlot
                      ? new Date(`${bookedSlot.slot_date}T${bookedSlot.slot_time}+09:00`).toISOString()
                      : null;
                    // Fallback: if no slot (e.g. legacy approval), find the makeup session by reschedule_origin_dates
                    if (!slotISO && r.original_scheduled_at) {
                      const origDateStr = new Date(r.original_scheduled_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
                      const makeupSess = sessions.find(s =>
                        s.instructor_name === r.instructor_name &&
                        Array.isArray(s.reschedule_origin_dates) &&
                        s.reschedule_origin_dates.includes(origDateStr)
                      );
                      if (makeupSess) slotISO = makeupSess.scheduled_at;
                    }
                    const within48 = slotISO ? new Date(slotISO).getTime() - Date.now() < 48 * 60 * 60 * 1000 : true;
                    const displayDate = bookedSlot
                      ? `${fmtDateKo(bookedSlot.slot_date)} ${fmtTimeKo(bookedSlot.slot_time)}`
                      : (slotISO ? `${fmtSessionDate(slotISO)} ${fmtSessionTime(slotISO)}` : null);
                    return (
                      <div key={r.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground">
                            {r.request_type === "extra" ? "추가 보강" : "일정 변경"}
                          </p>
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full",
                            r.status === "approved" ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" :
                            r.status === "cancel_requested" ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]" :
                            r.status === "rejected" ? "bg-destructive/10 text-destructive" :
                            r.status === "changed" ? "bg-primary/10 text-primary" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {r.status === "approved" ? "보강 확정" :
                             r.status === "cancel_requested" ? "취소 승인 대기" :
                             r.status === "rejected" ? "강사 거절" :
                             r.status === "changed" ? "일정 변경" : "취소됨"}
                          </span>
                        </div>
                        {displayDate && (
                          <p className="text-[10px] text-muted-foreground">
                            보강: {displayDate}
                          </p>
                        )}
                        {(rejectionLabel || r.reject_reason) && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            사유: {rejectionLabel || r.reject_reason}
                          </p>
                        )}
                        {isFutureApproved && (
                          <button
                            disabled={within48}
                            onClick={async () => {
                              if (within48) return;
                              if (!confirm("보강 일정 취소를 요청하시겠습니까?\n강사의 승인 후 취소가 확정됩니다.")) return;
                              const { error } = await supabase.from("makeup_requests")
                                .update({ status: "cancel_requested" } as any)
                                .eq("id", r.id);
                              if (error) {
                                toast({ title: "취소 요청 실패", description: error.message, variant: "destructive" });
                              } else {
                                toast({ title: "취소 요청이 전송되었습니다", description: "강사의 승인을 기다려주세요." });
                                setMyRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: "cancel_requested" } : x));
                              }
                            }}
                            className={cn(
                              "text-[11px] font-medium",
                              within48
                                ? "text-muted-foreground/60 cursor-not-allowed"
                                : "text-destructive hover:underline"
                            )}
                            title={within48 ? "보강 48시간 전부터는 취소할 수 없습니다" : ""}
                          >
                            {within48 ? "취소 불가 (48시간 이내)" : "취소 요청하기"}
                          </button>
                        )}
                        {isCancelRequested && (
                          <p className="text-[10px] text-[hsl(var(--warning))] font-medium">
                            강사 승인 대기 중 — 승인되면 원래 일정으로 복원됩니다
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* STEP 1: Type selection */}
              {step === "type" && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-foreground">보강 유형을 선택해주세요</p>

                  {cancelledSessions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[hsl(var(--gold-dark))] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" /> 보강이 필요한 수업
                      </p>
                      {cancelledSessions.map(s => {
                        const cancelLabel = s.cancellation_type === 'sick' ? '병결' :
                          s.cancellation_type === 'instructor_cancel' ? '강사취소' :
                          s.cancellation_type === 'advance_cancel' ? '사전취소' : '취소';
                        return (
                          <button key={s.id}
                            onClick={() => {
                              setRequestType("makeup");
                              setSelectedCancelledSession(s);
                              const d = new Date(s.scheduled_at);
                              setCalYear(d.getFullYear());
                              setCalMonth(d.getMonth());
                              setSelectedDate(null);
                              setSelectedSlot(null);
                              setStep("calendar");
                            }}
                            className="w-full rounded-xl border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.05)] p-4 text-left hover:border-[hsl(var(--gold)/0.7)] transition-colors space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                                  <RotateCcw className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
                                  {fmtSessionDate(s.scheduled_at)} 보강
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {fmtSessionTime(s.scheduled_at)} · {cancelLabel}
                                </p>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))] font-semibold">
                                보강 신청 →
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => { setRequestType("reschedule"); setStep("session"); }}
                    className="w-full rounded-xl border border-border p-4 text-left hover:border-primary/50 transition-colors space-y-1"
                  >
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-primary" /> 일정 변경
                    </p>
                    <p className="text-xs text-muted-foreground">기존 수업을 다른 시간으로 변경합니다</p>
                  </button>
                  <button
                    onClick={() => { setRequestType("extra"); setStep("calendar"); }}
                    className="w-full rounded-xl border border-border p-4 text-left hover:border-primary/50 transition-colors space-y-1"
                  >
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[hsl(var(--success))]" /> 추가 보강
                    </p>
                    <p className="text-xs text-muted-foreground">수업 횟수를 추가로 신청합니다</p>
                  </button>
                </div>
              )}

              {/* STEP 2 (a): Session selection (일정 변경) */}
              {step === "session" && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-foreground">변경할 수업을 선택해주세요</p>
                  {reschedulableSessions.length === 0 ? (
                    <div className="rounded-xl border border-border p-6 text-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">변경 가능한 수업이 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reschedulableSessions.map(s => {
                        const within48 = isWithin24h(s.scheduled_at);
                        return (
                          <button key={s.id}
                            onClick={() => proceedFromSession(s)}
                            className="w-full rounded-lg border border-border p-3 text-left hover:border-primary/30 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground">
                                  {fmtSessionDate(s.scheduled_at)} {fmtSessionTime(s.scheduled_at)}
                                </p>
                                {s.topic && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.topic}</p>}
                              </div>
                              {within48 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold shrink-0">
                                  48시간 이내
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2 (b): Urgent reason — only shown when within 48h */}
              {step === "urgent" && selectedSession && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">예외 사유 확인</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      선택하신 수업({fmtSessionDate(selectedSession.scheduled_at)} {fmtSessionTime(selectedSession.scheduled_at)})까지 24시간이 남지 않았습니다.
                    </p>
                    <p className="text-[11px] text-foreground/80 mt-2 leading-relaxed">
                      24시간 이내 신청은 <span className="font-semibold">월 1회에 한해</span> 다음의 예외 사유에 해당하는 경우에만 가능합니다. 그 외 사유로는 24시간 이내 보강 신청이 불가합니다.
                    </p>
                  </div>

                  {/* 빨강 경고 박스 */}
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                    <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> 승인되지 않는 사유
                    </p>
                    <ul className="text-[11px] text-foreground/80 space-y-0.5 pl-4 list-disc">
                      <li>깜빡했어요 / 늦잠 / 피곤해요</li>
                      <li>미리 알고 있던 약속</li>
                      <li>단순 기분/컨디션</li>
                    </ul>
                  </div>

                  {/* 노랑 경고 박스 */}
                  <div className="rounded-lg border-l-4 border-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10 px-3 py-2.5 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-foreground/80 leading-relaxed">
                      잦은 일정 변경은 강사 스케줄 운영과 다른 학생들의 수업에도 영향을 줍니다. 반복될 경우 보강 신청과 수업 재등록이 제한될 수 있습니다.
                    </p>
                  </div>

                  {/* 예외 사유 확인 (단일 카테고리: sick) */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">예외 사유 확인</p>
                    <button
                      disabled={urgentLimitReached}
                      onClick={() => setUrgentReason(urgentReason === "sick" ? null : "sick")}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left text-xs transition-colors",
                        urgentLimitReached && "opacity-50 cursor-not-allowed",
                        !urgentLimitReached && urgentReason === "sick"
                          ? "border-primary bg-primary/5 text-foreground font-semibold"
                          : "border-border text-foreground hover:border-primary/40"
                      )}
                    >
                      <span className="flex items-start gap-2">
                        <span className={cn(
                          "w-3.5 h-3.5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center",
                          urgentReason === "sick" ? "border-primary bg-primary" : "border-muted-foreground/40"
                        )}>
                          {urgentReason === "sick" && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </span>
                        <span className="leading-relaxed">
                          위 예외 사유({SICK_EXCEPTION_LABEL})에 해당함을 확인합니다.
                        </span>
                      </span>
                    </button>
                  </div>

                  {urgentLimitReached && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-[11px] text-foreground/80 leading-relaxed">
                        이번 수업 기간({activePeriod?.label})에 이미 긴급 보강을 1회 사용하셨습니다. 추가 신청은 다음 기간부터 가능합니다.
                      </p>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    size="sm"
                    disabled={!urgentReason || urgentLimitReached}
                    onClick={enterCalendarFromUrgent}
                  >
                    다음 — 가능한 일정 보기
                  </Button>
                </div>
              )}

              {/* STEP 3: Calendar */}
              {step === "calendar" && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-foreground">
                    {selectedDate ? `📅 ${fmtDateKo(selectedDate)} · 회차를 선택해 주세요.` : "날짜를 선택해주세요"}
                  </p>

                  {activePeriod && (
                    <div className="rounded-lg border border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.05)] px-3 py-2 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-[hsl(var(--gold-dark))] shrink-0 mt-0.5" />
                      <p className="text-[11px] text-foreground/80 leading-relaxed">
                        <span className="font-semibold text-[hsl(var(--gold-dark))]">{activePeriod.label} 수업</span>은 같은 기간({fmtDateKo(activePeriod.start_date)} ~ {fmtDateKo(activePeriod.end_date)}) 안에서만 보강이 가능합니다.
                      </p>
                    </div>
                  )}

                  {visibleSlots.length === 0 ? (
                    <>
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          <span className="font-semibold text-foreground">{targetInstructorName}</span> 강사님이 아직 이 기간에 가능한 시간을 등록하지 않았어요.
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setStep("no_slots")}>
                        가능한 일정이 없어요
                      </Button>
                    </>
                  ) : !hasAnyAvailableSlot ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setStep("no_slots")}>
                      가능한 일정이 없어요
                    </Button>
                  ) : null}

                  <div className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-center justify-center gap-4">
                      <button onClick={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }}
                        className="p-1 hover:bg-muted rounded-md">
                        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <span className="text-sm font-bold text-foreground min-w-[90px] text-center">
                        {calYear}.{String(calMonth + 1).padStart(2, "0")}
                      </span>
                      <button onClick={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }}
                        className="p-1 hover:bg-muted rounded-md">
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 text-center">
                      {DAYS_KO.map((d, i) => (
                        <div key={d} className={cn("text-[11px] font-semibold py-1",
                          i === 0 ? "text-destructive/70" : "text-muted-foreground"
                        )}>{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {calendarCells.map((cell, idx) => {
                        const hasSlots = slotCountForDate(cell.date) > 0;
                        const isPast = cell.date < todayStr;
                        const isToday = cell.date === todayStr;
                        const isSelected = cell.date === selectedDate;
                        const slotsForDay = slotDates.get(cell.date) || [];
                        const pendingSlotIds = new Set(pendingRequests.map(r => r.slot_id));
                        const availableCount = slotsForDay.filter(
                          s => s.status === "open" && !pendingSlotIds.has(s.id)
                        ).length;
                        const totalCount = slotsForDay.length;

                        return (
                          <button key={idx}
                            disabled={!cell.inMonth || isPast || !hasSlots}
                            onClick={() => { setSelectedDate(cell.date); setSelectedSlot(null); }}
                            className={cn(
                              "aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all",
                              !cell.inMonth && "text-muted-foreground/30",
                              cell.inMonth && isPast && "text-muted-foreground/40",
                              cell.inMonth && !isPast && !hasSlots && "text-muted-foreground/60",
                              cell.inMonth && hasSlots && !isSelected && "text-foreground hover:bg-muted",
                              isToday && !isSelected && "font-bold text-primary",
                              isSelected && "bg-primary text-primary-foreground font-bold shadow-sm",
                            )}
                          >
                            {cell.day}
                            {cell.inMonth && hasSlots && !isPast && (
                              <span className={cn("text-[8px] leading-none mt-0.5",
                                isSelected ? "text-primary-foreground/80" :
                                availableCount === 0 ? "text-muted-foreground" : "text-[hsl(var(--success))]"
                              )}>
                                {availableCount === 0 ? `${totalCount}매진` : `${availableCount}/${totalCount}매`}
                              </span>
                            )}
                            {isToday && !isSelected && (
                              <span className="text-[8px] leading-none mt-0.5 text-primary font-bold">오늘</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedDate && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">회차를 선택하세요.</p>
                      <div className="flex flex-wrap gap-2">
                        {dateSlots.map(slot => {
                          const isMyPending = pendingRequests.some(r => r.slot_id === slot.id);
                          const isBookedByOther = slot.status === "booked" && !isMyPending;
                          const isUnavailable = isMyPending || isBookedByOther;
                          return (
                            <button key={slot.id} disabled={isUnavailable}
                              onClick={() => { setSelectedSlot(slot); setStep("confirm"); }}
                              className={cn(
                                "px-4 py-3 rounded-xl border text-center min-w-[110px] transition-all",
                                isUnavailable && "border-border bg-muted/50 text-muted-foreground cursor-not-allowed",
                                !isUnavailable && "border-border hover:border-primary/30 text-foreground",
                              )}
                            >
                              <p className={cn("text-sm font-bold", isUnavailable && "line-through")}>{fmtTimeKo(slot.slot_time)}</p>
                              <p className={cn("text-[10px] mt-0.5",
                                isMyPending ? "text-primary" :
                                isBookedByOther ? "text-muted-foreground" :
                                "text-[hsl(var(--success))]"
                              )}>
                                {isMyPending ? "내 신청" : isBookedByOther ? "신청 완료" : "신청 가능"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                      {dateSlots.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">이 날짜에 가능한 시간이 없습니다</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* No-slots fallback */}
              {step === "no_slots" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.05)] p-4 space-y-2">
                    <p className="text-sm font-bold text-[hsl(var(--gold-dark))] flex items-center gap-2">
                      <CalendarX className="w-4 h-4" /> 가능한 일정이 없습니다
                    </p>
                    <p className="text-[11px] text-foreground/80 leading-relaxed">
                      해당 기간에 <span className="font-semibold">{targetInstructorName}</span> 강사님이 등록한 가능 시간이 없거나 모두 마감되었습니다.
                      규정에 따라 가능 슬롯이 없는 경우 별도 시간 개설은 어려우며, 해당 수업은 수업 횟수에서 차감될 수 있습니다.
                    </p>
                  </div>

                  {requestType === "reschedule" && (
                    <Button className="w-full" size="sm" onClick={handleKeepOriginal}>
                      기존 수업 유지하기
                    </Button>
                  )}
                  <Button variant="outline" className="w-full" size="sm" onClick={onClose}>
                    나중에 다시 확인할게요
                  </Button>
                </div>
              )}

              {/* STEP 4: Confirm */}
              {step === "confirm" && selectedSlot && (
                <div className="space-y-4">
                  <p className="text-sm font-bold text-foreground">신청 확인</p>
                  <div className="rounded-xl border border-border p-4 space-y-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold inline-block",
                      requestType === "reschedule" ? "bg-primary/10 text-primary" :
                      requestType === "makeup" ? "bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]" :
                      "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                    )}>
                      {requestType === "reschedule" ? "일정 변경" : requestType === "makeup" ? "취소 수업 보강" : "추가 보강"}
                    </span>

                    {requestType === "reschedule" && selectedSession && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-semibold">기존 수업</p>
                        <p className="text-xs text-foreground">
                          {fmtSessionDate(selectedSession.scheduled_at)} {fmtSessionTime(selectedSession.scheduled_at)}
                        </p>
                      </div>
                    )}

                    {requestType === "makeup" && selectedCancelledSession && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-semibold">취소된 수업</p>
                        <p className="text-xs text-foreground">
                          {fmtSessionDate(selectedCancelledSession.scheduled_at)} {fmtSessionTime(selectedCancelledSession.scheduled_at)}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-semibold">
                        {requestType === "reschedule" ? "변경 일시" : "보강 일시"}
                      </p>
                      <p className="text-sm font-bold text-primary">
                        {fmtDateKo(selectedSlot.slot_date)} {fmtTimeKo(selectedSlot.slot_time)}
                      </p>
                    </div>

                    {urgentReason && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-semibold">예외 사유</p>
                        <p className="text-xs text-foreground">{SICK_EXCEPTION_LABEL}</p>
                      </div>
                    )}

                    {groupStudents.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-semibold">그룹 수업</p>
                        <p className="text-xs text-foreground">{groupStudents.join(", ")} 함께 변경됩니다</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> 강사 승인 후 일정이 확정됩니다
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep("calendar")} className="flex-1">이전</Button>
                    <Button onClick={handleSubmit} disabled={submitting}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      신청하기
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
