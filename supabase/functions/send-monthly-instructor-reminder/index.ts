import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // KST 기준 현재 월/다음 월 계산
    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const currentMonth = kstNow.getUTCMonth() + 1; // 1-12
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

    const subject = "월말 업무를 마무리해주세요.";
    const body = `이번 수업 기간이 종료되기에 앞서 다음의 업무를 마무리하고
대표 강사에게 업무 종료를 보고해주세요. 

1. 학생별 설문조사 작성 
2. 학생별 목표 일괄 생성

이번 ${currentMonth}월도 수고 많으셨습니다. 
다음 ${nextMonth}월도 수업 잘 부탁드립니다.`;

    // 중복 발송 방지: 이번 달에 이미 발송된 경우 스킵
    const monthStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1));
    const { data: existing } = await supabase
      .from("admin_notifications")
      .select("id")
      .eq("subject", subject)
      .eq("target", "instructors")
      .gte("sent_at", monthStart.toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Already sent this month" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const { error } = await supabase.from("admin_notifications").insert({
      target: "instructors",
      subject,
      body,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, month: currentMonth }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
