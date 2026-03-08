import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, Clock, Loader2, Check, X, AlertCircle, RotateCcw, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const SLOT_HOURS_AM = [10, 11, 12, 13]; // 오전 10~13시
const SLOT_HOURS_PM = [18, 19, 20, 21]; // 오후 18~21시
const SLOT_HOURS = [...SLOT_HOURS_AM, ...SLOT_HOURS_PM];
const WEEKDAY_LABELS = ["월", "화", "수", "목", "금"];

interface AvailableSlot {
  id: string;
  instructor_id: string;
  instructor_name: string;
  slot_date: string;
  slot_time: string;
  status: string;
}

interface MakeupReq {
  id: string;
  student_name: string;
  instructor_name: string;
  original_session_id: string | null;
  slot_id: string;
  request_type: string;
  status: string;
  group_students: string[];
  reject_reason: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface SchedulePeriod {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

function fmtDateKo(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}(${DAYS_KO[d.getDay()]})`;
}

function fmtTimeKo(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const displayH = h <= 12 ? h : h - 12;
  return `${period} ${displayH}:${String(m).padStart(2, "0")}`;
}

function fmtDateFull(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${DAYS_KO[d.getDay()]})`;
}

// Get weekdays (Mon-Fri) within a period
function getWeekdaysInPeriod(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) { // Mon-Fri
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dates.push(str);
    }
  }
  return dates;
}

type TabView = "register" | "calendar" | "requests";

export default function InstructorMakeupTab({ instructorId, instructorName }: { instructorId: string; instructorName: string }) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [requests, setRequests] = useState<MakeupReq[]>([]);
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<SchedulePeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<TabView>("register");

  // Registration state - week based
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  // pendingSlots: Set of "date|hour" keys
  const [pendingSlots, setPendingSlots] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // Approval state
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [slotsRes, reqsRes, periodsRes] = await Promise.all([
      supabase.from("instructor_available_slots")
        .select("*")
        .eq("instructor_id", instructorId)
        .order("slot_date").order("slot_time"),
      supabase.from("makeup_requests")
        .select("*")
        .eq("instructor_name", instructorName)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("schedule_periods")
        .select("*")
        .order("start_date", { ascending: false }),
    ]);
    setSlots((slotsRes.data || []) as AvailableSlot[]);
    setRequests((reqsRes.data || []) as MakeupReq[]);
    const allPeriods = (periodsRes.data || []) as SchedulePeriod[];
    setPeriods(allPeriods);
    if (!selectedPeriod && allPeriods.length > 0) {
      const active = allPeriods.find(p => p.is_active) || allPeriods[0];
      setSelectedPeriod(active);
    }
    setLoading(false);
  }, [instructorId, instructorName]);

  useEffect(() => { loadData(); }, [loadData]);

  // Weekdays in selected period
  const weekdays = useMemo(() => {
    if (!selectedPeriod) return [];
    return getWeekdaysInPeriod(selectedPeriod.start_date, selectedPeriod.end_date);
  }, [selectedPeriod]);

  const currentDate = weekdays[selectedDateIdx] || "";

  // Build slot lookup: date -> hour -> slot
  const slotMap = useMemo(() => {
    const map = new Map<string, Map<number, AvailableSlot>>();
    for (const s of slots) {
      if (!map.has(s.slot_date)) map.set(s.slot_date, new Map());
      const h = parseInt(s.slot_time.split(":")[0]);
      map.get(s.slot_date)!.set(h, s);
    }
    return map;
  }, [slots]);

  // Get slot for current date and hour
  const getSlot = (date: string, hour: number) => slotMap.get(date)?.get(hour);

  // Period navigation
  const periodIdx = periods.findIndex(p => p.id === selectedPeriod?.id);

  // Handle date navigation within period
  const goDate = (delta: number) => {
    setSelectedDateIdx(i => {
      const next = i + delta;
      if (next < 0 || next >= weekdays.length) return i;
      return next;
    });
    setPendingTimes(new Set());
  };

  // Toggle a pending time
  const togglePending = (hour: number) => {
    setPendingTimes(prev => {
      const next = new Set(prev);
      if (next.has(hour)) next.delete(hour); else next.add(hour);
      return next;
    });
  };

  // Register selected times
  const handleRegister = async () => {
    if (pendingTimes.size === 0 || !currentDate) return;
    setAdding(true);
    const toInsert = Array.from(pendingTimes).map(h => ({
      instructor_id: instructorId,
      instructor_name: instructorName,
      slot_date: currentDate,
      slot_time: `${String(h).padStart(2, "0")}:00:00`,
    }));
    const { error } = await supabase.from("instructor_available_slots").insert(toInsert as any);
    if (error) {
      if (error.message.includes("duplicate")) {
        toast({ title: "중복된 시간이 있습니다", variant: "destructive" });
      } else {
        toast({ title: "등록 실패", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: `${pendingTimes.size}개 시간 등록 완료 ✓` });
      setPendingTimes(new Set());
    }
    await loadData();
    setAdding(false);
  };

  // Delete a slot
  const handleDeleteSlot = async (slotId: string) => {
    const { error } = await supabase.from("instructor_available_slots").delete().eq("id", slotId).eq("status", "open");
    if (!error) {
      setSlots(prev => prev.filter(s => s.id !== slotId));
      toast({ title: "시간 삭제됨" });
    }
  };

  // Approve/reject
  const handleApprove = async (reqId: string) => {
    setProcessingId(reqId);
    const { data, error } = await supabase.functions.invoke("handle-makeup-request", {
      body: { action: "approve", request_id: reqId },
    });
    if (error || data?.error) {
      toast({ title: "승인 실패", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "보강 신청이 승인되었습니다 ✓" });
    }
    await loadData();
    setProcessingId(null);
  };

  const handleReject = async (reqId: string) => {
    setProcessingId(reqId);
    const { data, error } = await supabase.functions.invoke("handle-makeup-request", {
      body: { action: "reject", request_id: reqId, reject_reason: rejectReason || null },
    });
    if (error || data?.error) {
      toast({ title: "거절 실패", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "보강 신청이 거절되었습니다" });
    }
    setRejectingId(null);
    setRejectReason("");
    await loadData();
    setProcessingId(null);
  };

  const pendingRequests = requests.filter(r => r.status === "pending");
  const recentProcessed = requests.filter(r => r.status !== "pending").slice(0, 10);

  // Calendar view: group slots by week within period
  const calendarWeeks = useMemo(() => {
    if (!selectedPeriod) return [];
    const start = new Date(selectedPeriod.start_date + "T00:00:00");
    const end = new Date(selectedPeriod.end_date + "T00:00:00");
    // Grid from Sunday of start week to Saturday of end week
    const gridStart = new Date(start);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    const gridEnd = new Date(end);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

    const weeks: { dates: { date: string; day: number; month: number; inPeriod: boolean }[] }[] = [];
    let currentWeek: { date: string; day: number; month: number; inPeriod: boolean }[] = [];

    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const inPeriod = d >= start && d <= end;
      currentWeek.push({ date: dateStr, day: d.getDate(), month: d.getMonth(), inPeriod });
      if (currentWeek.length === 7) {
        weeks.push({ dates: currentWeek });
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeks.push({ dates: currentWeek });
    return weeks;
  }, [selectedPeriod]);

  // Slot count per date for calendar
  const slotCountByDate = useMemo(() => {
    const map = new Map<string, { open: number; booked: number }>();
    for (const s of slots) {
      if (!map.has(s.slot_date)) map.set(s.slot_date, { open: 0, booked: 0 });
      const entry = map.get(s.slot_date)!;
      if (s.status === "open") entry.open++;
      else entry.booked++;
    }
    return map;
  }, [slots]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Pending requests badge */}
      {pendingRequests.length > 0 && activeView !== "requests" && (
        <button
          onClick={() => setActiveView("requests")}
          className="w-full rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-3 flex items-center justify-between hover:bg-[hsl(var(--warning))]/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[hsl(var(--warning))]" />
            <span className="text-sm font-semibold text-foreground">승인 대기 {pendingRequests.length}건</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
        {([
          { key: "register" as TabView, label: "시간 등록", icon: Clock },
          { key: "calendar" as TabView, label: "캘린더", icon: Calendar },
          { key: "requests" as TabView, label: "신청 관리", icon: RotateCcw },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveView(t.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all",
              activeView === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.key === "requests" && pendingRequests.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] font-bold">
                {pendingRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Period selector */}
      {(activeView === "register" || activeView === "calendar") && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => periodIdx < periods.length - 1 && setSelectedPeriod(periods[periodIdx + 1])}
              disabled={periodIdx >= periods.length - 1}
              className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-bold text-foreground min-w-[100px] text-center">
              {selectedPeriod?.label || "기간 없음"}
            </span>
            <button
              onClick={() => periodIdx > 0 && setSelectedPeriod(periods[periodIdx - 1])}
              disabled={periodIdx <= 0}
              className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {selectedPeriod && (
            <span className="text-[11px] text-muted-foreground">
              {selectedPeriod.start_date.slice(5)} ~ {selectedPeriod.end_date.slice(5)}
            </span>
          )}
        </div>
      )}

      {/* ═══ REGISTER VIEW ═══ */}
      {activeView === "register" && selectedPeriod && (
        <div className="space-y-4">
          {/* Date navigator */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <button
                onClick={() => goDate(-1)}
                disabled={selectedDateIdx <= 0}
                className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="text-sm font-bold text-foreground">{currentDate ? fmtDateFull(currentDate) : "날짜 없음"}</span>
              <button
                onClick={() => goDate(1)}
                disabled={selectedDateIdx >= weekdays.length - 1}
                className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Time grid */}
            <div className="p-3">
              <div className="grid grid-cols-4 gap-2">
                {SLOT_HOURS.map(hour => {
                  const existing = getSlot(currentDate, hour);
                  const isPending = pendingTimes.has(hour);
                  const isOpen = existing?.status === "open";
                  const isBooked = existing?.status === "booked";
                  const isPast = currentDate < todayStr;

                  return (
                    <button
                      key={hour}
                      disabled={isBooked || isPast}
                      onClick={() => {
                        if (isOpen && existing) {
                          handleDeleteSlot(existing.id);
                        } else if (!existing) {
                          togglePending(hour);
                        }
                      }}
                      className={cn(
                        "relative h-11 rounded-lg text-sm font-semibold transition-all border",
                        isPast && "opacity-30 cursor-not-allowed border-transparent bg-muted/30 text-muted-foreground",
                        !isPast && isBooked && "bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] cursor-not-allowed",
                        !isPast && isOpen && "bg-[hsl(var(--success))] border-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/80",
                        !isPast && !existing && isPending && "bg-primary border-primary text-primary-foreground",
                        !isPast && !existing && !isPending && "bg-card border-border text-foreground hover:border-primary/40 hover:bg-muted/50",
                      )}
                    >
                      {hour}:00
                      {isOpen && (
                        <X className="absolute top-1 right-1 w-3 h-3 opacity-60" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-primary" />
                  <span className="text-[10px] text-muted-foreground">선택됨</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[hsl(var(--success))]" />
                  <span className="text-[10px] text-muted-foreground">등록됨 (클릭 시 삭제)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[hsl(var(--warning))]/30" />
                  <span className="text-[10px] text-muted-foreground">예약됨</span>
                </div>
              </div>
            </div>

            {/* Register button */}
            {pendingTimes.size > 0 && (
              <div className="px-3 pb-3">
                <Button
                  onClick={handleRegister}
                  disabled={adding}
                  className="w-full h-10 text-sm bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {pendingTimes.size}개 시간 등록
                </Button>
              </div>
            )}
          </div>

          {/* Quick stats for current date */}
          {currentDate && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-1">
              <span>
                이 날: 등록 <span className="font-bold text-[hsl(var(--success))]">{slotCountByDate.get(currentDate)?.open || 0}</span>
                {(slotCountByDate.get(currentDate)?.booked || 0) > 0 && (
                  <> · 예약 <span className="font-bold text-[hsl(var(--warning))]">{slotCountByDate.get(currentDate)?.booked}</span></>
                )}
              </span>
              <span className="text-border">|</span>
              <span>전체 기간: 등록 <span className="font-bold text-foreground">
                {Array.from(slotCountByDate.values()).reduce((s, v) => s + v.open, 0)}
              </span></span>
            </div>
          )}
        </div>
      )}

      {/* ═══ CALENDAR VIEW ═══ */}
      {activeView === "calendar" && selectedPeriod && (
        <div className="space-y-3">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center">
            {DAYS_KO.map((d, i) => (
              <div key={d} className={cn(
                "text-[11px] font-semibold py-1.5",
                i === 0 ? "text-destructive/70" : i === 6 ? "text-blue-400" : "text-muted-foreground"
              )}>{d}</div>
            ))}
          </div>

          {/* Weeks */}
          <div className="space-y-1">
            {calendarWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.dates.map((cell, ci) => {
                  const counts = slotCountByDate.get(cell.date);
                  const isToday = cell.date === todayStr;
                  const isWeekend = ci === 0 || ci === 6;

                  return (
                    <button
                      key={cell.date}
                      onClick={() => {
                        if (!cell.inPeriod || isWeekend) return;
                        const idx = weekdays.indexOf(cell.date);
                        if (idx >= 0) {
                          setSelectedDateIdx(idx);
                          setActiveView("register");
                          setPendingTimes(new Set());
                        }
                      }}
                      className={cn(
                        "aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs transition-all relative",
                        !cell.inPeriod && "opacity-30",
                        isWeekend && "opacity-40",
                        cell.inPeriod && !isWeekend && "hover:bg-muted cursor-pointer",
                        isToday && "ring-1 ring-primary",
                      )}
                    >
                      <span className={cn(
                        "text-[11px] font-medium",
                        isToday ? "text-primary font-bold" : "text-foreground"
                      )}>
                        {cell.day}
                      </span>
                      {counts && (counts.open > 0 || counts.booked > 0) && (
                        <div className="flex items-center gap-0.5">
                          {counts.open > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]" />
                          )}
                          {counts.booked > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--warning))]" />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Slot list below calendar */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold text-muted-foreground">등록된 가용 시간</p>
            {Array.from(slotMap.entries())
              .filter(([date]) => {
                if (!selectedPeriod) return false;
                return date >= selectedPeriod.start_date && date <= selectedPeriod.end_date;
              })
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, hourMap]) => (
                <div key={date} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="px-3 py-1.5 bg-muted/30 border-b border-border">
                    <p className="text-[11px] font-semibold text-foreground">{fmtDateKo(date)}</p>
                  </div>
                  <div className="p-2 flex flex-wrap gap-1.5">
                    {Array.from(hourMap.entries())
                      .sort(([a], [b]) => a - b)
                      .map(([hour, slot]) => (
                        <div key={slot.id} className={cn(
                          "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium border",
                          slot.status === "open"
                            ? "bg-[hsl(var(--success))]/5 border-[hsl(var(--success))]/20 text-[hsl(var(--success))]"
                            : "bg-[hsl(var(--warning))]/5 border-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]",
                        )}>
                          <span>{hour}:00</span>
                          {slot.status === "booked" ? (
                            <span className="text-[9px]">예약</span>
                          ) : (
                            <button onClick={() => handleDeleteSlot(slot.id)} className="hover:text-destructive transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            {slots.filter(s => selectedPeriod && s.slot_date >= selectedPeriod.start_date && s.slot_date <= selectedPeriod.end_date).length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Clock className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">등록된 가용 시간이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ REQUESTS VIEW ═══ */}
      {activeView === "requests" && (
        <div className="space-y-4">
          {/* Pending */}
          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[hsl(var(--warning))]" />
                승인 대기 중
                <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] font-semibold">{pendingRequests.length}</span>
              </h3>
              {pendingRequests.map(req => {
                const slot = slots.find(s => s.id === req.slot_id);
                return (
                  <div key={req.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{req.student_name}</span>
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold",
                            req.request_type === "reschedule" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                          )}>
                            {req.request_type === "reschedule" ? "일정 변경" : "추가 보강"}
                          </span>
                        </div>
                        {req.group_students.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">그룹: {req.group_students.join(", ")}</p>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" })}
                      </p>
                    </div>

                    {slot && (
                      <p className="text-xs text-foreground">
                        → <span className="font-semibold text-primary">{fmtDateKo(slot.slot_date)} {fmtTimeKo(slot.slot_time)}</span>
                      </p>
                    )}

                    {rejectingId === req.id ? (
                      <div className="space-y-2">
                        <Input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="거절 사유 (선택)"
                          className="h-8 text-xs"
                        />
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setRejectingId(null)} className="h-7 text-xs flex-1">취소</Button>
                          <Button size="sm" onClick={() => handleReject(req.id)}
                            disabled={processingId === req.id}
                            className="h-7 text-xs flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "거절 확인"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setRejectingId(req.id)} disabled={!!processingId} className="h-8 text-xs flex-1">
                          <X className="w-3 h-3 mr-1" /> 거절
                        </Button>
                        <Button size="sm" onClick={() => handleApprove(req.id)} disabled={!!processingId}
                          className="h-8 text-xs flex-1 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--success-foreground))]">
                          {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" /> 승인</>}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {pendingRequests.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <Check className="w-6 h-6 text-[hsl(var(--success))]/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">대기 중인 신청이 없습니다</p>
            </div>
          )}

          {/* Recent processed */}
          {recentProcessed.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground">최근 처리 내역</h3>
              {recentProcessed.map(req => (
                <div key={req.id} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{req.student_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {req.request_type === "reschedule" ? "일정 변경" : "추가 보강"} ·{" "}
                      {new Date(req.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", timeZone: "Asia/Seoul" })}
                    </p>
                  </div>
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full",
                    req.status === "approved" ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" :
                    req.status === "rejected" ? "bg-destructive/10 text-destructive" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {req.status === "approved" ? "승인" : req.status === "rejected" ? "거절" : "취소"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
