import { hydrateMessageFiles } from "../files/store.ts";
import { parseActions, stripActions } from "./actions.ts";
import { runCascade } from "./cascade.ts";
import { withMemoryContext } from "./providers.ts";
import { executeActions, formatToolResults } from "./tools.ts";
import type { ChatAttachment } from "@chatgpa/core";
import type { AiAttempt, ChatMessage, ToolResultPublic } from "./types.ts";

const MAX_TOOL_ROUNDS = 2;

export interface ChatRunResult {
  ok: true;
  content: string;
  provider: string;
  model: string;
  attempts: AiAttempt[];
  memory: string[];
  toolResults: ToolResultPublic[];
  attachments: ChatAttachment[];
}

export interface ChatRunFailure {
  ok: false;
  error: string;
  attempts: AiAttempt[];
  memory: string[];
}

export type ChatRunOutcome = ChatRunResult | ChatRunFailure;

function success(
  content: string,
  provider: string,
  model: string,
  attempts: AiAttempt[],
  memory: string[],
  toolResults: ToolResultPublic[],
  attachments: ChatAttachment[],
): ChatRunResult {
  return { ok: true, content, provider, model, attempts, memory, toolResults, attachments };
}

export async function runChat(
  messages: ChatMessage[],
  options: { forceModel?: string; memory?: string[] } = {},
): Promise<ChatRunOutcome> {
  const memory = [...(options.memory ?? [])];
  await hydrateMessageFiles(messages);
  const attempts: AiAttempt[] = [];
  const toolResults: ToolResultPublic[] = [];
  const attachments: ChatAttachment[] = [];
  let conversation = withMemoryContext(messages, memory);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await runCascade(conversation, options.forceModel, { skipSystemWrap: true });
    attempts.push(...result.attempts);
    if (!result.ok) return { ok: false, error: result.error, attempts, memory };

    const actions = parseActions(result.content);
    const stripped = stripActions(result.content);
    if (!actions.length) {
      return success(
        stripped,
        result.provider,
        result.model,
        attempts,
        memory,
        toolResults,
        attachments,
      );
    }

    const { results } = await executeActions(actions, memory);
    toolResults.push(...results);
    for (const r of results) if (r.ok && r.attachment) attachments.push(r.attachment);

    if (round === MAX_TOOL_ROUNDS - 1) {
      const suffix = results.map((
        r,
      ) => (r.ok ? `✓ ${r.tool}: ${r.output}` : `✗ ${r.tool}: ${r.error}`)).join("\n");
      return success(
        `${stripped}\n\n${suffix}`.trim(),
        result.provider,
        result.model,
        attempts,
        memory,
        toolResults,
        attachments,
      );
    }

    conversation = withMemoryContext(
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
      memory,
    );
  }

  return { ok: false, error: "Zbyt wiele rund narzędzi", attempts, memory };
}
