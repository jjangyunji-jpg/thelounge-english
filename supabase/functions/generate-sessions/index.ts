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
      .select("student_name, schedules, level, instructor_name, meet_link")
      .eq("status", "active");
    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ created: 0, message: "No active students found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get holidays
    const { data: holidays } = await sb
      .from("holiday_notices")
      .select("date_start, date_end")
      .gte("date_end", period.start_date)
      .lte("date_start", period.end_date);

    // Build holiday date set (YYYY-MM-DD strings in KST)
    const holidayDates = new Set<string>();
    for (const h of holidays || []) {
      // Use plain date strings (YYYY-MM-DD) to avoid UTC/KST shift issues
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
      .select("student_name, scheduled_at")
      .gte("scheduled_at", period.start_date + "T00:00:00+09:00")
      .lte("scheduled_at", period.end_date + "T23:59:59+09:00");

    const existingSet = new Set<string>();
    for (const s of existingSessions || []) {
      // Normalize to KST date+student key
      const d = new Date(s.scheduled_at);
      // Convert to KST by adding 9 hours
      const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      const dateStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
      existingSet.add(`${s.student_name}|${dateStr}`);
    }

    // 5. Generate sessions
    const sessionsToInsert: any[] = [];
    // Use locale-safe dates to avoid UTC/KST shift
    const psParts = period.start_date.split("-").map(Number);
    const peParts = period.end_date.split("-").map(Number);
    const periodStart = new Date(psParts[0], psParts[1] - 1, psParts[2]);
    const periodEnd = new Date(peParts[0], peParts[1] - 1, peParts[2]);

    for (const student of students) {
      let schedules: { day: string; time: string }[] = [];
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

        // Skip Tuesdays (정기 휴일)
        if (dayOfWeek === 2) continue;

        // Skip holidays
        if (holidayDates.has(dateStr)) continue;

        // Check if this day matches any schedule
        for (const sched of schedules) {
          const schedDay = DAY_MAP[sched.day];
          if (schedDay === undefined || schedDay !== dayOfWeek) continue;

          // Skip if already exists
          if (existingSet.has(`${student.student_name}|${dateStr}`)) continue;

          const [hour, minute] = (sched.time || "10:00").split(":").map(Number);
          // Create scheduled_at in KST
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

          // Mark as created to avoid duplicates within same batch
          existingSet.add(`${student.student_name}|${dateStr}`);
        }
      }
    }

    // 6. Bulk insert
    let created = 0;
    if (sessionsToInsert.length > 0) {
      // Insert in batches of 100
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
