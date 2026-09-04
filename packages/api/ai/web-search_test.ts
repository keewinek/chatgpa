import { assertEquals, assertStringIncludes } from "@std/assert";
import { createMemoryStore, executeActions } from "./tools.ts";
import {
  clampSearchLimit,
  formatWebSearchOutput,
  webSearch,
} from "./web-search.ts";

Deno.test("clampSearchLimit bounds", () => {
  assertEquals(clampSearchLimit(undefined), 5);
  assertEquals(clampSearchLimit(0), 1);
  assertEquals(clampSearchLimit(99), 8);
  assertEquals(clampSearchLimit(3.7), 3);
});

Deno.test("formatWebSearchOutput lists hits", () => {
  const out = formatWebSearchOutput("brave", "mitoza", [{
    title: "Mitoza",
    url: "https://example.com/mitoza",
    snippet: "Podział komórki.",
  }]);
  assertStringIncludes(out, 'Wyszukiwanie (brave): "mitoza"');
  assertStringIncludes(out, "1. Mitoza");
  assertStringIncludes(out, "https://example.com/mitoza");
});

Deno.test("webSearch uses Brave when key provided", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    assertStringIncludes(url, "api.search.brave.com");
    return Promise.resolve(
      new Response(
        JSON.stringify({
          web: {
            results: [{
              title: "Fotosynteza",
              url: "https://example.com/fotosynteza",
              description: "Proces wytwarzania cukrów.",
            }],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  }) as typeof fetch;

  try {
    const outcome = await webSearch("fotosynteza", 3, { braveApiKey: "test-key" });
    assertEquals(outcome.ok, true);
    assertEquals(outcome.provider, "brave");
    assertEquals(outcome.results.length, 1);
    assertEquals(outcome.results[0].title, "Fotosynteza");
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("webSearch falls back to Wikipedia without Brave key", async () => {
  const original = globalThis.fetch;
  const originalKey = Deno.env.get("BRAVE_SEARCH_API_KEY");
  Deno.env.delete("BRAVE_SEARCH_API_KEY");
  let call = 0;

  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    call += 1;
    if (url.includes("action=opensearch")) {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            "mitoza",
            ["Mitoza"],
            [""],
            ["https://pl.wikipedia.org/wiki/Mitoza"],
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (url.includes("page/summary/")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ extract: "Podział jądra komórkowego." }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url} (#${call})`));
  }) as typeof fetch;

  try {
    const outcome = await webSearch("mitoza", 5);
    assertEquals(outcome.ok, true);
    assertEquals(outcome.provider, "wikipedia");
    assertEquals(outcome.results[0].url, "https://pl.wikipedia.org/wiki/Mitoza");
    assertStringIncludes(outcome.results[0].snippet, "Podział");
  } finally {
    globalThis.fetch = original;
    if (originalKey === undefined) Deno.env.delete("BRAVE_SEARCH_API_KEY");
    else Deno.env.set("BRAVE_SEARCH_API_KEY", originalKey);
  }
});

Deno.test("web.search tool returns formatted results", async () => {
  const original = globalThis.fetch;
  const originalKey = Deno.env.get("BRAVE_SEARCH_API_KEY");
  Deno.env.delete("BRAVE_SEARCH_API_KEY");

  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("action=opensearch")) {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            "kwasy",
            ["Kwasy"],
            [""],
            ["https://pl.wikipedia.org/wiki/Kwasy"],
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (url.includes("page/summary/")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ extract: "Związki chemiczne oddające protony." }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  }) as typeof fetch;

  try {
    const store = await createMemoryStore();
    const { results } = await executeActions(
      [{ tool: "web.search", args: { query: "kwasy", limit: 3 } }],
      store,
    );
    assertEquals(results[0].ok, true);
    assertStringIncludes(results[0].output ?? "", "Wyszukiwanie (wikipedia)");
    assertStringIncludes(results[0].output ?? "", "Kwasy");
  } finally {
    globalThis.fetch = original;
    if (originalKey === undefined) Deno.env.delete("BRAVE_SEARCH_API_KEY");
    else Deno.env.set("BRAVE_SEARCH_API_KEY", originalKey);
  }
});

Deno.test("web.search requires query", async () => {
  const store = await createMemoryStore();
  const { results } = await executeActions(
    [{ tool: "web.search", args: {} }],
    store,
  );
  assertEquals(results[0].ok, false);
  assertEquals(results[0].error, "Brak pola query");
});
