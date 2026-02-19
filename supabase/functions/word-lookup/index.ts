import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { word, level } = await req.json();
    if (!word) {
      return new Response(JSON.stringify({ error: "word is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert English vocabulary teacher.
Given a word or phrase and a student's CEFR level, return a structured JSON with:
- korean_meaning: string — concise Korean definition (e.g. "약속하다, 헌신하다")
- part_of_speech: string — e.g. "verb", "noun", "adjective", "phrasal verb", "idiom"
- example_sentence: string — one natural English example sentence using the word
- synonyms: array of objects, each with:
    - expression: string — the synonym/phrasal verb/idiom/slang (English)
    - type: one of "synonym" | "phrasal verb" | "idiom" | "slang"
    - korean: string — Korean meaning of this expression
    - level: CEFR level suitability "A1"–"C2" or "all"
    - example: string — short English example sentence
  Provide 6–10 entries mixing all types (synonym, phrasal verb, idiom, slang), prioritising expressions suitable for or slightly above the student's level.
Respond only with valid JSON, no markdown.`;

    const userPrompt = `Word: "${word}"\nStudent CEFR level: ${level || "B1"}\n\nReturn the vocabulary lookup JSON.`;

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
      throw new Error(`AI gateway error [${response.status}]`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const result = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in word-lookup:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
