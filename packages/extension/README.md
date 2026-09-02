# ChatGPA Librus Extension

Wtyczka MV3 synchronizująca dane z Librus Synergia do ChatGPA.

## Bezpieczeństwo

- Hasło Librus **nigdy** nie opuszcza przeglądarki.
- Wtyczka czyta tylko DOM aktywnej karty `*.librus.pl` (gdy jesteś zalogowany).
- POST idzie wyłącznie na skonfigurowany host ChatGPA (domyślnie `http://localhost:8000`).

## Instalacja (Chrome / Edge)

1. Uruchom ChatGPA API: `deno task dev:api`
2. Otwórz `chrome://extensions` → **Developer mode** → **Load unpacked**
3. Wskaż folder `packages/extension`
4. Zaloguj się na [synergia.librus.pl](https://synergia.librus.pl)
5. Kliknij ikonę wtyczki **Sync Librus → ChatGPA** lub przycisk w UI ChatGPA

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
