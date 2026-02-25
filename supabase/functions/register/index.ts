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

    const { email, password, name, role } = await req.json();

    if (!email || !password || !name || !role) {
      throw new Error("email, password, name, role are required");
    }
    if (!["student", "instructor"].includes(role)) {
      throw new Error("role must be student or instructor");
    }
    if (password.length < 8) {
      throw new Error("비밀번호는 8자 이상이어야 합니다.");
    }

    // 1. Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) throw createError;
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
      throw roleError;
    }

    // 3. If student, create student_profiles
    if (role === "student") {
      const { error: profileError } = await adminClient.from("student_profiles").insert({
        user_id: userId,
        student_name: name,
        nickname: name,
      });
      if (profileError) {
        await adminClient.auth.admin.deleteUser(userId);
        throw profileError;
      }
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
