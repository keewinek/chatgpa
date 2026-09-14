# ChatGPA Librus Extension

Wtyczka MV3 synchronizująca dane z Librus Synergia do ChatGPA.

## Bezpieczeństwo

- Hasło Librus **nigdy** nie opuszcza przeglądarki.
- Wtyczka czyta tylko DOM aktywnej karty `*.librus.pl` (gdy jesteś zalogowany).
- POST idzie wyłącznie na skonfigurowany host ChatGPA (domyślnie
  `https://chatgpa.keewinek.deno.net`, produkcja — możesz zmienić na `http://localhost:8000` w
  popupie do lokalnego dev).

## Instalacja (Chrome / Edge) — jednorazowo

1. Otwórz `chrome://extensions` → **Developer mode** → **Load unpacked**
2. Wskaż folder `packages/extension`
3. Przypnij ikonkę wtyczki do paska (opcjonalnie, mniej klików później)

## Sync (za każdym razem — 2 kliki)

1. Zaloguj się na [synergia.librus.pl](https://synergia.librus.pl) (jeśli sesja wygasła)
2. Kliknij ikonę wtyczki **Sync Librus → ChatGPA** — dane lecą prosto na produkcję, widoczne od razu
   w aplikacji na telefonie

## Co syncuje (MVP)

| Dane         | Plik docelowy                            |
| ------------ | ---------------------------------------- |
| Oceny        | `~/school/librus/grades.json`            |
| Plan lekcji  | `~/school/librus/schedule.json`          |
| Zmiany planu | `~/school/librus/timetable-changes.json` |
| Terminarz    | merge do `~/calendar/*.cal` + TODO       |

Selektory DOM są heurystyczne — po zmianach layoutu Librus mogą wymagać aktualizacji w
`content-librus.js`.

## UI ChatGPA

Przycisk **Sync Librus** w headerze czatu wysyła żądanie przez `content-bridge.js` (wymaga
zainstalowanej wtyczki + otwartej karty Librus).
