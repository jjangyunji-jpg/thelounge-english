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
    const profession = String(body.profession || "").trim().slice(0, 300);
    const topic = String(body.topic || "").trim().slice(0, 500);
    const level = String(body.level || "B1").trim().slice(0, 10);
    const duration = String(body.duration || "40").trim().slice(0, 10);

    if (!profession) {
      return new Response(JSON.stringify({ error: "직업/직무를 입력해주세요." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert ESL/EFL lesson material creator specializing in profession-relevant English lessons for Korean adult learners.

You will receive a student's profession (and optional focus topic), and create a concise "Insight" briefing for an English speaking lesson.

IMPORTANT RULES:
- Tailor the concept and examples to the student's actual profession/industry
- The concept paragraph must be 1 well-crafted English paragraph (5-7 sentences) at ${level} CEFR level
- Vocabulary table: exactly 8 essential industry/topic terms with simple English definitions and natural Korean translations
- Discussion Questions: exactly 5 thought-provoking, profession-relevant questions in English
- Keep tone professional but conversational; avoid jargon overload`;

    const userPrompt = `Create an Insight lesson briefing.

Student Profession / Role: ${profession}
${topic ? `Focus Topic / Interest: ${topic}` : ""}
CEFR Level: ${level}
Lesson Duration: ${duration} min

Generate the output in this EXACT HTML format (no markdown, no code fences):

<div style="border-left:4px solid #8b5cf6;padding:12px 16px;background:#f5f3ff;margin-bottom:16px;border-radius:4px">
<p style="margin:0;font-weight:bold;font-size:14px">[Insight Title — relevant to profession${topic ? " and topic" : ""}] / ${duration} min</p>
</div>

<h2>💡 Concept</h2>
<p style="line-height:1.7;font-size:14px">
(One well-written English paragraph, 5-7 sentences, explaining a concept commonly encountered in this profession${topic ? " related to the focus topic" : ""}. Include a concrete example.)
</p>

<h2>📚 Key Vocabulary</h2>
<table>
<thead><tr><th>No.</th><th>Term</th><th>Meaning (English)</th><th>한국어 뜻</th></tr></thead>
<tbody>
<tr><td>1</td><td><strong>term</strong></td><td>simple English definition</td><td>한국어</td></tr>
...8 rows total...
</tbody>
</table>

<h2>💬 Discussion Questions</h2>
<ol>
<li style="color:#1a0dab">Question 1?</li>
<li style="color:#1a0dab">Question 2?</li>
<li style="color:#1a0dab">Question 3?</li>
<li style="color:#1a0dab">Question 4?</li>
<li style="color:#1a0dab">Question 5?</li>
</ol>

Make everything educational and appropriate for ${level} level Korean adult learners working as ${profession}.`;

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
