// Sends advance reminders for official holiday/closure notices.
// Triggered daily at 09:00 KST (00:00 UTC) via pg_cron.
// For each upcoming holiday_notices row with notify_students=true:
//   - 15 days before date_start → insert one admin_notification (target='all'), mark notified_15d
//   - 7 days before date_start  → same, mark notified_7d
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function kstTodayISO(): string {
  // YYYY-MM-DD in KST
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function formatRangeKo(start: string, end: string): string {
  const fmt = (s: string) => {
    const [y, m, d] = s.split("-");
    return `${Number(m)}월 ${Number(d)}일`;
  };
  return start === end ? fmt(start) : `${fmt(start)} ~ ${fmt(end)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = kstTodayISO();
  const target15 = addDays(today, 15);
  const target7 = addDays(today, 7);

  // Pull all candidates: notify_students=true, future-or-today, missing at least one flag
  const { data: notices, error } = await supabase
    .from("holiday_notices")
    .select("id,title,date_start,date_end,reason,notified_15d,notified_7d,notify_students")
    .eq("notify_students", true)
    .gte("date_start", today);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sent: { id: string; kind: "15d" | "7d" }[] = [];

  for (const n of notices ?? []) {
    const fires: ("15d" | "7d")[] = [];
    if (!n.notified_15d && n.date_start === target15) fires.push("15d");
    if (!n.notified_7d && n.date_start === target7) fires.push("7d");

    for (const kind of fires) {
      const daysLeft = kind === "15d" ? 15 : 7;
      const range = formatRangeKo(n.date_start, n.date_end);
      const subject = `[휴원 안내] ${daysLeft}일 후 휴원 — ${n.title}`;
      const body = [
        `안녕하세요, 더라운지 잉글리쉬입니다.`,
        ``,
        `다가오는 공식 휴원일을 미리 안내드립니다.`,
        ``,
        `📅 휴원 기간: ${range}`,
        `📝 사유: ${n.title}${n.reason ? ` (${n.reason})` : ""}`,
        ``,
        `해당 기간 동안에는 정규 수업이 진행되지 않습니다.`,
        `보강이 필요한 경우 강사님과 사전에 일정을 조율해 주세요.`,
        ``,
        `감사합니다. 🌿`,
      ].join("\n");

      const { error: insErr } = await supabase.from("admin_notifications").insert({
        target: "all",
        subject,
        body,
        sent_at: new Date().toISOString(),
      });
      if (insErr) {
        console.error("notif insert error", insErr);
        continue;
      }

      const patch = kind === "15d" ? { notified_15d: true } : { notified_7d: true };
      const { error: updErr } = await supabase
        .from("holiday_notices")
        .update(patch)
        .eq("id", n.id);
      if (updErr) console.error("flag update error", updErr);

      sent.push({ id: n.id, kind });
    }
  }

  return new Response(JSON.stringify({ ok: true, today, sent_count: sent.length, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
