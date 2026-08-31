/** Parsed tool invocation from a ```chatgpa-action``` block. */
export interface ChatAction {
  tool: string;
  args?: Record<string, unknown>;
}

const ACTION_RE = /```chatgpa-action\s*\n([\s\S]*?)```/gi;

export function parseActions(content: string): ChatAction[] {
  const actions: ChatAction[] = [];
  for (const match of content.matchAll(ACTION_RE)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (isChatAction(item)) actions.push(item);
        }
      } else if (isChatAction(parsed)) {
        actions.push(parsed);
      }
    } catch {
      // ignore invalid JSON blocks
    }
  }
  return actions;
}

export function stripActions(content: string): string {
  return content.replace(ACTION_RE, "").trim();
}

function isChatAction(value: unknown): value is ChatAction {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.tool === "string" && v.tool.length > 0;
}
