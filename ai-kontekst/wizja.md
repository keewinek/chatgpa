# Wizja — Cursor do szkoły

## Problem

Uczeń ma rozproszone źródła: Librus (oceny, zadania, sprawdziany), notatki, kalendarz, chaty z AI.
Brakuje jednego miejsca, które **wie wszystko o Tobie i szkole**, planuje dzień i pilnuje nauki.

## Produkt

**ChatGPA** = osobisty AI-copilot edukacyjny (jak Cursor, ale do szkoły).

Nie jest to produkt komercyjny na start — to system **dla Ciebie**. Dlatego cały stack kosztów = **0
zł**:

- darmowe API AI (wiele dostawców, kaskada fallback),
- self-host / lokalny Deno,
- Librus przez własną wtyczkę / scraper (osobny tor).

## Doświadczenie docelowe

1. Otwierasz ChatGPA jak ChatGPT — piszesz naturalnie.
2. AI zna Twoje przedmioty, oceny, prace domowe, etap nauki.
3. Rano dostajesz plan dnia; wieczorem podsumowanie i TODO na jutro.
4. Widzisz postęp: co już umiesz, czego jeszcze nie, co warto powtórzyć.
5. Kalendarz + lista zadań zintegrowane z rozmową („dodaj powtórkę matematyki”).

## Metafora „Cursor”

| Cursor (kod)       | ChatGPA (szkoła)                        |
| ------------------ | --------------------------------------- |
| Workspace projektu | Profil ucznia + kontekst szkoły         |
| Pliki / git        | Notatki, materiały, Librus              |
| Agent / chat       | Chat edukacyjny z narzędziami           |
| Autocomplete       | Sugestie planu nauki                    |
| Background agents  | Automatyzacje w tle (plan dnia, alerty) |

## Zasady produktowe

1. **Darmowe albo nie istnieje** — żadna ścieżka nie wymaga płatnego API.
2. **Zawsze działa** — kaskada modeli; jeśli smart pada, bierze głupszy.
3. **Transparentność** — pod odpowiedzią widać użyty model i dostawcę.
4. **Kontekst osobisty** — AI ma wiedzieć o Tobie i szkole jak najwięcej.
5. **Jeden UI** — chat jest centrum; planer / kalendarz / TODO to panele wokół.
6. **Prywatność** — dane szkolne zostają u Ciebie; klucze w `.env`.

## Persona

- Ty: uczeń, chcesz podnieść średnią / ogarnąć tydzień bez chaosu.
- Język UI: polski.
- Ton AI: konkretny, motywujący, bez lania wody; tłumaczy jak dobry korepetytor.
