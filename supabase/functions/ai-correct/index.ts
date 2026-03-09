import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { text, mode } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "typo") {
      systemPrompt = `You are a spelling-only autocorrect for individual words.
RULES:
- Fix ONLY misspelled words (typos, wrong letters, missing letters).
- Fix lowercase "i" when used as a pronoun to "I".
- Do NOT change grammar, sentence structure, punctuation, word choice, tense, or meaning.
- Do NOT add or remove words. Do NOT rephrase or restructure sentences.
- If a word is spelled correctly, leave it exactly as-is even if grammar is wrong.
- Return a JSON object with: { "corrected": "the text with only spelling fixes" }
- If there are no misspellings, return the original text UNCHANGED.`;
      userPrompt = `Fix only misspelled words (do NOT fix grammar): "${text}"`;
    } else if (mode === "correct") {
      systemPrompt = `You are an expert English language teacher. Correct grammar, vocabulary, and expression errors in the student's speech transcript. 
      Return a JSON object with:
      - corrected: the corrected version of the text
      - errors: array of { original, corrected, explanation } objects for each error found
      - score: naturalness score 1-10
      Keep explanations concise and educational. Respond in Korean for explanations.`;
      userPrompt = `Correct this student's English: "${text}"`;
    } else if (mode === "synonyms") {
      systemPrompt = `You are an English vocabulary expert. Find interesting synonyms and alternative expressions for key words and phrases in the text.
      Return a JSON object with:
      - synonyms: array of { word, alternatives: string[], example: string } objects
      Limit to the 5 most interesting/educational words. Respond in Korean for context.`;
      userPrompt = `Find synonyms for key words in: "${text}"`;
    } else if (mode === "homework_review") {
      systemPrompt = `You are an expert English language teacher reviewing a Korean student's written homework.
Return a JSON object with:
- corrected: the corrected version of the text
- errors: array of { original, corrected, explanation } objects for each error found. The "original" must be the EXACT substring from the student's text. Keep explanations concise in Korean.
- score: naturalness score 1-10 (how natural the English sounds)
- english_level: estimated English proficiency level as a string (e.g. "A1", "A2", "B1", "B2", "C1", "C2" using CEFR scale)
- vocab_level: estimated vocabulary level as a string (e.g. "초급", "중급", "중상급", "고급")
- feedback: object with:
  - praise: one warm, friendly, human-like sentence praising what the student did well STRICTLY in terms of GRAMMAR USAGE or LOGICAL STRUCTURE/FLOW of the writing (in Korean). Write as if a caring teacher is speaking directly to the student — use casual, encouraging tone (e.g. "~했네요!", "~한 부분이 정말 좋았어요!"). Do NOT praise effort, attitude, topic choice, or content. Focus ONLY on grammatical accuracy and structural organization.
  - priorities: array of exactly 3 strings, each describing the most important thing the student should fix or improve (in Korean, concise)

IMPORTANT for errors:
- The "original" field must match exactly a substring in the student's text (case-sensitive)
- Do NOT fix the entire sentence; only mark the specific word(s) that are wrong
- If a word is spelled correctly but used incorrectly, still mark it`;
      userPrompt = `Review this student's English homework: "${text}"`;
    } else if (mode === "notes_correct") {
      systemPrompt = `You are an expert English language teacher. Correct grammar and expression errors in the student's text.
Return a JSON object with:
- errors: array of { original, corrected } objects for each error found. The "original" must be the EXACT substring from the student's text (case-sensitive). Only mark the specific word(s) that are wrong, not entire sentences. Do NOT include explanations.
- If there are no errors, return { "errors": [] }`;
      userPrompt = `Correct errors in this English text: "${text}"`;
    } else {
      systemPrompt = `You are an expert English language teacher analyzing a student's spoken English.
      Return a JSON object with:
      - corrected: grammatically correct version
      - errors: array of { original, corrected, explanation } for each error
      - synonyms: array of { word, alternatives: string[] } for interesting word choices
      - score: naturalness score 1-10
      - feedback: one encouraging sentence of overall feedback
      Respond in Korean for explanations and feedback.`;
      userPrompt = `Analyze this student's English speech: "${text}"`;
    }

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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI 크레딧이 부족합니다." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const result = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ai-correct:", error);
    return new Response(
      JSON.stringify({ error: "요청을 처리할 수 없습니다. 나중에 다시 시도해주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
