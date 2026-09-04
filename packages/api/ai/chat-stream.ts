import type { MemoryEntry } from "@chatgpa/core";
import { hydrateMessageFiles } from "../files/store.ts";
import { parseActions, stripActions } from "./actions.ts";
import { runCascadeStream } from "./cascade.ts";
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

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "replace"; text: string }
  | { type: "tool"; results: ToolResultPublic[] }
  | {
    type: "done";
    content: string;
    model: string;
    provider: string;
    attempts: AiAttempt[];
    memory: MemoryEntry[];
    toolResults: ToolResultPublic[];
    attachments?: ChatAttachment[];
  }
  | { type: "error"; error: string; attempts: AiAttempt[]; memory: MemoryEntry[] };

export async function* runChatStream(
  messages: ChatMessage[],
  options: { forceModel?: string; memory?: string[]; groupPrefs?: GroupPrefs } = {},
): AsyncGenerator<ChatStreamEvent> {
  const store = await createMemoryStore(options.memory);
  let groupPrefs = options.groupPrefs ?? DEFAULT_GROUP_PREFS;
  const memoryHint = formatMemoryContextHint(store.list());
  await hydrateMessageFiles(messages);
  const allAttempts: AiAttempt[] = [];
  const allToolResults: ToolResultPublic[] = [];
  const allAttachments: ChatAttachment[] = [];
  let thread: ChatMessage[] = [...messages];
  let conversation = withChatContext(thread, groupPrefs, { memoryHint });
  let provider = "";
  let model = "";
  let rememberedThisTurn = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const gen = runCascadeStream(conversation, options.forceModel, { skipSystemWrap: true });
    let roundContent = "";
    let result = await gen.next();

    while (!result.done) {
      roundContent += result.value;
      yield { type: "delta", text: result.value };
      result = await gen.next();
    }

    const cascade = result.value;
    allAttempts.push(...cascade.attempts);

    if (!cascade.ok) {
      yield { type: "error", error: cascade.error, attempts: allAttempts, memory: store.list() };
      return;
    }

    provider = cascade.provider;
    model = cascade.model;
    const actions = parseActions(cascade.content);
    const stripped = stripActions(cascade.content);

    if (!actions.length) {
      if (stripped !== roundContent) {
        yield { type: "replace", text: stripped };
      }
      if (!rememberedThisTurn) await autoRememberFromTurn(messages, store);
      yield {
        type: "done",
        content: stripped,
        model,
        provider,
        attempts: allAttempts,
        memory: store.list(),
        toolResults: allToolResults,
        attachments: allAttachments.length ? allAttachments : undefined,
      };
      return;
    }

    rememberedThisTurn ||= actions.some((a) => a.tool === "memory.remember");
    const { results } = await executeActions(actions, store, groupPrefs);
    allToolResults.push(...results);
    for (const r of results) {
      if (r.ok && r.attachment && !allAttachments.some((a) => a.id === r.attachment!.id)) {
        allAttachments.push(r.attachment);
      }
      if (r.groupPrefs) groupPrefs = r.groupPrefs;
    }
    yield { type: "tool", results };

    const finalRound = shouldFinalize(results, round);
    yield { type: "replace", text: stripped || "(wywołano narzędzia)" };
    thread = [
      ...thread,
      { role: "assistant", content: stripped || "(wywołano narzędzia)" },
      { role: "user", content: toolContinuePrompt(results, finalRound) },
    ];
    conversation = withChatContext(thread, groupPrefs, { memoryHint });

    if (finalRound) {
      const genFinal = runCascadeStream(conversation, options.forceModel, { skipSystemWrap: true });
      let finalContent = "";
      let finalResult = await genFinal.next();
      while (!finalResult.done) {
        finalContent += finalResult.value;
        yield { type: "delta", text: finalResult.value };
        finalResult = await genFinal.next();
      }
      const finale = finalResult.value;
      allAttempts.push(...finale.attempts);
      if (!finale.ok) {
        yield { type: "error", error: finale.error, attempts: allAttempts, memory: store.list() };
        return;
      }
      provider = finale.provider;
      model = finale.model;
      const text = stripActions(finale.content) ||
        stripped ||
        "Gotowe — sprawdziłem dane, ale nie udało się ułożyć odpowiedzi.";
      if (text !== finalContent) {
        yield { type: "replace", text };
      }
      if (!rememberedThisTurn) await autoRememberFromTurn(messages, store);
      yield {
        type: "done",
        content: text,
        model,
        provider,
        attempts: allAttempts,
        memory: store.list(),
        toolResults: allToolResults,
        attachments: allAttachments.length ? allAttachments : undefined,
      };
      return;
    }
  }

  yield {
    type: "error",
    error: "Zbyt wiele rund narzędzi",
    attempts: allAttempts,
    memory: store.list(),
  };
}
