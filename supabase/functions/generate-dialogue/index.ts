import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { situation, speakers, student, level, mustInclude, tone } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert English dialogue writer for ESL/EFL education. You create natural, realistic conversations that sound like real people talking — NOT textbook dialogues. 

Rules:
- Write dialogues that feel authentic and conversational
- Use contractions, fillers (um, well, you know), and natural speech patterns appropriate to the tone
- Include 8-12 exchanges (back and forth)
- After the English dialogue, provide a Korean translation of the entire dialogue
- Format the output clearly with speaker labels
- If any input field is empty, use your best judgment to fill in reasonable defaults
- The dialogue MUST be educational and relevant to the student's level`;

    const userPrompt = `Generate a natural English dialogue with the following parameters:

Situation: ${situation || "A casual everyday conversation"}
Speakers: ${speakers || "Two people"}
Student info: ${student || "An adult Korean English learner"}
English Level (CEFR): ${level || "B1"}
Must include these expressions/words/grammar: ${mustInclude || "No specific requirements"}
Tone: ${tone || "Casual"}

Format the output EXACTLY like this (use HTML formatting):

<h2>📝 Dialogue</h2>
<p><strong>[Speaker A]:</strong> (English line)</p>
<p><strong>[Speaker B]:</strong> (English line)</p>
...continue the dialogue...

<hr>

<h2>🇰🇷 한국어 번역</h2>
<p><strong>[Speaker A]:</strong> (Korean translation)</p>
<p><strong>[Speaker B]:</strong> (Korean translation)</p>
...continue translations...

Use the actual speaker names from the input. Make the dialogue feel real and natural, not like a textbook exercise.`;

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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }), {
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
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ dialogue: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-dialogue error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
