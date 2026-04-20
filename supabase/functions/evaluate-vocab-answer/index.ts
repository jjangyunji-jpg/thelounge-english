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

    const { korean_meaning, expected_english, student_answer, part_of_speech } = await req.json();
    if (!korean_meaning || !expected_english || typeof student_answer !== "string") {
      return new Response(JSON.stringify({ error: "korean_meaning, expected_english, student_answer are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a lenient vocabulary grader for Korean adult learners.
You will receive a Korean meaning, the expected English word/phrase from the vocabulary list, and the student's English answer.

Your job: decide if the student's answer is a VALID English equivalent of the Korean meaning.

GRADING PHILOSOPHY — BE GENEROUS WITH SYNONYMS:
- Accept any common English word/phrase that conveys the SAME core meaning as the Korean prompt.
- Examples that MUST be accepted as correct:
  * Korean: "즉시, 바로" / Expected: "immediately" / Student: "right away" → CORRECT (true synonym)
  * Korean: "적당한" / Expected: "fair" / Student: "reasonable" / "moderate" → CORRECT
  * Korean: "만족하는" / Expected: "content" / Student: "satisfied" → CORRECT
  * Korean: "일부러" / Expected: "on purpose" / Student: "intentionally" / "deliberately" → CORRECT
- Accept minor spelling/capitalization/spacing differences.
- Accept different parts of speech ONLY if the meaning matches the Korean prompt naturally.
- REJECT if the student's answer means something different, is unrelated, or is not real English.

Return ONLY via the tool call. is_correct=true means accept as correct.`;

    const userPrompt = `Korean meaning: ${korean_meaning}
${part_of_speech ? `Part of speech: ${part_of_speech}\n` : ""}Expected English (one valid answer): ${expected_english}
Student's answer: ${student_answer}`;

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
              name: "submit_judgment",
              description: "Return whether the student's answer is a valid synonym/equivalent.",
              parameters: {
                type: "object",
                properties: {
                  is_correct: { type: "boolean", description: "true if the answer is a valid English equivalent of the Korean meaning" },
                  reason_korean: { type: "string", description: "Short Korean explanation (max 1 sentence)" },
                },
                required: ["is_correct", "reason_korean"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_judgment" } },
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
    const parsed = JSON.parse(argStr) as { is_correct: boolean; reason_korean: string };

    return new Response(JSON.stringify({
      is_correct: !!parsed.is_correct,
      reason: parsed.reason_korean ?? "",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in evaluate-vocab-answer:", error);
    return new Response(
      JSON.stringify({ error: "요청을 처리할 수 없습니다.", is_correct: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
