import { useState, useEffect, useMemo } from "react";
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

export default function MakeupRequestModal({ studentName, instructorName, groupStudents, onClose }: MakeupRequestModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [myRequests, setMyRequests] = useState<MakeupReq[]>([]);

  const [step, setStep] = useState<"type" | "checklist" | "session" | "calendar" | "confirm">("type");
  const [checkedItems, setCheckedItems] = useState<boolean[]>([false, false, false, false]);
  const [requestType, setRequestType] = useState<"reschedule" | "extra">("reschedule");
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  useEffect(() => {
    (async () => {
      if (!instructorName) { setLoading(false); return; }
      const now = new Date();
      const [slotsRes, sessionsRes, reqsRes, groupSessRes] = await Promise.all([
        supabase.from("instructor_available_slots").select("*")
          .eq("instructor_name", instructorName).eq("status", "open")
          .gte("slot_date", todayStr).order("slot_date").order("slot_time"),
        supabase.from("class_sessions").select("id, scheduled_at, topic, instructor_name, group_students")
          .eq("student_name", studentName).gte("scheduled_at", now.toISOString())
          .is("started_at", null).order("scheduled_at"),
        supabase.from("makeup_requests").select("*")
          .eq("student_name", studentName).order("created_at", { ascending: false }).limit(20),
        supabase.from("class_sessions").select("id, scheduled_at, topic, instructor_name, group_students")
          .contains("group_students", [studentName]).gte("scheduled_at", now.toISOString())
          .is("started_at", null).order("scheduled_at"),
      ]);

      const sessionMap = new Map<string, ClassSession>();
      for (const s of (sessionsRes.data || [])) sessionMap.set(s.id, s as ClassSession);
      for (const s of (groupSessRes.data || [])) sessionMap.set(s.id, s as ClassSession);

      setSlots((slotsRes.data || []) as AvailableSlot[]);
      setSessions(Array.from(sessionMap.values()).sort((a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      ));
      setMyRequests((reqsRes.data || []) as MakeupReq[]);
      setLoading(false);
    })();
  }, []);

  const eligibleSessions = useMemo(() => {
    const cutoff = Date.now() + 48 * 60 * 60 * 1000;
    return sessions.filter(s => new Date(s.scheduled_at).getTime() > cutoff);
  }, [sessions]);

  const slotDates = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      if (!map.has(s.slot_date)) map.set(s.slot_date, []);
      map.get(s.slot_date)!.push(s);
    }
    return map;
  }, [slots]);

  const dateSlots = useMemo(() => {
    if (!selectedDate) return [];
    return slotDates.get(selectedDate) || [];
  }, [selectedDate, slotDates]);

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

  const handleSubmit = async () => {
    if (!selectedSlot) return;
    if (requestType === "reschedule" && !selectedSession) return;
    setSubmitting(true);
    try {
      const { data: slotCheck } = await supabase.from("instructor_available_slots")
        .select("status").eq("id", selectedSlot.id).single();
      if (!slotCheck || slotCheck.status !== "open") {
        toast({ title: "이미 예약된 시간입니다", description: "다른 시간을 선택해주세요.", variant: "destructive" });
        const { data: fresh } = await supabase.from("instructor_available_slots").select("*")
          .eq("instructor_name", instructorName).eq("status", "open")
          .gte("slot_date", todayStr).order("slot_date").order("slot_time");
        setSlots((fresh || []) as AvailableSlot[]);
        setSubmitting(false);
        return;
      }
      await supabase.from("instructor_available_slots").update({ status: "booked" }).eq("id", selectedSlot.id);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card w-full max-w-md max-h-[85vh] rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {step !== "type" && (
              <button onClick={() => {
                if (step === "confirm") setStep("calendar");
                else if (step === "calendar") setStep(requestType === "reschedule" ? "session" : "type");
                else if (step === "session") setStep("checklist");
                else if (step === "checklist") { setCheckedItems([false, false, false, false]); setStep("type"); }
              }} className="text-muted-foreground hover:text-foreground">
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
              {/* Pending requests */}
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

              {/* Past requests */}
              {pastRequests.length > 0 && step === "type" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">이전 신청 내역</p>
                  {pastRequests.map(r => (
                    <div key={r.id} className="rounded-lg border border-border bg-muted/30 p-3">
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
                      {r.reject_reason && <p className="text-[10px] text-muted-foreground mt-1">사유: {r.reject_reason}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Step: Type selection */}
              {step === "type" && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-foreground">보강 유형을 선택해주세요</p>
                  <button
                    onClick={() => { setRequestType("reschedule"); setCheckedItems([false, false, false, false]); setStep("checklist"); }}
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

              {/* Step: Checklist */}
              {step === "checklist" && (() => {
                const CHECKLIST_ITEMS = [
                  "수업 48시간 이내의 일정은 변경이 어려울 수 있습니다.",
                  "잦은 일정 변경은 학습 흐름에 영향을 줄 수 있습니다. 또한 일정 변경이 반복될 경우, 수업이 중단될 수 있습니다.",
                  "장기 부재(출장, 여행 등)가 예정된 경우, 한 달 전에 미리 알려주세요.",
                  "변경된 수업은 강사 승인 후 확정됩니다.",
                ];
                const allChecked = checkedItems.every(Boolean);
                return (
                  <div className="space-y-4">
                    <p className="text-sm font-bold text-foreground">일정 변경 전 확인해주세요 <span className="text-xs font-normal text-muted-foreground">(모두 체크해주세요)</span></p>
                    <div className="space-y-3">
                      {CHECKLIST_ITEMS.map((text, i) => (
                        <label key={i} className="flex items-start gap-3 cursor-pointer group">
                          <div
                            className={cn(
                              "mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                              checkedItems[i]
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/40 group-hover:border-primary/60"
                            )}
                            onClick={() => setCheckedItems(prev => { const n = [...prev]; n[i] = !n[i]; return n; })}
                          >
                            {checkedItems[i] && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <span className="text-xs text-muted-foreground leading-relaxed">{text}</span>
                        </label>
                      ))}
                    </div>
                    <Button
                      onClick={() => setStep("session")}
                      disabled={!allChecked}
                      className="w-full"
                      size="sm"
                    >
                      확인했습니다
                    </Button>
                  </div>
                );
              })()}

              {/* Step: Session selection */}
              {step === "session" && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-foreground">변경할 수업을 선택해주세요</p>
                  {eligibleSessions.length === 0 ? (
                    <div className="rounded-xl border border-border p-6 text-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">변경 가능한 수업이 없습니다</p>
                      <p className="text-[10px] text-muted-foreground">수업 48시간 전까지만 변경할 수 있습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {eligibleSessions.map(s => (
                        <button key={s.id}
                          onClick={() => { setSelectedSession(s); setStep("calendar"); }}
                          className="w-full rounded-lg border border-border p-3 text-left hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-foreground">
                                {fmtSessionDate(s.scheduled_at)} {fmtSessionTime(s.scheduled_at)}
                              </p>
                              {s.topic && <p className="text-[10px] text-muted-foreground mt-0.5">{s.topic}</p>}
                            </div>
                            <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step: Calendar */}
              {step === "calendar" && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-foreground">
                    {selectedDate ? `📅 ${fmtDateKo(selectedDate)} · 회차를 선택해 주세요.` : "날짜를 선택해주세요"}
                  </p>

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
                        const bookedSlotIds = new Set(pendingRequests.map(r => r.slot_id));
                        const availableCount = slotsForDay.filter(s => !bookedSlotIds.has(s.id)).length;

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

                  {selectedDate && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">회차를 선택하세요.</p>
                      <div className="flex flex-wrap gap-2">
                        {dateSlots.map(slot => {
                          const isBooked = pendingRequests.some(r => r.slot_id === slot.id);
                          return (
                            <button key={slot.id} disabled={isBooked}
                              onClick={() => { setSelectedSlot(slot); setStep("confirm"); }}
                              className={cn(
                                "px-4 py-3 rounded-xl border text-center min-w-[110px] transition-all",
                                isBooked && "border-border bg-muted/50 text-muted-foreground cursor-not-allowed",
                                !isBooked && "border-border hover:border-primary/30 text-foreground",
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

              {/* Step: Confirm */}
              {step === "confirm" && selectedSlot && (
                <div className="space-y-4">
                  <p className="text-sm font-bold text-foreground">신청 확인</p>
                  <div className="rounded-xl border border-border p-4 space-y-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold inline-block",
                      requestType === "reschedule" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                    )}>
                      {requestType === "reschedule" ? "일정 변경" : "추가 보강"}
                    </span>

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
