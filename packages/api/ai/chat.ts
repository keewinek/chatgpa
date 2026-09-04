import type { MemoryEntry } from "@chatgpa/core";
import { hydrateMessageFiles } from "../files/store.ts";
import { parseActions, stripActions } from "./actions.ts";
import { runCascade } from "./cascade.ts";
import { autoRememberFromTurn, formatMemoryContextHint } from "./memory-extract.ts";
import { withChatContext } from "./providers.ts";
import { createMemoryStore, executeActions, formatToolResults, type ToolResult } from "./tools.ts";
import type { ChatAttachment, GroupPrefs } from "@chatgpa/core";
import { DEFAULT_GROUP_PREFS } from "@chatgpa/core";
import type { AiAttempt, ChatMessage, ToolResultPublic } from "./types.ts";

const MAX_TOOL_ROUNDS = 3;

function toolContinuePrompt(results: ToolResult[], finalRound: boolean): string {
  const base = `Wyniki narzędzi:\n${formatToolResults(results)}`;
  if (finalRound) {
    return `${base}\n\nTo ostatnia runda narzędzi. NIE wołaj już żadnych tools — odpowiedz uczniowi wyłącznie tekstem na podstawie WSZYSTKICH wyników narzędzi w tej rozmowie (także wcześniejszych rund). Jeśli był plan.generate — przedstaw ten plan.`;
  }
  return `${base}\n\nKontynuuj odpowiedź dla ucznia.`;
}

function shouldFinalize(results: ToolResult[], round: number): boolean {
  if (round === MAX_TOOL_ROUNDS - 1) return true;
  return results.some((r) => r.ok && r.tool === "plan.generate");
}

export interface ChatRunResult {
  ok: true;
  content: string;
  provider: string;
  model: string;
  attempts: AiAttempt[];
  memory: MemoryEntry[];
  toolResults: ToolResultPublic[];
  attachments: ChatAttachment[];
}

export interface ChatRunFailure {
  ok: false;
  error: string;
  attempts: AiAttempt[];
  memory: MemoryEntry[];
}

export type ChatRunOutcome = ChatRunResult | ChatRunFailure;

function success(
  content: string,
  provider: string,
  model: string,
  attempts: AiAttempt[],
  memory: MemoryEntry[],
  toolResults: ToolResultPublic[],
  attachments: ChatAttachment[],
): ChatRunResult {
  return { ok: true, content, provider, model, attempts, memory, toolResults, attachments };
}

export async function runChat(
  messages: ChatMessage[],
  options: { forceModel?: string; memory?: string[]; groupPrefs?: GroupPrefs } = {},
): Promise<ChatRunOutcome> {
  const store = await createMemoryStore(options.memory);
  let groupPrefs = options.groupPrefs ?? DEFAULT_GROUP_PREFS;
  const memoryHint = formatMemoryContextHint(store.list());
  await hydrateMessageFiles(messages);
  const attempts: AiAttempt[] = [];
  const toolResults: ToolResultPublic[] = [];
  const attachments: ChatAttachment[] = [];
  let thread: ChatMessage[] = [...messages];
  let conversation = withChatContext(thread, groupPrefs, { memoryHint });
  let rememberedThisTurn = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await runCascade(conversation, options.forceModel, { skipSystemWrap: true });
    attempts.push(...result.attempts);
    if (!result.ok) {
      return { ok: false, error: result.error, attempts, memory: store.list() };
    }

    const actions = parseActions(result.content);
    const stripped = stripActions(result.content);
    if (!actions.length) {
      if (!rememberedThisTurn) await autoRememberFromTurn(messages, store);
      return success(
        stripped,
        result.provider,
        result.model,
        attempts,
        store.list(),
        toolResults,
        attachments,
      );
    }

    rememberedThisTurn ||= actions.some((a) => a.tool === "memory.remember");
    const { results } = await executeActions(actions, store, groupPrefs);
    toolResults.push(...results);
    for (const r of results) {
      if (r.ok && r.attachment && !attachments.some((a) => a.id === r.attachment!.id)) {
        attachments.push(r.attachment);
      }
      if (r.groupPrefs) groupPrefs = r.groupPrefs;
    }

    const finalRound = shouldFinalize(results, round);
    thread = [
      ...thread,
      { role: "assistant", content: stripped || "(wywołano narzędzia)" },
      { role: "user", content: toolContinuePrompt(results, finalRound) },
    ];
    conversation = withChatContext(thread, groupPrefs, { memoryHint });

    if (finalRound) {
      const finale = await runCascade(conversation, options.forceModel, { skipSystemWrap: true });
      attempts.push(...finale.attempts);
      if (!finale.ok) {
        return { ok: false, error: finale.error, attempts, memory: store.list() };
      }
      if (!rememberedThisTurn) await autoRememberFromTurn(messages, store);
      return success(
        stripActions(finale.content) ||
          stripped ||
          "Gotowe — sprawdziłem dane, ale nie udało się ułożyć odpowiedzi.",
        finale.provider,
        finale.model,
        attempts,
        store.list(),
        toolResults,
        attachments,
      );
    }
  }

  return { ok: false, error: "Zbyt wiele rund narzędzi", attempts, memory: store.list() };
}
