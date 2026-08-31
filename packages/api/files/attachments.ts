import type { ChatMessage } from "@chatgpa/core";
import { attachmentTextSnippet, bytesToBase64, describeAttachment, getFile } from "./store.ts";
import { isVisionMime } from "./mime.ts";

export interface ResolvedParts {
  text: string;
  geminiInline: Array<{ mimeType: string; data: string }>;
  imageDataUrls: string[];
}

/** Turn message text + file refs into provider-ready parts. */
export async function resolveMessageParts(message: ChatMessage): Promise<ResolvedParts> {
  const lines: string[] = [];
  const geminiInline: ResolvedParts["geminiInline"] = [];
  const imageDataUrls: string[] = [];

  if (message.content.trim()) lines.push(message.content.trim());

  for (const att of message.attachments ?? []) {
    const file = getFile(att.id);
    if (!file) continue;

    if (isVisionMime(file.mimeType)) {
      const data = bytesToBase64(file.bytes);
      geminiInline.push({ mimeType: file.mimeType, data });
      if (file.mimeType.startsWith("image/")) {
        imageDataUrls.push(`data:${file.mimeType};base64,${data}`);
      }
      continue;
    }

    const snippet = await attachmentTextSnippet(file);
    lines.push(
      snippet ? `Treść pliku „${file.name}”:\n${snippet}` : describeAttachment(file),
    );
  }

  return {
    text: lines.join("\n\n"),
    geminiInline,
    imageDataUrls,
  };
}
