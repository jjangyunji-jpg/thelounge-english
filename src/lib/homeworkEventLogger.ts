import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget logger for homework submission events.
 * Never throws — logging failures must never break the user flow.
 */
export type HomeworkEventType =
  | "autosave"
  | "draft_save"
  | "submit"
  | "storage_audio_upload"
  | "storage_file_upload"
  | "prefill";

export type HomeworkEventStage = "attempt" | "success" | "error";

export interface HomeworkEventInput {
  event_type: HomeworkEventType;
  stage: HomeworkEventStage;
  student_name?: string | null;
  assignment_id?: string | null;
  assignment_type?: string | null;
  submission_id?: string | null;
  error?: unknown;
  context?: Record<string, unknown>;
  source?: string; // e.g. "HomeworkSubmitModal", "StudentHomeworkPanel"
}

function extractErrorFields(err: unknown): { message: string | null; code: string | null } {
  if (!err) return { message: null, code: null };
  if (err instanceof Error) {
    const anyErr = err as any;
    return { message: err.message?.slice(0, 1000) ?? null, code: anyErr.code ?? anyErr.status?.toString() ?? null };
  }
  if (typeof err === "object") {
    const anyErr = err as any;
    return {
      message: (anyErr.message ?? JSON.stringify(anyErr)).toString().slice(0, 1000),
      code: anyErr.code ?? anyErr.status?.toString() ?? null,
    };
  }
  return { message: String(err).slice(0, 1000), code: null };
}

export function logHomeworkEvent(input: HomeworkEventInput): void {
  try {
    const { message, code } = extractErrorFields(input.error);
    const payload = {
      event_type: input.event_type,
      stage: input.stage,
      student_name: input.student_name ?? null,
      assignment_id: input.assignment_id ?? null,
      assignment_type: input.assignment_type ?? null,
      submission_id: input.submission_id ?? null,
      error_message: message,
      error_code: code,
      context: {
        ...(input.context ?? {}),
        ua: typeof navigator !== "undefined" ? navigator.userAgent?.slice(0, 200) : null,
        url: typeof window !== "undefined" ? window.location.pathname : null,
      },
      source: input.source ?? null,
    };

    // Attach user id if available — but don't await
    supabase.auth.getSession().then(({ data }) => {
      const user_id = data.session?.user?.id ?? null;
      supabase
        .from("homework_event_logs")
        .insert({ ...payload, user_id })
        .then(({ error }) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.warn("[homeworkEventLogger] insert failed", error.message);
          }
        });
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[homeworkEventLogger] unexpected", e);
  }
}
