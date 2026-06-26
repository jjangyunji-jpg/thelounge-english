// Shared event logger for Supabase Edge Functions.
// Writes to public.homework_event_logs using the service role key.
// Fire-and-forget — never throws.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

export type EdgeEventStage = "attempt" | "success" | "error";
export type EdgeEventCategory =
  | "homework" | "classroom" | "scheduling" | "payment"
  | "auth" | "admin" | "edge_function" | "other";

export interface EdgeLogInput {
  category?: EdgeEventCategory;
  event_type: string;
  stage: EdgeEventStage;
  function_name: string;
  user_id?: string | null;
  student_name?: string | null;
  http_status?: number | null;
  error?: unknown;
  context?: Record<string, unknown>;
}

function extractErr(err: unknown) {
  if (!err) return { message: null, code: null, details: null, hint: null, stack: null };
  const a = err as any;
  return {
    message: (a?.message ?? (typeof err === "string" ? err : JSON.stringify(err)))?.toString()?.slice(0, 2000) ?? null,
    code: a?.code?.toString() ?? a?.status?.toString() ?? null,
    details: a?.details ? String(a.details).slice(0, 2000) : null,
    hint: a?.hint ? String(a.hint).slice(0, 1000) : null,
    stack: a?.stack ? String(a.stack).slice(0, 4000) : null,
  };
}

export function logEdgeEvent(input: EdgeLogInput): void {
  try {
    const e = extractErr(input.error);
    admin
      .from("homework_event_logs")
      .insert({
        category: input.category ?? "edge_function",
        source_type: "edge_function",
        function_name: input.function_name,
        event_type: input.event_type,
        stage: input.stage,
        user_id: input.user_id ?? null,
        student_name: input.student_name ?? null,
        error_message: e.message,
        error_code: e.code,
        pg_details: e.details,
        pg_hint: e.hint,
        stack: e.stack,
        http_status: input.http_status ?? null,
        context: input.context ?? {},
        source: input.function_name,
      })
      .then(({ error }) => {
        if (error) console.warn("[logEdgeEvent] insert failed", error.message);
      });
  } catch (err) {
    console.warn("[logEdgeEvent] unexpected", err);
  }
}

/** Wrap an edge function handler with automatic attempt/success/error logging. */
export function withEdgeLogging(
  functionName: string,
  category: EdgeEventCategory,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === "OPTIONS") return handler(req);
    const started = Date.now();
    try {
      const res = await handler(req);
      logEdgeEvent({
        category,
        event_type: "invoke",
        stage: res.status >= 400 ? "error" : "success",
        function_name: functionName,
        http_status: res.status,
        context: { duration_ms: Date.now() - started, method: req.method },
      });
      return res;
    } catch (err) {
      logEdgeEvent({
        category,
        event_type: "invoke",
        stage: "error",
        function_name: functionName,
        error: err,
        context: { duration_ms: Date.now() - started, method: req.method },
      });
      throw err;
    }
  };
}
