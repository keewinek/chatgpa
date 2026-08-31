import type { ChatAction } from "./actions.ts";

export interface ToolResult {
  tool: string;
  ok: boolean;
  output?: string;
  error?: string;
}

export interface ToolRunSummary {
  results: ToolResult[];
  memory: string[];
}

export function buildMemoryBlock(memory: string[]): string {
  if (memory.length === 0) return "";
  const lines = memory.map((fact) => `- ${fact}`).join("\n");
  return `Pamięć ucznia (zapisane fakty — traktuj jako prawdę, nie wymyślaj poza tym):\n${lines}`;
}

export function formatToolResults(results: ToolResult[]): string {
  return results
    .map((r) => {
      if (r.ok) return `[${r.tool}] ${r.output ?? "OK"}`;
      return `[${r.tool}] BŁĄD: ${r.error ?? "nieznany"}`;
    })
    .join("\n");
}

function safeCalc(expression: string): number {
  const cleaned = expression.replace(/[^0-9+\-*/().%\s]/g, "");
  if (!cleaned.trim()) throw new Error("Puste wyrażenie");
  const value = Function(`"use strict"; return (${cleaned})`)();
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Wynik nie jest liczbą");
  }
  return value;
}

function warsawNow(): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
}

function runOne(action: ChatAction, memory: string[]): ToolResult {
  const args = action.args ?? {};
  switch (action.tool) {
    case "memory.remember": {
      const text = typeof args.text === "string" ? args.text.trim() : "";
      if (!text) return { tool: action.tool, ok: false, error: "Brak pola text" };
      if (memory.some((m) => m.toLowerCase() === text.toLowerCase())) {
        return { tool: action.tool, ok: true, output: "Fakt już jest w pamięci." };
      }
      memory.push(text);
      return { tool: action.tool, ok: true, output: `Zapisano: „${text}”` };
    }
    case "memory.list": {
      if (memory.length === 0) {
        return { tool: action.tool, ok: true, output: "Pamięć jest pusta." };
      }
      return {
        tool: action.tool,
        ok: true,
        output: memory.map((m, i) => `${i + 1}. ${m}`).join("\n"),
      };
    }
    case "memory.forget": {
      const text = typeof args.text === "string" ? args.text.trim().toLowerCase() : "";
      const idx = memory.findIndex((m) => m.toLowerCase() === text);
      if (idx === -1) return { tool: action.tool, ok: false, error: "Nie znalazłem tego faktu" };
      const removed = memory.splice(idx, 1)[0];
      return { tool: action.tool, ok: true, output: `Usunięto: „${removed}”` };
    }
    case "datetime.now": {
      return { tool: action.tool, ok: true, output: warsawNow() };
    }
    case "calc.eval": {
      const expression = typeof args.expression === "string" ? args.expression : "";
      if (!expression.trim()) return { tool: action.tool, ok: false, error: "Brak expression" };
      try {
        const value = safeCalc(expression);
        return { tool: action.tool, ok: true, output: String(value) };
      } catch (err) {
        return {
          tool: action.tool,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    default:
      return { tool: action.tool, ok: false, error: `Nieznane narzędzie: ${action.tool}` };
  }
}

export function executeActions(actions: ChatAction[], memory: string[]): ToolRunSummary {
  const results: ToolResult[] = [];
  for (const action of actions) {
    results.push(runOne(action, memory));
  }
  return { results, memory };
}
