import { logEvent } from "./eventLogger";

/**
 * Backwards-compatible homework logger. Delegates to the generalized eventLogger.
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
  source?: string;
}

export function logHomeworkEvent(input: HomeworkEventInput): void {
  logEvent({
    category: "homework",
    event_type: input.event_type,
    stage: input.stage,
    source_type: "client",
    source: input.source,
    student_name: input.student_name,
    assignment_id: input.assignment_id,
    assignment_type: input.assignment_type,
    submission_id: input.submission_id,
    error: input.error,
    context: input.context,
  });
}
