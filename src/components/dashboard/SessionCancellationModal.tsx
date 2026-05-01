import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  BanIcon, Clock, Thermometer, UserX, CalendarOff, CalendarClock,
} from "lucide-react";

// DB 값은 호환성 위해 그대로 유지 (no_show / student_cancel / sick / instructor_cancel / advance_cancel)
export type CancellationType = "student_cancel" | "no_show" | "sick" | "instructor_cancel" | "advance_cancel";
export type CancellationResolution = "makeup" | "carry_over" | "refund" | "cancel" | "scheduled_advance";

interface CancellationOption {
  // 새 라벨/설명. 내부 type은 기존 DB 값 재사용
  type: CancellationType;
  label: string;
  description: string;
  icon: React.ElementType;
  billable: boolean;        // 학생 결제 차감 여부 (true=차감)
  makeupAvailable: boolean; // 보강 가능 여부
  needsResolution: boolean;
  fixedResolution?: CancellationResolution;
}

// 새 규정 (2026.5월~)
const CANCELLATION_OPTIONS: CancellationOption[] = [
  {
    type: "advance_cancel",
    label: "24시간 전 취소",
    description: "수업 24시간 이전에 취소된 경우. 월 1회까지는 보강 가능 / 차감 없음. 월 1회 초과 시 수업료가 차감되며 보강은 진행되지 않습니다.",
    icon: CalendarClock,
    billable: false, // 시스템이 월 카운트 보고 자동 분기 (후속 조치에서 처리)
    makeupAvailable: true,
    needsResolution: true,
  },
  {
    type: "sick",
    label: "당일 취소 — 예외 사유",
    description: "병가 / 갑작스러운 야근 / 직계가족 질병 등 예외 사유로 당일 취소된 경우. 차감 없이 보강이 가능합니다.",
    icon: Thermometer,
    billable: false,
    makeupAvailable: true,
    needsResolution: true,
    fixedResolution: "makeup",
  },
  {
    type: "student_cancel",
    label: "당일 취소 — 예외 사유 없음",
    description: "예외 사유에 해당하지 않는 당일 취소. 수업료가 차감되며 보강은 진행되지 않습니다.",
    icon: BanIcon,
    billable: true,
    makeupAvailable: false,
    needsResolution: false,
  },
  {
    type: "no_show",
    label: "노쇼",
    description: "수업 시작 후 30분이 지나도록 학생이 참여하지 않은 경우. 수업료가 차감되며 보강은 진행되지 않습니다. 처리 즉시 학생 대시보드에 알림이 발송됩니다.",
    icon: UserX,
    billable: true,
    makeupAvailable: false,
    needsResolution: false,
  },
  {
    type: "advance_cancel",
    label: "사전 예정 (전달 고지)",
    description: "여행/출장 등으로 전달에 미리 고지된 사전 예정 일정. 수업료가 청구되지 않으며 보강도 별도로 진행되지 않습니다.",
    icon: CalendarOff,
    billable: false,
    makeupAvailable: false,
    needsResolution: false,
    fixedResolution: "scheduled_advance",
  },
  {
    type: "instructor_cancel",
    label: "강사 취소",
    description: "강사 사정으로 취소된 경우. 보강 / 이월 / 환불 중 선택하며, 학생 결제대상에서 자동 -1 차감됩니다.",
    icon: Clock,
    billable: false,
    makeupAvailable: true,
    needsResolution: true,
  },
];

const RESOLUTION_OPTIONS_DEFAULT: { value: CancellationResolution; label: string; description: string }[] = [
  { value: "makeup", label: "보강", description: "보강 수업을 진행합니다" },
  { value: "carry_over", label: "다음달 이월", description: "다음달로 수업을 이월합니다" },
  { value: "refund", label: "환불", description: "해당 수업료를 환불합니다" },
];

const RESOLUTION_OPTIONS_ADVANCE: { value: CancellationResolution; label: string; description: string }[] = [
  { value: "makeup", label: "보강 (월 1회 한정)", description: "월 1회까지 보강이 가능합니다. 월 1회 초과 시 자동으로 수업료가 차감됩니다." },
  { value: "carry_over", label: "다음달 이월", description: "다음달로 수업을 이월합니다" },
  { value: "cancel", label: "취소 (수업료 차감)", description: "결제대상에서 1회 차감됩니다" },
];

interface Props {
  sessionId: string;
  studentName: string;
  scheduledAt: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (type: CancellationType, resolution: CancellationResolution | null, remark: string | null) => void;
}

export default function SessionCancellationModal({
  studentName, scheduledAt, open, onClose, onConfirm,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [resolution, setResolution] = useState<CancellationResolution | null>(null);
  const [remark, setRemark] = useState("");
  const [step, setStep] = useState<"type" | "resolution">("type");

  const selectedOption = selectedIndex !== null ? CANCELLATION_OPTIONS[selectedIndex] : null;

  const handleTypeSelect = (idx: number) => {
    const option = CANCELLATION_OPTIONS[idx];
    setSelectedIndex(idx);
    if (option.needsResolution && !option.fixedResolution) {
      setStep("resolution");
      setResolution(null);
    } else if (option.fixedResolution) {
      onConfirm(option.type, option.fixedResolution, null);
      resetState();
    } else {
      onConfirm(option.type, null, null);
      resetState();
    }
  };

  const handleConfirmResolution = () => {
    if (!selectedOption || !resolution) return;
    onConfirm(selectedOption.type, resolution, remark.trim() || null);
    resetState();
  };

  const resetState = () => {
    setSelectedIndex(null);
    setResolution(null);
    setRemark("");
    setStep("type");
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

  // advance_cancel 카테고리에 대해서는 "사전 예정" 옵션 제외한 기본 후속조치 표시
  const resolutionOptions =
    selectedOption?.label.startsWith("24시간 전") ? RESOLUTION_OPTIONS_ADVANCE :
    selectedOption?.type === "instructor_cancel" || selectedOption?.type === "sick" ? RESOLUTION_OPTIONS_DEFAULT :
    RESOLUTION_OPTIONS_DEFAULT;

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
                  </div>
                </button>
              );
            })}
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              규정 외 개별 예외는 인정되지 않습니다.
            </p>
          </div>
        )}

        {step === "resolution" && selectedOption && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
              <selectedOption.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{selectedOption.label}</span>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">후속 조치를 선택하세요</p>
              {resolutionOptions.map(opt => (
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
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{opt.label}</span>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {(resolution === "carry_over" || resolution === "refund" || resolution === "cancel") && (
              <Textarea
                placeholder="메모 (선택사항)"
                value={remark}
                onChange={e => setRemark(e.target.value)}
                className="text-sm resize-none h-20"
              />
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep("type"); setResolution(null); setRemark(""); }}>
                뒤로
              </Button>
              <Button
                className="flex-1"
                disabled={!resolution}
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
