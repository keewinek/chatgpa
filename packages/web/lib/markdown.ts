import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true,
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Safe markdown for assistant bubbles (links open in new tab). */
export function renderMarkdown(content: string): string {
  const raw = marked.parse(content, { async: false }) as string;
  return raw.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

export function renderPlainText(content: string): string {
  return escapeHtml(content);
}
