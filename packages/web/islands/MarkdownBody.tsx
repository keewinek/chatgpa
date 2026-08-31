import { renderMarkdown } from "../lib/markdown.ts";

interface MarkdownBodyProps {
  content: string;
}

export default function MarkdownBody({ content }: MarkdownBodyProps) {
  const html = renderMarkdown(content);
  // deno-lint-ignore react-no-danger -- assistant markdown from our API only
  return <div class="bubble-md" dangerouslySetInnerHTML={{ __html: html }} />;
}
