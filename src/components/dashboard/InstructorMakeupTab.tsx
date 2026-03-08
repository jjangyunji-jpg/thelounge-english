import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, Plus, Trash2, Loader2, Check, X, ChevronLeft, ChevronRight, AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const SLOT_HOURS = Array.from({ length: 12 }, (_, i) => `${String(i + 9).padStart(2, "0")}:00`);

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

export default function InstructorMakeupTab({ instructorId, instructorName }: { instructorId: string; instructorName: string }) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [requests, setRequests] = useState<MakeupReq[]>([]);
  const [loading, setLoading] = useState(true);

  // Slot creation
  const [addDate, setAddDate] = useState("");
  const [addTimes, setAddTimes] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // Approval
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  const loadData = async () => {
    setLoading(true);
    const [slotsRes, reqsRes] = await Promise.all([
      supabase.from("instructor_available_slots")
        .select("*")
        .eq("instructor_id", instructorId)
        .gte("slot_date", todayStr)
        .order("slot_date").order("slot_time"),
      supabase.from("makeup_requests")
        .select("*")
        .eq("instructor_name", instructorName)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setSlots((slotsRes.data || []) as AvailableSlot[]);
    setRequests((reqsRes.data || []) as MakeupReq[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [instructorId]);

  const pendingRequests = requests.filter(r => r.status === "pending");
  const recentProcessed = requests.filter(r => r.status !== "pending").slice(0, 10);

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      if (!map.has(s.slot_date)) map.set(s.slot_date, []);
      map.get(s.slot_date)!.push(s);
    }
    return map;
  }, [slots]);

  const handleAddSlots = async () => {
    if (!addDate || addTimes.size === 0) return;
    setAdding(true);
    const toInsert = Array.from(addTimes).map(t => ({
      instructor_id: instructorId,
      instructor_name: instructorName,
      slot_date: addDate,
      slot_time: t + ":00",
    }));

    const { error } = await supabase.from("instructor_available_slots").insert(toInsert as any);
    if (error) {
      if (error.message.includes("duplicate")) {
        toast({ title: "중복된 시간이 있습니다", variant: "destructive" });
      } else {
        toast({ title: "등록 실패", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: `${addTimes.size}개 시간 등록 완료 ✓` });
      setAddDate("");
      setAddTimes(new Set());
    }
    await loadData();
    setAdding(false);
  };

  const handleDeleteSlot = async (slotId: string) => {
    // Can only delete 'open' slots
    const { error } = await supabase.from("instructor_available_slots").delete().eq("id", slotId).eq("status", "open");
    if (!error) {
      setSlots(prev => prev.filter(s => s.id !== slotId));
      toast({ title: "시간 삭제됨" });
    }
  };

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

  // Get slot info for a request
  const getSlotInfo = (slotId: string) => {
    const allSlots = slots;
    return allSlots.find(s => s.id === slotId);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[hsl(var(--warning))]" />
            승인 대기 중
            <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] font-semibold">{pendingRequests.length}</span>
          </h3>
          {pendingRequests.map(req => {
            const slot = getSlotInfo(req.slot_id);
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectingId(req.id)}
                      disabled={!!processingId}
                      className="h-8 text-xs flex-1"
                    >
                      <X className="w-3 h-3 mr-1" /> 거절
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(req.id)}
                      disabled={!!processingId}
                      className="h-8 text-xs flex-1 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--success-foreground))]"
                    >
                      {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" /> 승인</>}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Available Slots */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          보강 가능 시간 등록
        </h3>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">날짜</Label>
            <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} min={todayStr} className="h-9 text-sm" />
          </div>
          {addDate && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">시간 선택 (1시간 단위, 복수 선택 가능)</Label>
              <div className="flex flex-wrap gap-1.5">
                {SLOT_HOURS.map(h => {
                  const selected = addTimes.has(h);
                  const existing = slots.some(s => s.slot_date === addDate && s.slot_time === h + ":00");
                  return (
                    <button
                      key={h}
                      disabled={existing}
                      onClick={() => {
                        setAddTimes(prev => {
                          const next = new Set(prev);
                          if (next.has(h)) next.delete(h); else next.add(h);
                          return next;
                        });
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all border",
                        existing && "bg-muted/50 text-muted-foreground/40 cursor-not-allowed border-transparent",
                        !existing && !selected && "bg-card hover:bg-muted border-border text-foreground",
                        selected && "bg-primary text-primary-foreground border-primary",
                      )}
                    >
                      {h}
                      {existing && <span className="ml-1 text-[9px]">등록됨</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <Button
            onClick={handleAddSlots}
            disabled={adding || !addDate || addTimes.size === 0}
            className="w-full h-9 text-sm bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {addTimes.size > 0 ? `${addTimes.size}개 시간 등록` : "시간 등록"}
          </Button>
        </div>
      </div>

      {/* Registered Slots List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          등록된 가용 시간
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{slots.length}</span>
        </h3>
        {Array.from(slotsByDate.entries()).map(([date, dateSlots]) => (
          <div key={date} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 bg-muted/30 border-b border-border">
              <p className="text-xs font-semibold text-foreground">{fmtDateKo(date)}</p>
            </div>
            <div className="p-2 flex flex-wrap gap-1.5">
              {dateSlots.map(slot => (
                <div key={slot.id} className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border",
                  slot.status === "open" ? "bg-[hsl(var(--success))]/5 border-[hsl(var(--success))]/20 text-[hsl(var(--success))]" :
                  "bg-muted/50 border-border text-muted-foreground",
                )}>
                  <span>{fmtTimeKo(slot.slot_time)}</span>
                  {slot.status === "booked" ? (
                    <span className="text-[9px] text-muted-foreground">예약됨</span>
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
        {slotsByDate.size === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">등록된 가용 시간이 없습니다</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">위에서 날짜와 시간을 선택하여 등록해주세요</p>
          </div>
        )}
      </div>

      {/* Recent processed */}
      {recentProcessed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
            최근 처리 내역
          </h3>
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
  );
}
