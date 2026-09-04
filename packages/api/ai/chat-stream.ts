import type { MemoryEntry } from "@chatgpa/core";
import { hydrateMessageFiles } from "../files/store.ts";
import { parseActions, stripActions } from "./actions.ts";
import { runCascadeStream } from "./cascade.ts";
import { autoRememberFromTurn, formatMemoryContextHint } from "./memory-extract.ts";
import { withChatContext } from "./providers.ts";
import { createMemoryStore, executeActions, formatToolResults } from "./tools.ts";
import type { ChatAttachment, GroupPrefs } from "@chatgpa/core";
import { DEFAULT_GROUP_PREFS } from "@chatgpa/core";
import type { AiAttempt, ChatMessage, ToolResultPublic } from "./types.ts";

const MAX_TOOL_ROUNDS = 3;

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
  let conversation = withChatContext(messages, groupPrefs, { memoryHint });
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

    if (round === MAX_TOOL_ROUNDS - 1) {
      if (!rememberedThisTurn) await autoRememberFromTurn(messages, store);
      const suffix = results.map((
        r,
      ) => (r.ok ? `✓ ${r.tool}: ${r.output}` : `✗ ${r.tool}: ${r.error}`)).join("\n");
      const content = `${stripped}\n\n${suffix}`.trim();
      yield { type: "replace", text: content };
      yield {
        type: "done",
        content,
        model,
        provider,
        attempts: allAttempts,
        memory: store.list(),
        toolResults: allToolResults,
        attachments: allAttachments.length ? allAttachments : undefined,
      };
      return;
    }

    yield { type: "replace", text: stripped || "(wywołano narzędzia)" };
    conversation = withChatContext(
      [
        ...messages,
        { role: "assistant", content: stripped || "(wywołano narzędzia)" },
        {
          role: "user",
          content: `Wyniki narzędzi:\n${
            formatToolResults(results)
          }\n\nKontynuuj odpowiedź dla ucznia.`,
        },
      ],
      groupPrefs,
      { memoryHint },
    );
  }

  yield {
    type: "error",
    error: "Zbyt wiele rund narzędzi",
    attempts: allAttempts,
    memory: store.list(),
  };
}
