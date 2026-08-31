import { STARTER_PROMPTS } from "../lib/prompts.ts";

interface ChatEmptyProps {
  onPick: (text: string) => void;
  disabled?: boolean;
}

export default function ChatEmpty({ onPick, disabled }: ChatEmptyProps) {
  return (
    <div class="chat-empty">
      <p class="chat-empty-title">Cześć — tu ChatGPA</p>
      <p class="chat-empty-hint">
        Osobisty AI do szkoły. Zapytaj o naukę, wyślij zdjęcie zadania albo poproś o plik z quizem.
      </p>
      <div class="chat-prompts">
        {STARTER_PROMPTS.map((prompt) => (
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
