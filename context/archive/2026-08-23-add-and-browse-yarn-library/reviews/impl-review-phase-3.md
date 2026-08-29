<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Dodawanie i przeglądanie biblioteki włóczek

- **Plan**: context/changes/add-and-browse-yarn-library/plan.md
- **Zakres**: Faza 3 z 5
- **Data**: 2026-08-28
- **Werdykt**: ZAAKCEPTOWANY
- **Ustalenia**: 0 krytycznych, 0 ostrzeżeń, 3 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | PASS |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Kryteria sukcesu | PASS |

## Kontekst

Commit `6dc8f1d` — 4 pliki zmienione (`src/pages/api/yarns.ts` nowy, `src/lib/validation/yarn.ts`, `.claude/launch.json` nowy, `plan.md` Progress). Podczas ręcznych testów w przeglądarce (przeprowadzonych wspólnie z userem) odkryto i naprawiono w tym samym commicie lukę: zod nie odzwierciedlał CHECK constraints z bazy (`needle_size_mm`/`hook_size_mm > 0`, `quantity_skeins`/`quantity_grams >= 0`), a endpoint połykał prawdziwy komunikat błędu Supabase (`error instanceof Error` zwraca `false` dla `PostgrestError`).

## Ustalenia

### F1 — Surowy komunikat błędu Supabase trafia do URL (`?error=...`)

- **Ważność**: OBSERVACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/yarns.ts:49-53
- **Szczegóły**: `error.message` z Supabase (np. treść naruszenia CHECK constraint) trafia bezpośrednio do query stringu, więc ląduje w historii przeglądarki i logach proxy. Ryzyko niskie — zod blokuje te same warunki przed insertem, więc ta ścieżka uruchamia się tylko przy nietypowym naruszeniu. To dokładnie ten sam wzorzec co istniejący `signup.ts:16`/`signin.ts:16` — nie jest to regresja wprowadzona przez tę fazę, tylko odziedziczona konwencja repo.
- **Fix**: Brak działania w tej fazie. Jeśli kiedyś adresowane, to jako zmiana całego wzorca auth (generyczny komunikat dla błędów spoza zod), nie punktowa poprawka tego PR-a.
- **Decyzja**: OCZEKUJĄCA

### F2 — `toErrorMessage()` zdefiniowana lokalnie w `yarns.ts`

- **Ważność**: OBSERVACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/pages/api/yarns.ts:8-13
- **Szczegóły**: Jedyne miejsce użycia na razie — trzymanie helpera lokalnie jest uzasadnione (YAGNI). `signup.ts`/`signin.ts` nie potrzebują tej funkcji, bo operują na `AuthError extends Error`, podczas gdy `PostgrestError` nie dziedziczy po `Error`.
- **Fix**: Jeśli w Fazie 4/5 pojawi się drugi endpoint z tą samą potrzebą (np. edycja/usuwanie włóczki w S-03), przenieść do współdzielonego miejsca (`src/lib/utils.ts` lub nowy `src/lib/api-errors.ts`) wtedy, nie teraz.
- **Decyzja**: OCZEKUJĄCA

### F3 — Podwójny submit może utworzyć duplikat wiersza

- **Ważność**: OBSERVACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Bezpieczeństwo i jakość (Niezawodność)
- **Lokalizacja**: src/pages/api/yarns.ts (całość)
- **Szczegóły**: Brak idempotency key/debounce — dwa szybkie POST-y (np. podwójny klik) utworzą dwa wiersze. Zaobserwowane w logach dev podczas testów. Konsekwencje ograniczone do duplikatu rekordu należącego do tego samego użytkownika, bez wycieku danych ani naruszenia RLS.
- **Fix**: Jeśli ma być adresowane, to na poziomie UI w Fazie 4 (disable submit button po kliknięciu), nie w tym endpoincie.
- **Decyzja**: OCZEKUJĄCA

## Dowody weryfikacji

- **Automatyczne**: `npx astro check` — 0 błędów. `npm run lint` na zmienionych plikach (`src/pages/api/yarns.ts`, `src/lib/validation/yarn.ts`) — 0 błędów (2 warningi `no-console`, zgodne z istniejącym wzorcem w `src/lib/services/yarns.ts`).
- **Ręczne**: 3.2, 3.3, 3.4 (i 2.3 z Fazy 2) potwierdzone przez usera na żywo w przeglądarce podczas tej sesji — w tym dodatkowy test ad-hoc negatywnych wartości druty/szydełko, który ujawnił F1-klasy lukę i doprowadził do bugfixu w tym samym commicie.
