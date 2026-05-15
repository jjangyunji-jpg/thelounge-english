import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Pick {
  question_id: string;
  picked: number;
}

interface Body {
  test_id: string;
  picks: Pick[];
  started_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller via JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = (await req.json()) as Body;
    if (!body?.test_id || !Array.isArray(body.picks) || body.picks.length === 0) {
      return json({ error: "invalid_payload" }, 400);
    }

    // Service role for trusted reads/writes
    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve student_name from auth user
    const { data: profile } = await admin
      .from("student_profiles")
      .select("student_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.student_name) return json({ error: "no_student_profile" }, 403);
    const studentName = profile.student_name as string;

    // Load test (for pass_threshold)
    const { data: test } = await admin
      .from("level_tests")
      .select("id, pass_threshold")
      .eq("id", body.test_id)
      .maybeSingle();
    if (!test) return json({ error: "test_not_found" }, 404);

    // Load correct answers + meta for the picked question IDs
    const qIds = body.picks.map((p) => p.question_id);
    const { data: questions } = await admin
      .from("level_test_questions")
      .select("id, level_test_id, set_number, category, question, choices, correct_index, explanation")
      .eq("level_test_id", body.test_id)
      .in("id", qIds);
    if (!questions || questions.length === 0) {
      return json({ error: "no_questions" }, 400);
    }
    const qMap = new Map<string, any>(questions.map((q: any) => [q.id, q]));

    let correctCount = 0;
    const answers = body.picks.map((p) => {
      const q = qMap.get(p.question_id);
      const isCorrect = q ? p.picked === q.correct_index : false;
      if (isCorrect) correctCount++;
      return {
        question_id: p.question_id,
        category: q?.category ?? "",
        question: q?.question ?? "",
        picked: p.picked,
        correct: q?.correct_index ?? -1,
        explanation: q?.explanation ?? null,
        is_correct: isCorrect,
      };
    });

    const total = body.picks.length;
    const score = Math.round((correctCount / total) * 100);
    const passed = score >= (test.pass_threshold ?? 80);

    // Insert attempt
    await admin.from("level_test_attempts").insert({
      student_name: studentName,
      level_test_id: body.test_id,
      score,
      total_questions: total,
      correct_count: correctCount,
      passed,
      answers,
      started_at: body.started_at || new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    });

    // Update activation summary
    const { data: activation } = await admin
      .from("level_test_activations")
      .select("id, best_score, attempt_count, current_set, passed_at")
      .eq("level_test_id", body.test_id)
      .eq("student_name", studentName)
      .maybeSingle();

    if (activation) {
      if (passed) {
        // Auto-deactivate on pass; attempt history is retained in level_test_attempts
        await admin.from("level_test_activations").delete().eq("id", activation.id);
      } else {
        const updates: Record<string, unknown> = {
          best_score: Math.max(activation.best_score ?? 0, score),
          attempt_count: (activation.attempt_count ?? 0) + 1,
        };
        const { data: nextSetRows } = await admin
          .from("level_test_questions")
          .select("set_number")
          .eq("level_test_id", body.test_id)
          .eq("is_active", true)
          .eq("set_number", (activation.current_set ?? 1) + 1)
          .limit(1);
        if (nextSetRows && nextSetRows.length > 0) {
          updates.current_set = (activation.current_set ?? 1) + 1;
        }
        await admin.from("level_test_activations").update(updates).eq("id", activation.id);
      }
    }

    return json({ score, correct_count: correctCount, total, passed, answers });
  } catch (e) {
    console.error("[grade-level-test] error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
