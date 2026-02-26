import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 한국어 포함 여부 감지
function isKorean(text: string): boolean {
  return /[\uAC00-\uD7A3]/.test(text);
}

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

    const korean = isKorean(word);

    const systemPrompt = `You are an expert English vocabulary teacher. Return ONLY a valid JSON object, no markdown, no explanation.

The JSON must have this exact structure:
{
  "search_word": "the English word or phrase you looked up",
  "korean_meaning": "Korean definition string",
  "part_of_speech": "e.g. verb / noun / adjective / phrasal verb / idiom",
  "example_sentence": "one natural English example sentence",
  "synonyms": [
    {
      "expression": "English expression",
      "type": "synonym | phrasal verb | idiom | slang",
      "korean": "Korean meaning",
      "level": "CEFR level e.g. B1",
      "example": "short English example"
    }
  ]
}

Provide 6–10 synonym entries mixing all types. Prioritise expressions suitable for or slightly above the student's CEFR level.`;

    const userPrompt = korean
      ? `The student typed a Korean word: "${word}". First find the most natural English equivalent, then return the full vocabulary JSON for that English word. Student CEFR level: ${level || "B1"}.`
      : `Word or phrase: "${word}". Student CEFR level: ${level || "B1"}. Return the full vocabulary JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI gateway error [${response.status}]:`, errText);
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

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    // JSON 블록 추출 (마크다운 코드블록 포함 대응)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");
    const result = JSON.parse(jsonMatch[0]);

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
