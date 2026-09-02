# Pamięć AI — short-term i long-term

## Cel

Agent ma pamiętać rzeczy o uczniu i o sobie — bez wpychania wszystkiego do system promptu na start.
Dzielimy pamięć na **krótkoterminową** (z wygaśnięciem) i **długoterminową** (trwała, między czatami).

## Stan obecny (do migracji)

- Pamięć = `string[]` w `localStorage` (`chatgpa:v2:store.memory`)
- Narzędzia: `memory.remember`, `memory.list`, `memory.forget`
- Wstrzykiwana w całości do system promptu przy każdym requeście
- Brak TTL, brak rozróżnienia short/long, brak sync między urządzeniami

## Docelowy model

### MemoryEntry

```ts
{
  id: string
  content: string           // treść faktu / notatki pamięciowej
  kind: "short" | "long"
  createdAt: string         // ISO datetime
  expiresAt?: string        // ISO datetime — tylko dla kind=short
  source: "ai" | "user" | "system"
  tags?: string[]           // np. ["chemia", "preferencje"]
  chatId?: string           // opcjonalnie: z którego czatu powstało
}
```

### Short-term memory

- Każdy wpis ma **czas wygaśnięcia** (`expiresAt`)
- Domyślne TTL (propozycja): 7 dni; agent może ustawić krótszy/dłuższy przy zapisie
- Użycie: bieżący tydzień, tymczasowe ustalenia („dziś mam lekarza”), kontekst sesji
- Po wygaśnięciu wpis jest **archiwizowany lub usuwany** (cron / lazy cleanup przy odczycie)
- **Nie** wstrzykiwana w całości do promptu — agent pobiera przez tool `memory.list({ kind: "short" })`

### Long-term memory

- Brak wygaśnięcia (lub bardzo długi TTL, np. rok, z możliwością odświeżenia)
- Użycie: stałe fakty (przedmioty, cele, preferencje nauki, ważne ustalenia między czatami)
- Przechowywana jako **plik** w systemie plików (patrz [system-plikow.md](./system-plikow.md)):
  - `~/.chatgpa/memory/long-term.memory` (lub `.memory` — do ustalenia w decyzji)
- Agent może **czytać i dopisywać** przez tools; użytkownik też widzi plik w UI

### Relacja z obecnym `memory.*`

| Stare | Nowe |
| ----- | ---- |
| `memory.remember` | `memory.remember` z `kind` + opcjonalnym `expiresInDays` |
| `memory.list` | `memory.list({ kind?, includeExpired? })` |
| `memory.forget` | `memory.forget({ id })` lub `memory.clear({ kind: "short" })` |

## Komendy użytkownika

| Komenda | Działanie |
| ------- | --------- |
| `/clear short memory` | Usuwa wszystkie aktywne wpisy short-term |
| `/clear memory` | Potwierdzenie → czyści short + long (ostrożnie) |
| `/memory` | Panel / lista wpisów w UI (opcjonalnie) |

Szczegóły komend: [komendy.md](./komendy.md).

## Storage

| Warstwa | Gdzie |
| ------- | ----- |
| API / DB | Tabela `memory_entries` (PostgreSQL) lub plik w `user_files` |
| Sync | Serwer = źródło prawdy; klient cache (patrz [serwer-i-sync.md](./serwer-i-sync.md)) |
| Plik long-term | Odbicie w systemie plików dla czytelności i edycji ręcznej |

## Zasady dla agenta (prompt)

1. **Nie zapisuj wszystkiego** — tylko trwałe fakty → long; tymczasowe → short z TTL.
2. **Nie powtarzaj** — przed `remember` sprawdź `memory.list`.
3. **Nie wklejaj pamięci do odpowiedzi** — użytkownik nie musi widzieć surowych wpisów.
4. Gdy użytkownik mówi „zapomnij o X” → `memory.forget` lub edycja pliku.
5. Preferencje czasu nauki, powrót do domu, quiet hours → **long-term** + profil.

## UI

- Sidebar: zakładki „Krótka” / „Długa” pamięć (z datą wygaśnięcia przy short)
- Przycisk „Wyczyść krótką pamięć” (to samo co `/clear short memory`)
- Wpis z toola → toast „Zapisano w pamięci (krótka/długa)”

## Migracja z Fazy 1

1. Istniejące `string[]` z localStorage → `MemoryEntry` z `kind: "long"`.
2. Upload do serwera przy pierwszym logowaniu / sync.
3. Stary format localStorage jako fallback offline (read-only).

## Definition of Done

- [ ] Short-term z `expiresAt` i automatycznym cleanup
- [ ] Long-term w pliku + DB, widoczny w systemie plików
- [ ] Tools zaktualizowane (`kind`, TTL)
- [ ] `/clear short memory` działa
- [ ] Sync między telefonem a komputerem
- [ ] Agent **nie** dostaje całej pamięci w system prompcie — tylko przez tool
