// Generate A1-style level test questions via Lovable AI Gateway (Tool Calling)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { level = "A1", count = 30, focus = "" } = await req.json().catch(() => ({}));
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    const tenseInstruction =
      level === "A1"
        ? `반드시 다음 6개 시제를 균형 있게 다루세요(각 카테고리 최소 4문제 이상): "현재형", "현재진행형", "미래형", "과거형", "현재완료(경험)", "현재완료(계속)".`
        : "";

    const systemPrompt = `당신은 한국인 영어 학습자를 위한 ${level} 레벨 평가 문제를 만드는 출제 전문가입니다.
${tenseInstruction}

규칙:
- 문법 용어를 묻지 말고, 실제 일상/업무 상황에서 자연스럽게 영어를 작문·선택하는지 평가하세요.
- 각 문제는 한국어 상황 설명(또는 한국어 문장) + 자연스러운 영어 4지선다 형태입니다.
- 보기 4개 중 정답은 1개. 오답은 한국 학습자가 흔히 하는 실수(시제 혼동, 어순, 관용 표현 오용)로 만드세요.
- 답안은 단순 단어 빈칸이 아니라 가급적 짧은 문장 단위(완전한 영어 문장)로 만드세요.
- 해설(explanation)은 한국어로 1~2문장, 왜 그 시제·표현이 자연스러운지 간단히.
- 카테고리(category)는 정확히 위 6개 중 하나를 한국어로 적으세요.

추가 출제 지시: ${focus || "없음"}`;

    const tools = [{
      type: "function",
      function: {
        name: "submit_questions",
        description: "Submit the generated multiple-choice questions",
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  question: { type: "string", description: "한국어 상황 설명 또는 빈칸 문제" },
                  choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                  correct_index: { type: "integer", minimum: 0, maximum: 3 },
                  explanation: { type: "string" },
                },
                required: ["category", "question", "choices", "correct_index", "explanation"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    }];

    // Generate in small batches to avoid Gemini truncating tool-call output
    const BATCH = 10;
    const MAX_ATTEMPTS = 8;
    const allQuestions: any[] = [];
    let attempts = 0;
    while (allQuestions.length < count && attempts < MAX_ATTEMPTS) {
      attempts++;
      const remaining = count - allQuestions.length;
      const askFor = Math.min(BATCH, remaining);
      const userPrompt = `${level} 레벨 ${askFor}문제를 만들어주세요. (이번 배치: ${askFor}문제)`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "submit_questions" } },
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.error(`AI gateway batch ${attempts} failed:`, resp.status, txt);
        if (resp.status === 429 || resp.status >= 500) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        throw new Error(`AI gateway ${resp.status}: ${txt}`);
      }
      const data = await resp.json();
      const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        console.warn(`Batch ${attempts}: no tool call returned`);
        continue;
      }
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const batch = Array.isArray(args.questions) ? args.questions : [];
        allQuestions.push(...batch);
      } catch (e) {
        console.warn(`Batch ${attempts}: invalid JSON`, e);
      }
    }

    const questions = allQuestions.slice(0, count);

    return new Response(JSON.stringify({ questions, generated: questions.length, requested: count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-level-test error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
