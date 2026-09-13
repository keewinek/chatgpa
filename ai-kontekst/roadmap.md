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
- [x] **Kontekst AI v2** — lazy context przez tools ([prompty.md](./prompty.md))
- [x] Komendy slash ([komendy.md](./komendy.md))
- [x] Pomodoro (`/pomodoro`)

## Faza 2 — Serwer, pliki, sync (NOWA — priorytet)

Szczegóły: [plan-implementacji.md](./plan-implementacji.md)

- [x] PostgreSQL + Drizzle ([serwer-i-sync.md](./serwer-i-sync.md))
- [x] Wirtualny system plików `~/` ([system-plikow.md](./system-plikow.md))
- [x] Pamięć short-term + long-term ([pamiec.md](./pamiec.md))
- [x] Globalna TODO ([todo.md](./todo.md))
- [x] Notatki Markdown ([notatki.md](./notatki.md))
- [x] Sync czatów multi-device
- [x] Kalendarz + profil czasu ([kalendarz.md](./kalendarz.md))
- [x] Profil ucznia w `~/profile/me.profile`

## Faza 3 — Szkoła i planowanie ✅

- [x] Wtyczka Librus + `POST /api/librus/sync` ([librus.md](./librus.md))
- [x] Plan dnia / tygodnia + anty-prokrastynacja T-7 ([plan-nauki.md](./plan-nauki.md))
- [x] Powiadomienia po szkole (30 min po lekcjach) ([powiadomienia.md](./powiadomienia.md))
- [x] Klik powiadomienia → czat z agentem + TODO dziś
- [x] Negocjacja planu („dziś lekarz” → przesunięcie)

## Faza 4 — Agent Core: poziom Cursor / Claude Code / Codex (NOWA — priorytet)

**Cel:** wszystkie domenowe funkcje (Faza 0–3) są zrobione. Teraz dojrzewa sam **agent** — silnik,
który czyta/pisze `~/` — żeby faktycznie działał jak Cursor/Claude Code/Codex, nie tylko wyglądał.
Szczegóły promptów: [plan-implementacji.md](./plan-implementacji.md), epiki 14–16.

- [ ] Dłuższa, mądrzejsza pętla narzędzi (więcej niż 3 rundy, lepsza heurystyka finalizacji)
- [ ] `fs.grep` / pełnotekstowe wyszukiwanie po `~/` (agent znajduje fakty bez zgadywania ścieżki)
- [ ] Bezpieczne edycje: diff przed/po przy `fs.write`, prosty undo/historia wersji pliku
- [ ] Polish do codziennego użytku: naprawić szumiące 404 przy tworzeniu wątków (patrz
      [decyzje.md](./decyzje.md), wpis 2026-09-13), pełny manualny przegląd paneli

## Później / someday (poza zakresem MVP)

Świadomie odłożone — nie blokują „gotowego" osobistego produktu, wracamy gdy podstawy (Faza 4) są
solidne:

- [ ] ROI ranking po syncu
- [ ] Diff wiedzy / średniej (`/diff`)
- [ ] Weekly review
- [ ] Tracker wiedzy + spaced repetition
- [ ] Focus mode (timer + quiz)
- [ ] RAG po książkach w `~/books/`
- [ ] Discord webhook
- [ ] Wykresy średniej
- [ ] Eksport backup `~/` jako zip

> **Świadomie NIE robimy:** lokalny/offline model (Ollama) jako fallback czy "privacy mode" — jeden
> użytkownik ma zawsze internet, kaskada darmowych API wystarcza. Patrz
> [AI-dostawcy.md](./AI-dostawcy.md).

## Definition of Done — osobisty produkt (cel)

- [x] Telefon i laptop: te same czaty, TODO, notatki, pamięć
- [x] Agent używa tools zamiast pełnego kontekstu w prompcie
- [x] Powiadomienie po szkole z planem na dziś
- [x] Librus: oceny + plan lekcji
- [x] `/clear short memory`, `/plan`, `/pomodoro` działają
- [ ] Agent pracuje jak Cursor/Claude Code: długie rundy narzędzi, szuka po całym `~/`, pokazuje
      diff i pozwala cofnąć zmianę pliku (Faza 4)

## Kontekst (wrzesień 2026)

Wszystkie epiki Fazy 0–3 (1–13) ukończone i przetestowane ręcznie 2026-09-13 (chat, streaming,
multi-round tools, panel Plików — patrz [decyzje.md](./decyzje.md)). Następny krok: Faza 4 —
dojrzewanie silnika agenta, nie nowe domeny. Pełna specyfikacja:
[plan-implementacji.md](./plan-implementacji.md)

- pliki w sekcji „Funkcje” w [README.md](./README.md).
