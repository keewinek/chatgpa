import { STARTER_PROMPTS } from "../lib/prompts.ts";

interface ChatEmptyProps {
  onPick: (text: string) => void;
  disabled?: boolean;
}

const MINIMAL_PROMPTS = STARTER_PROMPTS.slice(0, 3);

export default function ChatEmpty({ onPick, disabled }: ChatEmptyProps) {
  return (
    <div class="chat-empty">
      <p class="chat-empty-title">ChatGPA</p>
      <div class="chat-prompts">
        {MINIMAL_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            class="chat-prompt"
            disabled={disabled}
            onClick={() => onPick(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
