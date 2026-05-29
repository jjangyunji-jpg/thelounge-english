import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  BanIcon, Clock, UserX, CalendarOff, CalendarClock, AlertCircle, UserCheck, AlertTriangle,
} from "lucide-react";

// DB 값: no_show / student_cancel / sick / instructor_cancel / advance_cancel / late_cancel
export type CancellationType = "student_cancel" | "no_show" | "sick" | "instructor_cancel" | "advance_cancel" | "late_cancel";
export type CancellationResolution = "makeup" | "carry_over" | "refund" | "cancel" | "scheduled_advance" | "substitute";

interface CancellationOption {
  type: CancellationType;
  label: string;
  description: string;
  icon: React.ElementType;
  billable: boolean;        // 학생 결제 차감 여부
  makeupAvailable: boolean;
  needsResolution: boolean;
  fixedResolution?: CancellationResolution;
  payNote: string; // 강사 정산 안내
}

const CANCELLATION_OPTIONS: CancellationOption[] = [
  {
    type: "no_show",
    label: "당일 노쇼 / 4시간 이내 취소",
    description: "수업 시작 4시간 전 이후 취소되었거나, 학생이 30분까지도 입장하지 않은 경우. 입장 전 3회 이상 연락 부탁드립니다. 30분 이후라도 수업이 10분 이상 진행된 경우 정상 수업으로 처리해주세요.",
    icon: UserX,
    billable: true,
    makeupAvailable: false,
    needsResolution: false,
    payNote: "수업료의 50% 지급",
  },
  {
    type: "student_cancel",
    label: "학생 취소 (48시간 ~ 4시간 전)",
    description: "수업 시작 48시간 ~ 4시간 전 학생 사정으로 취소된 경우. 학생 결제대상에서 차감되며, 강사에게는 기본 급여만 지급됩니다.",
    icon: BanIcon,
    billable: true,
    makeupAvailable: false,
    needsResolution: false,
    payNote: "기본 급여 11,000원 지급",
  },
  {
    type: "sick",
    label: "강사 취소 (병결 / 직계가족 사고·질병)",
    description: "병결, 직계가족 사고 및 질병 등 부득이한 사유로 강사가 취소한 경우. 보강 / 이월 / 환불 / 대체 강사 중 선택해주세요.",
    icon: Clock,
    billable: false,
    makeupAvailable: true,
    needsResolution: true,
    payNote: "보강·대체 진행 시에만 정상 지급",
  },
  {
    type: "advance_cancel",
    label: "사전 취소 (협의된 예외)",
    description: "사전에 협의되어 처리되는 예외적인 취소. 보강 / 이월 / 환불 / 대체 강사 중 선택해주세요.",
    icon: CalendarOff,
    billable: false,
    makeupAvailable: true,
    needsResolution: true,
    payNote: "보강·대체 진행 시 정상 지급 / 그 외 무급",
  },
];

const RESOLUTION_OPTIONS_DEFAULT: { value: CancellationResolution; label: string; description: string }[] = [
  { value: "makeup", label: "보강", description: "보강 수업을 진행합니다" },
  { value: "carry_over", label: "다음달 이월", description: "다음달로 수업을 이월합니다" },
  { value: "refund", label: "환불", description: "해당 수업료를 환불합니다" },
  { value: "substitute", label: "대체 강사", description: "다른 강사가 같은 시간에 대체 진행합니다" },
];

interface InstructorOption {
  id: string;
  name: string;
}

interface Props {
  sessionId: string;
  studentName: string;
  scheduledAt: string;
  currentInstructorName: string;
  allInstructors: InstructorOption[];
  open: boolean;
  onClose: () => void;
  onConfirm: (
    type: CancellationType,
    resolution: CancellationResolution | null,
    remark: string | null,
    extra?: { substituteInstructorName?: string; substituteConflictAcknowledged?: boolean },
  ) => void;
}

export default function SessionCancellationModal({
  sessionId, studentName, scheduledAt, currentInstructorName, allInstructors, open, onClose, onConfirm,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [resolution, setResolution] = useState<CancellationResolution | null>(null);
  const [remark, setRemark] = useState("");
  const [reasonTag, setReasonTag] = useState<string | null>(null);
  const [step, setStep] = useState<"type" | "resolution">("type");
  const [substituteInstructor, setSubstituteInstructor] = useState<string>("");
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  const selectedOption = selectedIndex !== null ? CANCELLATION_OPTIONS[selectedIndex] : null;
  const needsReasonTag = selectedOption?.type === "sick";
  const isSubstitute = resolution === "substitute";

  // 대체 강사 선택 시 같은 시각 충돌 검사 (warning only)
  useEffect(() => {
    if (!isSubstitute || !substituteInstructor) {
      setConflictWarning(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setCheckingConflict(true);
      try {
        const { data, error } = await supabase
          .from("class_sessions")
          .select("id, scheduled_at, student_name")
          .eq("instructor_name", substituteInstructor)
          .eq("scheduled_at", scheduledAt)
          .is("cancellation_type", null)
          .limit(3);
        if (cancelled) return;
        if (error) {
          setConflictWarning(null);
          return;
        }
        if (data && data.length > 0) {
          const names = data.map((r: any) => r.student_name).join(", ");
          setConflictWarning(`⚠ 같은 시각에 ${substituteInstructor} 강사의 수업이 이미 있습니다 (${names}). 그래도 진행할 수 있지만 일정 중복이 발생합니다.`);
        } else {
          setConflictWarning(null);
        }
      } finally {
        if (!cancelled) setCheckingConflict(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isSubstitute, substituteInstructor, scheduledAt]);

  const handleTypeSelect = (idx: number) => {
    const option = CANCELLATION_OPTIONS[idx];
    setSelectedIndex(idx);
    if (option.needsResolution && !option.fixedResolution) {
      setStep("resolution");
      setResolution(null);
      setReasonTag(null);
    } else if (option.fixedResolution) {
      onConfirm(option.type, option.fixedResolution, null);
      resetState();
    } else {
      onConfirm(option.type, null, null);
      resetState();
    }
  };

  const needsOtherReason = needsReasonTag && reasonTag === "기타";

  const handleConfirmResolution = () => {
    if (!selectedOption || !resolution) return;
    if (needsReasonTag && !reasonTag) return;
    if (needsOtherReason && !remark.trim()) return;
    if (isSubstitute && !substituteInstructor) return;
    const finalRemark = needsReasonTag
      ? `[${reasonTag}]${remark.trim() ? ` ${remark.trim()}` : ""}`
      : (remark.trim() || null);
    onConfirm(selectedOption.type, resolution, finalRemark, isSubstitute ? {
      substituteInstructorName: substituteInstructor,
      substituteConflictAcknowledged: !!conflictWarning,
    } : undefined);
    resetState();
  };

  const resetState = () => {
    setSelectedIndex(null);
    setResolution(null);
    setRemark("");
    setReasonTag(null);
    setStep("type");
    setSubstituteInstructor("");
    setConflictWarning(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const dateStr = new Date(scheduledAt).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });

  const otherInstructors = allInstructors.filter(i => i.name !== currentInstructorName);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {step === "type" ? "수업 취소 처리" : "후속 조치 선택"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {studentName} · {dateStr}
          </p>
        </DialogHeader>

        {step === "type" && (
          <div className="space-y-2">
            {CANCELLATION_OPTIONS.map((opt, idx) => {
              const Icon = opt.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleTypeSelect(idx)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/30 transition-all text-left"
                >
                  <Icon className="w-5 h-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        opt.billable
                          ? "bg-destructive/10 text-destructive"
                          : "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]"
                      )}>
                        {opt.billable ? "수업료 차감" : "차감 없음"}
                      </span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        opt.makeupAvailable
                          ? "bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-dark))]"
                          : "bg-muted text-muted-foreground"
                      )}>
                        보강 {opt.makeupAvailable ? "가능" : "불가"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{opt.description}</p>
                    <p className="text-[11px] text-[hsl(var(--gold-dark))] mt-1 font-medium">💰 {opt.payNote}</p>
                  </div>
                </button>
              );
            })}
            <div className="rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 px-3 py-2 mt-2 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
              <p className="text-[11px] text-foreground/80 leading-relaxed">
                정상적인 정산을 위해 클래스룸 노트에 취소 사유를 정확히 작성해주세요. 사유 누락 시 정산 반영이 어려울 수 있습니다.
              </p>
            </div>
          </div>
        )}

        {step === "resolution" && selectedOption && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
              <selectedOption.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{selectedOption.label}</span>
            </div>

            {needsReasonTag && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">취소 사유를 선택하세요</p>
                <div className="flex flex-wrap gap-2">
                  {["병결", "직계가족 사고·질병", "기타"].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setReasonTag(tag)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-full border transition-all",
                        reasonTag === tag
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:border-primary/40 text-muted-foreground"
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {needsOtherReason && (
                  <Textarea
                    placeholder="사유를 입력해주세요 (필수)"
                    value={remark}
                    onChange={e => setRemark(e.target.value)}
                    maxLength={500}
                    className="text-sm resize-none h-20"
                  />
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">후속 조치를 선택하세요</p>
              {RESOLUTION_OPTIONS_DEFAULT.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setResolution(opt.value)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                    resolution === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    resolution === opt.value ? "border-primary" : "border-muted-foreground/40"
                  )}>
                    {resolution === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {opt.value === "substitute" && <UserCheck className="w-3.5 h-3.5 text-primary" />}
                      <span className="text-sm font-medium">{opt.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {isSubstitute && (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <label className="text-xs font-medium text-foreground block">
                  대체 진행할 강사 선택 <span className="text-destructive">*</span>
                </label>
                <select
                  value={substituteInstructor}
                  onChange={e => setSubstituteInstructor(e.target.value)}
                  className="w-full text-sm h-9 rounded-md border border-input bg-background px-2"
                >
                  <option value="">강사를 선택하세요</option>
                  {otherInstructors.map(i => (
                    <option key={i.id} value={i.name}>{i.name}</option>
                  ))}
                </select>
                {checkingConflict && (
                  <p className="text-[11px] text-muted-foreground">일정 확인 중...</p>
                )}
                {conflictWarning && (
                  <div className="flex items-start gap-1.5 text-[11px] text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/30 rounded px-2 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{conflictWarning}</span>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  · 대체 강사 캘린더에 새 일정이 생성되고, 학생에게는 알림이 전송됩니다.<br/>
                  · 학생의 Google Meet 링크는 그대로 유지됩니다.<br/>
                  · 정산은 대체 강사 본인의 단가·레벨 할증 기준으로 지급됩니다.
                </p>
              </div>
            )}

            {!needsOtherReason && !isSubstitute && (resolution === "carry_over" || resolution === "refund" || resolution === "cancel") && (
              <Textarea
                placeholder="메모 (선택사항)"
                value={remark}
                onChange={e => setRemark(e.target.value)}
                maxLength={500}
                className="text-sm resize-none h-20"
              />
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep("type"); setResolution(null); setRemark(""); setReasonTag(null); setSubstituteInstructor(""); setConflictWarning(null); }}>
                뒤로
              </Button>
              <Button
                className="flex-1"
                disabled={!resolution || (needsReasonTag && !reasonTag) || (needsOtherReason && !remark.trim()) || (isSubstitute && !substituteInstructor)}
                onClick={handleConfirmResolution}
              >
                확인
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
