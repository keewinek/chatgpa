# ChatGPA Librus Extension

Wtyczka MV3 synchronizująca dane z Librus Synergia do ChatGPA.

## Bezpieczeństwo

- Hasło Librus **nigdy** nie opuszcza przeglądarki.
- Wtyczka czyta dane przez `fetch()` na `*.librus.pl` z sesją zalogowanej karty (musisz być
  zalogowany w tej samej przeglądarce).
- POST idzie wyłącznie na skonfigurowany host ChatGPA (domyślnie
  `https://chatgpa.keewinek.deno.net`, produkcja — możesz zmienić na `http://localhost:8000` w
  popupie do lokalnego dev).

## Instalacja (Chrome / Edge) — jednorazowo

1. Otwórz `chrome://extensions` → **Developer mode** → **Load unpacked**
2. Wskaż folder `packages/extension`
3. Zaloguj się raz na [synergia.librus.pl](https://synergia.librus.pl)

## Sync — 0 kliknięć w normalnym użyciu

Content script uruchamia się sam na każdej stronie `librus.pl` i syncuje w tle (throttle: raz na
15 min), więc wystarczy, że **normalnie zaglądasz do Librusa** — nic nie trzeba klikać. Sync
ciągnie za jednym razem oceny, plan lekcji **i** terminarz (bieżący + 2 kolejne miesiące), więc nie
trzeba być akurat na konkretnej podstronie.

Ręczny sync (np. żeby nie czekać na throttle) — kliknij ikonę wtyczki **Sync Librus → ChatGPA**, ale
musisz być wtedy na karcie `*.librus.pl`.

## Co syncuje

| Dane         | Plik docelowy                            | Status                                    |
| ------------ | ----------------------------------------- | ------------------------------------------ |
| Terminarz (sprawdziany, prace domowe) | merge do `~/calendar/*.cal` + TODO | zweryfikowane na żywym Librusie (2026-09) |
| Plan lekcji  | `~/school/librus/schedule.json`          | zweryfikowane na żywym Librusie (2026-09) |
| Oceny        | `~/school/librus/grades.json`            | nazwy przedmiotów pewne; wartości ocen **niezweryfikowane** — konto testowe nie miało jeszcze żadnej oceny w momencie pisania parsera |

Terminarz klasyfikuje wydarzenie jako sprawdzian/kartkówkę po słowach kluczowych w polu „Rodzaj”
**i** „Opis” (nauczyciele często wpisują np. „Mapówka” z Rodzajem „Inne” — samo pole Rodzaj nie
wystarcza).

Jeśli sync znów ucichnie: Librus zmienił markup. Selektory są w `content-librus.js`, każda funkcja
`parse*Doc` operuje na jednej konkretnej stronie — łatwo zweryfikować osobno w devtoolsach
zalogowanej karty.

## UI ChatGPA

Przycisk **Sync Librus** w headerze czatu wysyła żądanie przez `content-bridge.js` (wymaga
zainstalowanej wtyczki + otwartej karty Librus).
