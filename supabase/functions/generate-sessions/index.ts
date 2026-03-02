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

/**
 * For biweekly: check if the week number (from period start) is even (0-based).
 * Generates on weeks 0, 2, 4, ... (i.e. every other week).
 */
function isMatchingWeek(dateStr: string, periodStartStr: string, frequency: Frequency): boolean {
  if (frequency === "weekly") return true;

  const dp = dateStr.split("-").map(Number);
  const pp = periodStartStr.split("-").map(Number);
  const date = new Date(dp[0], dp[1] - 1, dp[2]);
  const periodStart = new Date(pp[0], pp[1] - 1, pp[2]);
  const diffDays = Math.floor((date.getTime() - periodStart.getTime()) / (86400000));
  const weekNum = Math.floor(diffDays / 7);

  if (frequency === "biweekly") {
    return weekNum % 2 === 0;
  }

  // monthly2: 1st and 3rd occurrence of that weekday in the month
  if (frequency === "monthly2") {
    const dayOfWeek = date.getDay();
    // Count which occurrence this is in the month
    const firstOfMonth = new Date(dp[0], dp[1] - 1, 1);
    let count = 0;
    for (let d = new Date(firstOfMonth); d <= date; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === dayOfWeek) count++;
    }
    return count === 1 || count === 3;
  }

  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { period_id } = await req.json();
    if (!period_id) throw new Error("period_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // 1. Get the period
    const { data: period, error: pErr } = await sb
      .from("schedule_periods")
      .select("*")
      .eq("id", period_id)
      .single();
    if (pErr || !period) throw new Error("Period not found");

    // 2. Get active students with schedules
    const { data: students } = await sb
      .from("instructor_students")
      .select("id, student_name, schedules, level, instructor_name, meet_link, start_date")
      .eq("status", "active");
    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ created: 0, message: "No active students found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2.1 Get pause periods for active students
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

    // Build holiday date set
    const holidayDates = new Set<string>();
    for (const h of holidays || []) {
      const startParts = h.date_start.split("-").map(Number);
      const endParts = h.date_end.split("-").map(Number);
      const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        holidayDates.add(`${yyyy}-${mm}-${dd}`);
      }
    }

    // 4. Get existing sessions in this period to avoid duplicates
    const { data: existingSessions } = await sb
      .from("class_sessions")
      .select("student_name, scheduled_at, notes, topic, started_at")
      .gte("scheduled_at", period.start_date + "T00:00:00+09:00")
      .lte("scheduled_at", period.end_date + "T23:59:59+09:00");

    const existingSet = new Set<string>();
    for (const s of existingSessions || []) {
      const d = new Date(s.scheduled_at);
      const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      const dateStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
      existingSet.add(`${s.student_name}|${dateStr}`);
    }

    // 5. Generate sessions
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

      for (
        let d = new Date(periodStart);
        d <= periodEnd;
        d.setDate(d.getDate() + 1)
      ) {
        const dayOfWeek = d.getDay();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;

        // Skip holidays
        if (holidayDates.has(dateStr)) continue;

        // Skip dates before student's start date
        if (student.start_date && dateStr < student.start_date) continue;

        // Skip dates during any pause period
        if (student.id && isStudentPausedOn(student.id, dateStr)) continue;

        // Check if this day matches any schedule
        for (const sched of schedules) {
          const schedDay = DAY_MAP[sched.day];
          if (schedDay === undefined || schedDay !== dayOfWeek) continue;

          // Check frequency
          const freq: Frequency = sched.frequency || "weekly";
          if (!isMatchingWeek(dateStr, period.start_date, freq)) continue;

          // Skip if already exists
          if (existingSet.has(`${student.student_name}|${dateStr}`)) continue;

          const [hour, minute] = (sched.time || "10:00").split(":").map(Number);
          const scheduledAt = new Date(
            `${dateStr}T${String(hour).padStart(2, "0")}:${String(
              minute
            ).padStart(2, "0")}:00+09:00`
          );

          sessionsToInsert.push({
            student_name: student.student_name,
            instructor_name: student.instructor_name || "Unknown",
            level: student.level || "B1",
            scheduled_at: scheduledAt.toISOString(),
            meet_link: student.meet_link || null,
            topic: null,
          });

          existingSet.add(`${student.student_name}|${dateStr}`);
        }
      }
    }

    // 6. Bulk insert
    let created = 0;
    if (sessionsToInsert.length > 0) {
      for (let i = 0; i < sessionsToInsert.length; i += 100) {
        const batch = sessionsToInsert.slice(i, i + 100);
        const { error: insertErr } = await sb
          .from("class_sessions")
          .insert(batch);
        if (insertErr) {
          console.error("Insert error:", insertErr);
          throw new Error(`Insert failed: ${insertErr.message}`);
        }
        created += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        created,
        period: period.label,
        students: students.length,
        skipped_holidays: holidayDates.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-sessions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
