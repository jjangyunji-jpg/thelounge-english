import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { student_name, instructor_name, period_id, period_label, period_start, period_end, save = true } =
      await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch sessions for this period
    const { data: sessions } = await sb
      .from("class_sessions")
      .select("scheduled_at, topic, notes, level")
      .eq("student_name", student_name)
      .eq("instructor_name", instructor_name)
      .gte("scheduled_at", period_start + "T00:00:00+09:00")
      .lte("scheduled_at", period_end + "T23:59:59+09:00")
      .order("scheduled_at", { ascending: true });

    // Fetch student info
    const { data: studentInfo } = await sb
      .from("instructor_students")
      .select("level, learning_objective, english_name")
      .eq("student_name", student_name)
      .eq("instructor_name", instructor_name)
      .maybeSingle();

    const sessionSummary = (sessions || [])
      .map((s, i) => `${i + 1}회 (${new Date(s.scheduled_at).toLocaleDateString("ko-KR")}): 주제 - ${s.topic || "미정"}`)
      .join("\n");

    const level = studentInfo?.level || "B1";
    const objective = studentInfo?.learning_objective || "일반 영어 회화";
    const englishName = studentInfo?.english_name || "";
    const displayName = englishName ? `${student_name} (${englishName})` : student_name;

    const systemPrompt = `당신은 영어 학원의 강사입니다. 학생에게 전달할 월간 학습 리포트를 작성합니다.
리포트는 학생이 직접 읽는 것이므로 따뜻하고 격려하는 어조로 작성해주세요.

리포트 구성:
1. 인사 및 이번 달 수업 개요 (1-2문장)
2. 이번 달 학습한 주요 내용 요약 (2-3문장)
3. 학생의 성과와 발전된 점 칭찬 (2-3문장, 구체적으로)
4. 다음 달 수업 방향과 목표 안내 (2-3문장)
5. 마무리 격려 (1문장)

전체 길이는 약 200-300자 내외로 간결하게 작성하세요. 한국어로 작성하세요.`;

    const userPrompt = `학생: ${displayName}
레벨: ${level}
학습 목표: ${objective}
기간: ${period_label}
총 수업 횟수: ${(sessions || []).length}회

이번 달 수업 내용:
${sessionSummary || "수업 기록 없음"}

위 내용을 바탕으로 학생에게 전달할 월간 학습 리포트를 작성해주세요.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
          tools: [
            {
              type: "function",
              function: {
                name: "return_report",
                description: "Return the student report",
                parameters: {
                  type: "object",
                  properties: {
                    report: {
                      type: "string",
                      description: "The monthly student report in Korean",
                    },
                  },
                  required: ["report"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_report" },
          },
        }),
      }
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = JSON.parse(toolCall?.function?.arguments || "{}");
    const report = args.report || "";

    // Save to student_reports table
    const { error: upsertError } = await sb
      .from("student_reports")
      .upsert(
        {
          instructor_name,
          student_name,
          period_id,
          period_label,
          content: report,
          is_read: false,
        },
        { onConflict: "instructor_name,student_name,period_id" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      throw new Error(upsertError.message);
    }

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-student-report error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
