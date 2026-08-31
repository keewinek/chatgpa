# Zasady twarde

## Produkt

1. **Darmowe albo nie istnieje** — żadna ścieżka happy-path nie wymaga karty / subskrypcji.
2. **Single-user first** — to narzędzie dla właściciela repo, nie produkt szkolny dla 500 uczniów.
3. **Chat jest centrum** — reszta (kalendarz, TODO, tracker) to panele / narzędzia wokół rozmowy.
4. **Prawda > zgadywanie** — AI nie wymyśla ocen, terminów ani frekwencji; mówi „nie wiem”.
5. **Transparentność AI** — zawsze widać który model odpowiedział.
6. **Język polski** — UI i domyślny ton asystenta po polsku.
7. **Lokalność danych** — dane szkolne zostają u Ciebie (lokalny API / Twoja baza).

## Techniczne

1. **Deno-only** w monorepo (API + Fresh web + core).
2. **Klucze tylko po stronie API** — frontend woła `/api/*` na tej samej originie, nigdy Gemini/Groq
   bezpośrednio.
3. **Kaskada smart → dumb** — błąd / 429 / timeout = następny slot.
4. **Graceful degrade** — brak kluczy → czytelny 503 z instrukcją, nie crash.
5. **Typy w `@chatgpa/core`** — współdzielone kontrakty, nie duplikuj.
6. **Testy na krytycznej ścieżce** — walidacja `/api/chat`, lista modeli, brak kluczy.

## UX

1. Enter = wyślij, Shift+Enter = nowa linia.
2. Loading state z informacją, że leci kaskada.
3. Błędy pokazują próby modeli (debug bez DevTools).
4. Mobile-first: chat ma działać na telefonie (PWA później).

## Koszt / limity

1. Szanuj darmowe RPM/RPD — nie spamuj requestami w pętli.
2. Timeout per model (~45s), potem fallback.
3. Jeśli dostawca przestaje być darmowy → wypada z kaskady, nie z produktu.
