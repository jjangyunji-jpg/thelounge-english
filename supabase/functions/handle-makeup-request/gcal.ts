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
    const res = await fetch(`${GATEWAY_URL}/calendars/${encodeURIComponent(calId)}/events`, {
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
      `${GATEWAY_URL}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
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
 * Format event title for makeup sessions:
 *  - "강사명_학생명 (보강)"
 *  - english_name 있으면: "강사명_학생명 / English (보강)"
 */
export function formatEventTitle(opts: {
  studentName: string;
  englishName?: string | null;
  studentType?: string | null; // kept for backward compat (unused)
  instructorName: string;
}): string {
  const namePart = opts.englishName
    ? `${opts.studentName} / ${opts.englishName}`
    : opts.studentName;
  return `${opts.instructorName}_${namePart} (보강)`;
}
