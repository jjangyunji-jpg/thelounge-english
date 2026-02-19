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

  const { email, role } = await req.json();

  // 1. Invite user by email (sends invite link)
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = data.user.id;

  // 2. Assign role in user_roles
  const { error: roleError } = await adminClient.from("user_roles").insert({
    user_id: userId,
    role: role ?? "admin",
  });

  if (roleError) {
    return new Response(JSON.stringify({ error: roleError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, userId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
