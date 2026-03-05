import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SessionData {
  date: string;
  topic: string | null;
  notes: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { sessions, learningObjective, type } = await req.json() as {
      sessions: SessionData[];
      learningObjective: string;
      type: "summaries" | "remarks";
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userPrompt: string;

    if (type === "summaries") {
      systemPrompt =
        "당신은 영어 수업 보고서를 작성하는 전문가입니다. 각 수업의 노트를 기반으로 그날 어떻게 수업을 진행했는지 한국어로 2~3문장으로 서술해주세요. 글 형식으로 자연스럽게 작성하세요.";
      const sessionsText = sessions
        .map(
          (s, i) =>
            `수업 ${i + 1} (${s.date}):\n주제: ${s.topic || "없음"}\n노트: ${s.notes || "없음"}`
        )
        .join("\n\n");
      userPrompt = `다음 영어 수업들의 내용을 각각 한국어로 2~3문장의 글 형식으로 요약해주세요. 수업에서 어떤 활동을 하고 무엇을 학습했는지 서술해주세요.\n\n${sessionsText}`;

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
                  name: "return_summaries",
                  description: "Return summaries for each session",
                  parameters: {
                    type: "object",
                    properties: {
                      summaries: {
                        type: "array",
                        items: { type: "string" },
                        description:
                          "Array of Korean summaries, one per session in order",
                      },
                    },
                    required: ["summaries"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "return_summaries" },
            },
          }),
        }
      );

      if (!response.ok) {
        const t = await response.text();
        console.error("AI error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      const args = JSON.parse(toolCall?.function?.arguments || "{}");

      return new Response(JSON.stringify({ summaries: args.summaries || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // type === "remarks"
      systemPrompt =
        "당신은 영어 강사입니다. 수업 보고서의 비고란을 격식있게 작성해주세요. 첫 수업과 마지막 수업 내용을 비교하여 학생의 발전 사항을 언급하고, 다음 달 수업 방향과 목표를 제안해주세요. 3~5문장으로 작성하세요.";

      const firstSession = sessions[0];
      const lastSession = sessions[sessions.length - 1];

      userPrompt = `학습 목표: ${learningObjective || "일반 영어 회화"}\n\n첫 수업 (${firstSession?.date}):\n주제: ${firstSession?.topic || "없음"}\n내용: ${firstSession?.notes || "없음"}\n\n마지막 수업 (${lastSession?.date}):\n주제: ${lastSession?.topic || "없음"}\n내용: ${lastSession?.notes || "없음"}\n\n위 내용을 바탕으로 비고란을 작성해주세요.`;

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
                  name: "return_remarks",
                  description: "Return the remarks text",
                  parameters: {
                    type: "object",
                    properties: {
                      remarks: {
                        type: "string",
                        description: "The remarks text in Korean",
                      },
                    },
                    required: ["remarks"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "return_remarks" },
            },
          }),
        }
      );

      if (!response.ok) {
        const t = await response.text();
        console.error("AI error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      const args = JSON.parse(toolCall?.function?.arguments || "{}");

      return new Response(JSON.stringify({ remarks: args.remarks || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("summarize-report error:", e);
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
