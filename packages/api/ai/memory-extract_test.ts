import { assertEquals } from "@std/assert";
import {
  factsToRememberActions,
  formatMemoryContextHint,
  looksLikePersonalFact,
  parseExtractedFacts,
} from "./memory-extract.ts";
import type { MemoryEntry } from "@chatgpa/core";

Deno.test("looksLikePersonalFact detects preferences and identity", () => {
  assertEquals(looksLikePersonalFact("Lubię matematykę i wolę uczyć się wieczorem"), true);
  assertEquals(looksLikePersonalFact("Nazywam się Ania, jestem w klasie 3A"), true);
  assertEquals(looksLikePersonalFact("Dziś mam lekarza o 16"), true);
  assertEquals(looksLikePersonalFact("Co to jest mitoza?"), false);
  assertEquals(looksLikePersonalFact("Policz 2+2"), false);
  assertEquals(looksLikePersonalFact("ok"), false);
});

Deno.test("parseExtractedFacts reads JSON facts", () => {
  const raw = `{"facts":[{"text":"Lubię chemię","kind":"long","tags":["chemia"]},{"text":"Dziś lekarz","kind":"short","expiresInDays":2}]}`;
  const facts = parseExtractedFacts(raw);
  assertEquals(facts.length, 2);
  assertEquals(facts[0]?.text, "Lubię chemię");
  assertEquals(facts[0]?.kind, "long");
  assertEquals(facts[1]?.kind, "short");
  assertEquals(facts[1]?.expiresInDays, 2);
});

Deno.test("parseExtractedFacts tolerates markdown fences and empty", () => {
  assertEquals(parseExtractedFacts("```json\n{\"facts\":[]}\n```"), []);
  assertEquals(parseExtractedFacts("brak faktów"), []);
});

Deno.test("factsToRememberActions maps to memory.remember tools", () => {
  const actions = factsToRememberActions([
    { text: "Klasa 3A", kind: "long", tags: ["szkoła"] },
  ]);
  assertEquals(actions.length, 1);
  assertEquals(actions[0]?.tool, "memory.remember");
  assertEquals(actions[0]?.args?.text, "Klasa 3A");
  assertEquals(actions[0]?.args?.kind, "long");
});

Deno.test("formatMemoryContextHint reflects empty vs populated memory", () => {
  assertEquals(formatMemoryContextHint([]).includes("pusta"), true);
  const entries: MemoryEntry[] = [
    {
      id: "1",
      content: "Lubię matmę",
      kind: "long",
      createdAt: new Date().toISOString(),
      source: "ai",
    },
    {
      id: "2",
      content: "Dziś lekarz",
      kind: "short",
      createdAt: new Date().toISOString(),
      source: "ai",
      expiresAt: new Date().toISOString(),
    },
  ];
  const hint = formatMemoryContextHint(entries);
  assertEquals(hint.includes("1 długich"), true);
  assertEquals(hint.includes("1 krótkich"), true);
  assertEquals(hint.includes("memory.list"), true);
});
