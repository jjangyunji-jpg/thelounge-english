import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Delete cached TTS mp3s older than 180 days (6 months).
// Runs via pg_cron monthly. Safe: cache is regenerated on demand.
const MAX_AGE_DAYS = 180;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    // List all cached files (paginated)
    const toDelete: string[] = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase.storage
        .from("homework-tts")
        .list("descriptions", {
          limit: pageSize,
          offset,
          sortBy: { column: "created_at", order: "asc" },
        });
      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const obj of data) {
        const created = obj.created_at ? new Date(obj.created_at).getTime() : 0;
        if (created && created < cutoff) {
          toDelete.push(`descriptions/${obj.name}`);
        }
      }

      if (data.length < pageSize) break;
      offset += pageSize;
    }

    let deleted = 0;
    if (toDelete.length > 0) {
      // Remove in batches of 100
      for (let i = 0; i < toDelete.length; i += 100) {
        const batch = toDelete.slice(i, i + 100);
        const { error: rmError } = await supabase.storage
          .from("homework-tts")
          .remove(batch);
        if (rmError) {
          console.error("Remove batch error:", rmError);
          continue;
        }
        deleted += batch.length;
      }
    }

    console.log(
      `cleanup-homework-tts: scanned older than ${MAX_AGE_DAYS}d, deleted ${deleted} files`
    );

    return new Response(
      JSON.stringify({ success: true, deleted, max_age_days: MAX_AGE_DAYS }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("cleanup-homework-tts error:", error);
    return new Response(
      JSON.stringify({ error: "정리 작업 중 오류가 발생했습니다." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
