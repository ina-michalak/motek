---
date: 2026-09-05T16:53:14+02:00
researcher: Claude Code
git_commit: be3d28b1f7747c1fbda007bbe1e7d23f37d92a88
branch: develop
repository: motek
topic: "Ryzyko #1 (test-plan.md): dodanie nowej włóczki nie zapisuje się mimo widocznego sukcesu formularza"
tags: [research, codebase, yarns, create-yarn, supabase, rls, validation, api-routes]
status: complete
last_updated: 2026-09-05
last_updated_by: Claude Code
---

# Research: Ryzyko #1 — dodanie nowej włóczki nie zapisuje się

**Date**: 2026-09-05T16:53:14+02:00
**Researcher**: Claude Code
**Git Commit**: be3d28b1f7747c1fbda007bbe1e7d23f37d92a88
**Branch**: develop
**Repository**: motek

## Research Question

Zgodnie z `context/foundation/test-plan.md` §2, Ryzyko #1: *"Dodanie nowej włóczki nie zapisuje się (formularz 'wygląda' na udany, ale wiersz nie powstaje)"*. Co dokładnie w bieżącej bazie kodu trzeba ugruntować, żeby napisać test integracyjny, który to udowodni — dokładny przepływ dodania włóczki (formularz → API → serwis → baza), reguły walidacji, zachowanie przy błędzie, oraz stan RLS/GRANT na tabeli `yarns`?

## Summary

- **Kluczowe ustalenie zmieniające charakter ryzyka**: przepływ dodania włóczki to **natywny formularz HTML** (`<form method="POST" encType="multipart/form-data">`), nie `fetch()`. Przeglądarka fizycznie czeka na odpowiedź serwera przed pokazaniem czegokolwiek — klasyczny wzorzec "pokazaliśmy sukces zanim serwer odpowiedział" **nie występuje w tym kodzie**. "Sukces" widziany przez użytkownika to zawsze efekt uboczny realnego przekierowania `302` po udanym insercie (`src/pages/api/yarns.ts:73`).
- **Błędy nie są dziś cicho połykane.** Zarówno błąd walidacji Zod, jak i błąd Supabase przy insercie, kończą się widocznym komunikatem na `/yarns/new?error=...`. Nie znaleziono ścieżki, w której formularz przekierowuje na sukces bez faktycznego zapisu.
- **RLS + GRANT na `yarns` są dziś poprawnie skonfigurowane** dla operacji INSERT — polityka `WITH CHECK (auth.uid() = user_id)` istnieje, a osobna migracja `20260823120100_grant_yarns_privileges.sql` explicite naprawia historyczny brak GRANT (to jest właśnie dowód z §2 test-planu na "pułapkę, która już raz wystąpiła" — dziś naprawioną, ale warto zabezpieczyć regresję testem).
- **Dwa realne, potwierdzone w kodzie kandydaci na "cichą porażkę"**, oba warte pokrycia testem:
  1. **Constraint bazy `yarns_quantity_present`** (co najmniej jedna z `quantity_skeins`/`quantity_grams` wymagana) jest zduplikowany w Zod (`.refine`) i w DB. Jeśli kiedykolwiek rozjadą się reguły klient/serwer/DB, DB odrzuci insert wyjątkiem — pytanie testowe: czy ten wyjątek zawsze trafia do czytelnego komunikatu, czy może zniknąć.
  2. **Rozjazd RLS insert-vs-select**: `createYarn` używa `.insert(...).select().single()` — insert może się powieść, ale następujący po nim SELECT (też pod RLS) może zwrócić błąd, co rzuci wyjątek i pokaże użytkownikowi porażkę **mimo że wiersz faktycznie już istnieje w bazie**. To dokładnie odwrotność zgłoszonego ryzyka, ale sąsiaduje z nim i zasługuje na osobny test/asercję.
- **Zero testów integracyjnych i zero konwencji integracyjnej istnieje dziś w repo** — to będzie pierwsza faza ustalająca wzorzec (zgodnie z test-plan.md §6.2). Lokalny Supabase jest gotowy do użycia (`supabase/config.toml` skonfigurowany, `supabase` CLI w devDependencies), ale trzeba będzie pobrać `anon key` z outputu `npx supabase start` — `.env.example` zawiera tylko placeholdery.
- **Historyczna decyzja z `add-and-browse-yarn-library`** (zarchiwizowana zmiana) ujawniła dwa kryteria akceptacji nigdy faktycznie niezweryfikowane end-to-end (tylko odczytem kodu): pusta biblioteka pokazuje stan pusty; dostęp do cudzej włóczki przekierowuje bez wycieku. To naturalni pierwsi kandydaci do faktycznego automatycznego pokrycia.

## Detailed Findings

### Przepływ "dodanie włóczki" — pełna ścieżka

1. `src/pages/dashboard.astro:45,75` — linki „Dodaj włóczkę” → `/yarns/new`.
2. `src/pages/yarns/new.astro:1-20` — strona SSR (`prerender=false`), renderuje React island `YarnForm` z `client:load`, `action="/api/yarns"`. Czyta z query stringa wyłącznie `error` (linia 7) — **nie odtwarza wcześniej wpisanych wartości formularza** przy błędzie.
3. `src/components/yarn/YarnForm.tsx:199-206` — natywny `<form method="POST" action="/api/yarns" encType="multipart/form-data" noValidate onSubmit={handleSubmit}>`. Brak `fetch()` w tym komponencie.
4. `YarnForm.tsx:144-165,180-191` — `handleSubmit` woła `validate()` = `createYarnSchema.safeParse(...)` (ten sam schemat co serwer). Walidacja nieudana → `preventDefault()`, formularz nie jest wysyłany. Walidacja udana → normalny submit przeglądarki (prawdziwa nawigacja, nie XHR).
5. `src/components/auth/SubmitButton.tsx:12` — używa `useFormStatus()` z `react-dom` do pokazania stanu „Zapisywanie...” w oczekiwaniu na zakończenie natywnej nawigacji formularza.
6. `src/pages/api/yarns.ts` (`POST`, `prerender=false`):
   - `:16-18` — guard: brak `context.locals.user` → redirect `/auth/signin`.
   - `:20-23` — `createClient(context.request.headers, context.cookies)` z `src/lib/supabase.ts:5-24` — klient SSR **w kontekście sesji użytkownika** (cookies), nie service-role → RLS aktywne.
   - `:25-39` — `createYarnSchema.safeParse(FormData)`; błąd → redirect `/yarns/new?error=<komunikat>` (`:41-44`).
   - `:46-52` — `validateYarnPhoto(file)` osobno od schematu Zod.
   - `:54-61` — `createYarn(supabase, userId, parsed.data)` w `try/catch`; błąd → `console.error` + redirect `/yarns/new?error=...` (błąd **nie jest** cicho połykany).
   - `:63-71` — jeśli zdjęcie: `attachYarnPhoto(...)`; błąd tutaj to **soft-fail** — włóczka już zapisana, redirect na `/dashboard?warning=...` z jawnym komunikatem.
   - `:73` — sukces → redirect `/dashboard`.
7. `src/lib/services/yarns.ts:69-93` — `createYarn`:
   ```ts
   const { data: yarn, error } = await supabase
     .from("yarns")
     .insert({ user_id: userId, name: data.name, manufacturer: data.manufacturer, /* ... */ })
     .select()
     .single();
   if (error) throw error;
   if (!yarn) throw new Error("Insert succeeded but returned no row");
   return yarn;
   ```

### Walidacja — `src/lib/validation/yarn.ts:63-92`

`createYarnSchema` (Zod, jedyne źródło prawdy, importowane identycznie po stronie klienta i serwera):

- `name`, `manufacturer` — wymagane, `min(1)`, max 200 znaków.
- `quantity_skeins` / `quantity_grams` — opcjonalne liczby nieujemne każda z osobna, ale `.refine` (`:78-81`) wymaga **co najmniej jednej** z nich (logika OR, nie AND — potwierdzone też w archiwalnej decyzji `add-and-browse-yarn-library/plan.md:47`).
- `composition` — tablica `{fiber, percent}`, domyślnie `[]` (opcjonalna); jeśli niepusta, `.refine` (`:82-92`) wymaga sumy % ≈ 100 (tolerancja 0.5).
- `needle_size_mm` / `hook_size_mm` — opcjonalne, muszą być dodatnie.
- `rating` — opcjonalne, int 1–5.
- `validateYarnPhoto` (`:99-107`) — osobna walidacja MIME (JPEG/PNG/WEBP) i rozmiaru (max 5MB), poza schematem Zod.

### Schemat i ograniczenia bazy danych — `supabase/migrations/20260823120000_create_yarns_table.sql`

- `:3-33` — tabela `yarns`: `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`; `name`, `manufacturer` `not null`; reszta pól nullable.
- `:27` — `constraint yarns_quantity_present check (quantity_skeins is not null or quantity_grams is not null)` — **zduplikowana reguła** z Zod `.refine`, druga linia obrony na poziomie DB.
- `:28-32` — dodatkowe checki: nieujemność ilości, dodatniość rozmiarów drutów/szydełka, `rating between 1 and 5`.
- `:53` — `alter table yarns enable row level security;`
- `:60-63` — jedyna polityka INSERT:
  ```sql
  create policy "Users can insert their own yarns"
    on yarns for insert to authenticated
    with check (auth.uid() = user_id);
  ```
- `:37-51` — trigger `set_updated_at()` jest `BEFORE UPDATE`, **nie dotyczy INSERT** — wykluczony jako przyczyna tego ryzyka. Funkcja ma jawnie ustawiony `search_path` zgodnie z regułą w `context/foundation/lessons.md`.

### GRANT — `supabase/migrations/20260823120100_grant_yarns_privileges.sql:1-3`

Osobna migracja, komentarz w kodzie wprost mówi:
```sql
-- RLS policies alone do not grant table access in Postgres — the `authenticated`
-- role also needs explicit table-level privileges, which the previous migration omitted.
grant select, insert, update, delete on yarns to authenticated;
```
To jest źródłowy dowód historycznego incydentu, na który powołuje się `test-plan.md:49` (Ryzyko #4, ale ten sam wzorzec pułapki dotyczy każdej tabeli). **Stan dzisiejszy: GRANT istnieje i obejmuje INSERT — problem jest już naprawiony**, ale brak automatycznego testu regresji, który wykryłby powrót tego błędu przy przyszłej migracji.

### Test referencyjny i konwencja testowa — `vitest.config.ts`, `src/lib/services/substitute-matching.test.ts`

- `vitest.config.ts` (11 linii) — tylko alias `@`→`./src`, brak `environment`/`setupFiles`, domyślny `node`. Zero konfiguracji pod testy integracyjne czy komponenty React.
- `package.json:13` — `"test": "vitest run"` (jednorazowy przebieg, nie watch — dobre pod CI).
- 4 istniejące pliki `*.test.ts` (`substitute-matching.test.ts`, `utils.test.ts`, `validation/yarn.test.ts`, `yarn-filters.test.ts`) testują **wyłącznie czyste funkcje**, zero I/O, zero mocków. `validation/yarn.test.ts` (24 linie) pokrywa dziś tylko regułę `quantity_skeins: 0` — **nie pokrywa** sumy składu 100%, reguły "co najmniej jedna ilość", limitów długości pól ani `rating` 1–5.
- **Zero testów integracyjnych, zero helpera do lokalnego Supabase, zero testów API routes** — potwierdzone przez `test-plan.md` samo i przez brak jakiegokolwiek katalogu `tests/`/`__tests__` w repo.
- `supabase/config.toml` — lokalny Supabase w pełni skonfigurowany: API port `54321`, DB `54322`, Studio `54323`; `auth.enable_confirmations = false` (ułatwia testowe konta bez potwierdzania e-maila).
- `supabase` (`^2.23.4`) jest w `devDependencies` — CLI dostępne przez `npx supabase start` bez globalnej instalacji.
- `.env.example` zawiera tylko placeholdery (`SUPABASE_URL=###`, `SUPABASE_KEY=###`) — realny lokalny `anon key` trzeba odczytać z outputu `npx supabase start`, nie z tego pliku. `.dev.vars.example` nie istnieje.

## Architecture Insights

- **Jeden schemat Zod, dwa miejsca użycia** (klient + serwer) — nie ma ryzyka rozjazdu reguł walidacji między frontendem a backendem, bo to dosłownie ten sam import.
- **Podwójna obrona na poziomie ilości** (Zod `.refine` + DB `constraint`) jest świadomym wzorcem w tym repo (potwierdzonym też w innych miejscach, np. rating 1–5 tylko w Zod, ale needle/hook size dodatnie w obu warstwach) — test integracyjny powinien próbować obejść walidację klienta (np. bezpośrednie żądanie do API z nieprawidłowymi danymi), żeby faktycznie przetestować warstwę DB, nie tylko Zod.
- **Serwis (`src/lib/services/yarns.ts`) nigdy nie tworzy własnego klienta Supabase** — zawsze przyjmuje gotowy, uwierzytelniony klient jako pierwszy parametr. To oznacza, że test integracyjny może wywołać `createYarn` bezpośrednio z realnym testowym klientem SSR (bez konieczności przechodzenia przez HTTP), albo testować przez pełny endpoint — obie opcje są możliwe, wybór należy do `/10x-plan`.
- **Brak warstwy "API mocking"** w tym projekcie (potwierdzone też w `test-plan.md §4`) — jedyna sensowna warstwa dla tego ryzyka to **integration z prawdziwym lokalnym Supabase**, zgodnie z rekomendacją test-planu; zaślepka Supabase skłamałaby o constraintach DB i RLS, które są właśnie sednem tego, co ryzyko #1 chce udowodnić.

## Historical Context (from prior changes)

- `context/archive/2026-08-23-add-and-browse-yarn-library/plan.md` — oryginalny plan implementacji formularza dodawania włóczki (wtedy `AddYarnForm.tsx`, od tego czasu przemianowany na współdzielony `YarnForm.tsx` w zmianie `manage-saved-yarn-entry`). Potwierdza decyzje: logika OR na ilości, walidacja składu tylko gdy niepusty, kolejność zapisu insert→upload→update photo_url jako soft-fail, `photo_url` jako ścieżka prywatna (nie publiczny URL).
- Ten sam plan, sekcja kryteriów akceptacji: **5.3** ("pusta biblioteka pokazuje stan pusty") i **5.6** ("dostęp do cudzej włóczki przekierowuje bez wycieku") oznaczone w impl-review jako `SKIPPED` — zweryfikowane tylko czytaniem kodu, nigdy faktycznym testem. Naturalni kandydaci do pokrycia przy okazji tej fazy.
- `context/archive/2026-08-29-manage-saved-yarn-entry/plan.md:25` — potwierdza, że `createYarnSchema` już świadomie akceptuje `quantity_skeins`/`quantity_grams` = `0` jako poprawną wartość (`nonnegative()`, nie `positive()`) — źródło istniejącego testu jednostkowego `yarn.test.ts`.
- `context/foundation/lessons.md` — reguła o `search_path` w funkcjach Postgres (zastosowana w `set_updated_at`) oraz reguła o `return` na najwyższym poziomie frontmatteru `.astro` (nieistotna dla `new.astro`, który nie ma warunkowego przekierowania w tym miejscu, ale istotna gdyby test integracyjny wymagał modyfikacji tej strony).

## Code References

- `src/pages/yarns/new.astro:7,14` — strona formularza, czytanie `error` z query stringa
- `src/components/yarn/YarnForm.tsx:144-165` — `validate()`, `createYarnSchema.safeParse`
- `src/components/yarn/YarnForm.tsx:180-191` — `handleSubmit`
- `src/components/yarn/YarnForm.tsx:199-208` — natywny `<form>`, hidden inputs `composition`/`rating`
- `src/pages/api/yarns.ts:16-73` — cały handler `POST`
- `src/lib/services/yarns.ts:69-93` — `createYarn`
- `src/lib/validation/yarn.ts:63-92` — `createYarnSchema`
- `src/lib/validation/yarn.ts:99-107` — `validateYarnPhoto`
- `supabase/migrations/20260823120000_create_yarns_table.sql:3-33` — definicja tabeli `yarns`
- `supabase/migrations/20260823120000_create_yarns_table.sql:53,60-63` — RLS + polityka INSERT
- `supabase/migrations/20260823120100_grant_yarns_privileges.sql:1-3` — GRANT (historyczna naprawa)
- `vitest.config.ts` — konfiguracja testowa (alias `@` only)
- `src/lib/services/substitute-matching.test.ts` — test referencyjny wg `test-plan.md §6.1`
- `supabase/config.toml` — lokalna konfiguracja portów Supabase

## Related Research

- `context/archive/2026-08-29-ai-substitute-suggestions/research.md` — wcześniejsze badanie konwencji serwisu/walidacji/RLS dla innej funkcji tego projektu; potwierdza te same wzorce (serwis jako plain functions, `.eq("user_id", userId)` jako defense-in-depth, RLS + osobny GRANT).

## Open Questions

- Czy test integracyjny dla Ryzyka #1 powinien uderzać w pełny endpoint HTTP (`POST /api/yarns` z prawdziwym `FormData`/multipart), czy wywoływać `createYarn(supabase, userId, data)` bezpośrednio z realnym testowym klientem Supabase? Obie opcje są technicznie możliwe dzięki architekturze serwisu — decyzja należy do `/10x-plan`.
- Czy w tej fazie warto od razu dorzucić asercję na scenariusz "insert powiódł się, ale `.select().single()` po nim zwrócił błąd" (odwrotność zgłoszonego ryzyka, ale sąsiadująca z nim) — wymagałoby to symulacji rozjazdu RLS insert/select, co może być trudne do wywołania z zewnątrz bez modyfikacji polityk w locie.
- Jak dokładnie pozyskać lokalny `anon key`/URL do testów (`npx supabase start` output) i gdzie go przechowywać dla CI — to pytanie należy do konwencji ustalanej w tej fazie (§6.2 test-plan.md), nie do samego badania.
