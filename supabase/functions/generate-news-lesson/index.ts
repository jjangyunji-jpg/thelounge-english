import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchArticleFromUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);
    const html = await res.text();
    // Strip tags to get plain text
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    // Truncate
    if (text.length > 30000) text = text.slice(0, 30000) + "\n[truncated]";
    return text;
  } catch (e) {
    throw new Error(`URL에서 기사를 가져올 수 없습니다: ${e instanceof Error ? e.message : "Unknown"}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { articleText, articleUrl, level, duration } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let article = articleText || "";
    if (!article && articleUrl) {
      article = await fetchArticleFromUrl(articleUrl);
    }
    if (!article.trim()) {
      return new Response(JSON.stringify({ error: "기사 내용 또는 URL을 입력해주세요." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert ESL/EFL lesson material creator specializing in news-based English lessons for Korean adult learners.

You will receive a news article and create structured lesson materials in HTML format.

IMPORTANT RULES:
- The vocabulary table must contain exactly 15 essential words/phrases from the article
- Words should be ordered by relevance to the article, NOT by difficulty
- Include practical, high-frequency words that students need to understand the article
- Meaning (English) should be simple definitions appropriate for ${level || "B1"} level learners
- 한국어 뜻 should be natural Korean translations
- The summary section for students must be BLANK (students summarize themselves)
- Keywords should capture the main concepts and discussion themes of the article
- Guided Questions should provoke critical thinking and discussion`;

    const userPrompt = `Based on the following news article, create lesson materials.

Student Level (CEFR): ${level || "B1"}
Lesson Duration: ${duration || "40"} min

Article:
${article}

Generate the output in this EXACT HTML format:

<div style="border-left:4px solid #3b5998;padding:12px 16px;background:#f0f4ff;margin-bottom:16px;border-radius:4px">
<p style="margin:0;font-weight:bold;font-size:14px">[Article Title] / ${duration || "40"} min</p>
</div>

<details style="margin-bottom:20px;border:1px solid #ddd;border-radius:6px;padding:12px">
<summary style="cursor:pointer;font-weight:bold;color:#666">📋 Teacher's Summary (click to expand)</summary>
<div style="margin-top:8px;padding:8px;background:#fafafa;border-radius:4px;font-size:13px;line-height:1.7">
(Write a clear, comprehensive English summary of the article in 5-7 sentences. This is for the instructor's reference only.)
</div>
</details>

<h2>📚 Vocabulary</h2>
<table>
<thead><tr><th>No.</th><th>Vocabulary</th><th>Meaning (English)</th><th>한국어 뜻</th></tr></thead>
<tbody>
<tr><td>1</td><td><strong>word</strong></td><td>simple English definition</td><td>한국어</td></tr>
...15 rows total...
</tbody>
</table>

<h2>📝 Summarize the article (5 sentences)</h2>
<div style="border:2px dashed #ccc;padding:20px;border-radius:8px;min-height:80px;color:#999;font-style:italic">
Student's own summary goes here...
</div>

<h2>🔑 Keywords</h2>
<ul>
<li><strong>Keyword/concept 1</strong></li>
<li><strong>Keyword/concept 2</strong></li>
...5-7 keywords...
</ul>

<h2>💬 Guided Questions (optional)</h2>
<ol>
<li style="color:#1a0dab">Question 1?</li>
<li style="color:#1a0dab">Question 2?</li>
<li style="color:#1a0dab">Question 3?</li>
<li style="color:#1a0dab">Question 4?</li>
</ol>

Use the actual article title. Make everything educational and appropriate for ${level || "B1"} level Korean adult learners.`;

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
    console.error("generate-news-lesson error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
