// Student help chatbot — answers questions about how to use the program.
// Uses Lovable AI Gateway. Non-streaming JSON response for simplicity.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `당신은 영어 학원 "더 라운지(The Lounge)" 학생용 프로그램의 친절한 도우미입니다.
학생들이 프로그램 사용 중 겪는 어려움이나 궁금한 점을 한국어로 간결하고 정확하게 안내해 주세요.

[프로그램 주요 기능]
- 대시보드: 다가오는 수업, 숙제, 단어시험 현황을 한눈에 확인
- 수업노트(클래스룸): 수업 시작 시 강사가 작성한 노트 열람 및 실시간 수업 진행
- 숙제: 강사가 내준 숙제 확인, 텍스트/오디오/파일 제출, AI 자동 첨삭 받기
- 단어시험: 수업 중 추출된 표현/단어 복습 및 시험
- 예약/보강 신청: 일정 변경이나 보강을 강사에게 요청 (월 1회 긴급 보강 가능)
- 수업 취소: 본인 수업 직접 취소 (시작 전, 48시간 기준 정책 다름)
- 결제확인: 수강료 결제 및 현금영수증 정보 입력
- 강사 평가: 월별 만족도 및 코멘트 제출
- MY 페이지: 본인 정보 및 비밀번호 변경
- 프로그램 이용 안내 PDF: 우측 상단 메뉴에서 열람 가능

[안내 원칙]
1. 답변은 3-5문장 이내로 짧게, 단계별 안내가 필요하면 번호 목록 사용
2. 화면 위치를 구체적으로 알려주기 (예: "우측 상단의 '제안' 버튼")
3. 학생이 직접 해결할 수 없는 문제(결제 오류, 강사 변경, 환불 등)는 "신고하기 버튼으로 운영진에게 전달해 주세요"라고 안내
4. 모르는 내용이나 시스템 오류로 보이는 경우 추측하지 말고 "신고하기 버튼으로 문의해 주세요"라고 안내
5. 친근하지만 존댓말 유지, 이모지 과용 금지`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-10),
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "잠시 후 다시 시도해 주세요. (요청 한도 초과)" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "AI 사용량이 소진되었습니다. 운영진에 문의해 주세요." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error", res.status, errText);
      return new Response(JSON.stringify({ error: "AI 응답을 가져올 수 없습니다." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
