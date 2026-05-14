import { cn } from "@/lib/utils";

interface MakeupBadgesProps {
  isMakeup: boolean;
  isUrgent?: boolean | null;
  className?: string;
}

/**
 * Standardized 보강 / 예외보강 badges shown across InstructorDashboard,
 * StudentDashboard, and Classroom SessionSidebar.
 *
 * - 보강: any session with reschedule_origin_dates (i.e. moved from another date)
 * - 예외보강: makeup session whose request had an urgent (긴급/예외) reason
 *   (class_sessions.is_urgent_makeup = true)
 */
export function MakeupBadges({ isMakeup, isUrgent, className }: MakeupBadgesProps) {
  if (!isMakeup) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 flex-wrap", className)}>
      <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-semibold leading-relaxed bg-gold/15 text-gold">
        보강
      </span>
      {isUrgent && (
        <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-semibold leading-relaxed bg-destructive/15 text-destructive">
          예외보강
        </span>
      )}
    </span>
  );
}

/** Compact "(M월 D일에서 변경)" subtitle text — pure formatter. */
export function formatMovedFromText(originDates: string[] | null | undefined): string | null {
  if (!originDates || originDates.length === 0) return null;
  const parts = originDates.map(d =>
    new Date(d + "T00:00:00").toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Seoul",
    })
  );
  return `${parts.join(", ")}에서 변경`;
}
