import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const BASE = `${SUPABASE_URL}/functions/v1/handle-makeup-request`;

Deno.test("handle-makeup-request - rejects unauthenticated request", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action: "approve", request_id: "nonexistent" }),
  });
  const json = await res.json();
  assertEquals(res.status, 401);
  assertExists(json.error);
});

Deno.test("handle-makeup-request - rejects request without Bearer token format", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "InvalidTokenFormat",
    },
    body: JSON.stringify({ action: "approve", request_id: "nonexistent" }),
  });
  const json = await res.json();
  assertEquals(res.status, 401);
  assertExists(json.error);
});

Deno.test("handle-makeup-request - rejects request with invalid Bearer token", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer invalid-jwt-token",
    },
    body: JSON.stringify({ action: "approve", request_id: "nonexistent" }),
  });
  const json = await res.json();
  // Should fail at auth or role check
  assertEquals(res.status >= 400, true);
  assertExists(json.error);
});

Deno.test("handle-makeup-request - handles CORS preflight", async () => {
  const res = await fetch(BASE, {
    method: "OPTIONS",
    headers: { "apikey": SUPABASE_ANON_KEY },
  });
  await res.text();
  assertEquals(res.status, 200);
});
