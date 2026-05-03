// Public REST API for external apps. Authenticated via X-API-Key header.
// Each API key is bound to a single student (student_name) and can only read
// that student's own data. Endpoints (under /public-api):
//   GET /me            -> student profile
//   GET /sessions      -> upcoming + recent class sessions for the student
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const apiKey = req.headers.get("x-api-key") || "";
  if (!apiKey || apiKey.length < 16) {
    return json({ error: "missing_or_invalid_api_key" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow, error: keyErr } = await supabase
    .from("api_keys")
    .select("id, student_name, active, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyErr || !keyRow) return json({ error: "invalid_api_key" }, 401);
  if (!keyRow.active || keyRow.revoked_at) {
    return json({ error: "api_key_revoked" }, 403);
  }

  const studentName = keyRow.student_name;

  // Fire-and-forget last_used_at update
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  const url = new URL(req.url);
  // Path looks like /public-api/<resource>
  const parts = url.pathname.split("/").filter(Boolean);
  const resource = parts[parts.length - 1] || "";

  try {
    if (resource === "me") {
      const { data: profile } = await supabase
        .from("instructor_students")
        .select(
          "student_name, english_name, level, status, instructor_name, start_date, lesson_goal, schedules"
        )
        .eq("student_name", studentName)
        .maybeSingle();
      return json({ student: profile });
    }

    if (resource === "sessions") {
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
      const { data: sessions } = await supabase
        .from("class_sessions")
        .select(
          "id, scheduled_at, ended_at, started_at, instructor_name, level, topic, cancellation_type, cancellation_resolution"
        )
        .eq("student_name", studentName)
        .order("scheduled_at", { ascending: false })
        .limit(limit);
      return json({ sessions: sessions || [] });
    }

    return json(
      {
        error: "unknown_endpoint",
        available: ["/public-api/me", "/public-api/sessions"],
      },
      404
    );
  } catch (e) {
    console.error("[public-api] error", e);
    return json({ error: "server_error" }, 500);
  }
});
