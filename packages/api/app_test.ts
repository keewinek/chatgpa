import { assertEquals } from "@std/assert";
import { createApp } from "./app.ts";

Deno.test("GET /api/health returns ok", async () => {
  const app = createApp();
  const res = await app.request("/api/health");
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { status: "ok" });
});

Deno.test("GET /api/ai/models returns cascade list", async () => {
  const app = createApp();
  const res = await app.request("/api/ai/models");
  assertEquals(res.status, 200);
  const body = await res.json() as { models: unknown[] };
  assertEquals(Array.isArray(body.models), true);
  assertEquals(body.models.length > 0, true);
});

Deno.test("POST /api/chat validates body", async () => {
  const app = createApp();
  const res = await app.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });
  assertEquals(res.status, 400);
});

Deno.test("POST /api/chat without keys returns 503", async () => {
  // Ensure no keys leak from the developer env into this unit test.
  const keys = ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"] as const;
  const backup = Object.fromEntries(keys.map((k) => [k, Deno.env.get(k)]));
  for (const k of keys) Deno.env.delete(k);

  try {
    const app = createApp();
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Cześć" }],
      }),
    });
    assertEquals(res.status, 503);
    const body = await res.json() as { error: string };
    assertEquals(typeof body.error, "string");
  } finally {
    for (const k of keys) {
      const v = backup[k];
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
});
