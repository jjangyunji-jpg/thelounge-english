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
    // Auth check - instructor or admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "instructor"]);
    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "권한이 없습니다." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { notes, studentName, weekLabel, sessionId } = await req.json();
    if (!notes || !studentName || !weekLabel) {
      return new Response(
        JSON.stringify({ error: "notes, studentName, weekLabel are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an English vocabulary extractor for Korean learners.
Analyze the class notes and extract English-Korean vocabulary pairs.

RULES:
- Only extract items where BOTH an English word/phrase AND its Korean meaning appear close together in the notes.
- Patterns to detect: "word 한국어", "word / word 한국어", "word: 한국어", "word (한국어)", "word — 한국어"
- Include single words, phrasal verbs, idioms, and short phrases.
- Do NOT include full sentences as vocabulary items.
- Do NOT include items where Korean is only a sentence (e.g. grammar explanations).
- Provide a clean English word/phrase, Korean meaning, and part of speech.

Return ONLY a valid JSON object:
{
  "words": [
    {
      "english_word": "attach",
      "korean_meaning": "붙이다",
      "part_of_speech": "verb",
      "example_sentence": "Please attach the file to the email."
    }
  ]
}

If no clear English-Korean pairs are found, return { "words": [] }.`;

    const userPrompt = `Extract English-Korean vocabulary pairs from these class notes:\n\n${notes}`;

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
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const content: string = aiData.choices?.[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    const { words } = JSON.parse(jsonMatch[0]) as { words: Array<{
      english_word: string;
      korean_meaning: string;
      part_of_speech?: string;
      example_sentence?: string;
    }> };

    if (!words || words.length === 0) {
      return new Response(JSON.stringify({ inserted: 0, words: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (sessionId) {
      const { error: deleteError } = await supabase
        .from("vocabulary_words")
        .delete()
        .eq("student_name", studentName)
        .eq("session_id", sessionId);
      if (deleteError) throw deleteError;
    } else {
      const { error: deleteError } = await supabase
        .from("vocabulary_words")
        .delete()
        .eq("student_name", studentName)
        .eq("week_label", weekLabel);
      if (deleteError) throw deleteError;
    }

    const toInsert = words
      .filter((w) => w.english_word && w.korean_meaning)
      .map((w) => ({
        student_name: studentName,
        week_label: weekLabel,
        session_id: sessionId ?? null,
        english_word: w.english_word.trim(),
        korean_meaning: w.korean_meaning.trim(),
        part_of_speech: w.part_of_speech ?? null,
        example_sentence: w.example_sentence ?? null,
      }));

    if (toInsert.length === 0) {
      return new Response(JSON.stringify({ inserted: 0, words: [], message: "추출된 단어가 없습니다." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase.from("vocabulary_words").insert(toInsert);
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ inserted: toInsert.length, words: toInsert }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-vocab:", error);
    return new Response(
      JSON.stringify({ error: "요청을 처리할 수 없습니다. 나중에 다시 시도해주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
