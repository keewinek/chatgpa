# Bezpieczeństwo i prywatność

## Zasady

1. **Single-user lokalny** — nie eksponuj API publicznie bez auth.
2. **Klucze AI tylko na serwerze** (`.env`, nigdy w bundle web).
3. **Dane Librus lokalnie** — nie wrzucaj snapshotów do gita ani publicznych gistów.
4. **Hasło Librus** — preferuj wtyczkę (sesja przeglądarki), nie przechowuj hasła w ChatGPA.
5. **Least surprise** — AI nie wysyła Twoich danych nigdzie poza wybranymi darmowymi providerami.

## Threat model (uproszczony)

| Zagrożenie                 | Mitygacja                                       |
| -------------------------- | ----------------------------------------------- |
| Wyciek `.env`              | gitignore, nie commitować, rotacja kluczy       |
| XSS kradnie chat           | zaufany UI; później sanitize markdown           |
| CORS zbyt szeroki          | whitelist localhost na start                    |
| Prompt injection z notatek | tool-calls tylko whitelisted; nie wykonuj blind |
| Publiczny tunnel bez auth  | nie używać / dodać token bearer                 |

## Darmowe AI a prywatność

- Gemini free tier może trenować na promptach (poza niektórymi regionami) — świadoma decyzja.
- Groq deklaruje brak trainingu na free (weryfikuj aktualny ToS).
- OpenRouter — zależy od modelu/providera.
- Ollama lokalnie = maksymalna prywatność, niższa jakość.

Opcja: flaga `PRIVACY_MODE=strict` → tylko Ollama / lokalne.

## Auth (później, jeśli potrzebne)

Dla single-user na LAN: wspólny `CHAT_GPA_TOKEN` w headerze. Bez OAuth Google „na zapas”.
