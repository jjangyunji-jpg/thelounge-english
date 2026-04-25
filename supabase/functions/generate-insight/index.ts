import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supa.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const professionRaw = String(body.profession || "").trim().slice(0, 300);
    const topic = String(body.topic || "").trim().slice(0, 500);
    const level = String(body.level || "B1").trim().slice(0, 10);
    const duration = String(body.duration || "40").trim().slice(0, 10);

    if (!professionRaw) {
      return new Response(JSON.stringify({ error: "직업/직무를 입력해주세요." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Split multiple professions/fields by comma, slash, semicolon, or " and "
    const professionList = professionRaw
      .split(/[,/;]|\s+and\s+/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // Randomly pick ONE field for this generation
    const profession = professionList[Math.floor(Math.random() * professionList.length)];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a senior subject-matter expert AND an experienced ESL/EFL lesson material creator for Korean adult professionals.

Your job: produce a SHORT, DENSE, EXPERT-LEVEL "Insight" briefing on a SPECIFIC, CONCRETE concept, technology, trend, or recent development from the student's professional field — written in the style of a high-quality industry explainer or business/tech magazine article (think The Economist, MIT Technology Review, Harvard Business Review, Bloomberg).

CRITICAL CONTENT RULES:
- DO NOT write generic overviews of the field ("AI is a fast-growing area..."). Pick ONE concrete, named, specific topic inside the field.
  - For "AI technology" → pick something specific like "What an LLM actually is", "Retrieval-Augmented Generation (RAG)", "Mixture-of-Experts architectures", "the rise of small on-device models", "AI agents and tool use", a specific recent model release, etc.
  - For "Bond manager" → pick something specific like "Duration risk in a rising-rate environment", "How credit spreads signal recession risk", "The mechanics of a bond auction", "Why the yield curve inverted", etc.
  - For "Marketing" → "Performance marketing vs. brand marketing trade-offs", "How attribution broke after iOS 14.5", "The shift from third-party cookies to first-party data", etc.
- Prefer recent, currently-relevant topics (developments, debates, or shifts that a working professional would actually be discussing in 2024-2025) when natural.
- Vary the angle every time: sometimes explain a core concept, sometimes a recent industry event/trend, sometimes a debate, sometimes a tool/technique, sometimes a case study.
- Write with the authority and precision of someone who works in the field. Use real terminology, real names of frameworks/companies/standards/people when appropriate, and concrete numbers/examples.

LANGUAGE RULES:
- Concept paragraph: 1 paragraph, 6-9 sentences, written at ${level} CEFR level but with PRECISE professional vocabulary preserved. Do not water down technical terms — define them naturally inline.
- Vocabulary: exactly 8 terms that are SPECIFIC to the chosen concept (not generic field words). Definitions in simple English + natural Korean translation.
- Discussion Questions: exactly 5, profession-relevant, opinion- or analysis-eliciting (not yes/no, not factual recall).
- Tone: confident, informative, slightly editorial — like a briefing memo, not a textbook.`;

    const userPrompt = `Create an Insight lesson briefing.

Student's professional field for THIS briefing: ${profession}
${topic ? `Optional focus topic / interest: ${topic}` : ""}
CEFR Level: ${level}
Lesson Duration: ${duration} min

STEP 1 (think internally, do not output): Pick ONE specific, concrete, named concept / technology / recent development / trend / debate inside "${profession}"${topic ? ` that connects to "${topic}"` : ""}. It must be specific enough that an expert in the field would recognize it as a real, discussable topic — NOT a generic overview of the field.

STEP 2: Write the briefing in this EXACT HTML format (no markdown, no code fences):

<div style="border-left:4px solid #8b5cf6;padding:12px 16px;background:#f5f3ff;margin-bottom:16px;border-radius:4px">
<p style="margin:0;font-weight:bold;font-size:14px">[Specific topic title — e.g. "What an LLM Actually Is" or "Duration Risk When Rates Rise"] / ${duration} min</p>
<p style="margin:4px 0 0 0;font-size:11px;color:#6b7280">Field: ${profession}</p>
</div>

<h2>💡 Concept</h2>
<p style="line-height:1.7;font-size:14px">
(ONE dense, expert-style English paragraph, 6-9 sentences. Explain the specific concept/technology/development you picked. Include at least one concrete example, real name, real number, or real recent event. Sound like an industry explainer article.)
</p>

<h2>📚 Key Vocabulary</h2>
<table>
<thead><tr><th>No.</th><th>Term</th><th>Meaning (English)</th><th>한국어 뜻</th></tr></thead>
<tbody>
<tr><td>1</td><td><strong>specific term</strong></td><td>precise English definition</td><td>한국어 뜻</td></tr>
...exactly 8 rows, all terms specific to the chosen topic, not generic field vocabulary...
</tbody>
</table>

<h2>💬 Discussion Questions</h2>
<ol>
<li style="color:#1a0dab">Opinion/analysis question 1?</li>
<li style="color:#1a0dab">Question 2?</li>
<li style="color:#1a0dab">Question 3?</li>
<li style="color:#1a0dab">Question 4?</li>
<li style="color:#1a0dab">Question 5?</li>
</ol>

Audience: a Korean adult professional working in ${profession}, at ${level} CEFR. Be specific, be expert, avoid generic "introduction to the field" content.`;

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
        temperature: 0.95,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI 크레딧이 부족합니다." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ html: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-insight error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
