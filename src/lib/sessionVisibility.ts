/**
 * Common helpers for deciding whether a class_session should be visible
 * in "upcoming" / "next class" lists across InstructorDashboard, StudentDashboard,
 * and SessionSidebar.
 *
 * Why this exists:
 * Two different code paths historically caused bugs where rescheduled (보강) sessions
 * still appeared as upcoming:
 *   1. Some sessions are flagged with cancellation_type='sick' on the origin row.
 *   2. Other times, only the new session's `reschedule_origin_dates` records the
 *      original KST date, leaving the origin row unflagged.
 *
 * `getMovedAwayKeys` builds the set of (student_name, KST date) pairs that have
 * been moved to another session, so the origin row can be filtered out everywhere
 * with the same rule.
 */

export interface SessionLike {
  scheduled_at: string;
  student_name?: string | null;
  cancellation_type?: string | null;
  cancellation_resolution?: string | null;
  reschedule_origin_dates?: string[] | null;
}

/** YYYY-MM-DD in KST for a given ISO timestamp. */
export function kstDateKey(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * Build a set of "moved away" keys: each entry means the (student, KST date)
 * pair has been rescheduled to another session and should be hidden from
 * upcoming/next-class lists.
 *
 * Pass `scoped=true` (default) to scope by student_name. Use `scoped=false`
 * for single-student contexts (Classroom sidebar, StudentDashboard) where
 * student_name is constant.
 */
export function getMovedAwayKeys(
  sessions: SessionLike[],
  opts: { scoped?: boolean } = {}
): Set<string> {
  const { scoped = true } = opts;
  const moved = new Set<string>();
  for (const s of sessions) {
    const selfKey = kstDateKey(s.scheduled_at);
    for (const orig of s.reschedule_origin_dates ?? []) {
      const key = typeof orig === "string" ? orig.slice(0, 10) : String(orig);
      if (key === selfKey) continue;
      const composite = scoped && s.student_name ? `${s.student_name}__${key}` : key;
      moved.add(composite);
    }
  }
  return moved;
}

/** Check if `session` has been moved away (rescheduled to another row). */
export function isMovedAway(
  session: SessionLike,
  movedAwayKeys: Set<string>,
  opts: { scoped?: boolean } = {}
): boolean {
  const { scoped = true } = opts;
  const dateKey = kstDateKey(session.scheduled_at);
  const composite = scoped && session.student_name ? `${session.student_name}__${dateKey}` : dateKey;
  return movedAwayKeys.has(composite);
}

/**
 * A session should be hidden from "active/upcoming" lists if it was cancelled
 * OR if it was moved away to another rescheduled session.
 */
export function isEffectivelyInactive(
  session: SessionLike,
  movedAwayKeys: Set<string>,
  opts: { scoped?: boolean } = {}
): boolean {
  if (session.cancellation_type) return true;
  return isMovedAway(session, movedAwayKeys, opts);
}
