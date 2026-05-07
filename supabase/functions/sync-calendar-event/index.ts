// Sync Google Calendar events for class_sessions.
// Supports three actions:
//   - create:        create an event (used to restore after un-cancel)
//   - move:          move an existing event to a new time (used by reschedule)
//   - delete:        delete an event (used by session deletion)
//
// For each action, the function tries token-based ops first when a
// gcal_event_id token is provided; otherwise it falls back to a time-window
// search of the instructor's mapped calendar (the same pattern Reina uses for
// manually created regular-class events).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL =
  "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const DEFAULT_CALENDAR_ID = "reina@thelounge-english.co.kr";
const CORPORATE_CALENDAR_ID = "c_6c6baefcf2b4191697b3b4927d20eb436833106c408687c2dd7d0c91ff568860@group.calendar.google.com";
const WINDOW_MINUTES = 30;

async function resolveStudentType(
  sb: ReturnType<typeof createClient>,
  studentName: string,
): Promise<string> {
  const { data } = await sb
    .from("instructor_students")
    .select("student_type")
    .eq("student_name", studentName)
    .maybeSingle();
  return (data as { student_type?: string } | null)?.student_type || "regular";
}

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

function parseToken(token: string | null | undefined): { calendarId: string; eventId: string } | null {
  if (!token) return null;
  const idx = token.indexOf("::");
  if (idx > 0) {
    return { calendarId: token.slice(0, idx), eventId: token.slice(idx + 2) };
  }
  return { calendarId: DEFAULT_CALENDAR_ID, eventId: token };
}

async function resolveCalendarId(
  sb: ReturnType<typeof createClient>,
  instructor_name: string,
  student_type?: string,
): Promise<string> {
  if (student_type === "corporate") return CORPORATE_CALENDAR_ID;
  const { data } = await sb
    .from("instructor_calendar_mapping")
    .select("gcal_calendar_id")
    .eq("instructor_name", instructor_name)
    .maybeSingle();
  return (data as { gcal_calendar_id?: string } | null)?.gcal_calendar_id || DEFAULT_CALENDAR_ID;
}

async function resolveInstructorDisplayName(
  sb: ReturnType<typeof createClient>,
  instructor_name: string,
): Promise<string> {
  const [instRes, mapRes] = await Promise.all([
    sb.from("instructors").select("english_name").eq("name", instructor_name).maybeSingle(),
    sb.from("instructor_calendar_mapping").select("display_name").eq("instructor_name", instructor_name).maybeSingle(),
  ]);
  const eng = (instRes.data as { english_name?: string } | null)?.english_name;
  const disp = (mapRes.data as { display_name?: string } | null)?.display_name;
  return eng || disp || instructor_name;
}

function formatStudentLabel(student_name: string, student_type?: string): string {
  return student_type === "corporate" ? `기업_${student_name}` : student_name;
}

async function resolveInstructorDisplayName(
  sb: ReturnType<typeof createClient>,
  instructor_name: string,
): Promise<string> {
  const [instRes, mapRes] = await Promise.all([
    sb.from("instructors").select("english_name").eq("name", instructor_name).maybeSingle(),
    sb.from("instructor_calendar_mapping").select("display_name").eq("instructor_name", instructor_name).maybeSingle(),
  ]);
  const eng = (instRes.data as { english_name?: string } | null)?.english_name;
  const disp = (mapRes.data as { display_name?: string } | null)?.display_name;
  return eng || disp || instructor_name;
}

async function searchEvents(
  calendarId: string,
  studentName: string,
  scheduledAt: string,
): Promise<Array<{ id: string; summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }>> {
  const start = new Date(scheduledAt);
  const timeMin = new Date(start.getTime() - WINDOW_MINUTES * 60_000).toISOString();
  const timeMax = new Date(start.getTime() + WINDOW_MINUTES * 60_000).toISOString();
  const url =
    `${GATEWAY_URL}/calendars/${calendarId}/events?` +
    `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
    `&singleEvents=true&orderBy=startTime&maxResults=50`;
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) {
    console.error("[sync-cal] list failed", res.status, JSON.stringify(data));
    return [];
  }
  const events = (data.items || []) as Array<{ id: string; summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }>;
  return events.filter((e) => e.summary && e.summary.includes(studentName));
}

async function createEvent(input: {
  calendarId: string;
  title: string;
  startISO: string;
  durationMinutes?: number;
  meetLink?: string | null;
  description?: string | null;
}): Promise<string | null> {
  const duration = input.durationMinutes ?? 60;
  const start = new Date(input.startISO);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const descParts: string[] = [];
  if (input.description) descParts.push(input.description);
  if (input.meetLink) descParts.push(`Google Meet: ${input.meetLink}`);
  const body = {
    summary: input.title,
    description: descParts.join("\n\n") || undefined,
    location: input.meetLink || undefined,
    start: { dateTime: start.toISOString(), timeZone: "Asia/Seoul" },
    end: { dateTime: end.toISOString(), timeZone: "Asia/Seoul" },
  };
  const res = await fetch(`${GATEWAY_URL}/calendars/${input.calendarId}/events`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("[sync-cal] create failed", res.status, JSON.stringify(data));
    return null;
  }
  return `${input.calendarId}::${data.id}`;
}

async function patchEventTime(
  calendarId: string,
  eventId: string,
  startISO: string,
  durationMinutes = 60,
): Promise<boolean> {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const res = await fetch(`${GATEWAY_URL}/calendars/${calendarId}/events/${eventId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({
      start: { dateTime: start.toISOString(), timeZone: "Asia/Seoul" },
      end: { dateTime: end.toISOString(), timeZone: "Asia/Seoul" },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[sync-cal] patch failed", res.status, txt);
    return false;
  }
  return true;
}

async function deleteEvent(calendarId: string, eventId: string): Promise<boolean> {
  const res = await fetch(`${GATEWAY_URL}/calendars/${calendarId}/events/${eventId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (res.ok || res.status === 404 || res.status === 410) return true;
  const txt = await res.text().catch(() => "");
  console.error("[sync-cal] delete failed", res.status, txt);
  return false;
}

async function patchEventSummary(
  calendarId: string,
  eventId: string,
  summary: string,
): Promise<boolean> {
  const res = await fetch(`${GATEWAY_URL}/calendars/${calendarId}/events/${eventId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ summary }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[sync-cal] patch summary failed", res.status, txt);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const action: string = body?.action;
    const sessionId: string | undefined = body?.session_id;
    const gcalToken: string | null | undefined = body?.gcal_event_id;
    const instructor_name: string = body?.instructor_name;
    const student_name: string = body?.student_name;

    if (!action || !instructor_name || !student_name) {
      return new Response(
        JSON.stringify({ error: "missing fields (action, instructor_name, student_name)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const calendarId = await resolveCalendarId(sb, instructor_name);

    // ── DELETE ──────────────────────────────────────────────
    if (action === "delete") {
      const scheduled_at: string | undefined = body?.scheduled_at;
      const tok = parseToken(gcalToken);
      if (tok) {
        const ok = await deleteEvent(tok.calendarId, tok.eventId);
        return new Response(
          JSON.stringify({ ok, mode: "token" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!scheduled_at) {
        return new Response(
          JSON.stringify({ ok: false, error: "scheduled_at required when no gcal_event_id" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const matches = await searchEvents(calendarId, student_name, scheduled_at);
      const deleted: string[] = [];
      for (const ev of matches) {
        if (await deleteEvent(calendarId, ev.id)) deleted.push(ev.id);
      }
      return new Response(
        JSON.stringify({ ok: true, mode: "search", deleted }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── RENAME (used by 당일 취소: prefix "(취) ") ──────────
    if (action === "rename") {
      const scheduled_at: string | undefined = body?.scheduled_at;
      const new_title: string | undefined = body?.new_title;
      let title = new_title;
      if (!title) {
        const display = await resolveInstructorDisplayName(sb, instructor_name);
        title = `(취) ${display}_${student_name}`;
      }
      const tok = parseToken(gcalToken);
      if (tok) {
        const ok = await patchEventSummary(tok.calendarId, tok.eventId, title);
        return new Response(
          JSON.stringify({ ok, mode: "token", title }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!scheduled_at) {
        return new Response(
          JSON.stringify({ ok: false, error: "scheduled_at required when no gcal_event_id" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const matches = await searchEvents(calendarId, student_name, scheduled_at);
      let renamed = 0;
      for (const ev of matches) {
        if (await patchEventSummary(calendarId, ev.id, title)) renamed++;
      }
      if (sessionId && matches.length === 1) {
        await sb
          .from("class_sessions")
          .update({ gcal_event_id: `${calendarId}::${matches[0].id}` })
          .eq("id", sessionId);
      }
      return new Response(
        JSON.stringify({ ok: true, mode: "search", renamed, title }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (action === "move") {
      const old_scheduled_at: string | undefined = body?.old_scheduled_at;
      const new_scheduled_at: string | undefined = body?.new_scheduled_at;
      if (!new_scheduled_at) {
        return new Response(
          JSON.stringify({ error: "new_scheduled_at required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const tok = parseToken(gcalToken);
      if (tok) {
        const ok = await patchEventTime(tok.calendarId, tok.eventId, new_scheduled_at);
        return new Response(
          JSON.stringify({ ok, mode: "token" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Search-based: locate event near old time, patch to new time
      if (!old_scheduled_at) {
        return new Response(
          JSON.stringify({ ok: false, error: "old_scheduled_at required when no gcal_event_id" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const matches = await searchEvents(calendarId, student_name, old_scheduled_at);
      if (matches.length === 0) {
        // Fallback: old event couldn't be located (e.g. previous reschedule
        // already shifted DB but not calendar, or event was edited manually).
        // Create a fresh event at the new time so the calendar at least
        // reflects the latest schedule, and persist its token.
        // Avoid duplicates: re-check the new-time window first.
        const existingAtNew = await searchEvents(calendarId, student_name, new_scheduled_at);
        if (existingAtNew.length > 0) {
          const tok = `${calendarId}::${existingAtNew[0].id}`;
          if (sessionId) {
            await sb.from("class_sessions").update({ gcal_event_id: tok }).eq("id", sessionId);
          }
          return new Response(
            JSON.stringify({ ok: true, mode: "search", patched: 0, note: "event already at new time", token: tok }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const display = await resolveInstructorDisplayName(sb, instructor_name);
        const title = `${display}_${student_name}`;
        const token = await createEvent({
          calendarId,
          title,
          startISO: new_scheduled_at,
          description: `정규 수업 (강사: ${instructor_name})`,
        });
        if (token && sessionId) {
          await sb.from("class_sessions").update({ gcal_event_id: token }).eq("id", sessionId);
        }
        return new Response(
          JSON.stringify({ ok: !!token, mode: "search-create", patched: 0, created: !!token, token }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      let patched = 0;
      for (const ev of matches) {
        if (await patchEventTime(calendarId, ev.id, new_scheduled_at)) patched++;
      }
      // Persist token onto session row when only 1 match (so future moves use token)
      if (sessionId && matches.length === 1) {
        await sb
          .from("class_sessions")
          .update({ gcal_event_id: `${calendarId}::${matches[0].id}` })
          .eq("id", sessionId);
      }
      return new Response(
        JSON.stringify({ ok: true, mode: "search", patched }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── CREATE (used by un-cancel restore) ──────────────────
    if (action === "create") {
      const scheduled_at: string | undefined = body?.scheduled_at;
      const meet_link: string | null | undefined = body?.meet_link;
      const description: string | null | undefined = body?.description;
      if (!scheduled_at) {
        return new Response(
          JSON.stringify({ error: "scheduled_at required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Avoid duplicates: check if an event already exists in the window
      const existing = await searchEvents(calendarId, student_name, scheduled_at);
      if (existing.length > 0) {
        const tok = `${calendarId}::${existing[0].id}`;
        if (sessionId) {
          await sb.from("class_sessions").update({ gcal_event_id: tok }).eq("id", sessionId);
        }
        return new Response(
          JSON.stringify({ ok: true, mode: "existing", token: tok }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const display = await resolveInstructorDisplayName(sb, instructor_name);
      const title = `${display}_${student_name}`;
      const token = await createEvent({
        calendarId,
        title,
        startISO: scheduled_at,
        meetLink: meet_link || null,
        description: description || `정규 수업 (강사: ${instructor_name})`,
      });
      if (token && sessionId) {
        await sb.from("class_sessions").update({ gcal_event_id: token }).eq("id", sessionId);
      }
      return new Response(
        JSON.stringify({ ok: !!token, token }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[sync-cal] error", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
