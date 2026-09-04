import { STARTER_PROMPTS } from "../lib/prompts.ts";

interface ChatEmptyProps {
  onPick: (text: string) => void;
  disabled?: boolean;
}

const MINIMAL_PROMPTS = STARTER_PROMPTS.slice(0, 3);

export default function ChatEmpty({ onPick, disabled }: ChatEmptyProps) {
  return (
    <div class="chat-empty">
      <div class="chat-empty-copy">
        <p class="chat-empty-title">Czym mogę pomóc?</p>
        <p class="chat-empty-hint">Zapytaj o plan nauki, zadania lekcji albo notatki.</p>
      </div>
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
