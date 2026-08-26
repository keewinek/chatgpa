# Librus — integracja (osobny tor)

ChatGPA ma „wiedzieć wszystko o szkole”. Librus jest głównym źródłem prawdy dla ocen, terminów i
zadań.

## Założenie

Pełna integracja Librus **nie jest w tym samym sprincie** co chat AI. Raczej:

1. **Wtyczka do przeglądarki** (Chrome/Firefox) loguje się na Librus / czyta dane gdy jesteś
   zalogowany.
2. Wtyczka wysyła znormalizowany JSON do lokalnego API ChatGPA (`POST /api/librus/sync`).
3. ChatGPA trzyma snapshot kontekstu i karmi nim AI.

## Alternatywy (research)

- Oficjalne API Librus — ograniczone / dla szkół.
- Nieoficjalne biblioteki (np. librus-api) — kruche, ToS, 2FA.
- Ręczny eksport / CSV — awaryjnie.

## Co syncujemy

- Przedmioty + oceny (wartość, waga, kategoria, data)
- Terminy (sprawdziany, prace klasowe)
- Zadania domowe
- (opcjonalnie) frekwencja, ogłoszenia

## Bezpieczeństwo

- Hasła Librus **nie** lądują w ChatGPA, jeśli idziemy ścieżką wtyczki (sesja przeglądarki).
- Dane tylko lokalnie / w Twojej bazie.
- Sync na żądanie + okresowy.

## Status

`planned` — najpierw chat + AI cascade, potem wtyczka / sync.
