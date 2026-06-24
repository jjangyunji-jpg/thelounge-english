import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAY_MAP: Record<string, number> = {
  일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6,
};

type Frequency = "weekly" | "biweekly" | "monthly2";

interface ScheduleSlot {
  day: string;
  time: string;
  frequency?: Frequency;
}

function isMatchingWeek(dateStr: string, periodStartStr: string, frequency: Frequency): boolean {
  if (frequency === "weekly") return true;

  const dp = dateStr.split("-").map(Number);
  const pp = periodStartStr.split("-").map(Number);
  const date = new Date(dp[0], dp[1] - 1, dp[2]);
  const periodStart = new Date(pp[0], pp[1] - 1, pp[2]);
  const diffDays = Math.floor((date.getTime() - periodStart.getTime()) / 86400000);
  const weekNum = Math.floor(diffDays / 7);

  if (frequency === "biweekly") return weekNum % 2 === 0;

  if (frequency === "monthly2") {
    const dayOfWeek = date.getDay();
    const firstOfMonth = new Date(dp[0], dp[1] - 1, 1);
    let count = 0;
    for (let d = new Date(firstOfMonth); d <= date; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === dayOfWeek) count++;
    }
    return count === 1 || count === 3;
  }

  return true;
}

function toKstDateStr(isoDate: string): string {
  const d = new Date(isoDate);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Get ISO week key (Mon-based) for a date string YYYY-MM-DD */
function weekKey(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  // Shift to Monday-based week: Mon=0..Sun=6
  const dayOffset = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayOffset);
  return formatDate(monday);
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Check role
    const { data: roleData } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "manager", "instructor"]);
    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "권한이 없습니다." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { period_id, effective_date, student_name: filterStudentName } = await req.json();
    if (!period_id) throw new Error("period_id is required");

    // 1. Get the period
    const { data: period, error: pErr } = await sb
      .from("schedule_periods")
      .select("*")
      .eq("id", period_id)
      .single();
    if (pErr || !period) throw new Error("Period not found");

    // 2. Get active students with schedules (skip corporate managers - 수업 안 받음)
    let studentQuery = sb
      .from("instructor_students")
      .select("id, student_name, schedules, level, instructor_name, meet_link, start_date, end_date, group_students, corporate_role")
      .eq("status", "active")
      .neq("corporate_role", "manager");
    if (filterStudentName) {
      studentQuery = studentQuery.eq("student_name", filterStudentName);
    }
    const { data: students } = await studentQuery;
    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ created: 0, message: "No active students found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2.1 Get pause periods
    const studentIds = students.map((s: any) => s.id).filter(Boolean);
    const pausesByStudent = new Map<string, { pause_start: string; pause_end: string | null }[]>();
    if (studentIds.length > 0) {
      const { data: pauses } = await sb
        .from("student_pauses")
        .select("student_id, pause_start, pause_end")
        .in("student_id", studentIds)
        .order("pause_start", { ascending: true });
      for (const p of pauses || []) {
        if (!pausesByStudent.has(p.student_id)) pausesByStudent.set(p.student_id, []);
        pausesByStudent.get(p.student_id)!.push({ pause_start: p.pause_start, pause_end: p.pause_end });
      }
    }
    const isStudentPausedOn = (studentId: string, dateStr: string) => {
      const pauses = pausesByStudent.get(studentId) || [];
      return pauses.some((p) => dateStr >= p.pause_start && (!p.pause_end || dateStr <= p.pause_end));
    };

    // 3. Get holidays
    const { data: holidays } = await sb
      .from("holiday_notices")
      .select("date_start, date_end")
      .gte("date_end", period.start_date)
      .lte("date_start", period.end_date);

    const holidayDates = new Set<string>();
    for (const h of holidays || []) {
      const startParts = h.date_start.split("-").map(Number);
      const endParts = h.date_end.split("-").map(Number);
      const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        holidayDates.add(formatDate(d));
      }
    }

    // 4. Get existing sessions to avoid duplicates
    const { data: existingSessions } = await sb
      .from("class_sessions")
      .select("student_name, instructor_name, scheduled_at, reschedule_origin_dates")
      .gte("scheduled_at", period.start_date + "T00:00:00+09:00")
      .lte("scheduled_at", period.end_date + "T23:59:59+09:00");

    const existingSet = new Set<string>();
    // Track sessions per student per week (for weekly cap check)
    const weeklySessionCount = new Map<string, number>();

    // 4.1 Pre-load deleted_session_dates within the period so we never
    // re-create a session on a KST date that was explicitly removed
    // (e.g. via makeup reschedule). Key: `${student_name}|${YYYY-MM-DD}`.
    const deletedDateSet = new Set<string>();
    {
      const studentNamesForQuery = students.map((s: any) => s.student_name);
      if (studentNamesForQuery.length > 0) {
        const { data: deletedRows } = await sb
          .from("deleted_session_dates")
          .select("student_name, deleted_date")
          .in("student_name", studentNamesForQuery)
          .gte("deleted_date", period.start_date)
          .lte("deleted_date", period.end_date);
        for (const r of deletedRows || []) {
          deletedDateSet.add(`${r.student_name}|${r.deleted_date}`);
        }
      }
    }

    for (const s of existingSessions || []) {
      const dateStr = toKstDateStr(s.scheduled_at);
      // Dedup key intentionally excludes instructor_name because the DB unique
      // index is (student_name, scheduled_at) only. Including instructor here
      // would miss collisions after an instructor transition.
      existingSet.add(`${s.student_name}|${dateStr}`);

      // Count sessions per student per week (also instructor-agnostic)
      const wk = weekKey(dateStr);
      const countKey = `${s.student_name}|${wk}`;
      weeklySessionCount.set(countKey, (weeklySessionCount.get(countKey) || 0) + 1);

      const originDates = Array.isArray(s.reschedule_origin_dates)
        ? s.reschedule_origin_dates
        : [];
      for (const originDate of originDates) {
        if (originDate) {
          existingSet.add(`${s.student_name}|${originDate}`);
        }
      }
    }

    // 5. Clean up stale sessions (schedule changed → old day-of-week sessions)
    // NOTE: Clean ALL stale sessions in the period, not just future ones.
    // Only sessions with no notes, not started, and not rescheduled are eligible.
    let totalCleaned = 0;

    for (const student of students) {
      let parsedSchedules: ScheduleSlot[] = [];
      try {
        parsedSchedules =
          typeof student.schedules === "string"
            ? JSON.parse(student.schedules)
            : student.schedules || [];
      } catch {
        continue;
      }
      if (!Array.isArray(parsedSchedules) || parsedSchedules.length === 0) continue;

      // Build set of valid (day, time) combos from current schedule
      const validDayTimes = new Set<string>();
      const validDays = new Set<number>();
      for (const s of parsedSchedules) {
        const d = DAY_MAP[s.day];
        if (d !== undefined) {
          validDays.add(d);
          validDayTimes.add(`${d}|${s.time || "10:00"}`);
        }
      }

      // Find ALL sessions in this period that don't match current schedule
      const { data: periodSessions } = await sb
        .from("class_sessions")
        .select("id, scheduled_at, reschedule_origin_dates, notes, started_at")
        .eq("student_name", student.student_name)
        .eq("instructor_name", student.instructor_name || "")
        .gte("scheduled_at", period.start_date + "T00:00:00+09:00")
        .lte("scheduled_at", period.end_date + "T23:59:59+09:00")
        .is("started_at", null);

      const idsToDelete: string[] = [];
      for (const sess of periodSessions || []) {
        // Skip sessions with notes
        if (sess.notes && sess.notes !== "") continue;
        // Skip rescheduled sessions
        const origins = Array.isArray(sess.reschedule_origin_dates) ? sess.reschedule_origin_dates : [];
        if (origins.length > 0) continue;

        const sessKstDate = toKstDateStr(sess.scheduled_at);
        const sp = sessKstDate.split("-").map(Number);
        const sessDow = new Date(sp[0], sp[1] - 1, sp[2]).getDay();

        if (!validDays.has(sessDow)) {
          idsToDelete.push(sess.id);
        }
      }

      if (idsToDelete.length > 0) {
        const { error: delErr } = await sb
          .from("class_sessions")
          .delete()
          .in("id", idsToDelete);
        if (!delErr) {
          totalCleaned += idsToDelete.length;
          // Remove deleted sessions from existingSet and weeklySessionCount
          for (const sess of periodSessions || []) {
            if (idsToDelete.includes(sess.id)) {
              const dateStr = toKstDateStr(sess.scheduled_at);
              const key = `${student.student_name}|${dateStr}`;
              existingSet.delete(key);
              const wk = weekKey(dateStr);
              const countKey = `${student.student_name}|${wk}`;
              const current = weeklySessionCount.get(countKey) || 0;
              if (current > 0) weeklySessionCount.set(countKey, current - 1);
            }
          }
        } else {
          console.error("Stale session cleanup error:", delErr);
        }
      }
    }

    // 6. Generate sessions with weekly cap enforcement
    const sessionsToInsert: any[] = [];
    const psParts = period.start_date.split("-").map(Number);
    const peParts = period.end_date.split("-").map(Number);
    const periodStart = new Date(psParts[0], psParts[1] - 1, psParts[2]);
    const periodEnd = new Date(peParts[0], peParts[1] - 1, peParts[2]);

    for (const student of students) {
      let schedules: ScheduleSlot[] = [];
      try {
        schedules =
          typeof student.schedules === "string"
            ? JSON.parse(student.schedules)
            : student.schedules || [];
      } catch {
        continue;
      }
      if (!Array.isArray(schedules) || schedules.length === 0) continue;

      const expectedPerWeek = schedules.length;

      for (
        let d = new Date(periodStart);
        d <= periodEnd;
        d.setDate(d.getDate() + 1)
      ) {
        const dayOfWeek = d.getDay();
        const dateStr = formatDate(d);

        if (holidayDates.has(dateStr)) continue;
        if (student.start_date && dateStr < student.start_date) continue;
        if ((student as any).end_date && dateStr > (student as any).end_date) continue;
        if (effective_date && dateStr < effective_date) continue;
        if (student.id && isStudentPausedOn(student.id, dateStr)) continue;

        for (const sched of schedules) {
          const schedDay = DAY_MAP[sched.day];
          if (schedDay === undefined || schedDay !== dayOfWeek) continue;

          const freq: Frequency = sched.frequency || "weekly";
          if (!isMatchingWeek(dateStr, period.start_date, freq)) continue;

          if (existingSet.has(`${student.student_name}|${student.instructor_name || ""}|${dateStr}`)) continue;

          // Skip dates that were explicitly removed (makeup reschedule, etc.)
          if (deletedDateSet.has(`${student.student_name}|${dateStr}`)) continue;

          // Weekly cap check: don't exceed expected sessions per week
          const wk = weekKey(dateStr);
          const countKey = `${student.student_name}|${student.instructor_name || ""}|${wk}`;
          const currentWeekCount = weeklySessionCount.get(countKey) || 0;
          if (currentWeekCount >= expectedPerWeek) continue;

          const [hour, minute] = (sched.time || "10:00").split(":").map(Number);
          const scheduledAt = new Date(
            `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`
          );

          const groupStudents = Array.isArray((student as any).group_students) ? (student as any).group_students : [];

          sessionsToInsert.push({
            student_name: student.student_name,
            instructor_name: student.instructor_name || "Unknown",
            level: student.level || "B1",
            scheduled_at: scheduledAt.toISOString(),
            meet_link: student.meet_link || null,
            topic: null,
            group_students: groupStudents,
          });

          existingSet.add(`${student.student_name}|${student.instructor_name || ""}|${dateStr}`);
          weeklySessionCount.set(countKey, currentWeekCount + 1);
        }
      }
    }

    // 7. Bulk insert
    let created = 0;
    const insertedSessions: Array<{ id: string; student_name: string; instructor_name: string; scheduled_at: string; meet_link: string | null }> = [];
    if (sessionsToInsert.length > 0) {
      for (let i = 0; i < sessionsToInsert.length; i += 100) {
        const batch = sessionsToInsert.slice(i, i + 100);
        // Plain insert — existingSet + deletedDateSet already prevent dupes.
        // (upsert with onConflict can't be used because the unique index on
        // (student_name, scheduled_at) is partial: WHERE cancellation_type IS NULL.)
        const { data: inserted, error: insertErr } = await sb
          .from("class_sessions")
          .insert(batch)
          .select("id, student_name, instructor_name, scheduled_at, meet_link");
        if (insertErr) {
          console.error("Insert error:", insertErr);
          throw new Error("세션 생성 중 오류가 발생했습니다.");
        }
        created += (inserted || []).length;
        for (const row of inserted || []) insertedSessions.push(row as any);
      }
    }

    // 8. Sync each newly-created session to Google Calendar (best-effort).
    // sync-calendar-event(create) checks the time window for an existing event
    // first → if Reina/instructor already manually added it, only the token is
    // saved (no duplicate). If not, a new event is created on the instructor's
    // mapped calendar so future reschedules/cancellations have a token to use.
    if (insertedSessions.length > 0) {
      const fnUrl = `${supabaseUrl}/functions/v1/sync-calendar-event`;
      await Promise.all(
        insertedSessions.map(async (s) => {
          try {
            await fetch(fnUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                action: "create",
                session_id: s.id,
                instructor_name: s.instructor_name,
                student_name: s.student_name,
                scheduled_at: s.scheduled_at,
                meet_link: s.meet_link,
              }),
            });
          } catch (e) {
            console.error("[generate-sessions] sync-calendar-event failed", s.id, e);
          }
        }),
      );
    }

    return new Response(
      JSON.stringify({
        created,
        cleaned: totalCleaned,
        period: period.label,
        students: students.length,
        skipped_holidays: holidayDates.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-sessions error:", e);
    return new Response(
      JSON.stringify({ error: "요청을 처리할 수 없습니다. 나중에 다시 시도해주세요." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
