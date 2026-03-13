import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const BASE = `${SUPABASE_URL}/functions/v1/generate-sessions`;

Deno.test("generate-sessions - rejects unauthenticated request", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ period_id: "nonexistent" }),
  });
  const json = await res.json();
  assertEquals(res.status, 401);
  assertExists(json.error);
});

Deno.test("generate-sessions - handles CORS preflight", async () => {
  const res = await fetch(BASE, {
    method: "OPTIONS",
    headers: { "apikey": SUPABASE_ANON_KEY },
  });
  await res.text();
  assertEquals(res.status, 200);
});
