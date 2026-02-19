import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { notes, topic } = await req.json();
    if (!notes) {
      return new Response(
        JSON.stringify({ error: "notes is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an English class curriculum assistant for Korean learners.
Based on the class notes provided, extract 2-3 concise learning objectives in Korean.

RULES:
- Write each objective in Korean (한국어)
- Each objective should be a short action-oriented phrase (verb + object)
- Focus on what the student will LEARN or PRACTICE (grammar, expressions, skills)
- Maximum 20 characters per objective
- Do NOT include bullet points or numbering

Return ONLY a valid JSON object:
{
  "topic": "한 줄로 요약한 수업 주제 (예: 미래 표현 3가지)",
  "objectives": [
    "현재진행형 이해 및 활용",
    "will vs be going to 차이 구분",
    "미래 표현 문장 연습"
  ]
}`;

    const userPrompt = `Class notes:\n${notes}${topic ? `\n\nHint - topic area: ${topic}` : ""}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
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
      throw new Error(`AI gateway error [${response.status}]: ${errText}`);
    }

    const aiData = await response.json();
    const content: string = aiData.choices?.[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    const result = JSON.parse(jsonMatch[0]) as { topic?: string; objectives?: string[] };

    return new Response(JSON.stringify({
      topic: result.topic ?? topic ?? "",
      objectives: result.objectives ?? [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-objectives:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
