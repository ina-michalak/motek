---
date: 2026-08-29T14:47:54+02:00
researcher: Claude Code
git_commit: d9a4b82eb58b5a5393668c45718758d0a5dab8a8
branch: develop
repository: motek
topic: "S-02 ai-substitute-suggestions — jak zaimplementować sugestie AI zamienników włóczki"
tags: [research, codebase, yarns, substitutes, supabase, rls, api-routes, astro-islands]
status: complete
last_updated: 2026-08-29
last_updated_by: Claude Code
---

# Research: S-02 ai-substitute-suggestions

**Date**: 2026-08-29T14:47:54+02:00
**Researcher**: Claude Code
**Git Commit**: d9a4b82eb58b5a5393668c45718758d0a5dab8a8
**Branch**: develop
**Repository**: motek

## Research Question

Jak zaimplementować fragment mapy drogowej S-02 (`ai-substitute-suggestions`) — sekcję zamienników na stronie szczegółów włóczki z sugestiami wygenerowanymi z własnej biblioteki usera, z możliwością akceptacji/trwałego odrzucenia każdej sugestii — w sposób spójny z tym, co już istnieje w bazie kodu po S-01?

## Summary

- **"AI" w S-02 to nie wywołanie LLM.** PRD (`Business Logic`, `Non-Goals`) i roadmapa jednoznacznie definiują to jako **deterministyczne dopasowanie parametrów** (skład, grubość/druty/szydełko, opcjonalnie kolor) z własnej biblioteki usera — z jawnym wykluczeniem "AI uczącego się gustu" na rzecz "prostego dopasowania parametrów + trwałego odrzucenia danej pary". To determinuje architekturę: nie potrzeba integracji z żadnym modelem AI, potrzebny jest algorytm podobieństwa + dwie nowe tabele (akceptacje, odrzucenia).
- **Schemat `yarns` już istnieje i był świadomie projektowany pod S-02** (F-01 `plan.md:5`), ale ma jedną znaną lukę: `gauge_note` to wolny tekst, nie ustrukturyzowany parametr — jeśli dopasowanie ma go używać, wymaga to decyzji projektowej (patrz Open Questions).
- **Brak jakichkolwiek tabel/typów substitute/suggestion/rejection** — czysta karta, trzeba zaprojektować schemat od zera (prawdopodobnie 2 tabele: zaakceptowane zamienniki i trwałe odrzucenia, obie per `(yarn_id, suggested_yarn_id, user_id)`).
- **Wzorce do powielenia są jasne i spójne**: serwis w `src/lib/services/*.ts` (plain async functions, pierwszy param `SupabaseClient`, drugi `userId`, `.eq("user_id", userId)` jako defense-in-depth obok RLS, rzucanie surowego `PostgrestError`), walidacja zod w `src/lib/validation/*.ts`, RLS + `grant` na nowej tabeli wg wzorca z `yarns`.
- **Jedna prawdziwa luka konwencyjna**: istniejący endpoint `src/pages/api/yarns.ts` to classic form-POST z przekierowaniem (nie JSON), a `/api/yarns` NIE jest w `PROTECTED_ROUTES` middleware (chroniony tylko ręcznym guardem w handlerze). Nowa funkcja accept/reject będzie potrzebować natychmiastowego feedbacku UI bez przeładowania strony — czyli prawdopodobnie JSON API + `fetch`, co jest **nowym wzorcem w tym repo**, nie kopiowaniem istniejącego.
- **Miejsce w UI jest już przygotowane**: strona `src/pages/yarns/[id].astro` została w S-01 świadomie zaprojektowana z "naturalnym podziałem na sekcje" pod przyszłą sekcję zamienników (S-01 `plan.md:290`).

## Detailed Findings

### Schemat danych — tabela `yarns`

Pełny schemat (`supabase/migrations/20260823120000_create_yarns_table.sql:3-33`):

| Kolumna | Typ | Nullable | Uwagi |
|---|---|---|---|
| `id` | uuid | NOT NULL | PK, `default gen_random_uuid()` |
| `user_id` | uuid | NOT NULL | FK → `auth.users(id) on delete cascade`, `default auth.uid()`, indeksowany (`yarns_user_id_idx`) |
| `name` | text | NOT NULL | |
| `manufacturer` | text | NOT NULL | |
| `quantity_skeins` / `quantity_grams` | numeric(10,2) | nullable każde | co najmniej jedno wymagane (`yarns_quantity_present`), obie `>= 0` |
| `color` | text | nullable | wolny tekst |
| `dye_lot` | text | nullable | numer partii farbowania, nie rodzina koloru |
| `composition` | jsonb | nullable | tablica `{fiber, percent}[]`; suma % walidowana tylko na poziomie aplikacji (zod), nie w DB |
| `needle_size_mm` / `hook_size_mm` | numeric(4,2) | nullable każde | `> 0`, niezależne — może być wypełnione jedno, drugie, oba albo żadne |
| `gauge_note` | text | nullable | **wolny tekst**, nie ustrukturyzowany parametr |
| `rating` | smallint | nullable | 1–5 |
| `note`, `photo_url` | text | nullable | `photo_url` to ścieżka w Storage, nie gotowy URL |

RLS (`supabase/migrations/20260823120000_create_yarns_table.sql:53-74`): `enable row level security` + 4 polityki per operacja (`SELECT`/`INSERT`/`UPDATE`/`DELETE`), wszystkie `to authenticated` z `auth.uid() = user_id`. **Krytyczne**: osobna migracja `20260823120100_grant_yarns_privileges.sql:3` dodaje `grant select, insert, update, delete on yarns to authenticated;` — RLS samo w sobie nie nadaje dostępu do tabeli w Postgresie, trzeba to powtórzyć dla nowych tabel.

Trigger `set_updated_at()` (`...120000...sql:37-46`) ma jawnie ustawiony `search_path = pg_catalog, public` — zgodnie z regułą w `context/foundation/lessons.md:5-10` (Supabase Security Advisor "Function Search Path Mutable"). Funkcja już istnieje i można ją ponownie użyć (nowy trigger `before update ... execute function set_updated_at()`) zamiast definiować drugą.

TypeScript: `src/types.ts:1-24` — `Yarn` (1:1 z wierszem DB) + `YarnFiberComposition { fiber, percent }`. Brak osobnych typów Row/Insert/Update — wzorzec repo to jeden typ encji + DTO wyprowadzone z zod (`CreateYarnInput = z.infer<typeof createYarnSchema>`).

**Brak jakiejkolwiek tabeli substitute/suggestion/rejection** — potwierdzone grepem po całym repo poza plikami planistycznymi.

### Konwencje serwisu i walidacji

`src/lib/services/yarns.ts` — wzorzec do powielenia:
- Plain exported async functions, **nie klasy**: `listYarns(supabase, userId)`, `getYarnById(supabase, userId, id)`, `createYarn(supabase, userId, data)`, `attachYarnPhoto(supabase, userId, yarnId, file)` (`:30,48,69,95`).
- Pierwszy param zawsze już-uwierzytelniony `SupabaseClient`; drugi zawsze `userId: string` z `context.locals.user.id` — serwis nigdy sam nie tworzy klienta.
- Każde zapytanie filtruje `.eq("user_id", userId)` jako defense-in-depth obok RLS (`:34,57,105,120`).
- `if (error) throw error;` zaraz po każdym wywołaniu Supabase — surowy `PostgrestError`, bez owijania (`:37,63,90`).
- Operacje wieloetapowe (np. `attachYarnPhoto`) ręcznie wycofują częściowe zmiany przy błędzie (`:122-127`).

`src/lib/validation/yarn.ts` — wzorzec do powielenia:
- Reużywalne preprocessory dla danych z `FormData` (wszystko stringiem): `emptyToUndefined`, `optionalTrimmedString`, `optionalNonNegativeNumber`, `optionalPositiveNumber` (`:33-44`).
- Zagnieżdżone dane (tablica) jako JSON-string w polu formularza, parsowane przez `z.preprocess` (`compositionSchema:54-61`).
- Współdzielone słowniki jako `as const` w tym samym pliku: `KNOWN_MANUFACTURERS` (`:3-14`), `COMMON_NEEDLE_HOOK_SIZES_MM = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 12]` (`:16`), `COMMON_FIBERS` (`:18-31`) — algorytm dopasowania powinien z nich korzystać do normalizacji zamiast wymyślać własne.

### API routes i middleware

`src/pages/api/yarns.ts` — jedyny istniejący endpoint domenowy:
- `export const prerender = false;` (`:6`), tylko `POST` (`:15`).
- Guard: `if (!context.locals.user) return context.redirect("/auth/signin");` (`:16-18`) — **ręczny w handlerze**, bo `/api/yarns` NIE jest wpisane w `PROTECTED_ROUTES`.
- Wejście to `FormData`, walidacja `schema.safeParse(...)`, błędy → **redirect z `?error=`** (klasyczny form-POST, nie JSON API).
- Sukces → `context.redirect("/dashboard")`.

`src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard", "/yarns"]` (prefix match). `/api/yarns` nie jest objęte — trzeba albo dodać nowy prefiks, albo polegać na ręcznym guardzie w handlerze (jak dziś).

**Ważna decyzja do podjęcia w planowaniu**: accept/reject sugestii potrzebuje natychmiastowego feedbacku UI (bez przeładowania strony) — czyli prawdopodobnie `fetch` + JSON response (`Response.json({...}, { status })`), a nie redirect. **W repo nie ma dziś ani jednego przykładu JSON-API route** — to będzie nowy wzorzec, nie kopia istniejącego.

### Frontend — strona szczegółów i lista

`src/pages/yarns/[id].astro`:
- Czysto statyczny Astro (SSR), zero React islands na tej stronie dziś.
- Sekcje renderowane jako `<section>` z nagłówkiem `<h2 class="text-muted-foreground mb-2 text-sm font-semibold">` (linie 70, 83, 96, 103).
- **Miejsce na sekcję zamienników**: wewnątrz istniejącego `space-y-6 p-6` kontenera, po ostatniej sekcji (notatka, linia ~106) — S-01 świadomie zostawiło tu "naturalny podział na sekcje" pod S-02 (archiwalny `plan.md:290`).
- Ponieważ sekcja potrzebuje interaktywności (accept/reject), naturalnie hostowałaby React island z `client:load`, analogicznie do `AddYarnForm`.

`src/pages/dashboard.astro` (to jest właściwa lista/grid biblioteki, nie ma osobnego `yarns/index.astro`):
- Pusty stan (linie 52-62) — wzorzec do powielenia dla "za mało włóczek na sensowne sugestie" z FR-007: wyśrodkowana karta z ikoną, zachęcającym tekstem i CTA, klasy `border-border bg-card ... rounded-2xl border p-12 text-center`.

`src/components/yarn/YarnCard.astro` — Astro (nie React), używa shadcn `Card`/`CardContent`, dobry szablon do renderowania mini-karty sugerowanego zamiennika, ale bez slotu na akcje (accept/reject trzeba dołożyć osobno).

**shadcn/ui zainstalowane**: tylko `button`, `card`, `input`, `label`, `textarea`. **Brak `badge`** — jeśli potrzebne chipy statusu, trzeba dodać `npx shadcn@latest add badge` albo powielić istniejący ad-hoc wzorzec `<span class="bg-secondary rounded-full px-3 py-1.5 ...">` (detail page, `chipClass`).

`src/components/hooks/` — **katalog istnieje, ale jest pusty**. Brak ustalonego wzorca hooka do fetch-based optymistycznego UI; `AddYarnForm` używa natywnego form-POST + pełnej nawigacji, nie `fetch`. Komponent accept/reject wprowadzi nowy wzorzec w tym repo (lokalny `useState` + `fetch`), nie podąży za istniejącym.

Konwencja Astro-island: statyczne `.astro` dla layoutu/SSR-fetch, React islands tylko tam gdzie potrzebna interakcja, hydratacja `client:load` (formularze) lub `client:only="react"` (np. `ThemeToggle`, gdy SSR nie ma sensu). Dane płyną jednokierunkowo Astro → React przez propsy przy wywołaniu (`<Component prop={value} client:load />`), bez współdzielonego stanu/kontekstu między wyspami.

## Code References

- `supabase/migrations/20260823120000_create_yarns_table.sql:3-74` — pełny schemat `yarns` + RLS + trigger
- `supabase/migrations/20260823120100_grant_yarns_privileges.sql:3` — wymagany `grant` obok RLS
- `src/types.ts:1-24` — `Yarn`, `YarnFiberComposition`
- `src/lib/services/yarns.ts:30,48,69,95` — wzorzec serwisu (list/get/create/attachPhoto)
- `src/lib/validation/yarn.ts:3-31,33-44,54-61,63-94` — słowniki, preprocessory, `createYarnSchema`
- `src/pages/api/yarns.ts:6,15-18,25-44,73` — wzorzec API route (form-POST, redirect-on-error)
- `src/middleware.ts:4,18-22` — `PROTECTED_ROUTES`, ochrona prefix-match
- `src/pages/yarns/[id].astro:12-21,38-107` — strona szczegółów, miejsce na sekcję zamienników
- `src/pages/dashboard.astro:13,52-67` — lista/grid + pusty stan
- `src/components/yarn/YarnCard.astro` — szablon mini-karty włóczki
- `src/components/hooks/` — pusty katalog, brak wzorca fetch-hooka
- `context/foundation/lessons.md:5-17` — reguła `search_path` dla funkcji Postgres; pułapka `return` w top-level frontmatterze `.astro`

## Architecture Insights

- **Warstwa danych jest "gruba na typach, cienka na abstrakcji"**: jeden typ encji per tabela, DTO wyprowadzone z zod, serwis jako zbiór funkcji (nie repozytorium/klasa). Nowa funkcja powinna trzymać się tego stylu — `src/lib/services/substitutes.ts` z funkcjami typu `listSubstituteSuggestions`, `acceptSubstitute`, `rejectSubstitute`.
- **RLS + `user_id` filter w zapytaniu to podwójna warstwa obrony** stosowana konsekwentnie — każda nowa tabela musi mieć własne RLS (4 polityki) + `grant` + filtr `.eq("user_id", userId)` w serwisie, nawet gdy RLS teoretycznie już to zapewnia.
- **Brak precedensu JSON API w repo** — wszystko dziś to server-rendered strony + form-POST z redirectami. To pierwsza funkcja, która prawdopodobnie wymusi wprowadzenie prawdziwego JSON API route (dla płynnego accept/reject bez przeładowania), co jest decyzją architektoniczną do jawnego podjęcia w planie, nie czymś do "skopiowania".
- **Puste `src/components/hooks/`** oznacza, że nie ma tu ustalonej konwencji na optymistyczne UI / obsługę fetch w komponencie React — plan powinien albo zaprojektować minimalny lokalny wzorzec (bez nadmiarowej abstrakcji), albo świadomie użyć prostego `useState` + `fetch` bez ekstrakcji do hooka, zgodnie z zasadą "nie buduj abstrakcji, zanim nie ma drugiego użycia".

## Historical Context (from prior changes)

- `context/archive/2026-08-23-yarn-data-foundation/plan.md:5` — F-01 explicitly designed columns to "udźwignąć parametry potrzebne do dopasowania zamienników w S-02" (support S-02's matching parameters) — to był świadomy cel projektowy, nie przypadek.
- `context/archive/2026-08-23-yarn-data-foundation/plan.md:36` — F-01 świadomie **nie** tworzyło tabel substitute/rejection: "te powstaną razem z fragmentem `ai-substitute-suggestions`, gdy będzie znany dokładny kształt logiki dopasowania" — potwierdza, że projekt tych tabel to właśnie zadanie tej zmiany.
- `context/archive/2026-08-23-yarn-data-foundation/plan-brief.md:51` — **najważniejsze ryzyko z F-01 dla S-02**: "Format `gauge_note` jako wolny tekst może wymagać restrukturyzacji, gdy w przyszłości okaże się potrzebny jako parametr dopasowania zamienników — świadomie odłożone." Decyzja, czy S-02 używa `gauge_note` do dopasowania, jest więc otwarta i ma koszt (potencjalna migracja/restrukturyzacja).
- `context/archive/2026-08-23-add-and-browse-yarn-library/plan.md:290` — strona `[id].astro` została zaprojektowana z "naturalnym podziałem na sekcje ułatwiającym późniejsze dołożenie" sekcji zamienników — potwierdza brak potrzeby refaktoryzacji layoutu przed dodaniem S-02.
- `context/archive/2026-08-23-add-and-browse-yarn-library/change.md:14-23` (Aneks) — helper `src/lib/numeric-input.ts` blokujący litery/`-+eE`/wartości ujemne w polach numerycznych powinien być reużyty w każdym nowym UI z polami numerycznymi (np. progi tolerancji dopasowania, jeśli byłyby edytowalne).
- `context/foundation/roadmap.md:82-92` — pełny zapis slice'u S-02: brak zanotowanych "Niewiadome" na poziomie roadmapy (jedyna niewiadoma to techniczna, odkryta dopiero w tym researchu: `gauge_note`).

## Related Research

- `context/archive/2026-08-23-yarn-data-foundation/plan.md` — projekt schematu `yarns` (fundament, od którego zależy ta zmiana)
- `context/archive/2026-08-23-add-and-browse-yarn-library/plan.md` — implementacja formularza/listy/szczegółów włóczki (bezpośredni poprzednik)

## Open Questions

1. **Czy `gauge_note` (wolny tekst) wchodzi w skład parametrów dopasowania zamienników?** Jeśli tak, prawdopodobnie wymaga to ustrukturyzowania (np. osobne kolumny stitches/rows na 10cm) — czyli mini-migracji przed właściwą logiką dopasowania. Jeśli nie, dopasowanie opiera się wyłącznie na `composition`, `needle_size_mm`/`hook_size_mm` i opcjonalnie `color`. — Owner: user/projektant algorytmu. Blokuje: tak, wpływa na zakres migracji w Fazie 1 planu.
2. **Dokładna definicja "podobieństwa"**: jakie wagi/tolerancje dla różnicy needle/hook size (np. ±0.5mm), dopasowania składu (dokładne dopasowanie fiber czy tolerancja %), czy brak wypełnionego parametru u jednej z włóczek wyklucza ją z porównania czy jest neutralny? To rdzeń algorytmu i wymaga jawnej decyzji w planie, research nie rozstrzyga tego (poza samym faktem, że ma to być deterministyczne dopasowanie, nie ML).
3. **Kształt schematu accept/reject**: czy to dwie tabele (`yarn_substitute_acceptances`, `yarn_substitute_rejections`) czy jedna tabela ze statusem (`pending`/`accepted`/`rejected`)? PRD sugeruje, że odrzucenie jest trwałe per para, a akceptacja "dodaje jako zamiennik" — może to wymagać też symetrii (czy zaakceptowanie A→B implikuje B→A jako zamiennik?). Nie było o tym mowy w PRD explicite — do rozstrzygnięcia w planie.
4. **JSON API czy form-POST dla accept/reject?** Research wskazuje, że JSON+fetch lepiej pasuje do UX (natychmiastowa reakcja bez przeładowania), ale to pierwszy taki endpoint w repo — decyzja architektoniczna do jawnego zapisania w planie, nie do domyślnego przyjęcia.
