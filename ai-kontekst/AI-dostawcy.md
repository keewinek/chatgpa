# Darmowi dostawcy AI — kaskada mądry → głupi

Cel: **zawsze dostać odpowiedź za 0 zł**. Próbujemy modele od najmocniejszych do najsłabszych.
Pierwszy sukces wygrywa. Pod odpowiedzią UI pokazuje `provider / model`.

**Źródło prawdy w kodzie:** `packages/api/ai/providers.ts` → `MODEL_CASCADE`.
Ten dokument ma być zsynchronizowany z kodem.

## Ranking (domyślny)

| Priorytet | Dostawca         | Model                                      | Env                  | Rola                              |
| --------- | ---------------- | ------------------------------------------ | -------------------- | --------------------------------- |
| 100       | Google AI Studio | `gemini-2.5-flash`                         | `GEMINI_API_KEY`     | Najmocniejszy darmowy tier        |
| 90        | Google AI Studio | `gemini-2.0-flash`                         | `GEMINI_API_KEY`     | Stabilny fallback Gemini          |
| 80        | Groq             | `llama-3.3-70b-versatile`                  | `GROQ_API_KEY`       | Duży + bardzo szybki              |
| 70        | OpenRouter       | `deepseek/deepseek-r1:free`                | `OPENROUTER_API_KEY` | Reasoning free                    |
| 60        | OpenRouter       | `meta-llama/llama-3.3-70b-instruct:free`   | `OPENROUTER_API_KEY` | Duży free przez agregator         |
| 40        | Groq             | `llama-3.1-8b-instant`                     | `GROQ_API_KEY`       | „Zawsze działa”, słabszy          |
| 30        | Google           | `gemini-2.0-flash-lite`                    | `GEMINI_API_KEY`     | Lekki, wysokie limity             |

> Modele `:free` na OpenRouter rotują — jeśli 404, zamień w `MODEL_CASCADE` i tu.

## Gdzie wziąć klucze (bez karty)

1. **Gemini** — https://aistudio.google.com/apikey
2. **Groq** — https://console.groq.com/keys
3. **OpenRouter** — https://openrouter.ai/keys (sufiks `:free`)

## Kandydaci na później (też free)

| Dostawca              | Po co                              | Env (propozycja)     |
| --------------------- | ---------------------------------- | -------------------- |
| Cerebras              | duże konteksty, szybkość           | `CEREBRAS_API_KEY`   |
| Hugging Face          | open weights                       | `HF_TOKEN`           |
| NVIDIA NIM            | brak dziennego cap (wg tieru)      | `NVIDIA_API_KEY`     |
| Cloudflare Workers AI | wysoki RPD                         | `CF_AI_TOKEN`        |
| GitHub Models         | GPT-like free dla konta GH         | `GITHUB_TOKEN`       |
| Ollama (lokalnie)     | offline, ostateczny fallback       | brak (localhost)     |

## Zachowanie kaskady

1. Filtruj sloty z obecnym kluczem w env.
2. Sortuj po `priority` malejąco.
3. Timeout ~45s (`AbortSignal.timeout`) → fail.
4. 429 / 5xx / invalid key / empty → log `attempts[]` → następny.
5. Sukces → `{ content, provider, model, attempts }`.
6. Wszystkie padły → HTTP 503 + `attempts` (UI pokazuje diagnostykę).

## Routing według zadania (pomysł, nie zaimplementowane)

| Typ zadania              | Preferowany slot          |
| ------------------------- | ------------------------- |
| plan / reasoning          | R1 / większy model        |
| szybkie Ask               | Flash / Groq 70B          |
| quiz / flashcards         | tańszy/szybszy 8B         |
| długi kontekst notatek    | Gemini (duże okno)        |

Na start: jedna kaskada dla wszystkich. Routing = optymalizacja limitów później.

## System prompt

Zobacz [prompty.md](./prompty.md). Kod: `DEFAULT_SYSTEM_PROMPT` w `providers.ts`.

## Koszt

Docelowo **$0/miesiąc**. Tier przestaje być darmowy → wypada z kaskady.
