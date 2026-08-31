import { parseActions, stripActions } from "./actions.ts";
import { runCascade } from "./cascade.ts";
import { withMemoryContext } from "./providers.ts";
import { buildMemoryBlock, executeActions, formatToolResults } from "./tools.ts";
import type { ChatAttachment } from "@chatgpa/core";
import type { AiAttempt, ChatMessage } from "./types.ts";

const MAX_TOOL_ROUNDS = 2;

export interface ChatRunResult {
  ok: true;
  content: string;
  provider: string;
  model: string;
  attempts: AiAttempt[];
  memory: string[];
  toolResults: Array<{ tool: string; ok: boolean; output?: string; error?: string }>;
  attachments: ChatAttachment[];
}

export interface ChatRunFailure {
  ok: false;
  error: string;
  attempts: AiAttempt[];
  memory: string[];
}

export type ChatRunOutcome = ChatRunResult | ChatRunFailure;

export async function runChat(
  messages: ChatMessage[],
  options: { forceModel?: string; memory?: string[] } = {},
): Promise<ChatRunOutcome> {
  const memory = [...(options.memory ?? [])];
  const allAttempts: AiAttempt[] = [];
  const allToolResults: ChatRunResult["toolResults"] = [];
  const allAttachments: ChatAttachment[] = [];

  let conversation = withMemoryContext(messages, memory);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await runCascade(conversation, options.forceModel, { skipSystemWrap: true });
    allAttempts.push(...result.attempts);

    if (!result.ok) {
      return { ok: false, error: result.error, attempts: allAttempts, memory };
    }

    const actions = parseActions(result.content);
    const stripped = stripActions(result.content);

    if (actions.length === 0) {
      return {
        ok: true,
        content: stripped,
        provider: result.provider,
        model: result.model,
        attempts: allAttempts,
        memory,
        toolResults: allToolResults,
        attachments: allAttachments,
      };
    }

    const { results } = executeActions(actions, memory);
    allToolResults.push(...results);
    for (const r of results) {
      if (r.ok && r.attachment) allAttachments.push(r.attachment);
    }

    if (round === MAX_TOOL_ROUNDS - 1) {
      const suffix = results
        .map((r) => (r.ok ? `✓ ${r.tool}: ${r.output}` : `✗ ${r.tool}: ${r.error}`))
        .join("\n");
      return {
        ok: true,
        content: `${stripped}\n\n${suffix}`.trim(),
        provider: result.provider,
        model: result.model,
        attempts: allAttempts,
        memory,
        toolResults: allToolResults,
        attachments: allAttachments,
      };
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

  return {
    ok: false,
    error: "Zbyt wiele rund narzędzi",
    attempts: allAttempts,
    memory,
  };
}

export function memoryBlockForClient(memory: string[]): string {
  return buildMemoryBlock(memory);
}
