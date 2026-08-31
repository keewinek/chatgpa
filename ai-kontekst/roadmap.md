# Roadmap

## Faza 0 — Chat + darmowe AI ✅

- [x] Folder `ai-kontekst/`
- [x] Backend AI cascade (Gemini → Groq → OpenRouter → …)
- [x] Endpoint `POST /api/chat` + `GET /api/ai/models`
- [x] UI chatu + badge modelu
- [x] `.env.example` z darmowymi kluczami
- [x] Rozszerzony kontekst (zasady, model danych, prompty, UI, …)

## Faza 1 — Rdzeń osobisty

- [x] Historia rozmów (localStorage)
- [x] Pamięć ucznia (localStorage + narzędzia memory.*)
- [x] Markdown w odpowiedziach asystenta
- [x] Narzędzia (`chatgpa-action`: pamięć, czas, kalkulator)
- [x] Streaming odpowiedzi (SSE via `/api/chat/stream`)
- [ ] Profil ucznia + ContextPacket w system prompcie
- [ ] TODO CRUD (API + panel UI)
- [ ] Kalendarz stub (API + panel)
- [ ] Komendy `/plan`, `/quiz` (seed prompty)
- [ ] Plan dnia (generuj + zapisz)

## Faza 2 — Szkoła

- [ ] Wtyczka Librus + `POST /api/librus/sync`
- [ ] ROI ranking po syncu
- [ ] Alerty T-3 / T-1 (in-app → Web Push)
- [ ] Diff wiedzy / średniej (`/diff`)
- [ ] Weekly review

## Faza 3 — Nauka głęboka

- [ ] Tracker wiedzy + spaced repetition
- [ ] Focus mode (timer + quiz)
- [ ] Tool-calling / `chatgpa-action`
- [ ] Notatki / RAG (opcjonalnie)
- [ ] Ollama jako offline slot

## Nice-to-have

- [ ] Discord webhook
- [ ] Wykresy średniej
- [ ] Multi-device sync (gdy DB)
- [ ] Privacy mode (tylko lokalne modele)

## Definition of Done — Faza 0

Możesz otworzyć web UI, napisać wiadomość, dostać odpowiedź z darmowego AI i zobaczyć pod spodem
który model odpowiedział. Jeśli jeden dostawca padnie, kolejny przejmuje bez Twojej interwencji.

## Definition of Done — Faza 1

Profil + TODO + kalendarz wpływają na odpowiedzi AI; plan dnia da się wygenerować i zapisać;
historia czatów przeżywa odświeżenie strony.
