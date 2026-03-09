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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const { student_name, level, current_objective, comment, period_label, instructor_name, session_count, current_session_topics } = body;

    // Support both old (checked/unchecked) and new (ratings) format
    let evaluationText: string;
    if (body.ratings && Array.isArray(body.ratings)) {
      evaluationText = body.ratings
        .map((r: { label: string; score: number }) => `${r.label}: ${"★".repeat(r.score)}${"☆".repeat(5 - r.score)} (${r.score}/5)`)
        .join("\n");
    } else {
      const { checked = [], unchecked = [] } = body;
      evaluationText = `✅ 달성: ${checked.length > 0 ? checked.join(", ") : "없음"}\n❌ 미달성: ${unchecked.length > 0 ? unchecked.join(", ") : "없음"}`;
    }

    // Fetch curriculum guide for this level
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let curriculumGuideText = "";
    const { data: guideData } = await serviceClient
      .from("curriculum_guides")
      .select("content")
      .eq("level", level || "B1")
      .single();
    if (guideData?.content?.trim()) {
      curriculumGuideText = `\n\n[${level} 커리큘럼 가이드]\n${guideData.content.trim()}`;
    }

    // Fetch teaching materials grouped by category for context
    let materialsText = "";
    const { data: materials } = await serviceClient
      .from("teaching_materials")
      .select("title, category, sort_order")
      .eq("is_active", true)
      .order("sort_order");

    let catMap: Record<string, string> = {};
    let grouped: Record<string, string[]> = {};

    if (materials && materials.length > 0) {
      const { data: categories } = await serviceClient
        .from("teaching_material_categories")
        .select("slug, name")
        .order("sort_order");

      (categories || []).forEach((c: any) => { catMap[c.slug] = c.name; });

      materials.forEach((m: any) => {
        if (!grouped[m.category]) grouped[m.category] = [];
        grouped[m.category].push(m.title);
      });
    }

    // Fetch recent session topics (last ~20 sessions) for context
    let sessionHistoryText = "";
    if (student_name && instructor_name) {
      const { data: sessions } = await serviceClient
        .from("class_sessions")
        .select("scheduled_at, topic, notes")
        .eq("student_name", student_name)
        .eq("instructor_name", instructor_name)
        .not("ended_at", "is", null)
        .order("scheduled_at", { ascending: false })
        .limit(20);

      if (sessions && sessions.length > 0) {
        const history = sessions.reverse().map((s: any) => {
          const date = new Date(s.scheduled_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
          return `- ${date}: ${s.topic || "주제 없음"}`;
        }).join("\n");
        sessionHistoryText = `\n\n[최근 수업 히스토리 (최근 ${sessions.length}회)]\n${history}`;
      }
    }

    // Build materialsText with progress markers by cross-referencing session history
    if (Object.keys(grouped).length > 0) {
      // Collect all covered topics from session history + current period
      const coveredTopics: string[] = [];
      if (student_name && instructor_name) {
        const { data: allSessions } = await serviceClient
          .from("class_sessions")
          .select("topic")
          .eq("student_name", student_name)
          .eq("instructor_name", instructor_name)
          .not("topic", "is", null);
        (allSessions || []).forEach((s: any) => {
          if (s.topic) coveredTopics.push(s.topic.toLowerCase().trim());
        });
      }
      if (current_session_topics && Array.isArray(current_session_topics)) {
        current_session_topics.forEach((t: string) => {
          if (t) coveredTopics.push(t.toLowerCase().trim());
        });
      }

      materialsText = "\n\n[수업 자료 진행 현황]\n" +
        Object.entries(grouped).map(([cat, titles]) => {
          let lastCoveredIdx = -1;
          const annotated = titles.map((t, i) => {
            const titleLower = t.toLowerCase().trim();
            const isCovered = coveredTopics.some(ct =>
              ct.includes(titleLower) || titleLower.includes(ct.split("/")[0].trim()) || ct.split("/")[0].trim().includes(titleLower)
            );
            if (isCovered) lastCoveredIdx = i;
            return `${i + 1}. ${isCovered ? "✅ " : ""}${t}`;
          });

          const nextIdx = lastCoveredIdx + 1;
          const nextMaterials = titles.slice(nextIdx, nextIdx + 6);

          return `[${catMap[cat] || cat}] (${lastCoveredIdx + 1}/${titles.length} 완료)\n${annotated.join("\n")}${
            nextMaterials.length > 0 ? `\n→ 다음 자료: ${nextMaterials.join(", ")}` : "\n→ 모든 자료 완료"
          }`;
        }).join("\n\n");
    }

    const topicCount = session_count || 4;

    const systemPrompt = `You are an English class curriculum advisor for Korean learners.
Based on the instructor's feedback about a student, suggest:
1. Learning goals for the next month (장기 학습 목표)
2. Per-session topic plan for the next period (exactly ${topicCount} topics)

RULES:
- Write in Korean (한국어)
- 2~4 concise learning goals, each on a new line
- Generate exactly ${topicCount} session topics for the next period
- CRITICAL: Session topics MUST use actual material titles from the [사용 가능한 수업 자료] list when available
- Match session history to the material list to determine where the student left off, then continue from the next material in sequence
- Each session topic format: "자료제목" or "자료제목 / 부가활동" (e.g. "현재형 2 / 빈도부사", "The Good Place 4-6")
- Consider the star ratings (1-5) for each evaluation category
- Lower scores indicate areas needing more attention
- Consider the instructor's comment
- Consider the student's current level and existing objectives
- If a curriculum guide is provided, align goals and topics with the curriculum roadmap
- If session history is provided, identify where the student stopped in the material sequence and continue from there
- Session topics should build progressively following the material order
- Be specific and actionable
- Each goal should be a short phrase (15-30 characters)

Return ONLY a valid JSON object:
{
  "goals": "목표1\\n목표2\\n목표3",
  "session_topics": ["1회차 주제", "2회차 주제", ...]
}`;

    let currentTopicsText = "";
    if (current_session_topics && Array.isArray(current_session_topics) && current_session_topics.length > 0) {
      currentTopicsText = `\n\n이번 기간 수업 주제:\n${current_session_topics.map((t: string, i: number) => `${i + 1}회: ${t || "(주제 없음)"}`).join("\n")}`;
    }

    const userPrompt = `학생: ${student_name}
레벨: ${level}
기간: ${period_label}
현재 학습 목표: ${current_objective || "없음"}
다음 기간 세션 수: ${topicCount}

강사 평가:
${evaluationText}
${comment ? `코멘트: ${comment}` : ""}${curriculumGuideText}${materialsText}${sessionHistoryText}${currentTopicsText}`;

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

    const result = JSON.parse(jsonMatch[0]) as { goals?: string; session_topics?: string[] };

    return new Response(JSON.stringify({ goals: result.goals ?? "", session_topics: result.session_topics ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in suggest-student-goals:", error);
    return new Response(
      JSON.stringify({ error: "요청을 처리할 수 없습니다. 나중에 다시 시도해주세요." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
