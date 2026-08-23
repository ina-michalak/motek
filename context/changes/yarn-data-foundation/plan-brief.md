# Fundament danych biblioteki włóczek — Krótki plan

> Pełny plan: `context/changes/yarn-data-foundation/plan.md`

## Co i dlaczego

Budujemy pierwszy fundament danych aplikacji: tabelę `yarns` w Supabase z izolacją danych między kontami (RLS) oraz podstawowy model typów TypeScript. To jedyny fundament na mapie drogowej (F-01) — bez niego żaden kolejny fragment (dodawanie włóczki, edycja, filtrowanie, sugestie AI) nie ma gdzie zapisywać danych.

## Punkt wyjścia

Baza kodu nie ma dziś żadnego schematu danych — brak katalogu migracji, brak `src/types.ts`, brak biblioteki walidacji. Auth jest już w pełni gotowe (rejestracja/logowanie/middleware), więc `user.id` z istniejącej sesji jest gotowym punktem zaczepienia dla nowej tabeli. Projekt korzysta wyłącznie z klucza publicznego (`anon`) Supabase — nie ma "furtki" omijającej RLS, więc poprawne polityki RLS są jedynym mechanizmem chroniącym prywatność biblioteki.

## Pożądany stan końcowy

Tabela `yarns` istnieje i działa: da się do niej zapisać wpis, a dane jednego użytkownika są całkowicie niewidoczne dla innego — potwierdzone ręcznie w Supabase Studio na dwóch testowych kontach. Kod aplikacji ma gotowy, jeden autorytatywny typ `Yarn` do importowania w kolejnych fragmentach.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
| --- | --- | --- | --- |
| Ilość włóczki | Dwie kolumny: `quantity_skeins` + `quantity_grams` | User może podać dowolną jednostkę lub obie, bez utraty informacji | Plan |
| Skład włókien | Kolumna `jsonb` z listą `{fiber, percent}` | Lekki fundament bez dodatkowej tabeli/JOIN-ów; lista popularnych włókien żyje w kodzie frontendu | Plan |
| Druty/szydełko | Dwie niezależne, opcjonalne kolumny liczbowe (mm) | Zgodnie z PRD pole jest opcjonalne; user wypełnia jedną, drugą, obie lub żadną | Plan |
| Próbka | Wolne pole tekstowe | Dokładniejsza struktura odłożona na później — za wcześnie na decyzję o formacie | Plan |
| Ocena/notatka | `rating` (1–5) + osobne pole `note` | Liczbowa ocena umożliwia przyszłe sortowanie (S-04) | Plan |
| Zdjęcie | Tylko kolumna `photo_url`, magazyn plików później | Bucket bez ekranu uploadu nie da się sensownie zweryfikować ręcznie — dograjemy w S-01 | Plan |
| Zakres kodu | Tylko migracja SQL + `src/types.ts`, bez zod i warstwy serwisowej | Fundament ma zostać wąski; walidacja i zapytania mają sens dopiero przy konkretnym API w S-01 | Plan |

## Zakres

**W zakresie:** tabela `yarns`, ograniczenia integralności, indeks pod `user_id`, trigger `updated_at`, cztery granularne polityki RLS, plik `src/types.ts` z typem `Yarn`.

**Poza zakresem:** tabele zamienników/odrzuceń (S-02), Supabase Storage bucket na zdjęcia, zod, warstwa serwisowa/query helpery, jakikolwiek UI lub endpoint API.

## Architektura / Podejście

Jedna tabela `yarns` z kolumną `user_id` wskazującą na `auth.users.id`, chronioną RLS filtrującym po `auth.uid() = user_id` na każdej operacji. Typy TypeScript odzwierciedlają kolumny 1:1 (bez warstwy mapującej), zgodnie z tym, co zwraca `@supabase/supabase-js` bez ORM-a.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Migracja bazy danych | Tabela `yarns` + RLS + ograniczenia + indeks | Błąd w polityce RLS ujawniłby dane między kontami — jedyny prawdziwie krytyczny punkt tego fundamentu |
| 2. Typy TypeScript | `src/types.ts` z typem `Yarn` | Rozjazd między typami a rzeczywistymi kolumnami, jeśli migracja zmieni się później bez aktualizacji typów |

**Wymagania wstępne:** lokalne środowisko Supabase (`npx supabase start`, wymaga Dockera) do weryfikacji ręcznej.
**Szacowany nakład pracy:** ~1 sesja, 2 fazy.

## Otwarte ryzyka i założenia

- Format `gauge_note` jako wolny tekst może wymagać restrukturyzacji, gdy w przyszłości okaże się potrzebny jako parametr dopasowania zamienników — świadomie odłożone.
- Baza nie wymusza sumy procentów składu włókien = 100% — poleganie na walidacji aplikacyjnej w S-01.

## Kryteria sukcesu (podsumowanie)

- Migracja aplikuje się czysto i jest odwracalna przez standardowe narzędzia Supabase CLI.
- Dane włóczki jednego użytkownika są całkowicie niewidoczne dla innego (potwierdzone ręcznie).
- `npx astro check` i `npm run lint` przechodzą bez błędów po dodaniu `src/types.ts`.
