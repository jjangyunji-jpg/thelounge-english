import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Admin client with service role key
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the calling user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Admin access required");

    const body = await req.json();
    const { name, email, password, phone, lessonRate, meetingRate } = body;

    if (!name || !email || !password) {
      throw new Error("name, email, password are required");
    }

    // 1. Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) throw createError;
    const newUserId = newUser.user.id;

    // 2. Insert into instructors table
    const { data: instructor, error: insError } = await adminClient
      .from("instructors")
      .insert({
        name,
        email,
        phone: phone || null,
        lesson_rate: lessonRate || 30000,
        meeting_rate: meetingRate || 20000,
        user_id: newUserId,
        active: true,
      })
      .select()
      .single();

    if (insError) {
      // Rollback: delete the created auth user
      await adminClient.auth.admin.deleteUser(newUserId);
      throw insError;
    }

    // 3. Assign instructor role
    await adminClient.from("user_roles").insert({
      user_id: newUserId,
      role: "instructor",
    });

    return new Response(JSON.stringify({ success: true, instructor }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Create instructor error:", err);
    return new Response(JSON.stringify({ error: "강사 계정 생성에 실패했습니다." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
