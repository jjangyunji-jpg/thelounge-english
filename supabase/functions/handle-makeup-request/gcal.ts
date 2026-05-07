// Google Calendar helper for makeup request sync.
// Uses Lovable connector gateway with the developer's connected Google Calendar.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
// Default calendar (Reina's "Organizer" workspace calendar) used when no
// instructor-specific mapping is configured.
const DEFAULT_CALENDAR_ID = "reina@thelounge-english.co.kr";

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

export interface CreateEventInput {
  title: string;
  startISO: string;       // RFC3339 with offset (KST)
  durationMinutes?: number;
  description?: string;
  meetLink?: string | null;
  calendarId?: string | null; // override target calendar
}

function pickCalendarId(calendarId?: string | null): string {
  return calendarId && calendarId.trim().length > 0 ? calendarId : DEFAULT_CALENDAR_ID;
}

export async function createCalendarEvent(input: CreateEventInput): Promise<string | null> {
  try {
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

    const calId = pickCalendarId(input.calendarId);
    // NOTE: do NOT encodeURIComponent the calendar ID — the connector gateway
    // returns 404 when "@" is encoded as "%40". Pass the raw ID instead.
    const res = await fetch(`${GATEWAY_URL}/calendars/${calId}/events`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[gcal] create failed", res.status, JSON.stringify(data));
      return null;
    }
    // Encode calendar id into the returned token so we can later delete from
    // the right calendar without another DB column. Format: "<calId>::<eventId>"
    return `${calId}::${data.id}`;
  } catch (e) {
    console.error("[gcal] create error", e);
    return null;
  }
}

export async function deleteCalendarEvent(eventToken: string | null | undefined): Promise<void> {
  if (!eventToken) return;
  try {
    let calId = DEFAULT_CALENDAR_ID;
    let eventId = eventToken;
    const idx = eventToken.indexOf("::");
    if (idx > 0) {
      calId = eventToken.slice(0, idx);
      eventId = eventToken.slice(idx + 2);
    }
    const res = await fetch(
      `${GATEWAY_URL}/calendars/${calId}/events/${eventId}`,
      { method: "DELETE", headers: authHeaders() }
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const txt = await res.text().catch(() => "");
      console.error("[gcal] delete failed", res.status, txt);
    }
  } catch (e) {
    console.error("[gcal] delete error", e);
  }
}

/**
 * Search for events in a calendar matching a student name within ±30 minutes
 * of `scheduledISO`, and delete every match. Used as a fallback when no
 * gcal_event_id token is stored on the session (e.g. event was created
 * manually in Google Calendar by Reina).
 */
export async function deleteCalendarEventsBySearch(opts: {
  calendarId?: string | null;
  studentName: string;
  scheduledISO: string;
  windowMinutes?: number;
}): Promise<{ deleted: number; scanned: number }> {
  const calId = pickCalendarId(opts.calendarId);
  const win = opts.windowMinutes ?? 30;
  try {
    const start = new Date(opts.scheduledISO);
    const timeMin = new Date(start.getTime() - win * 60_000).toISOString();
    const timeMax = new Date(start.getTime() + win * 60_000).toISOString();
    const url =
      `${GATEWAY_URL}/calendars/${calId}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
      `&singleEvents=true&orderBy=startTime&maxResults=50`;
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) {
      console.error("[gcal] search list failed", res.status, JSON.stringify(data));
      return { deleted: 0, scanned: 0 };
    }
    const events = (data.items || []) as Array<{ id: string; summary?: string }>;
    const matches = events.filter((e) => e.summary && e.summary.includes(opts.studentName));
    let deleted = 0;
    for (const ev of matches) {
      const delRes = await fetch(
        `${GATEWAY_URL}/calendars/${calId}/events/${ev.id}`,
        { method: "DELETE", headers: authHeaders() }
      );
      if (delRes.ok || delRes.status === 404 || delRes.status === 410) {
        deleted++;
      } else {
        const txt = await delRes.text().catch(() => "");
        console.error("[gcal] search-delete failed", delRes.status, txt);
      }
    }
    return { deleted, scanned: events.length };
  } catch (e) {
    console.error("[gcal] search-delete error", e);
    return { deleted: 0, scanned: 0 };
  }
}

/**
 * Format event title for makeup sessions:
 *  - "(보) 강사영어이름_학생한글이름"
 *  - 예: "(보) Reina_장현민"
 */
export function formatEventTitle(opts: {
  studentName: string;
  englishName?: string | null; // unused — kept for backward compat
  studentType?: string | null;
  instructorName: string;
}): string {
  const label = opts.studentType === "corporate" ? `기업_${opts.studentName}` : opts.studentName;
  return `(보) ${opts.instructorName}_${label}`;
}

export const CORPORATE_CALENDAR_ID =
  "c_6c6baefcf2b4191697b3b4927d20eb436833106c408687c2dd7d0c91ff568860@group.calendar.google.com";

