# Fundament danych biblioteki włóczek — Plan implementacji

## Przegląd

Wdrażamy pierwszy fundament danych aplikacji: tabelę `yarns` w Supabase Postgres z politykami RLS izolującymi dane między kontami, oraz podstawowy model typów TypeScript (`src/types.ts`) odzwierciedlający tę tabelę. To jedyny fundament na mapie drogowej (F-01) — odblokowuje S-01 (dodawanie/przeglądanie), S-03 (edycja/usuwanie) i S-04 (filtrowanie/sortowanie), a jego projekt kolumn musi udźwignąć parametry potrzebne do dopasowania zamienników w S-02.

## Analiza bieżącego stanu

Baza kodu nie zawiera obecnie żadnego schematu danych domenowych:

- Brak katalogu `supabase/migrations/` — to będzie pierwsza migracja w projekcie.
- Brak `src/types.ts` — brak jakiegokolwiek istniejącego wzorca typów encji do naśladowania.
- Brak zod i jakiejkolwiek biblioteki walidacji w `src/` ani w `package.json`.
- Auth jest w pełni zaimplementowane: `context.locals.user` (typu `User` z `@supabase/supabase-js`) jest ustawiane w `src/middleware.ts:12-13` przez `supabase.auth.getUser()`; pole `user.id` (uuid) to jedyny sensowny cel dla klucza obcego `user_id`.
- Projekt korzysta wyłącznie z klucza `anon` (`astro.config.mjs:17-22`) — brak service-role key nigdzie w repo. RLS jest więc jedynym mechanizmem izolacji danych między kontami (guardrail z PRD), nie jest to opcjonalne wzmocnienie.
- `supabase/config.toml` istnieje (CLI skonfigurowane), ale katalog `migrations/` jeszcze nie.

## Pożądany stan końcowy

Po zakończeniu tego planu:

- Tabela `yarns` istnieje w lokalnej i docelowej bazie Supabase, z RLS włączonym i granularnymi politykami per-operację (select/insert/update/delete), każda ograniczająca dostęp do wierszy, gdzie `user_id = auth.uid()`.
- Migracja aplikuje się czysto przez Supabase CLI.
- `src/types.ts` eksportuje typ `Yarn` (odzwierciedlający dokładnie kolumny tabeli) oraz pomocniczy typ `YarnFiberComposition` dla struktury składu włókien.
- Weryfikacja: nowy wiersz wstawiony jako User A w lokalnym Supabase Studio nie jest widoczny w zapytaniu wykonanym w kontekście User B; `npx astro check` przechodzi bez błędów typów.

### Kluczowe odkrycia:

- `src/middleware.ts:12-13` — `user.id` z `@supabase/supabase-js` `User` to jedyne źródło tożsamości do klucza obcego.
- `astro.config.mjs:17-22` — brak service-role key; wyłącznie `anon` + RLS.
- `context/foundation/infrastructure.md` (ryzyko #5) — zdjęcia włóczek docelowo trafiają bezpośrednio do Supabase Storage przez signed URL z klienta (nie przez funkcję Vercel, limit 4.5MB) — to dotyczy przyszłego uploadu (S-01), nie tego fundamentu.
- Brak istniejących wzorców zod/DTO w `src/` — decyzja o niewprowadzaniu zod w tym kroku jest świadoma, nie przez przeoczenie.

## Czego NIE robimy

- Nie tworzymy tabel dla zamienników/odrzuceń sugestii (relacje `S-02`) — te powstaną razem z fragmentem `ai-substitute-suggestions`, gdy będzie znany dokładny kształt logiki dopasowania.
- Nie konfigurujemy Supabase Storage bucket ani polityk RLS na pliki — rezerwujemy tylko kolumnę `photo_url`; bucket powstanie w `S-01` razem z rzeczywistym ekranem uploadu (bez UI nie da się go sensownie zweryfikować ręcznie).
- Nie wprowadzamy zod ani żadnej biblioteki walidacji.
- Nie tworzymy warstwy serwisowej / query helperów (`src/lib/services/yarn.ts`) ani żadnych endpointów API — to należy do `S-01`, które ustali własne konwencje wokół konkretnego formularza.
- Nie budujemy UI (formularza, listy) — ten fundament dotyczy wyłącznie danych.
- Nie egzekwujemy w bazie sumy procentów składu włókien = 100% — to walidacja aplikacyjna, do zaprojektowania w `S-01` razem z formularzem (checkboxy + auto-uzupełnianie procentów).

## Podejście do implementacji

Dwie ściśle powiązane fazy: najpierw schemat danych (migracja SQL — jedyne miejsce prawdy o kształcie tabeli), potem typy TypeScript, które go odzwierciedlają. Kolejność jest wymuszona: typy bez schematu nie mają się do czego odnosić.

Projekt kolumn wynika z decyzji podjętych w tej sesji planistycznej:

- **Ilość**: dwie niezależne kolumny liczbowe (`quantity_skeins`, `quantity_grams`) zamiast jednej kolumny + jednostki — użytkownik może podać dowolną z nich lub obie. Ograniczenie w bazie wymusza podanie co najmniej jednej (pole jest wymagane w PRD).
- **Skład włókien**: kolumna `jsonb` z tablicą par `{fiber, percent}` zamiast osobnej tabeli złączeniowej — lekki fundament bez dodatkowych JOIN-ów; lista popularnych włókien do checkboxów będzie żyła w kodzie frontendu (S-01), nie w bazie.
- **Druty/szydełko**: dwie niezależne, opcjonalne kolumny liczbowe (`needle_size_mm`, `hook_size_mm`) — można wypełnić jedną, drugą, obie albo żadną (pole jest opcjonalne w PRD).
- **Próbka**: pojedyncze pole tekstowe (`gauge_note`) — dokładniejsza struktura odłożona na później.
- **Ocena/notatka**: rozdzielone na `rating` (liczba 1–5) i `note` (wolny tekst) — ocena liczbowa umożliwia przyszłe sortowanie (S-04).
- **Zdjęcie**: tylko kolumna `photo_url`, magazyn plików odłożony do S-01.

## Faza 1: Migracja bazy danych — tabela `yarns` z RLS

### Przegląd

Tworzy tabelę `yarns` wraz z ograniczeniami integralności, indeksem pod `user_id`, triggerem `updated_at` i granularnymi politykami RLS.

### Wymagane zmiany:

#### 1. Migracja SQL

**Plik**: `supabase/migrations/20260823120000_create_yarns_table.sql`, `supabase/migrations/20260823120100_grant_yarns_privileges.sql`

**Uwaga z implementacji**: Odkryto podczas weryfikacji ręcznej, że same polityki RLS nie wystarczają — Postgres wymaga też jawnego `GRANT` uprawnień na tabelę dla roli `authenticated`, inaczej każdy dostęp (nawet zgodny z polityką) kończy się `permission denied`. Druga migracja (`...120100_grant_yarns_privileges.sql`) dodaje `grant select, insert, update, delete on yarns to authenticated;`.

**Cel**: Utworzyć tabelę `yarns` należącą do zalogowanego użytkownika, z polami wymaganymi przez PRD (nazwa, producent, ilość) i opcjonalnymi (kolor, farbowanie, skład, druty/szydełko, próbka, ocena/notatka, zdjęcie), wraz z pełną izolacją danych przez RLS.

**Kontrakt**:
- Tabela `yarns` z kolumnami: `id uuid primary key default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, `name text not null`, `manufacturer text not null`, `quantity_skeins numeric(10,2)`, `quantity_grams numeric(10,2)`, `color text`, `dye_lot text`, `composition jsonb`, `needle_size_mm numeric(4,2)`, `hook_size_mm numeric(4,2)`, `gauge_note text`, `rating smallint`, `note text`, `photo_url text`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.
- Ograniczenia: `CHECK (quantity_skeins IS NOT NULL OR quantity_grams IS NOT NULL)` (ilość wymagana w co najmniej jednej jednostce); `CHECK` nieujemności dla `quantity_skeins`, `quantity_grams`; `CHECK` dodatniości dla `needle_size_mm`, `hook_size_mm`; `CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)`.
- Indeks: `CREATE INDEX yarns_user_id_idx ON yarns (user_id)` — RLS filtruje każde zapytanie po `user_id`, indeks jest niezbędny dla wydajności listowania (S-04).
- Trigger `updated_at`: funkcja `set_updated_at()` (`NEW.updated_at = now(); RETURN NEW;`) + `BEFORE UPDATE ... FOR EACH ROW EXECUTE FUNCTION set_updated_at()`.
- `ALTER TABLE yarns ENABLE ROW LEVEL SECURITY;` + cztery granularne polityki (`select`, `insert`, `update`, `delete`), każda `USING (auth.uid() = user_id)` (oraz `WITH CHECK (auth.uid() = user_id)` dla `insert`/`update`).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Migracja stosuje się czysto lokalnie: `npx supabase db reset`

#### Weryfikacja ręczna:

- Wiersz wstawiony przez REST API (PostgREST) z access tokenem User A nie jest widoczny w zapytaniu `GET` tego samego API wykonanym z access tokenem User B (test izolacji RLS uwierzytelniony prawdziwym JWT `authenticated`, nie przez Supabase Studio — Studio łączy się jako superużytkownik i domyślnie omija RLS, więc test tam dałby fałszywy wynik pozytywny)
- Próba wstawienia wiersza bez `quantity_skeins` i bez `quantity_grams` zostaje odrzucona przez ograniczenie bazy
- Aktualizacja istniejącego wiersza powoduje automatyczną zmianę `updated_at`

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu wszystkich automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne potwierdzenie od człowieka, że testowanie ręczne zakończyło się sukcesem, zanim przejdziesz do następnej fazy.

---

## Faza 2: Podstawowe typy TypeScript

### Przegląd

Dodaje `src/types.ts` z typem encji `Yarn` odzwierciedlającym dokładnie kolumny tabeli z Fazy 1, gotowym do użycia przez przyszłe zapytania Supabase w S-01.

### Wymagane zmiany:

#### 1. Plik typów współdzielonych

**Plik**: `src/types.ts`

**Cel**: Dostarczyć jeden autorytatywny typ encji `Yarn` (i pomocniczy typ dla struktury składu włókien), które S-01/S-03/S-04 będą importować zamiast każde na nowo definiować kształt wiersza tabeli.

**Kontrakt**:
- `export interface YarnFiberComposition { fiber: string; percent: number }`
- `export interface Yarn` z polami odpowiadającymi 1:1 kolumnom tabeli `yarns` (nazwy pól w `snake_case`, zgodnie z tym, co zwraca `@supabase/supabase-js` bez warstwy mapującej): `id: string`, `user_id: string`, `name: string`, `manufacturer: string`, `quantity_skeins: number | null`, `quantity_grams: number | null`, `color: string | null`, `dye_lot: string | null`, `composition: YarnFiberComposition[] | null`, `needle_size_mm: number | null`, `hook_size_mm: number | null`, `gauge_note: string | null`, `rating: number | null`, `note: string | null`, `photo_url: string | null`, `created_at: string`, `updated_at: string`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Sprawdzanie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`

#### Weryfikacja ręczna:

- Ręczne porównanie pól `Yarn` z kolumnami tabeli `yarns` z Fazy 1 — każda kolumna ma odpowiadające pole, nazwy i nullability się zgadzają

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu wszystkich automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne potwierdzenie od człowieka, że testowanie ręczne zakończyło się sukcesem.

---

## Strategia testowania

### Testy jednostkowe:

- Brak — projekt nie ma jeszcze skonfigurowanego test runnera (zgodnie z `CLAUDE.md`), a ten fundament nie wprowadza logiki aplikacyjnej do przetestowania jednostkowo.

### Testy integracyjne:

- Brak w tym fundamencie — pierwsze testy integracyjne (zapis/odczyt przez API) mają sens dopiero przy S-01, gdy istnieje endpoint do przetestowania.

### Kroki testowania ręcznego:

1. Uruchom `npx supabase start` i `npx supabase db reset`, potwierdź brak błędów.
2. Utwórz dwóch testowych użytkowników (User A, User B) przez istniejący flow `/auth/signup`, tak samo jak zrobiłby to prawdziwy użytkownik aplikacji.
3. Zaloguj obu tym samym mechanizmem, którego używa `/auth/signin` (Supabase Auth) — najprościej przez `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` z nagłówkiem `apikey: <anon key>` — i zapisz `access_token` każdego. Wstaw wiersz do `yarns` przez `POST {SUPABASE_URL}/rest/v1/yarns` z nagłówkami `apikey: <anon key>` i `Authorization: Bearer <access_token User A>`. Potwierdź, że `GET {SUPABASE_URL}/rest/v1/yarns` z `Authorization: Bearer <access_token User B>` nie zwraca tego wiersza. **Celowo pomiń Supabase Studio SQL Editor do tego testu** — łączy się jako superużytkownik `postgres`, który domyślnie omija RLS, więc dałby fałszywy wynik pozytywny nawet przy błędnych politykach.
4. Spróbuj wstawić wiersz z `quantity_skeins = null` i `quantity_grams = null` — potwierdź odrzucenie przez `CHECK`.
5. Zaktualizuj dowolne pole istniejącego wiersza i potwierdź, że `updated_at` się zmienia automatycznie.

## Uwagi dotyczące wydajności

Indeks na `user_id` jest krytyczny, ponieważ każde zapytanie (nawet `select *`) przechodzi przez politykę RLS filtrującą po tej kolumnie — bez indeksu S-04 (filtrowanie/sortowanie rosnącej biblioteki) degraduje się liniowo z rozmiarem całej tabeli, nie tylko biblioteki jednego użytkownika.

## Uwagi dotyczące migracji

Brak istniejących danych do migracji — to pierwsza tabela domenowa w projekcie. Zgodnie z `context/foundation/infrastructure.md`, wycofanie (rollback) kodu na Vercel nie cofa automatycznie migracji schematu Supabase — jeśli ta migracja wymaga kiedyś wycofania, trzeba to zrobić ręcznie osobną migracją korygującą.

## Referencje

- Mapa drogowa: `context/foundation/roadmap.md` (F-01: yarn-data-foundation)
- PRD: `context/foundation/prd.md` (FR-002 do FR-006, Guardrails, NFR)
- Notatki kształtujące: `context/foundation/shape-notes.md` (doprecyzowanie jednostek ilości i semantyki wyczerpania)
- Wzorzec auth i `context.locals.user`: `src/middleware.ts:6-16`, `src/lib/supabase.ts:1-24`
- Konfiguracja env: `astro.config.mjs:17-22`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Migracja bazy danych — tabela `yarns` z RLS

#### Automatyczne

- [x] 1.1 Migracja stosuje się czysto lokalnie: `npx supabase db reset`

#### Ręczne

- [x] 1.3 Izolacja RLS potwierdzona między User A i User B przez REST API (nie przez Supabase Studio)
- [x] 1.4 Ograniczenie ilości (co najmniej jedna jednostka) odrzuca niepoprawny wiersz
- [x] 1.5 `updated_at` zmienia się automatycznie przy aktualizacji

### Faza 2: Podstawowe typy TypeScript

#### Automatyczne

- [ ] 2.1 Sprawdzanie typów przechodzi: `npx astro check`
- [ ] 2.2 Linting przechodzi: `npm run lint`

#### Ręczne

- [ ] 2.3 Pola `Yarn` ręcznie porównane z kolumnami tabeli `yarns` — zgodność nazw i nullability
