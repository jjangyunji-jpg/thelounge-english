import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Heart, LogOut, CalendarCheck } from "lucide-react";

interface Props {
  studentName: string;
  /** Triggers re-evaluation when key changes (e.g. session change) */
  triggerKey?: string;
}

interface PeriodInfo {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
}

/**
 * 매 수강기간 마지막 주에 학생이 클래스룸 진입 시 표시되는 연장/퇴원 의사 확인 모달.
 *
 * 노출 조건 (모두 충족):
 *  - 현재 KST 일자가 해당 학생이 속한 활성 수강기간의 end_date D-10 이내
 *  - 해당 학생의 현재 period 내 잔여(미진행) 수업 ≤ 2
 *  - 해당 학생/period에 대한 renewal_confirmations 기록이 아직 없음
 */
export default function RenewalDecisionModal({ studentName, triggerKey }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!studentName) return;
    let cancelled = false;

    const evaluate = async () => {
      // KST today
      const kstToday = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const todayStr = kstToday.toISOString().slice(0, 10);

      // Find current period (active, today within range)
      const { data: periods } = await supabase
        .from("schedule_periods")
        .select("id, label, start_date, end_date")
        .eq("is_active", true)
        .lte("start_date", todayStr)
        .gte("end_date", todayStr)
        .order("end_date", { ascending: true })
        .limit(1);
      const cur = periods?.[0];
      if (!cur || cancelled) return;

      // D-10 boundary
      const end = new Date(cur.end_date + "T00:00:00+09:00");
      const today = new Date(todayStr + "T00:00:00+09:00");
      const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 10) return;

      // Already responded?
      const { data: existing } = await supabase
        .from("renewal_confirmations")
        .select("id")
        .eq("student_name", studentName)
        .eq("period_id", cur.id)
        .maybeSingle();
      if (existing || cancelled) return;

      // Remaining sessions (not yet started/ended) within this period
      const { data: remaining } = await supabase
        .from("class_sessions")
        .select("id, started_at, cancellation_type")
        .eq("student_name", studentName)
        .gte("scheduled_at", cur.start_date + "T00:00:00+09:00")
        .lte("scheduled_at", cur.end_date + "T23:59:59+09:00");
      const upcoming = (remaining ?? []).filter(
        (s: any) => !s.started_at && !s.cancellation_type,
      );
      if (upcoming.length === 0 || upcoming.length > 2 || cancelled) return;

      setPeriod(cur as PeriodInfo);
      setOpen(true);
    };

    evaluate();
    return () => { cancelled = true; };
  }, [studentName, triggerKey]);

  const handleDecide = async (decision: "extend" | "withdraw") => {
    if (!period) return;
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("renewal_confirmations").insert({
      student_name: studentName,
      period_id: period.id,
      decision,
      decided_via: "student",
      decided_by_user_id: session?.user.id ?? null,
    });
    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // If withdraw, push admin inbox notification
    if (decision === "withdraw") {
      await supabase.from("admin_notifications").insert({
        target: "managers",
        subject: `🚪 ${studentName}님 연장 거부`,
        body: `${studentName}님이 ${period.label} 수강 종료 후 다음 달 연장을 거부했습니다.\n수강기간 종료일(${period.end_date}) 다음 날에 자동 퇴원 처리됩니다.`,
      });
    }

    toast({
      title: decision === "extend" ? "다음 달 수강 연장 의사가 저장되었습니다 ✓" : "수강 종료 의사가 저장되었습니다",
      description: decision === "extend"
        ? "감사합니다! 다음 달 일정도 평소대로 안내드릴게요."
        : `${period.end_date} 까지 수업하시고 마무리됩니다. 마음 바뀌시면 라운지로 연락 주세요.`,
    });
    setSubmitting(false);
    setOpen(false);
  };

  if (!period) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) setOpen(v); }}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="w-4 h-4 text-gold" />
            다음 달 수업 연장 안내
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            <span className="font-medium text-foreground">{period.label}</span> 수강기간이
            <span className="font-medium text-foreground"> {period.end_date} </span>에 종료됩니다.
            <br />
            <span className="font-medium text-foreground">{studentName}</span>님,
            다음 달({nextLabel(period.end_date)})에도 수업을 이어가실까요?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => handleDecide("withdraw")}
            className="flex-col h-auto py-3 gap-1 border-destructive/30 hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium">아니오, 종료할게요</span>
          </Button>
          <Button
            disabled={submitting}
            onClick={() => handleDecide("extend")}
            className="flex-col h-auto py-3 gap-1 gold-gradient text-accent-foreground font-bold"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
            <span className="text-sm">네, 계속할게요</span>
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center pt-1">
          마음이 바뀌시면 언제든 라운지로 연락 주세요. 관리자가 처리해드립니다.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function nextLabel(endDateStr: string): string {
  const d = new Date(endDateStr + "T00:00:00+09:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
