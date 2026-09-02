# Darmowi dostawcy AI — kaskada mądry → głupi

Cel: **zawsze dostać odpowiedź za 0 zł**. Próbujemy modele od najmocniejszych do najsłabszych.
Pierwszy sukces wygrywa. Pod odpowiedzią UI pokazuje `provider / model`.

**Źródło prawdy w kodzie:** `packages/api/ai/cascade-config.ts` → `MODEL_CASCADE`. Ten dokument ma
być zsynchronizowany z kodem.

## Ranking (aktualny)

| Priorytet | Dostawca         | Model                    | Env               | Rola                       |
| --------- | ---------------- | ------------------------ | ----------------- | -------------------------- |
| 100       | Google AI Studio | `gemini-2.5-flash`       | `GEMINI_API_KEY`  | Najmocniejszy darmowy tier |
| 95        | Google AI Studio | `gemini-2.5-flash-lite`  | `GEMINI_API_KEY`  | Lekki Gemini               |
| 90        | Google AI Studio | `gemini-3.5-flash`       | `GEMINI_API_KEY`  | Nowszy Flash               |
| 85        | Google AI Studio | `gemini-3-flash-preview` | `GEMINI_API_KEY`  | Preview Flash              |
| 80        | Google AI Studio | `gemini-flash-latest`    | `GEMINI_API_KEY`  | Alias „latest”             |
| 70        | Groq             | `openai/gpt-oss-120b`    | `GROQ_API_KEY`    | Duży, szybki               |
| 68        | Z.AI             | `glm-4.7-flash`          | `ZAI_API_KEY`     | **Darmowy** GLM (200K ctx) |
| 65        | Z.AI             | `glm-4.5-flash`          | `ZAI_API_KEY`     | **Darmowy** GLM fallback   |
| 60        | Groq             | `openai/gpt-oss-20b`     | `GROQ_API_KEY`    | Mniejszy Groq              |
| 58        | Mistral          | `mistral-small-latest`   | `MISTRAL_API_KEY` | Experiment tier            |
| 55        | Mistral          | `open-mistral-nemo`      | `MISTRAL_API_KEY` | 12B, 128k ctx              |

> **OpenRouter** — kod wspiera (`OPENROUTER_API_KEY`), ale brak slotów w kaskadzie. Dodaj w
> `cascade-config.ts` jeśli potrzebujesz.

## Gdzie wziąć klucze (bez karty)

1. **Gemini** — https://aistudio.google.com/apikey
2. **Groq** — https://console.groq.com/keys
3. **Z.AI** — https://z.ai/model-api (GLM-4.7-Flash / 4.5-Flash = $0)
4. **Mistral** — https://console.mistral.ai/api-keys (plan Experiment)
5. **OpenRouter** — https://openrouter.ai/keys (modele `:free`, opcjonalnie)

## Endpointy (OpenAI-compatible)

| Provider   | Base URL                         |
| ---------- | -------------------------------- |
| groq       | `https://api.groq.com/openai/v1` |
| zai        | `https://api.z.ai/api/paas/v4`   |
| mistral    | `https://api.mistral.ai/v1`      |
| openrouter | `https://openrouter.ai/api/v1`   |

Konfiguracja: `packages/api/ai/stream-payload.ts` → `OPENAI_BASE`.

## Vision (obrazy / PDF)

Tylko **Gemini**. Przy załącznikach wizyjnych kaskada filtruje sloty do `provider === "gemini"`.

## Kandydaci na później

| Dostawca           | Po co                        | Env (propozycja)     |
| ------------------ | ---------------------------- | -------------------- |
| OpenRouter `:free` | agregator free modeli        | `OPENROUTER_API_KEY` |
| Cerebras           | szybkość                     | `CEREBRAS_API_KEY`   |
| Ollama (lokalnie)  | offline, ostateczny fallback | brak (localhost)     |

## Zachowanie kaskady

1. Filtruj sloty z obecnym kluczem w env.
2. Sortuj po `priority` malejąco.
3. Timeout ~45s → fail → następny slot.
4. 429 / 5xx / invalid key / empty → log `attempts[]` → następny.
5. Sukces → `{ content, provider, model, attempts }`.
6. Wszystkie padły → HTTP 503 + `attempts` (UI pokazuje diagnostykę).

## Limity free tier (orientacyjnie)

| Dostawca | Uwagi                                         |
| -------- | --------------------------------------------- |
| Gemini   | RPM/RPD zmienne; Google często zmienia limity |
| Groq     | ~30 RPM, ~1000 RPD na duże modele             |
| Z.AI     | GLM Flash = $0; rate limit ~1 RPS             |
| Mistral  | Experiment tier; ~1 RPS, limity nieujawnione  |

Szczegóły limitów sprawdzaj w dashboardzie dostawcy — free tiery się zmieniają.

## Koszt

Docelowo **$0/miesiąc**. Tier przestaje być darmowy → wypada z kaskady, nie z produktu.
