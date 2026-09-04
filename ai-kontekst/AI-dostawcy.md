# Darmowi dostawcy AI — kaskada mądry → głupi

Cel: **zawsze dostać odpowiedź za 0 zł**. Próbujemy modele od najmocniejszych do najsłabszych.
Pierwszy sukces wygrywa. Pod odpowiedzią UI pokazuje `provider / model`.

**Źródło prawdy w kodzie:** `packages/api/ai/cascade-config.ts` → `MODEL_CASCADE`. Ten dokument ma
być zsynchronizowany z kodem.

## Ranking (aktualny)

| Priorytet | Dostawca         | Model                    | Env               | Rola                          |
| --------- | ---------------- | ------------------------ | ----------------- | ----------------------------- |
| 100       | Google AI Studio | `gemini-3.5-flash`       | `GEMINI_API_KEY`  | Najmądrzejszy free Flash      |
| 95        | Google AI Studio | `gemini-3-flash-preview` | `GEMINI_API_KEY`  | Gemini 3 Flash                |
| 90        | Google AI Studio | `gemini-flash-latest`    | `GEMINI_API_KEY`  | Alias „latest”                |
| 85        | Google AI Studio | `gemini-2.5-flash`       | `GEMINI_API_KEY`  | Starszy Flash (często 429)    |
| 80        | Groq             | `openai/gpt-oss-120b`    | `GROQ_API_KEY`    | Duży open fallback (~0.5s)    |
| 70        | Z.AI             | `glm-4.7-flash`          | `ZAI_API_KEY`     | **Darmowy** GLM (200K ctx)    |
| 65        | Mistral          | `mistral-small-latest`   | `MISTRAL_API_KEY` | Experiment tier               |
| 60        | Groq             | `openai/gpt-oss-20b`     | `GROQ_API_KEY`    | Szybki/słabszy (~0.1s)        |
| 55        | Z.AI             | `glm-4.5-flash`          | `ZAI_API_KEY`     | **Darmowy** GLM fallback      |
| 50        | Mistral          | `open-mistral-nemo`      | `MISTRAL_API_KEY` | 12B, 128k ctx                 |

> Usunięto `gemini-2.5-flash-lite` (404 — Google wycofał dla nowych użytkowników).
> Kaskada jest **smart→dumb**: najpierw Gemini, potem Groq/Z.AI/Mistral. Po 429 cooldown ~10 min.

## Cooldown (w procesie)

Po `429` / quota model jest pomijany ~10 min; po `404` / „no longer available” ~24 h.
Dzięki temu rundy tooli nie płacą ponownie za martwe sloty.

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
2. Sortuj po `priority` malejąco (najmądrzejszy pierwszy).
3. Pomiń sloty na cooldownie (429 → 10 min, 404 → 24 h).
4. Timeout ~45s → fail → `markSlotFailure` → następny slot.
5. 429 / 5xx / invalid key / empty → log `attempts[]` → następny.
6. Sukces → `{ content, provider, model, attempts }`.
7. Wszystkie padły → HTTP 503 + `attempts` (UI pokazuje diagnostykę).

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
