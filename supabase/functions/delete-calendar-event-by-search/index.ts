// Searches the instructor's mapped Google Calendar for an event matching the
// given student/time and deletes it. Used when an instructor cancels a regular
// (non-makeup) session that was created manually in the calendar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL =
  "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const DEFAULT_CALENDAR_ID = "reina@thelounge-english.co.kr";
const WINDOW_MINUTES = 30;

function authHeaders() {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gcalKey = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!gcalKey) throw new Error("GOOGLE_CALENDAR_API_KEY is not configured");
  return {
    "Authorization": `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": gcalKey,
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { instructor_name, student_name, scheduled_at } = await req.json();
    if (!instructor_name || !student_name || !scheduled_at) {
      return new Response(
        JSON.stringify({ error: "missing fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve calendar id from instructor_calendar_mapping
    const { data: mapRow } = await supabase
      .from("instructor_calendar_mapping")
      .select("gcal_calendar_id")
      .eq("instructor_name", instructor_name)
      .maybeSingle();
    const calendarId = mapRow?.gcal_calendar_id || DEFAULT_CALENDAR_ID;

    // Build time window
    const start = new Date(scheduled_at);
    const timeMin = new Date(start.getTime() - WINDOW_MINUTES * 60_000).toISOString();
    const timeMax = new Date(start.getTime() + WINDOW_MINUTES * 60_000).toISOString();

    const listUrl =
      `${GATEWAY_URL}/calendars/${calendarId}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
      `&singleEvents=true&orderBy=startTime&maxResults=50`;

    const listRes = await fetch(listUrl, { headers: authHeaders() });
    const listData = await listRes.json();
    if (!listRes.ok) {
      console.error("[gcal-search] list failed", listRes.status, JSON.stringify(listData));
      return new Response(
        JSON.stringify({ error: "list_failed", status: listRes.status, details: listData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const events: Array<{ id: string; summary?: string }> = listData.items || [];
    const matches = events.filter(
      (e) => e.summary && e.summary.includes(student_name)
    );

    const deleted: string[] = [];
    const failures: Array<{ id: string; status: number }> = [];
    for (const ev of matches) {
      const delRes = await fetch(
        `${GATEWAY_URL}/calendars/${calendarId}/events/${ev.id}`,
        { method: "DELETE", headers: authHeaders() }
      );
      if (delRes.ok || delRes.status === 404 || delRes.status === 410) {
        deleted.push(ev.id);
      } else {
        const txt = await delRes.text().catch(() => "");
        console.error("[gcal-search] delete failed", delRes.status, txt);
        failures.push({ id: ev.id, status: delRes.status });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        calendarId,
        scanned: events.length,
        matched: matches.length,
        deleted,
        failures,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[gcal-search] error", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
