import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, ChevronLeft, ChevronRight, Clock, Check, Loader2, Plus, X, AlertCircle } from "lucide-react";
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
}

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
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" });
}
function fmtSessionTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
}

export default function MakeupRequest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [instructorName, setInstructorName] = useState<string | null>(null);
  const [groupStudents, setGroupStudents] = useState<string[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [myRequests, setMyRequests] = useState<MakeupReq[]>([]);

  // UI state
  const [step, setStep] = useState<"type" | "session" | "calendar" | "time" | "confirm">("type");
  const [requestType, setRequestType] = useState<"reschedule" | "extra">("reschedule");
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Calendar month navigation
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // Load data
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const { data: profile } = await supabase
        .from("student_profiles")
        .select("student_name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!profile) { navigate("/my/dashboard"); return; }

      const sName = profile.student_name;
      setStudentName(sName);

      // Get instructor info
      const { data: studentRec } = await supabase
        .from("instructor_students")
        .select("instructor_name, group_students")
        .eq("student_name", sName)
        .eq("status", "active")
        .maybeSingle();

      const iName = studentRec?.instructor_name || null;
      setInstructorName(iName);
      setGroupStudents(Array.isArray(studentRec?.group_students) ? studentRec.group_students : []);

      if (!iName) { setLoading(false); return; }

      // Load available slots, future sessions, and existing requests
      const now = new Date();
      const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

      const [slotsRes, sessionsRes, reqsRes] = await Promise.all([
        supabase.from("instructor_available_slots")
          .select("*")
          .eq("instructor_name", iName)
          .eq("status", "open")
          .gte("slot_date", todayStr)
          .order("slot_date").order("slot_time"),
        supabase.from("class_sessions")
          .select("id, scheduled_at, topic, instructor_name, group_students")
          .eq("student_name", sName)
          .gte("scheduled_at", now.toISOString())
          .is("started_at", null)
          .order("scheduled_at"),
        supabase.from("makeup_requests")
          .select("*")
          .eq("student_name", sName)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      // Also get group sessions
      const { data: groupSessions } = await supabase
        .from("class_sessions")
        .select("id, scheduled_at, topic, instructor_name, group_students")
        .contains("group_students", [sName])
        .gte("scheduled_at", now.toISOString())
        .is("started_at", null)
        .order("scheduled_at");

      // Merge and deduplicate
      const sessionMap = new Map<string, ClassSession>();
      for (const s of (sessionsRes.data || [])) sessionMap.set(s.id, s as ClassSession);
      for (const s of (groupSessions || [])) sessionMap.set(s.id, s as ClassSession);

      setSlots((slotsRes.data || []) as AvailableSlot[]);
      setSessions(Array.from(sessionMap.values()).sort((a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      ));
      setMyRequests((reqsRes.data || []) as MakeupReq[]);
      setLoading(false);
    })();
  }, []);

  // Filter sessions: only those 48+ hours away
  const eligibleSessions = useMemo(() => {
    const cutoff = Date.now() + 48 * 60 * 60 * 1000;
    return sessions.filter(s => new Date(s.scheduled_at).getTime() > cutoff);
  }, [sessions]);

  // Dates that have open slots
  const slotDates = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      if (!map.has(s.slot_date)) map.set(s.slot_date, []);
      map.get(s.slot_date)!.push(s);
    }
    return map;
  }, [slots]);

  // Slots for selected date
  const dateSlots = useMemo(() => {
    if (!selectedDate) return [];
    return slotDates.get(selectedDate) || [];
  }, [selectedDate, slotDates]);

  // Calendar cells
  const calendarCells = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startOffset = firstDay.getDay();
    const cells: { day: number; date: string; inMonth: boolean }[] = [];

    // Previous month padding
    const prevLastDay = new Date(calYear, calMonth, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevLastDay - i;
      const m = calMonth === 0 ? 11 : calMonth - 1;
      const y = calMonth === 0 ? calYear - 1 : calYear;
      cells.push({ day: d, date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: false });
    }
    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push({ day: d, date: `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: true });
    }
    // Next month padding
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

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  // Slot count per date for display
  const slotCountForDate = (dateStr: string) => {
    return slotDates.get(dateStr)?.length || 0;
  };

  const handleSubmit = async () => {
    if (!selectedSlot || !studentName || !instructorName) return;
    if (requestType === "reschedule" && !selectedSession) return;
    setSubmitting(true);

    try {
      // Check slot still open
      const { data: slotCheck } = await supabase
        .from("instructor_available_slots")
        .select("status")
        .eq("id", selectedSlot.id)
        .single();

      if (!slotCheck || slotCheck.status !== "open") {
        toast({ title: "이미 예약된 시간입니다", description: "다른 시간을 선택해주세요.", variant: "destructive" });
        // Refresh slots
        const { data: fresh } = await supabase.from("instructor_available_slots")
          .select("*").eq("instructor_name", instructorName).eq("status", "open")
          .gte("slot_date", todayStr).order("slot_date").order("slot_time");
        setSlots((fresh || []) as AvailableSlot[]);
        setSubmitting(false);
        return;
      }

      // Mark slot as booked
      await supabase.from("instructor_available_slots")
        .update({ status: "booked" })
        .eq("id", selectedSlot.id);

      // Create request
      const { error } = await supabase.from("makeup_requests").insert({
        student_name: studentName,
        instructor_name: instructorName,
        original_session_id: requestType === "reschedule" ? selectedSession!.id : null,
        slot_id: selectedSlot.id,
        request_type: requestType,
        group_students: groupStudents,
      } as any);

      if (error) throw error;

      toast({ title: "보강 신청 완료!", description: "강사의 승인을 기다려주세요." });
      navigate("/my/dashboard");
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
      // Re-open the slot
      await supabase.from("instructor_available_slots")
        .update({ status: "open" })
        .eq("id", slotId);
      toast({ title: "신청이 취소되었습니다." });
      setMyRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: "cancelled" } : r));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const pendingRequests = myRequests.filter(r => r.status === "pending");
  const pastRequests = myRequests.filter(r => r.status !== "pending").slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/my/dashboard")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <RotateCcw className="w-4 h-4 text-primary" />
        <h1 className="text-sm font-bold text-foreground">보강 신청</h1>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-5">
        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">대기 중인 신청</p>
            {pendingRequests.map(r => {
              const slot = slots.find(s => s.id === r.slot_id);
              return (
                <div key={r.id} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {r.request_type === "extra" ? "추가 보강" : "일정 변경"} · 승인 대기
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(r.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" })} 신청
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancel(r.id, r.slot_id)}
                    className="text-[11px] text-destructive hover:underline font-medium"
                  >
                    취소
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Past requests */}
        {pastRequests.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">이전 신청 내역</p>
            {pastRequests.map(r => (
              <div key={r.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    {r.request_type === "extra" ? "추가 보강" : "일정 변경"}
                  </p>
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full",
                    r.status === "approved" ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" :
                    r.status === "rejected" ? "bg-destructive/10 text-destructive" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {r.status === "approved" ? "승인됨" : r.status === "rejected" ? "거절됨" : "취소됨"}
                  </span>
                </div>
                {r.reject_reason && (
                  <p className="text-[10px] text-muted-foreground mt-1">사유: {r.reject_reason}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* New request flow */}
        {step === "type" && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-foreground">보강 유형을 선택해주세요</p>
            <button
              onClick={() => { setRequestType("reschedule"); setStep("session"); }}
              className="w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary/50 transition-colors space-y-1"
            >
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-primary" /> 일정 변경
              </p>
              <p className="text-xs text-muted-foreground">기존 수업을 다른 시간으로 변경합니다</p>
            </button>
            <button
              onClick={() => { setRequestType("extra"); setStep("calendar"); }}
              className="w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary/50 transition-colors space-y-1"
            >
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-[hsl(var(--success))]" /> 추가 보강
              </p>
              <p className="text-xs text-muted-foreground">수업 횟수를 추가로 신청합니다</p>
            </button>
          </div>
        )}

        {step === "session" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep("type")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-bold text-foreground">변경할 수업을 선택해주세요</p>
            </div>
            {eligibleSessions.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">변경 가능한 수업이 없습니다</p>
                <p className="text-[10px] text-muted-foreground">수업 48시간 전까지만 변경할 수 있습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {eligibleSessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSession(s); setStep("calendar"); }}
                    className="w-full rounded-lg border border-border bg-card p-3 text-left hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {fmtSessionDate(s.scheduled_at)} {fmtSessionTime(s.scheduled_at)}
                        </p>
                        {s.topic && <p className="text-[10px] text-muted-foreground mt-0.5">{s.topic}</p>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "calendar" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep(requestType === "reschedule" ? "session" : "type")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-bold text-foreground">
                {selectedDate ? `📅 ${fmtDateKo(selectedDate)} · 회차를 선택해 주세요.` : "날짜를 선택해주세요"}
              </p>
            </div>

            {/* Calendar */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {/* Month nav */}
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }}
                  className="p-1 hover:bg-muted rounded-md">
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-sm font-bold text-foreground min-w-[100px] text-center">
                  {calYear}.{String(calMonth + 1).padStart(2, "0")}
                </span>
                <button onClick={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }}
                  className="p-1 hover:bg-muted rounded-md">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 text-center">
                {DAYS_KO.map((d, i) => (
                  <div key={d} className={cn("text-[11px] font-semibold py-1",
                    i === 0 ? "text-destructive/70" : "text-muted-foreground"
                  )}>{d}</div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  const hasSlots = slotCountForDate(cell.date) > 0;
                  const isPast = cell.date < todayStr;
                  const isToday = cell.date === todayStr;
                  const isSelected = cell.date === selectedDate;
                  const slotsForDay = slotDates.get(cell.date) || [];
                  // Check if all slots on this date are already booked via pending requests
                  const bookedSlotIds = new Set(pendingRequests.map(r => r.slot_id));
                  const availableCount = slotsForDay.filter(s => !bookedSlotIds.has(s.id)).length;

                  return (
                    <button
                      key={idx}
                      disabled={!cell.inMonth || isPast || !hasSlots}
                      onClick={() => { setSelectedDate(cell.date); setSelectedSlot(null); }}
                      className={cn(
                        "aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all relative",
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
                          availableCount === 0 ? "text-destructive" : "text-[hsl(var(--success))]"
                        )}>
                          {availableCount === 0 ? "매진" : `${availableCount}매`}
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

            {/* Time slots for selected date */}
            {selectedDate && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">회차를 선택하세요.</p>
                <div className="flex flex-wrap gap-2">
                  {dateSlots.map(slot => {
                    const isBooked = pendingRequests.some(r => r.slot_id === slot.id);
                    const isSelected = selectedSlot?.id === slot.id;
                    return (
                      <button
                        key={slot.id}
                        disabled={isBooked}
                        onClick={() => { setSelectedSlot(slot); setStep("confirm"); }}
                        className={cn(
                          "px-4 py-3 rounded-xl border text-center min-w-[120px] transition-all",
                          isBooked && "border-border bg-muted/50 text-muted-foreground cursor-not-allowed",
                          !isBooked && !isSelected && "border-border bg-card hover:border-primary/30 text-foreground",
                          isSelected && "border-primary bg-primary/10 text-primary",
                        )}
                      >
                        <p className="text-sm font-bold">{fmtTimeKo(slot.slot_time)}</p>
                        <p className={cn("text-[10px] mt-0.5",
                          isBooked ? "text-destructive" : "text-[hsl(var(--success))]"
                        )}>
                          {isBooked ? "매진" : "1매"}
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

        {step === "confirm" && selectedSlot && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep("calendar")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-bold text-foreground">신청 확인</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold",
                  requestType === "reschedule" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                )}>
                  {requestType === "reschedule" ? "일정 변경" : "추가 보강"}
                </span>
              </div>

              {requestType === "reschedule" && selectedSession && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-semibold">기존 수업</p>
                  <p className="text-xs text-foreground">
                    {fmtSessionDate(selectedSession.scheduled_at)} {fmtSessionTime(selectedSession.scheduled_at)}
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

              {groupStudents.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-semibold">그룹 수업</p>
                  <p className="text-xs text-foreground">{groupStudents.join(", ")} 함께 변경됩니다</p>
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  강사 승인 후 일정이 확정됩니다
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("calendar")} className="flex-1">
                이전
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                신청하기
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
