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
  BanIcon, Clock, Thermometer, UserX, CalendarOff,
} from "lucide-react";

export type CancellationType = "student_cancel" | "no_show" | "sick" | "instructor_cancel" | "advance_cancel";
export type CancellationResolution = "makeup" | "carry_over" | "refund";

interface CancellationOption {
  type: CancellationType;
  label: string;
  description: string;
  icon: React.ElementType;
  settlement: boolean; // 정산 반영 여부
  needsResolution: boolean; // 후속 조치 선택 필요 여부
  fixedResolution?: CancellationResolution; // 고정 후속 조치
}

const CANCELLATION_OPTIONS: CancellationOption[] = [
  {
    type: "no_show",
    label: "노쇼",
    description: "수강생이 무단 불참. 정산에 반영됩니다.",
    icon: UserX,
    settlement: true,
    needsResolution: false,
  },
  {
    type: "student_cancel",
    label: "당일 취소",
    description: "48시간 이내 취소. 보강 불가, 정산 미반영.",
    icon: BanIcon,
    settlement: false,
    needsResolution: false,
  },
  {
    type: "sick",
    label: "병결",
    description: "수강생 또는 강사 병가. 보강/이월/환불 선택.",
    icon: Thermometer,
    settlement: false,
    needsResolution: true,
  },
  {
    type: "instructor_cancel",
    label: "강사 취소",
    description: "강사 사정으로 취소. 보강/이월/환불 선택.",
    icon: Clock,
    settlement: false,
    needsResolution: true,
  },
  {
    type: "advance_cancel",
    label: "사전 취소",
    description: "48시간 전 취소. 보강으로 자동 처리됩니다.",
    icon: CalendarOff,
    settlement: false,
    needsResolution: false,
    fixedResolution: "makeup",
  },
];

const RESOLUTION_OPTIONS: { value: CancellationResolution; label: string; description: string }[] = [
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
  const [selectedType, setSelectedType] = useState<CancellationType | null>(null);
  const [resolution, setResolution] = useState<CancellationResolution | null>(null);
  const [remark, setRemark] = useState("");
  const [step, setStep] = useState<"type" | "resolution">("type");

  const selectedOption = CANCELLATION_OPTIONS.find(o => o.type === selectedType);
  const needsResolution = selectedOption?.needsResolution ?? false;

  const handleTypeSelect = (type: CancellationType) => {
    const option = CANCELLATION_OPTIONS.find(o => o.type === type)!;
    setSelectedType(type);
    if (option.needsResolution) {
      setStep("resolution");
      setResolution(null);
    } else if (option.fixedResolution) {
      // Auto-confirm with fixed resolution
      onConfirm(type, option.fixedResolution, null);
      resetState();
    } else {
      // No resolution needed, confirm directly
      onConfirm(type, null, null);
      resetState();
    }
  };

  const handleConfirmResolution = () => {
    if (!selectedType || !resolution) return;
    onConfirm(selectedType, resolution, remark.trim() || null);
    resetState();
  };

  const resetState = () => {
    setSelectedType(null);
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
      <DialogContent className="max-w-md">
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
            {CANCELLATION_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.type}
                  onClick={() => handleTypeSelect(opt.type)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/30 transition-all text-left"
                >
                  <Icon className="w-5 h-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        opt.settlement
                          ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]"
                          : "bg-destructive/10 text-destructive"
                      )}>
                        정산 {opt.settlement ? "반영" : "미반영"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                </button>
              );
            })}
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
              {RESOLUTION_OPTIONS.map(opt => (
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
                  <div>
                    <span className="text-sm font-medium">{opt.label}</span>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {(resolution === "carry_over" || resolution === "refund") && (
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
