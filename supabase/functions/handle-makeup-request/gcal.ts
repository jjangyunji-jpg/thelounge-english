// Google Calendar helper for makeup request sync.
// Uses Lovable connector gateway with the developer's connected Google Calendar.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const CALENDAR_ID = "primary";

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
}

export async function createCalendarEvent(input: CreateEventInput): Promise<string | null> {
  try {
    const duration = input.durationMinutes ?? 50;
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

    const res = await fetch(`${GATEWAY_URL}/calendars/${encodeURIComponent(CALENDAR_ID)}/events`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[gcal] create failed", res.status, JSON.stringify(data));
      return null;
    }
    return data.id || null;
  } catch (e) {
    console.error("[gcal] create error", e);
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string | null | undefined): Promise<void> {
  if (!eventId) return;
  try {
    const res = await fetch(
      `${GATEWAY_URL}/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`,
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
 * Format event title:
 *  - corporate: "기업_홍길동"
 *  - regular:   "개인_홍길동" or "개인_홍길동 / John" (if english_name)
 */
export function formatEventTitle(opts: {
  studentName: string;
  englishName?: string | null;
  studentType?: string | null;
}): string {
  const isCorporate = opts.studentType === "corporate";
  const prefix = isCorporate ? "기업" : "개인";
  const namePart = opts.englishName
    ? `${opts.studentName} / ${opts.englishName}`
    : opts.studentName;
  return `${prefix}_${namePart}`;
}
