import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { email, studentName } = await req.json();

  if (!email || !studentName) {
    return new Response(JSON.stringify({ error: "email과 studentName이 필요합니다." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 초대 이메일 발송 (student_name을 user_metadata에 포함)
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { student_name: studentName, role: "student" },
    redirectTo: "https://thelounge-english.lovable.app/student-setup",
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, userId: data.user.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
