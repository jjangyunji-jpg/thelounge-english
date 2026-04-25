import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Sick makeup reminder.
 *
 * Sends a popup notification to students AND their instructors when a sick-cancelled
 * session has not yet had a makeup booking and the current month is closing.
 *
 * Triggered by pg_cron on the 15th and 22nd of each month at 09:00 KST.
 *
 * Logic:
 *   1. Find current month's class_sessions with cancellation_type='sick' and resolution='makeup'
 *   2. For each, check if a makeup_request exists in (pending|approved) status
 *   3. For unbooked ones, send one admin_notification per (student, instructor) pair
 *   4. Use a stable subject containing the cycle key (yyyy-MM-dd of trigger day) to dedupe
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // KST 기준 현재 시각 / 월 범위
    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const year = kstNow.getUTCFullYear();
    const month = kstNow.getUTCMonth(); // 0-11
    const day = kstNow.getUTCDate();
    const monthStartUtc = new Date(Date.UTC(year, month, 1)).toISOString();
    const monthEndUtc = new Date(Date.UTC(year, month + 1, 1)).toISOString();
    const cycleKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // 1) 이번 달 병결 + 보강(makeup) resolution 세션 조회
    const { data: sickSessions, error: sickErr } = await supabase
      .from("class_sessions")
      .select("id, student_name, instructor_name, scheduled_at, cancellation_resolution")
      .eq("cancellation_type", "sick")
      .eq("cancellation_resolution", "makeup")
      .gte("scheduled_at", monthStartUtc)
      .lt("scheduled_at", monthEndUtc);
    if (sickErr) throw sickErr;

    if (!sickSessions || sickSessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No sick sessions this month" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 2) 해당 세션들에 대한 보강 신청 (pending/approved) 존재 여부 확인
    const sessionIds = sickSessions.map((s) => s.id);
    const { data: existingRequests, error: reqErr } = await supabase
      .from("makeup_requests")
      .select("original_session_id, status")
      .in("original_session_id", sessionIds)
      .in("status", ["pending", "approved"]);
    if (reqErr) throw reqErr;

    const requestedSessionIds = new Set(
      (existingRequests || []).map((r) => r.original_session_id).filter(Boolean) as string[]
    );

    // 3) 미신청 병결 세션만 추림 + (student, instructor) 페어로 그룹핑
    const unbooked = sickSessions.filter((s) => !requestedSessionIds.has(s.id));
    if (unbooked.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "All sick sessions have makeup requests" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    type Pair = { student_name: string; instructor_name: string; sick_dates: string[] };
    const pairMap = new Map<string, Pair>();
    for (const s of unbooked) {
      const key = `${s.student_name}|${s.instructor_name}`;
      const kstDate = new Date(new Date(s.scheduled_at).getTime() + 9 * 60 * 60 * 1000);
      const dateLabel = `${kstDate.getUTCMonth() + 1}/${kstDate.getUTCDate()}`;
      const existing = pairMap.get(key);
      if (existing) {
        existing.sick_dates.push(dateLabel);
      } else {
        pairMap.set(key, {
          student_name: s.student_name,
          instructor_name: s.instructor_name,
          sick_dates: [dateLabel],
        });
      }
    }

    const monthLabel = `${month + 1}월`;
    const subjectBase = `[${monthLabel}] 병결 보강신청 안내`;

    // 4) 중복 발송 방지: 이번 사이클(cycleKey)에 이미 발송된 (학생, 강사) 페어 스킵
    const cycleSubject = `${subjectBase} (${cycleKey})`;
    const { data: alreadySent } = await supabase
      .from("admin_notifications")
      .select("body")
      .eq("subject", cycleSubject);
    const alreadySentKeys = new Set(
      (alreadySent || []).map((n) => {
        // body의 첫 줄에 [key] 마커가 들어있다고 가정
        const m = n.body.match(/^\[\[KEY:([^\]]+)\]\]/);
        return m ? m[1] : "";
      }).filter(Boolean)
    );

    const inserts: Array<{ target: string; subject: string; body: string }> = [];
    for (const [key, pair] of pairMap.entries()) {
      if (alreadySentKeys.has(key)) continue;
      const datesText = pair.sick_dates.join(", ");
      const body = `[[KEY:${key}]]
**${pair.student_name}** 수강생 / **${pair.instructor_name}** 강사

${monthLabel} 중 병결로 결석한 수업(${datesText})에 대한 **보강 신청이 아직 접수되지 않았습니다**.

병결로 인한 결석은 보강이 가능하지만, **다음 달로 이월되지 않습니다**.
반드시 ${monthLabel} 안에 보강 신청을 완료해 주세요.

⚠️ ${monthLabel} 마지막 주에 발생한 병결의 경우 다음 달 첫 주까지만 보강이 허용됩니다.`;
      inserts.push({
        target: "all",
        subject: cycleSubject,
        body,
      });
    }

    if (inserts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "All pairs already notified this cycle" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const { error: insertErr } = await supabase.from("admin_notifications").insert(inserts);
    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        success: true,
        sent: inserts.length,
        cycle: cycleKey,
        pairs: Array.from(pairMap.keys()),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
