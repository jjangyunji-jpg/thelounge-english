import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ElevenLabs voice ID — Rachel (clear, natural)
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ELEVENLABS_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const { word, wordId } = await req.json();
    if (!word || !wordId) {
      return new Response(JSON.stringify({ error: "word and wordId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Check cache: does this word already have an audio_url?
    const { data: existing } = await supabase
      .from("vocabulary_words")
      .select("audio_url")
      .eq("id", wordId)
      .single();

    if (existing?.audio_url) {
      return new Response(JSON.stringify({ audio_url: existing.audio_url, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Generate TTS via ElevenLabs
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: word,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      throw new Error(`ElevenLabs TTS error [${ttsRes.status}]: ${err}`);
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const filePath = `words/${wordId}.mp3`;

    // 3) Upload to vocab-audio bucket
    const { error: uploadError } = await supabase.storage
      .from("vocab-audio")
      .upload(filePath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) throw new Error(`Storage upload error: ${uploadError.message}`);

    const { data: urlData } = supabase.storage
      .from("vocab-audio")
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // 4) Update vocabulary_words record with cached URL
    await supabase
      .from("vocabulary_words")
      .update({ audio_url: publicUrl })
      .eq("id", wordId);

    return new Response(JSON.stringify({ audio_url: publicUrl, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("TTS cache error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
