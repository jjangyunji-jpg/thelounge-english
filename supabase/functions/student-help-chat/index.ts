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
  · **읽기/외우기 숙제 듣기 기능**: 읽기 또는 외우기 유형 숙제 모달을 열면, 헤더의 닫기(X) 버튼 옆에 🔊 **듣기 버튼**이 있습니다. 클릭하면 브라우저 음성합성(TTS)으로 지문을 읽어줍니다. (별도 음원 파일이 아니라 브라우저 내장 TTS 기반)
  · 쓰기/말하기 등 다른 유형 숙제에는 듣기 버튼이 없습니다.
- 단어시험: 수업 중 추출된 표현/단어 복습 및 시험 (음성 테스트 포함)
- 예약/보강 신청: 일정 변경이나 보강을 강사에게 요청 (월 1회 긴급 보강 가능)
- 수업 취소: 본인 수업 직접 취소 (시작 전, 48시간 기준 정책 다름)
- 수업료 결제하기: 수강료 결제 안내 및 현금영수증 정보 입력 (결제 방법은 **계좌이체 1가지** — 카드결제/현금 직접 결제 기능 없음. 계좌번호가 화면에 표시되며 복사 가능. 현금영수증은 1회성 또는 매달 자동 발급으로 신청 가능)
- 강사 평가: 월별 만족도 및 코멘트 제출
- MY 페이지: 본인 정보 및 비밀번호 변경
- 프로그램 이용 안내 PDF: 우측 상단 메뉴에서 열람 가능

[안내 원칙]
1. 답변은 3-5문장 이내로 짧게, 단계별 안내가 필요하면 번호 목록 사용
2. 화면 위치를 구체적으로 알려주기 (예: "우측 상단의 '제안' 버튼")
3. 학생이 직접 해결할 수 없는 문제(결제 오류, 강사 변경, 환불 등)는 "신고하기 버튼으로 운영진에게 전달해 주세요"라고 안내
4. **절대 추측 금지(반-할루시네이션 규칙)**: 위 [프로그램 주요 기능]에 명시되지 않은 기능에 대해서는 "있다/없다"를 단정하지 말 것. 학생이 어떤 기능을 찾는다고 하면, 위 목록에 해당 기능이 있으면 정확한 위치를 안내하고, 위 목록에 없으면 "제가 정확히 안내드리기 어려운 부분이라, 화면 우측 하단 '신고하기' 버튼으로 문의해 주시면 운영진이 빠르게 확인해 드릴게요"라고 답할 것. "기능이 없습니다"라고 단정하지 말 것.
5. 친근하지만 존댓말 유지, 이모지 과용 금지

[고정 답변 — 아래 주제에 대한 질문에는 반드시 다음 문구를 그대로(번호/줄바꿈 포함) 출력하세요]

▶ 보강 신청 방법 관련 질문:
보강 신청 방법에 대해 안내해 드릴게요!

1. 좌측 메뉴에서 '예약/보강 신청'을 클릭해 주세요.
2. 프로그램을 통해 강사님께 보강 일정을 요청할 수 있습니다.
3. 보강은 강사 일정이 우선되므로, 맞는 일정이 없는 경우 수업횟수에서 차감됩니다.
4. 병가/직계가족 질병 및 사고/갑작스러운 야근 등은 월 1회 긴급 보강이 가능합니다.

▶ 단어시험 보는 방법 관련 질문:
단어시험은 다음과 같이 보실 수 있습니다! 😊

1. 대시보드의 숙제에서 '테스트하기'를 클릭하거나 '전체 단어장 & 테스트'를 클릭해 주세요.
2. 수업 중 추출된 표현이나 단어들을 복습하고 시험을 볼 수 있습니다.
3. 꾸준히 복습하여 어휘 실력을 향상시켜 보세요!

▶ 결제 / 현금영수증 / 현금 결제 / 카드 결제 관련 질문:
결제 및 현금영수증 정보는 '수업료 결제하기' 메뉴에서 확인하고 입력하실 수 있습니다! 😊

1. 대시보드에서 '수업료 결제하기'를 클릭해 주세요.
2. 결제는 화면에 표시된 **계좌로 이체**하는 방식으로 진행됩니다. (카드 결제나 현금 직접 결제 기능은 제공하지 않습니다)
3. 같은 화면에서 **현금영수증 발급 정보**를 입력하실 수 있으며, 1회성 또는 매달 자동 발급으로 신청 가능합니다.
4. 결제 관련 문제가 있으시면 '신고하기' 버튼으로 운영진에 문의해 주세요.`;

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
