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
  BanIcon, Clock, UserX, CalendarOff, CalendarClock, AlertCircle,
} from "lucide-react";

// DB 값: no_show / student_cancel / sick / instructor_cancel / advance_cancel / late_cancel
export type CancellationType = "student_cancel" | "no_show" | "sick" | "instructor_cancel" | "advance_cancel" | "late_cancel";
export type CancellationResolution = "makeup" | "carry_over" | "refund" | "cancel" | "scheduled_advance";

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

// 신규 규정 (공지 기반) — 4가지 카테고리
// - 당일 노쇼/4h 이내: 수업료 50%
// - 학생 취소(48h~4h): BASE 11,000
// - 강사 취소(병결/직계가족 사고·질병): 보강/이월/환불 선택
// - 사전 취소: 보강/이월/환불 선택
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
    description: "병결, 직계가족 사고 및 질병 등 부득이한 사유로 강사가 취소한 경우. 보강 / 이월 / 환불 중 선택해주세요.",
    icon: Clock,
    billable: false,
    makeupAvailable: true,
    needsResolution: true,
    payNote: "보강 진행 시에만 정상 지급",
  },
  {
    type: "advance_cancel",
    label: "사전 취소 (협의된 예외)",
    description: "사전에 협의되어 처리되는 예외적인 취소. 보강 / 이월 / 환불 중 선택해주세요.",
    icon: CalendarOff,
    billable: false,
    makeupAvailable: true,
    needsResolution: true,
    payNote: "보강 진행 시 정상 지급 / 그 외 무급",
  },
];

const RESOLUTION_OPTIONS_DEFAULT: { value: CancellationResolution; label: string; description: string }[] = [
  { value: "makeup", label: "보강", description: "보강 수업을 진행합니다" },
  { value: "carry_over", label: "다음달 이월", description: "다음달로 수업을 이월합니다" },
  { value: "refund", label: "환불", description: "해당 수업료를 환불합니다" },
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
