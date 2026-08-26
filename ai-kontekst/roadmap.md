# Roadmap

## Teraz (ten sprint)

- [x] Folder `ai-kontekst/` z wizją i decyzjami
- [x] Backend AI cascade (Gemini → Groq → OpenRouter → …)
- [x] Endpoint `POST /api/chat`
- [x] UI chatu w stylu ChatGPT + badge modelu
- [x] `.env.example` z darmowymi kluczami

## Krótko (następne)

- [ ] Historia rozmów (localStorage → później DB)
- [ ] Streaming odpowiedzi (SSE)
- [ ] Profil ucznia + system prompt z kontekstem
- [ ] TODO + kalendarz (UI + API stub)
- [ ] Plan dnia (prompt + zapis)

## Średnio

- [ ] Wtyczka Librus + sync
- [ ] Tracker wiedzy / spaced repetition
- [ ] Powiadomienia PWA
- [ ] Notatki / RAG (opcjonalnie Samsung Notes)

## Później / nice-to-have

- [ ] Lokalny Ollama jako ostateczny offline fallback
- [ ] Discord / webhook alerty
- [ ] Eksport postępów / wykresy średniej
- [ ] Multi-device sync (gdy będzie DB)

## Definition of Done — Faza 0

Możesz otworzyć web UI, napisać wiadomość, dostać odpowiedź z darmowego AI i zobaczyć pod spodem
który model odpowiedział. Jeśli jeden dostawca padnie, kolejny przejmuje bez Twojej interwencji.
