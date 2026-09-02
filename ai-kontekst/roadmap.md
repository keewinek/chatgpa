# Roadmap

## Faza 0 — Chat + darmowe AI ✅

- [x] Folder `ai-kontekst/`
- [x] Backend AI cascade (Gemini → Groq → …)
- [x] Endpoint `POST /api/chat` + `GET /api/ai/models`
- [x] UI chatu + badge modelu
- [x] `.env.example` z darmowymi kluczami
- [x] Rozszerzony kontekst (zasady, model danych, prompty, UI, …)

## Faza 1 — Rdzeń osobisty (częściowo ✅)

- [x] Historia rozmów (localStorage)
- [x] Pamięć ucznia v1 (localStorage + narzędzia memory.*)
- [x] Markdown w odpowiedziach asystenta
- [x] Narzędzia (`chatgpa-action`: pamięć, czas, kalkulator, pliki)
- [x] Streaming odpowiedzi (SSE via `/api/chat/stream`)
- [x] Plan lekcji 3A — UI + kontekst AI + tools `timetable.*` ([plan-lekcji.md](./plan-lekcji.md))
- [ ] **Kontekst AI v2** — lazy context przez tools ([prompty.md](./prompty.md))
- [ ] Komendy slash ([komendy.md](./komendy.md))
- [ ] Pomodoro (`/pomodoro`)

## Faza 2 — Serwer, pliki, sync (NOWA — priorytet)

Szczegóły: [plan-implementacji.md](./plan-implementacji.md)

- [ ] PostgreSQL + Drizzle ([serwer-i-sync.md](./serwer-i-sync.md))
- [ ] Wirtualny system plików `~/` ([system-plikow.md](./system-plikow.md))
- [ ] Pamięć short-term + long-term ([pamiec.md](./pamiec.md))
- [ ] Globalna TODO ([todo.md](./todo.md))
- [ ] Notatki Markdown ([notatki.md](./notatki.md))
- [ ] Sync czatów multi-device
- [ ] Kalendarz + profil czasu ([kalendarz.md](./kalendarz.md))
- [ ] Profil ucznia w `~/profile/me.profile`

## Faza 3 — Szkoła i planowanie

- [ ] Wtyczka Librus + `POST /api/librus/sync` ([librus.md](./librus.md))
- [ ] Plan dnia / tygodnia + anty-prokrastynacja T-7 ([plan-nauki.md](./plan-nauki.md))
- [ ] Powiadomienia po szkole (30 min po lekcjach) ([powiadomienia.md](./powiadomienia.md))
- [ ] Klik powiadomienia → czat z agentem + TODO dziś
- [ ] Negocjacja planu („dziś lekarz” → przesunięcie)
- [ ] ROI ranking po syncu
- [ ] Diff wiedzy / średniej (`/diff`)
- [ ] Weekly review

## Faza 4 — Nauka głęboka

- [ ] Tracker wiedzy + spaced repetition
- [ ] Focus mode (timer + quiz)
- [ ] RAG po książkach w `~/books/`
- [ ] Ollama jako offline slot

## Nice-to-have

- [ ] Discord webhook
- [ ] Wykresy średniej
- [ ] Eksport backup `~/` jako zip
- [ ] Privacy mode (tylko lokalne modele)

## Definition of Done — osobisty produkt (cel)

- Telefon i laptop: te same czaty, TODO, notatki, pamięć
- Agent używa tools zamiast pełnego kontekstu w prompcie
- Powiadomienie po szkole z planem na dziś
- Librus: oceny + plan lekcji
- `/clear short memory`, `/plan`, `/pomodoro` działają

## Kontekst (wrzesień 2026)

Pełna specyfikacja nowych feature'ów: [plan-implementacji.md](./plan-implementacji.md) + pliki w sekcji „Funkcje” w [README.md](./README.md).
