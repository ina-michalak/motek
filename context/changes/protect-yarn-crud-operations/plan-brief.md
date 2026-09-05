# Ochrona zapisu nowej włóczki (Ryzyko #1) — Krótki plan

> Pełny plan: `context/changes/protect-yarn-crud-operations/plan.md`
> Badania: `context/changes/protect-yarn-crud-operations/research.md`

## Co i dlaczego

Budujemy pierwszy test integracyjny w tym projekcie, chroniący Ryzyko #1 z `test-plan.md`: dodanie włóczki nie może "wyglądać" na udane, jeśli wiersz faktycznie nie powstał w bazie. Przy okazji ustalamy konwencję testów integracyjnych, z której skorzystają kolejne ryzyka (#2, #3...).

## Punkt wyjścia

Dziś zero testów integracyjnych istnieje w repo — tylko testy jednostkowe czystych funkcji. Zapis włóczki dzieje się w `createYarn()` (`src/lib/services/yarns.ts`), które przyjmuje gotowego, uwierzytelnionego klienta Supabase — nie tworzy go samo.

## Pożądany stan końcowy

`npm run test` (z uruchomionym lokalnym Supabase) uruchamia test, który realnie tworzy testowego użytkownika, zapisuje włóczkę i **niezależnym odczytem** potwierdza, że wiersz istnieje z poprawnymi danymi — oraz osobny test potwierdzający, że brak wymaganej ilości nie tworzy wiersza.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
|---|---|---|---|
| Punkt wejścia testu | Bezpośrednio `createYarn()`, nie przez HTTP endpoint | Zapis (sedno ryzyka) dzieje się w tym samym miejscu niezależnie od wejścia; ominięcie ciasteczek Astro/`@supabase/ssr` eliminuje kruchość niezwiązaną z ryzykiem | Plan (po odkryciu w Kroku 2, że pełny endpoint wymagałby fabrykowania sesyjnych ciasteczek) |
| Konto testowe | Świeże konto per uruchomienie (`signUp` z losowym e-mailem) | Pełna izolacja między testami, zero zależności od zasianych danych | Plan |
| Sprzątanie danych | Jawne `afterEach` usuwające wiersze `yarns` | Powtarzalne uruchomienia bez resetu całej lokalnej bazy | Plan |
| Dane logowania Supabase | Domyślne lokalne wartości w kodzie + override przez env | Zero konfiguracji po `npx supabase start`; wartości i tak publiczne/nieprodukcyjne | Plan |
| Zakres tej fazy | Tylko Ryzyko #1; bez rozjazdu RLS insert/select | Utrzymuje fazę wąską i szybką do ukończenia | Plan |

## Zakres

**W zakresie:** helper `createTestSupabaseSession()`, test happy-path zapisu, test odrzucenia przy braku wymaganej ilości, wpis w `test-plan.md §6.2`.

**Poza zakresem:** walidacja Zod/przekierowania endpointu (Ryzyko #6), rozjazd RLS insert-vs-select, Ryzyko #2 i #3 (edycja/usunięcie), naprawa `vitest.config.ts` pod `astro:env/server` (niepotrzebna przy tym podejściu).

## Architektura / Podejście

Test → `createTestSupabaseSession()` (nowy helper, zwykły klient `@supabase/supabase-js`, realny `signUp`) → zwraca uwierzytelnionego klienta + `userId` → test woła `createYarn(supabase, userId, dane)` bezpośrednio → asercja niezależnym odczytem z tej samej tabeli.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Infrastruktura testów integracyjnych | Helper `createTestSupabaseSession()` + wpis w `test-plan.md §6.2` | Niestabilny lokalny `anon key` między środowiskami — wymaga weryfikacji przy pierwszym uruchomieniu |
| 2. Test integracyjny dla Ryzyka #1 | Dwa testy (happy path + odrzucenie) w `yarns.integration.test.ts` | Test-lustro, jeśli asercja skopiuje logikę `createYarn` zamiast niezależnego odczytu |

**Wymagania wstępne:** lokalny Supabase uruchamialny przez `npx supabase start` (Docker).
**Szacowany wysiłek:** ~1 sesja, 2 fazy.

## Otwarte ryzyka i założenia

- Rozjazd RLS insert-vs-select (z badania) świadomie odłożony — nie testowany w tej fazie.
- Lokalny `anon key` zakładany jako stabilny/deterministyczny — do zweryfikowania przy pierwszym `npx supabase start`.

## Kryteria sukcesu (podsumowanie)

- `npx supabase start && npm run test` udowadnia realny zapis do bazy, nie tylko odpowiedź endpointu.
- Konwencja gotowa do ponownego użycia w Ryzyku #2/#3.
