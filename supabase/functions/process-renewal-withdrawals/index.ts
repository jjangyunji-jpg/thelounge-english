import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * 매일 KST 9시 cron으로 호출.
 * decision='withdraw' 이고 period.end_date < KST 오늘인 미처리 행을 찾아
 * 학생을 자동 퇴원 처리하고 미진행 세션을 삭제한다.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const todayStr = kstNow.toISOString().slice(0, 10);

    // Pull pending withdrawals
    const { data: rows, error } = await admin
      .from("renewal_confirmations")
      .select("id, student_name, period_id, decided_at, processed_at, schedule_periods!inner(end_date,label)")
      .eq("decision", "withdraw")
      .is("processed_at", null);
    if (error) throw error;

    let processed = 0;
    const results: any[] = [];

    for (const r of rows ?? []) {
      const endDate: string = (r as any).schedule_periods.end_date;
      if (endDate >= todayStr) continue; // not yet due

      const studentName: string = (r as any).student_name;

      // Mark instructor_students inactive (if still active)
      const { error: updErr } = await admin
        .from("instructor_students")
        .update({
          status: "inactive",
          end_date: endDate,
          withdrawal_reason: "연장 거부 (수강기간 종료 후 자동 처리)",
        })
        .eq("student_name", studentName)
        .eq("status", "active");

      // Delete future un-started sessions (after end_date)
      const { data: futureSessions } = await admin
        .from("class_sessions")
        .select("id, started_at")
        .eq("student_name", studentName)
        .gt("scheduled_at", endDate + "T23:59:59+09:00");
      const deletableIds = (futureSessions ?? [])
        .filter((s: any) => !s.started_at)
        .map((s: any) => s.id);
      if (deletableIds.length > 0) {
        await admin.from("class_sessions").delete().in("id", deletableIds);
      }

      // Admin inbox notification (one per student)
      await admin.from("admin_notifications").insert({
        target: "managers",
        subject: `🚪 ${studentName} 자동 퇴원 처리 완료`,
        body: `${studentName}님이 연장을 거부하여 ${endDate} 기준으로 자동 퇴원 처리되었습니다.\n삭제된 미진행 세션: ${deletableIds.length}건`,
      });

      // Mark processed
      await admin
        .from("renewal_confirmations")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", (r as any).id);

      processed++;
      results.push({ student_name: studentName, end_date: endDate, deleted_sessions: deletableIds.length, update_error: updErr?.message ?? null });
    }

    return new Response(JSON.stringify({ ok: true, processed, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-renewal-withdrawals error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
