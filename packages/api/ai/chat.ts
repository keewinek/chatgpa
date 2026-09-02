import type { MemoryEntry } from "@chatgpa/core";
import { hydrateMessageFiles } from "../files/store.ts";
import { parseActions, stripActions } from "./actions.ts";
import { runCascade } from "./cascade.ts";
import { withChatContext } from "./providers.ts";
import { createMemoryStore, executeActions, formatToolResults } from "./tools.ts";
import type { ChatAttachment, GroupPrefs } from "@chatgpa/core";
import { DEFAULT_GROUP_PREFS } from "@chatgpa/core";
import type { AiAttempt, ChatMessage, ToolResultPublic } from "./types.ts";

const MAX_TOOL_ROUNDS = 2;

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
  const groupPrefs = options.groupPrefs ?? DEFAULT_GROUP_PREFS;
  await hydrateMessageFiles(messages);
  const attempts: AiAttempt[] = [];
  const toolResults: ToolResultPublic[] = [];
  const attachments: ChatAttachment[] = [];
  let conversation = withChatContext(messages, groupPrefs);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await runCascade(conversation, options.forceModel, { skipSystemWrap: true });
    attempts.push(...result.attempts);
    if (!result.ok) {
      return { ok: false, error: result.error, attempts, memory: store.list() };
    }

    const actions = parseActions(result.content);
    const stripped = stripActions(result.content);
    if (!actions.length) {
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

    const { results } = await executeActions(actions, store, groupPrefs);
    toolResults.push(...results);
    for (const r of results) {
      if (r.ok && r.attachment && !attachments.some((a) => a.id === r.attachment!.id)) {
        attachments.push(r.attachment);
      }
    }

    if (round === MAX_TOOL_ROUNDS - 1) {
      const suffix = results.map((
        r,
      ) => (r.ok ? `✓ ${r.tool}: ${r.output}` : `✗ ${r.tool}: ${r.error}`)).join("\n");
      return success(
        `${stripped}\n\n${suffix}`.trim(),
        result.provider,
        result.model,
        attempts,
        store.list(),
        toolResults,
        attachments,
      );
    }

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
    );
  }

  return { ok: false, error: "Zbyt wiele rund narzędzi", attempts, memory: store.list() };
}
