import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const BASE = `${SUPABASE_URL}/functions/v1/register`;

Deno.test("register - rejects missing fields", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email: "test@test.com" }),
  });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertExists(json.error);
});

Deno.test("register - rejects invalid role", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email: "test@test.com",
      password: "password123",
      name: "테스트",
      role: "admin",
    }),
  });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertExists(json.error);
});

Deno.test("register - rejects short password", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email: "test@test.com",
      password: "short",
      name: "테스트",
      role: "student",
    }),
  });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertExists(json.error);
});

Deno.test("register - handles CORS preflight", async () => {
  const res = await fetch(BASE, {
    method: "OPTIONS",
    headers: { "apikey": SUPABASE_ANON_KEY },
  });
  await res.text();
  assertEquals(res.status, 200);
});
