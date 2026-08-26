# Darmowi dostawcy AI — kaskada mądry → głupi

Cel: **zawsze dostać odpowiedź za 0 zł**. Próbujemy modele od najmocniejszych do najsłabszych.
Pierwszy sukces wygrywa. Pod odpowiedzią UI pokazuje `provider / model`.

## Ranking (domyślny)

Kolejność można zmienić w `packages/api/ai/cascade.ts`.

| Priorytet | Dostawca         |                       Model (przykład) | Env                  | Dlaczego                          |
| --------- | ---------------- | -------------------------------------: | -------------------- | --------------------------------- |
| 1         | Google AI Studio |                     `gemini-2.5-flash` | `GEMINI_API_KEY`     | Najmocniejszy darmowy tier        |
| 2         | Google AI Studio |                     `gemini-2.0-flash` | `GEMINI_API_KEY`     | Stabilny fallback Gemini          |
| 3         | Groq             |              `llama-3.3-70b-versatile` | `GROQ_API_KEY`       | Duży model, bardzo szybki         |
| 4         | OpenRouter       | `openrouter/auto` free / DeepSeek free | `OPENROUTER_API_KEY` | Agregator darmowych modeli        |
| 5         | Groq             |                 `llama-3.1-8b-instant` | `GROQ_API_KEY`       | Szybki, słabszy — „zawsze działa” |
| 6         | Google           |                `gemini-2.0-flash-lite` | `GEMINI_API_KEY`     | Lekki, wysokie limity             |

> Modele `:free` na OpenRouter zmieniają się — trzymaj listę aktualną w kodzie.

## Gdzie wziąć klucze (bez karty)

1. **Gemini** — https://aistudio.google.com/apikey
2. **Groq** — https://console.groq.com/keys
3. **OpenRouter** — https://openrouter.ai/keys (modele z sufiksem `:free`)

Opcjonalnie później: Cerebras, Hugging Face, NVIDIA NIM, Cloudflare Workers AI, lokalny Ollama
(całkowicie offline).

## Zachowanie kaskady

1. Filtruj modele, dla których jest klucz w env.
2. Idź po liście priorytetów.
3. Przy błędzie (429, 5xx, timeout, invalid key) → loguj attempt → następny.
4. Sukces → zwróć treść + meta modelu.
5. Wszystkie padły → HTTP 503 z listą `attempts` (żeby wiedzieć, co poprawić).

## System prompt (start)

Na razie prosty: pomocny asystent edukacyjny po polsku. Później: wstrzyknięcie kontekstu Librus /
TODO / profilu.

## Koszt

Docelowo **$0/miesiąc**. Jeśli któryś tier przestanie być darmowy — wypada z kaskady, nie z
produktu.
