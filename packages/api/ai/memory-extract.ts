import type { MemoryEntry, MemoryKind } from "@chatgpa/core";
import { runCascade } from "./cascade.ts";
import type { ChatAction } from "./actions.ts";
import type { ChatMessage } from "./types.ts";
import { executeActions } from "./tools.ts";
import type { MemoryStore } from "../memory/service.ts";
import { MODEL_CASCADE } from "./cascade-config.ts";

export interface ExtractedMemoryFact {
  text: string;
  kind: MemoryKind;
  expiresInDays?: number;
  tags?: string[];
}

const EXTRACTION_SYSTEM = `Jesteś ekstraktorem faktów do pamięci asystenta szkolnego ChatGPA.
Z ostatniej wiadomości ucznia wyciągnij TYLKO ważne fakty o uczniu warte zapamiętania.

Zapisuj: imię/ksywa, klasa, szkoła, preferencje przedmiotów, styl nauki, cele, powtarzalne
zajęcia, ograniczenia czasowe, ważne ustalenia między czatami.
NIE zapisuj: pytań o materiał, treści zadań, żartów, haseł, jednorazowych terminów bez kontekstu
„zapamiętaj na później”, ani faktów już obecnych na liście istniejącej pamięci.

Odpowiedz WYŁĄCZNIE poprawnym JSON (bez markdown):
{"facts":[{"text":"...","kind":"long"|"short","expiresInDays":7,"tags":["..."]}]}
Jeśli brak faktów: {"facts":[]}
kind=long dla trwałych; kind=short + expiresInDays (1–14) dla tymczasowych.`;

/** Signals that the user message may contain a memorable personal fact. */
const PERSONAL_SIGNAL_RE =
  /(?:^|[^\p{L}])(nazywam|mam na imię|jestem|lubię|nie lubię|uwielbiam|nienawidzę|wolę|preferuję|moja|mój|moje|moim|u mnie|chodzę|uczęszczam|klas[ayę]|liceum|szkoł\p{L}*|matur\p{L}*|celuję|trenuję|korepetycj\p{L}*|wracam|uczę się|zapamiętaj|pamiętaj|nie zapomnij|od dziś|nigdy nie|nie mogę|nie dam rady|zmęczon\p{L}*|lekarz\p{L}*|choruj\p{L}*|mam (klas\p{L}*|korepetycj\p{L}*|trening\p{L}*|lekcj\p{L}*|matur\p{L}*|cel))/iu;

const SKIP_RE =
  /^(co to|czym jest|wyjaśnij|przetłumacz|policz|oblicz|rozwiąż|napisz esej|napisz wypracowanie|\/)/iu;

export function looksLikePersonalFact(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  const personal = PERSONAL_SIGNAL_RE.test(trimmed);
  if (SKIP_RE.test(trimmed) && !personal) return false;
  return personal;
}

export function parseExtractedFacts(raw: string): ExtractedMemoryFact[] {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!parsed || typeof parsed !== "object") return [];
    const facts = (parsed as { facts?: unknown }).facts;
    if (!Array.isArray(facts)) return [];

    const out: ExtractedMemoryFact[] = [];
    for (const item of facts) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const text = typeof row.text === "string"
        ? row.text.trim()
        : typeof row.content === "string"
        ? row.content.trim()
        : "";
      if (!text || text.length > 500) continue;
      const kind: MemoryKind = row.kind === "short" ? "short" : "long";
      let expiresInDays: number | undefined;
      if (typeof row.expiresInDays === "number" && Number.isFinite(row.expiresInDays)) {
        expiresInDays = Math.max(1, Math.min(14, Math.round(row.expiresInDays)));
      } else if (kind === "short") {
        expiresInDays = 7;
      }
      const tags = Array.isArray(row.tags)
        ? row.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .map((t) => t.trim()).slice(0, 5)
        : undefined;
      out.push({ text, kind, expiresInDays, tags });
    }
    return out.slice(0, 5);
  } catch {
    return [];
  }
}

function cheapestConfiguredModel(): string | undefined {
  const withKey = MODEL_CASCADE
    .filter((s) => {
      const v = Deno.env.get(s.apiKeyEnv)?.trim();
      return Boolean(v);
    })
    .sort((a, b) => a.priority - b.priority);
  return withKey[0]?.model;
}

function alreadyKnown(existing: MemoryEntry[], text: string): boolean {
  const needle = text.toLowerCase().trim();
  return existing.some((e) => e.content.toLowerCase().trim() === needle);
}

function filterNewFacts(
  facts: ExtractedMemoryFact[],
  existing: MemoryEntry[],
): ExtractedMemoryFact[] {
  return facts.filter((f) => !alreadyKnown(existing, f.text));
}

export function factsToRememberActions(facts: ExtractedMemoryFact[]): ChatAction[] {
  return facts.map((f) => ({
    tool: "memory.remember",
    args: {
      text: f.text,
      kind: f.kind,
      ...(f.expiresInDays != null ? { expiresInDays: f.expiresInDays } : {}),
      ...(f.tags?.length ? { tags: f.tags } : {}),
    },
  }));
}

export function formatMemoryContextHint(entries: MemoryEntry[]): string {
  const short = entries.filter((e) => e.kind === "short").length;
  const long = entries.filter((e) => e.kind === "long").length;
  if (!short && !long) {
    return (
      "Pamięć ucznia jest pusta. Gdy poda fakty o sobie (preferencje, klasa, cele, ograniczenia), " +
      "SAM zapisz je memory.remember — nie czekaj na słowo „zapamiętaj”."
    );
  }
  return (
    `Pamięć ucznia: ${long} długich, ${short} krótkich wpisów. ` +
    "Przy personalizacji / planowaniu najpierw memory.list. " +
    "Nowe ważne fakty zapisuj memory.remember od razu, bez prośby ucznia."
  );
}

/**
 * After a chat turn: if the latest user message looks personal, extract facts
 * with a cheap model and persist via memory.remember (deduped).
 */
export async function autoRememberFromTurn(
  messages: ChatMessage[],
  store: MemoryStore,
): Promise<{ saved: number; facts: ExtractedMemoryFact[] }> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = typeof lastUser?.content === "string" ? lastUser.content : "";
  if (!text.trim() || !looksLikePersonalFact(text)) {
    return { saved: 0, facts: [] };
  }

  const existing = store.list();
  const extractionMessages: ChatMessage[] = [
    { role: "system", content: EXTRACTION_SYSTEM },
    {
      role: "user",
      content: [
        "Istniejąca pamięć (nie duplikuj):",
        existing.length
          ? existing.map((e, i) => `${i + 1}. [${e.kind}] ${e.content}`).join("\n")
          : "(pusta)",
        "",
        "Wiadomość ucznia:",
        text.slice(0, 4000),
      ].join("\n"),
    },
  ];

  const forceModel = cheapestConfiguredModel();
  const result = await runCascade(extractionMessages, forceModel, { skipSystemWrap: true });
  if (!result.ok) {
    console.warn(`[memory-extract] cascade failed: ${result.error}`);
    return { saved: 0, facts: [] };
  }

  const facts = filterNewFacts(parseExtractedFacts(result.content), existing);
  if (!facts.length) return { saved: 0, facts: [] };

  const actions = factsToRememberActions(facts);
  const { results } = await executeActions(actions, store);
  const saved = results.filter((r) => r.ok).length;
  return { saved, facts };
}
