import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPIC_TOPICS = [
  "travel", "movies", "music", "sports (watching)", "playing sports", "restaurants & dining out",
  "cooking at home", "shopping", "cafes", "parks", "beaches", "hotels", "domestic trips",
  "overseas trips", "watching TV / streaming shows", "reading books", "listening to podcasts",
  "going to concerts", "going to the gym", "yoga / pilates", "running / jogging",
  "hiking", "cycling", "swimming", "photography", "gardening", "pets", "video games",
  "board games", "social media", "smartphones", "online classes", "language learning",
  "volunteer work", "weekend activities", "family gatherings", "birthdays", "holidays",
  "weather and seasons", "fashion", "haircuts / salons", "public transportation",
  "driving / cars", "neighborhood", "housing / apartments", "furniture", "appliances",
  "internet / technology at home", "banking", "health and doctor visits",
];

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
    const topicRaw = String(body.topic || "").trim().slice(0, 200);
    const level = String(body.level || "B2").trim().slice(0, 10);

    // If user provided topics (comma-separated), pick one randomly. Otherwise pick from OPIC pool.
    let topic = "";
    if (topicRaw) {
      const list = topicRaw.split(/[,/;]|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
      topic = list[Math.floor(Math.random() * list.length)];
    } else {
      topic = OPIC_TOPICS[Math.floor(Math.random() * OPIC_TOPICS.length)];
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a senior OPIc (Oral Proficiency Interview - computer) examiner and AL-level (Advanced Low) prep coach for Korean adult learners.

Your job: produce ONE OPIc-style practice set on ONE topic, containing exactly 3 questions:
  1. Description (묘사) — describe a place, person, activity, or routine related to the topic
  2. Past experience (경험) — tell about a specific past experience related to the topic
  3. Opinion / comparison / issue (의견/비교/이슈) — express opinion, compare past vs present, or discuss a problem/issue related to the topic

CRITICAL RULES:
- ALL 3 questions MUST be about the SAME single topic. If the topic is "travel", every question must be about travel.
- Question style must match real OPIc question phrasing (natural spoken English, examiner voice, often 2-3 sentences with sub-prompts like "Describe... What does it look like? Why do you like it?").
- Model answers must be at AL (Advanced Low) level:
  - 8-14 sentences each
  - Rich connectors (To be honest, What I mean is, On top of that, The thing is, Looking back, etc.)
  - Specific details, names, numbers, vivid descriptions
  - Natural fillers/discourse markers used sparingly (you know, I mean, like — not overused)
  - Past-tense storytelling for question 2 with a clear beginning-middle-end
  - Opinion + reasoning + example for question 3
  - Sound like a confident, fluent speaker — NOT textbook English`;

    const userPrompt = `Create one OPIc practice set.

TOPIC for all 3 questions: ${topic}
Student CEFR Level (for vocabulary calibration of the QUESTION wording only — model answers are always AL): ${level}

Output this EXACT HTML format (no markdown, no code fences):

<div style="border-left:4px solid #0ea5e9;padding:12px 16px;background:#f0f9ff;margin-bottom:16px;border-radius:4px">
<p style="margin:0;font-weight:bold;font-size:14px">🎤 OPIc Practice — Topic: ${topic}</p>
<p style="margin:4px 0 0 0;font-size:11px;color:#6b7280">3 questions · All on the same topic · AL-level model answers</p>
</div>

<h2>1️⃣ Description (묘사)</h2>
<p style="line-height:1.7;font-size:14px;color:#1a0dab"><strong>Q.</strong> (Natural OPIc-style description question about ${topic}, 2-3 sentences with sub-prompts.)</p>

<h2>2️⃣ Past Experience (경험)</h2>
<p style="line-height:1.7;font-size:14px;color:#1a0dab"><strong>Q.</strong> (Natural OPIc-style past experience question about ${topic}, 2-3 sentences asking for a specific memorable story.)</p>

<h2>3️⃣ Opinion / Issue (의견)</h2>
<p style="line-height:1.7;font-size:14px;color:#1a0dab"><strong>Q.</strong> (Natural OPIc-style opinion/comparison/issue question about ${topic}, 2-3 sentences.)</p>

<hr style="margin:20px 0;border:none;border-top:1px dashed #cbd5e1" />

<h2>⭐ Model Answers (AL Level)</h2>

<h3 style="color:#0369a1">Model Answer 1 — Description</h3>
<p style="line-height:1.75;font-size:14px;background:#f8fafc;padding:12px;border-radius:4px">(8-14 sentence AL-level model answer for Q1. Rich, specific, natural spoken English.)</p>

<h3 style="color:#0369a1">Model Answer 2 — Past Experience</h3>
<p style="line-height:1.75;font-size:14px;background:#f8fafc;padding:12px;border-radius:4px">(8-14 sentence AL-level model answer for Q2. Specific past story with beginning-middle-end.)</p>

<h3 style="color:#0369a1">Model Answer 3 — Opinion</h3>
<p style="line-height:1.75;font-size:14px;background:#f8fafc;padding:12px;border-radius:4px">(8-14 sentence AL-level model answer for Q3. Clear opinion + reasoning + concrete example.)</p>

Remember: ALL 3 questions AND all 3 model answers must be about "${topic}" — nothing else.`;

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

    return new Response(JSON.stringify({ html: content, topic }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-opic error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
