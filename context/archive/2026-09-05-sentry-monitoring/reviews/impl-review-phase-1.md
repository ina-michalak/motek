<!-- IMPL-REVIEW-REPORT -->

# Przegląd implementacji: Konfiguracja monitoringu błędów Sentry

- **Plan**: context/changes/sentry-monitoring/plan.md
- **Zakres**: Faza 1 z 4
- **Data**: 2026-09-05
- **Werdykt**: ZAAKCEPTOWANY
- **Ustalenia**: 0 krytycznych, 2 ostrzeżenia, 2 obserwacje

## Werdykty

| Wymiar                  | Werdykt |
| ----------------------- | ------- |
| Zgodność z planem       | PASS    |
| Dyscyplina zakresu      | WARNING |
| Bezpieczeństwo i jakość | WARNING |
| Architektura            | PASS    |
| Spójność wzorców        | PASS    |
| Kryteria sukcesu        | PASS    |

## Ustalenia

### F1 — Trzy niezaplanowane, ale minimalne poprawki blokujące

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — decyzja już podjęta i zatwierdzona w trakcie sesji
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: src/components/yarn/DeleteYarnButton.tsx:1,26; .gitignore:38-40; eslint.config.js:77
- **Szczegóły**: Commit a788442 zawiera 3 zmiany spoza planu Fazy 1: naprawę typowania handlera `onClick` w `DeleteYarnButton.tsx` (pre-istniejący błąd `npm run typecheck`), dodanie `.claude/worktrees/` do `.gitignore` (porzucony worktree zaśmiecał `npm run lint` tysiącami błędów CRLF) oraz wykluczenie `.claude/hooks/**` z ESLint (pliki hooków powodowały błąd parsowania w project service). Wszystkie trzy zostały jawnie zgłoszone użytkownikowi w trakcie implementacji i zaakceptowane przez AskUserQuestion — nie są ukrytym rozszerzeniem zakresu, tylko koniecznością do spełnienia kryteriów sukcesu fazy ("npm run typecheck/lint przechodzi").
- **Poprawka**: Brak działania wymaganego — udokumentować w plan.md jako świadome odstępstwo (już opisane w treści commita).
- **Decyzja**: ZAAKCEPTOWANE (już zatwierdzone przez użytkownika w trakcie implementacji)

### F2 — `eslint.config.js` ignoruje więcej niż sugeruje komunikat commita

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja, poprawka jest jednowierszowa
- **Wymiar**: Bezpieczeństwo i jakość (Niezawodność) / Spójność wzorców
- **Lokalizacja**: eslint.config.js:77
- **Szczegóły**: `{ ignores: [".claude/hooks/**"] }` w ESLint flat-config to obiekt zawierający wyłącznie klucz `ignores`, co w semantyce ESLint działa jako **globalne ignorowanie** (jak sąsiedni `includeIgnoreFile(gitignorePath)`), a nie jako wyłączenie samego type-aware lintingu. Realny efekt: pliki w `.claude/hooks/` są całkowicie pomijane przez wszystkie reguły ESLint, nie tylko przez `strictTypeChecked`/`stylisticTypeChecked`, jak sugerował opis w commicie ("wykluczono... z type-aware lintingu"). Ryzyko praktyczne jest niskie — to katalog narzędziowy Claude Code, nie `src/` — ale zapis wprowadza w błąd co do faktycznego zasięgu.
- **Poprawka**: Dodać krótki komentarz przy tej linii wyjaśniający, że to pełne wyłączenie ESLint dla tego katalogu (nie tylko type-aware linting), żeby przyszła osoba czytająca konfigurację nie była zaskoczona.
- **Decyzja**: FIXED — dodano komentarz w eslint.config.js:77-78

### F3 — `sentry.server.config.ts` importuje z `astro:env/client` — wygląda na pomyłkę

- **Ważność**: OBSERWACJA
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: sentry.server.config.ts:2
- **Szczegóły**: Import `SENTRY_DSN` z `astro:env/client` w pliku serwerowym jest poprawny w modelu Astro — zmienne z `context: "client", access: "public"` są celowo czytelne zarówno po stronie klienta, jak i serwera, ponieważ nie są sekretem (w przeciwieństwie do `SUPABASE_URL`/`SUPABASE_KEY`, `context: "server", access: "secret"`). To zgodne z zamierzeniem planu, ale na pierwszy rzut oka wygląda jak błąd i ktoś może to "naprawić" niepoprawnie w przyszłości.
- **Poprawka**: Jednozdaniowy komentarz przy imporcie wyjaśniający, że DSN jest publiczny z natury i import z `astro:env/client` po stronie serwera jest zamierzony.
- **Decyzja**: FIXED — dodano komentarz w sentry.server.config.ts:2

### F4 — Rzutowanie `as string` w `sentry.client.config.ts` maskuje brak typu

- **Ważność**: OBSERWACJA
- **Wymiar**: Bezpieczeństwo i jakość (Niezawodność)
- **Lokalizacja**: sentry.client.config.ts:6
- **Szczegóły**: `import.meta.env.SENTRY_ENVIRONMENT as string` jest dziś bezpieczne, ponieważ Vite `define` w `astro.config.mjs` zawsze wstrzykuje `JSON.stringify(...)` (gwarantowany string), ale cast maskuje brak deklaracji typu w `ImportMetaEnv`. Nieblokujące.
- **Poprawka**: Docelowo rozważyć deklarację `SENTRY_ENVIRONMENT` w pliku typów Vite (`env.d.ts`) zamiast rzutowania `as string`.
- **Decyzja**: FIXED — dodano deklarację `ImportMetaEnv.SENTRY_ENVIRONMENT` w src/env.d.ts, usunięto cast w sentry.client.config.ts:6

## Sprawdzone i bez ustaleń

- 5/5 zaplanowanych zmian Fazy 1 — pełne dopasowanie do umowy planu (package.json, astro.config.mjs ×2, sentry.client.config.ts, sentry.server.config.ts).
- Ograniczenia "czego NIE robimy" zachowane: brak source maps/SENTRY_AUTH_TOKEN, `tracesSampleRate: 0`, `sendDefaultPii: false`, brak `captureException` w komponentach React, brak SENTRY_DSN w CI.
- DSN traktowany spójnie jako publiczny wszędzie, brak wycieku innych sekretów.
- Wzorzec importu/typowania w `DeleteYarnButton.tsx` zgodny z `YarnForm.tsx`/`SignInForm.tsx`.
- Kryteria sukcesu: `npm run typecheck`, `npm run lint`, `npm run build` — wszystkie zielone; `npm run dev` potwierdzony ręcznie przez użytkownika (czysty start, brak błędów Sentry).
