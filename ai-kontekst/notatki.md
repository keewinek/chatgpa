# System notatek (Markdown)

## Cel

Wewnętrzne notatki użytkownika — **Markdown na serwerze**, w katalogu `~/notes/`, dostępne z
telefonu i komputera. Agent może je czytać, tworzyć i edytować (np. po lekcji: „zapisz notatkę z
tego”).

## Lokalizacja

```
~/notes/
├── chemia/
│   └── kwasy.md
├── matma/
│   └── funkcje-liniowe.md
└── inbox.md              # szybkie notatki bez katalogu
```

## Format

- Czysty **Markdown** (nagłówki, listy, code blocks, linki)
- Opcjonalny **YAML frontmatter**:

```markdown
---
title: Kwasy i zasady
subject: chemia
createdAt: 2026-09-02
tags: [sprawdzian, rozdział-3]
---

# Kwasy

Treść notatki...
```

## Tools dla agenta

| Tool           | Opis                                      |
| -------------- | ----------------------------------------- |
| `notes.list`   | `{ path?: string }` — lista notatek       |
| `notes.read`   | `{ path: string }`                        |
| `notes.write`  | `{ path, content }` — create or overwrite |
| `notes.append` | `{ path, content }` — dopisanie na końcu  |

Równoważne z `fs.*` w `~/notes/` — można użyć jednego API.

## UI

- Przeglądarka notatek: drzewo katalogów + edytor Markdown (split: edycja | podgląd)
- Komenda `/notes` lub `/notes otwórz chemia/kwasy`
- Z czatu: „zapisz to jako notatkę” → agent `notes.write`

## Relacja z książkami

- **Notatki** = Twoje zapiski (`.md`)
- **Książki** = `~/books/` — PDFy podręczników; agent czyta przez `fs.read` (ekstrakcja tekstu)
- Agent może łączyć: notatka + fragment podręcznika przy planowaniu nauki

## Sync

- Serwer = źródło prawdy ([serwer-i-sync.md](./serwer-i-sync.md))
- Konflikt edycji (dwa urządzenia): last-write-wins na start; później wersjonowanie (nice-to-have)

## Definition of Done

- [x] CRUD notatek przez API
- [x] UI edytora Markdown
- [x] Tools dla agenta
- [ ] Sync multi-device
- [x] Katalogi per przedmiot
