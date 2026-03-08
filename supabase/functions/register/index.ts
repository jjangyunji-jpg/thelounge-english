import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { email, password, name, role, phone, desiredLevel, preferredSchedule, note } = await req.json();

    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ error: "이메일, 비밀번호, 이름, 역할을 입력해주세요." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["student", "instructor"].includes(role)) {
      return new Response(JSON.stringify({ error: "올바른 역할을 선택해주세요." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "비밀번호는 8자 이상이어야 합니다." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) {
      console.error("User creation error:", createError);
      const msg = (createError as any)?.code === "email_exists"
        ? "이미 등록된 이메일입니다. 다른 이메일을 사용해주세요."
        : "계정 생성에 실패했습니다. 다시 시도해주세요.";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = newUser.user.id;

    // 2. Insert role (approved = false, admin must approve)
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: userId,
      role,
      approved: false,
      display_name: name,
    });
    if (roleError) {
      await adminClient.auth.admin.deleteUser(userId);
      console.error("Role insert error:", roleError);
      return new Response(JSON.stringify({ error: "계정 생성에 실패했습니다. 다시 시도해주세요." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. If student, create student_profiles + waitlist entry
    if (role === "student") {
      const { error: profileError } = await adminClient.from("student_profiles").insert({
        user_id: userId,
        student_name: name,
        nickname: name,
      });
      if (profileError) {
        await adminClient.auth.admin.deleteUser(userId);
        console.error("Profile insert error:", profileError);
        return new Response(JSON.stringify({ error: "계정 생성에 실패했습니다. 다시 시도해주세요." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create waitlist entry
      const { error: waitlistError } = await adminClient.from("waitlist_entries").insert({
        user_id: userId,
        student_name: name,
        phone: phone || null,
        desired_level: desiredLevel || null,
        preferred_schedule: preferredSchedule || null,
        note: note || null,
      });
      if (waitlistError) {
        console.error("Waitlist insert error:", waitlistError);
        // Non-fatal — don't delete user for waitlist failure
      }
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Register error:", err);
    return new Response(JSON.stringify({ error: "요청을 처리할 수 없습니다. 나중에 다시 시도해주세요." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
