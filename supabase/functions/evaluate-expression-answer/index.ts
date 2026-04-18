import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { korean, target_english, student_answer } = await req.json();
    if (!korean || !target_english || typeof student_answer !== "string") {
      return new Response(JSON.stringify({ error: "korean, target_english, student_answer are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a GENEROUS and encouraging English writing tutor for Korean adult learners.
You will receive a Korean prompt, a target English expression (the "model answer"), and the student's English answer.

Your job: judge if the student's answer conveys the SAME MEANING as the target expression in natural English.

CRITICAL GRADING PHILOSOPHY — BE GENEROUS:
- The target expression is just ONE valid way to say it. Many other phrasings are EQUALLY correct.
- If the student's answer is grammatically correct AND conveys the same core meaning → it MUST be scored 90+ as fully correct.
- DO NOT penalize for stylistic nuance, "could be more natural", or "the model uses X instead". These are NOT errors.
- DO NOT deduct points just because the student omitted optional words (e.g., "ever", "just", "really") that the model included. Both versions are correct English.
- Examples that MUST be scored 95-100 (fully correct):
  * Target: "Have you ever been to Bali?" / Student: "Have you been to Bali?" → 100 (both perfectly natural)
  * Target: "I'm doing well" / Student: "I am doing well" / "I'm good" / "I'm fine" → 100
  * Target: "What do you do?" / Student: "What's your job?" → 95+ (same meaning)
  * Target: "Could you help me?" / Student: "Can you help me?" → 100

Score (integer 0–100, pass = 70+):
- 90–100: meaning matches AND English is grammatical (DEFAULT for any reasonable answer)
- 70–89: meaning matches but has a minor grammar mistake (e.g., wrong tense, missing article)
- 40–69: partially correct meaning OR significant grammar errors
- 0–39: wrong meaning or broken/unintelligible English

Feedback: 1–2 short sentences in Korean. Be warm and encouraging.
- If 90+: affirm briefly. Optionally note the model phrasing as ONE alternative (not as a "correction").
- If lower: briefly explain the actual grammar/meaning issue (NOT stylistic preference).

Return ONLY via the tool call.`;

    const userPrompt = `Korean prompt: ${korean}
Target (model) English: ${target_english}
Student answer: ${student_answer}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_evaluation",
              description: "Return judgment of the student's translation.",
              parameters: {
                type: "object",
                properties: {
                  is_correct: { type: "boolean" },
                  score: { type: "integer", minimum: 0, maximum: 100 },
                  feedback_korean: { type: "string" },
                },
                required: ["is_correct", "score", "feedback_korean"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_evaluation" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI 요청 한도 초과. 잠시 후 다시 시도해주세요." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI 크레딧이 부족합니다." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await response.text();
      console.error("AI gateway error:", response.status, txt);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const argStr = toolCall?.function?.arguments ?? "{}";
    const parsed = JSON.parse(argStr) as { is_correct: boolean; score: number; feedback_korean: string };

    return new Response(JSON.stringify({
      is_correct: !!parsed.is_correct,
      score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
      feedback: parsed.feedback_korean ?? "",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in evaluate-expression-answer:", error);
    return new Response(
      JSON.stringify({ error: "요청을 처리할 수 없습니다. 나중에 다시 시도해주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
