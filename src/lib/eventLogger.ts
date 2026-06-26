import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget logger for ALL application events (homework, classroom,
 * scheduling, payment, client crashes, …). Never throws.
 */

export type EventStage = "attempt" | "success" | "error";
export type EventSourceType = "client" | "edge_function" | "database";
export type EventCategory =
  | "homework"
  | "classroom"
  | "scheduling"
  | "payment"
  | "auth"
  | "admin"
  | "client_error"
  | "edge_function"
  | "other";

export interface LogEventInput {
  category: EventCategory;
  event_type: string;
  stage: EventStage;
  source_type?: EventSourceType; // default 'client'
  source?: string; // component / page name
  function_name?: string | null;
  student_name?: string | null;
  assignment_id?: string | null;
  assignment_type?: string | null;
  submission_id?: string | null;
  error?: unknown;
  http_status?: number | null;
  context?: Record<string, unknown>;
}

function extractErrorFields(err: unknown): {
  message: string | null;
  code: string | null;
  details: string | null;
  hint: string | null;
  stack: string | null;
} {
  if (!err) return { message: null, code: null, details: null, hint: null, stack: null };
  const anyErr = err as any;
  const message =
    (anyErr?.message ?? (typeof err === "string" ? err : JSON.stringify(err))
      ?.toString())?.slice(0, 2000) ?? null;
  return {
    message,
    code: anyErr?.code?.toString() ?? anyErr?.status?.toString() ?? null,
    details: anyErr?.details ? String(anyErr.details).slice(0, 2000) : null,
    hint: anyErr?.hint ? String(anyErr.hint).slice(0, 1000) : null,
    stack: anyErr?.stack ? String(anyErr.stack).slice(0, 4000) : null,
  };
}

export function logEvent(input: LogEventInput): void {
  try {
    const { message, code, details, hint, stack } = extractErrorFields(input.error);
    const payload = {
      category: input.category,
      source_type: input.source_type ?? "client",
      function_name: input.function_name ?? null,
      event_type: input.event_type,
      stage: input.stage,
      student_name: input.student_name ?? null,
      assignment_id: input.assignment_id ?? null,
      assignment_type: input.assignment_type ?? null,
      submission_id: input.submission_id ?? null,
      error_message: message,
      error_code: code,
      pg_details: details,
      pg_hint: hint,
      stack,
      http_status: input.http_status ?? null,
      context: {
        ...(input.context ?? {}),
        ua: typeof navigator !== "undefined" ? navigator.userAgent?.slice(0, 200) : null,
        url: typeof window !== "undefined" ? window.location.pathname : null,
      },
      source: input.source ?? null,
    };

    supabase.auth.getSession().then(({ data }) => {
      const user_id = data.session?.user?.id ?? null;
      supabase
        .from("homework_event_logs")
        .insert({ ...payload, user_id })
        .then(({ error }) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.warn("[eventLogger] insert failed", error.message);
          }
        });
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[eventLogger] unexpected", e);
  }
}

/** Install global handlers once at app startup. */
let installed = false;
export function installGlobalErrorLogging() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    logEvent({
      category: "client_error",
      event_type: "window_error",
      stage: "error",
      source: "window",
      error: e.error ?? new Error(e.message),
      context: { filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    logEvent({
      category: "client_error",
      event_type: "unhandled_rejection",
      stage: "error",
      source: "window",
      error: (e as PromiseRejectionEvent).reason,
    });
  });
}
