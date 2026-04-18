import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function stripHtml(html: string): string {
  let text = html;
  text = text.replace(/<img[^>]*>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "");
  text = text.replace(/data:[^"'\s)]+/gi, "");
  text = text.replace(/<\/th>/gi, " | ");
  text = text.replace(/<\/td>/gi, " | ");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

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
    const userId = userData.user.id;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "manager", "instructor"]);
    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "권한이 없습니다." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { notes, level } = await req.json();
    if (!notes) {
      return new Response(JSON.stringify({ error: "notes is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let cleaned = stripHtml(notes);
    const MAX_CHARS = 60000;
    if (cleaned.length > MAX_CHARS) cleaned = cleaned.slice(0, MAX_CHARS) + "\n[...truncated]";

    const systemPrompt = `You are an English coach who extracts ready-to-memorize EXAMPLE SENTENCES from class notes for Korean adult learners.

Goal: pick exactly 10 COMPLETE, NATURAL example sentences the student can memorize and use verbatim in real life.

CRITICAL RULES:
- Output COMPLETE example sentences as actually spoken (e.g. "What brings you to the party today?", "I was wondering if we could push the meeting to next week.").
- DO NOT output sentence patterns, templates, or fragments with blanks/placeholders (no "I was wondering if ___", no "What brings you to ___?").
- DO NOT output single words or short collocations (those belong in the vocabulary list).
- Prefer real conversational lines (questions, polite requests, reactions, small talk, business phrases) — natural, spoken English a Korean learner would actually use.
- Keep each sentence under 20 words. Avoid textbook-only or overly literary sentences.
- Order the 10 sentences from MOST FREQUENTLY USED in everyday/professional life (#1) to less frequent (#10). The top half should be high-frequency staples.
- For each item, write a short Korean situation label (4–10 자) describing WHEN to use it (e.g. "파티 인사", "회의 미루기", "정중한 거절").
- Provide a natural Korean translation that captures meaning and tone (not literal).
- If both English and Korean appear in the source, prefer the Korean from the source.

Target learner level: ${level || "B1"}.
Return exactly 10 items via the structured tool call (or fewer only if the notes truly don't support 10).`;

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
          { role: "user", content: `Class notes:\n\n${cleaned}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_key_expressions",
              description: "Return exactly 10 complete example sentences, ordered from most to least frequently used in real life.",
              parameters: {
                type: "object",
                properties: {
                  expressions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        situation_label: { type: "string", description: "Korean short situation label, 4-10 chars" },
                        english: { type: "string", description: "English sentence or expression" },
                        korean: { type: "string", description: "Natural Korean translation" },
                      },
                      required: ["situation_label", "english", "korean"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["expressions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_key_expressions" } },
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
    const parsed = JSON.parse(argStr) as { expressions?: Array<{ situation_label: string; english: string; korean: string }> };
    const expressions = (parsed.expressions ?? [])
      .filter(e => e.english?.trim() && e.korean?.trim())
      .slice(0, 12)
      .map(e => ({
        situation_label: (e.situation_label ?? "").trim(),
        english: e.english.trim(),
        korean: e.korean.trim(),
      }));

    return new Response(JSON.stringify({ expressions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-key-expressions:", error);
    return new Response(
      JSON.stringify({ error: "요청을 처리할 수 없습니다. 나중에 다시 시도해주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
