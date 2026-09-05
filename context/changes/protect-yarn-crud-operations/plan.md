# Ochrona zapisu nowej włóczki (Ryzyko #1) — Plan implementacji

## Przegląd

Ten plan wdraża **pierwszy test integracyjny w tym projekcie**, chroniący Ryzyko #1 z `context/foundation/test-plan.md`: *"Dodanie nowej włóczki nie zapisuje się (formularz 'wygląda' na udany, ale wiersz nie powstaje)"*. Ustala też konwencję testów integracyjnych dla całego repo (helper klienta testowego z realną sesją Supabase), z której będą korzystać kolejne fazy (Ryzyko #2, #3 i dalsze).

## Analiza stanu obecnego

Zgodnie z `research.md`: zero testów integracyjnych istnieje dziś w repo (`vitest.config.ts` ma tylko alias `@`, brak konfiguracji środowiska integracyjnego). Zapis włóczki przechodzi przez natywny formularz → `POST /api/yarns` → `createYarn(supabase, userId, data)` w `src/lib/services/yarns.ts:69-93`, gdzie `supabase` to już-uwierzytelniony klient z aktywnym RLS. Ochrona na poziomie bazy istnieje podwójnie: Zod `.refine` (co najmniej jedna ilość) i constraint SQL `yarns_quantity_present` (`supabase/migrations/20260823120000_create_yarns_table.sql:27`).

### Kluczowe odkrycia:

- `createYarn()` **nigdy nie tworzy własnego klienta Supabase** — przyjmuje gotowy, uwierzytelniony `SupabaseClient` jako parametr (`src/lib/services/yarns.ts:1-3` — importuje tylko typy z `@supabase/supabase-js`, zero zależności od Astro). To pozwala przetestować dokładnie tę samą ścieżkę zapisu (RLS + constrainty bazy), bez dotykania Astro w ogóle.
- `src/lib/supabase.ts` (użyty przez prawdziwy endpoint) czyta `SUPABASE_URL`/`SUPABASE_KEY` z wirtualnego modułu `astro:env/server`, którego obecny `vitest.config.ts` (zwykły `vitest/config`, bez integracji Astro) **nie potrafi rozwiązać**. Testując bezpośrednio serwis (nie endpoint), unikamy tego problemu całkowicie — nie importujemy `src/lib/supabase.ts` ani `src/pages/api/yarns.ts`.
- Lokalny Supabase jest w pełni skonfigurowany (`supabase/config.toml`: API port `54321`, `auth.enable_confirmations = false` — nowe konto jest od razu użyteczne, bez potwierdzania e-maila).
- Test referencyjny repo (`src/lib/services/substitute-matching.test.ts`) ustala konwencję: `describe`/`it`, helper budujący dane testowe, import przez alias `@/...` — ten sam styl zachowujemy.

## Pożądany stan końcowy

Nowy plik testowy w `src/lib/services/` uderza w prawdziwy lokalny Supabase z prawdziwą, świeżo utworzoną sesją użytkownika i udowadnia: (a) poprawny zapis tworzy odczytywalny wiersz z poprawnymi danymi, potwierdzony **niezależnym** odczytem; (b) brak wymaganej ilości jest odrzucany przez bazę, bez powstania wiersza. `npm run test` uruchamia ten test lokalnie po `npx supabase start`. `context/foundation/test-plan.md §6.2` opisuje ustaloną konwencję do ponownego użycia w kolejnych fazach.

Weryfikacja: `npm run test` przechodzi z lokalnym Supabase uruchomionym; ręczne uruchomienie `npm run test` **bez** `npx supabase start` daje czytelny błąd połączenia (nie cichą ciszę/pominięcie testu).

## Czego NIE robimy

- Nie testujemy walidacji Zod ani przekierowań `/api/yarns` (widoczny komunikat błędu to Ryzyko #6, osobna faza w §3 test-plan.md).
- Nie testujemy scenariusza rozjazdu RLS insert-vs-select znalezionego w badaniu — świadomie odłożone (decyzja z tej sesji planowania), zanotowane w Otwartych Ryzykach poniżej.
- Nie obejmujemy Ryzyka #2 (usuwanie/edycja) ani #3 (częściowy zapis edycji) — to osobne fazy, mimo że dzielą ten sam wiersz §3 test-plan.md. Ten plan kończy się tylko Ryzykiem #1.
- Nie naprawiamy `vitest.config.ts` pod kątem `astro:env/server` — niepotrzebne przy tym podejściu; jeśli przyszła faza zdecyduje się testować pełny endpoint HTTP, ten problem wróci i będzie wymagał osobnej decyzji.
- Nie usuwamy testowych kont użytkowników z `auth.users` po testach — tylko utworzone wiersze `yarns`. Konta pozostają w lokalnej (efemerycznej) bazie; to celowy kompromis kosztu, nie przeoczenie.

## Podejście do implementacji

Dwie fazy: najpierw infrastruktura (helper testowy tworzący prawdziwą sesję Supabase), potem sam test. Test wywołuje `createYarn()` bezpośrednio — nie przez HTTP endpoint — bo zapis (sedno Ryzyka #1) dzieje się w tym samym miejscu niezależnie od wejścia, a ominięcie warstwy Astro/cookies eliminuje kruchość niezwiązaną z badanym ryzykiem.

## Krytyczne szczegóły implementacji

- **Realne dane logowania do lokalnego Supabase muszą pochodzić z uruchomionego `npx supabase start`, nie z zgadywania.** Lokalny CLI Supabase generuje domyślny URL (`http://127.0.0.1:54321`) i domyślny `anon key` deterministycznie z domyślnego `auth.jwt_secret` (niezmienionego w `supabase/config.toml`) — są to publicznie znane, nieprodukcyjne wartości deweloperskie, bezpieczne do wpisania wprost w kod testowy. Implementator Fazy 1 musi faktycznie uruchomić `npx supabase start` i skopiować wypisany `anon key`, zamiast wklejać wartość z pamięci/internetu — lokalna instalacja może się różnić.
- **Kolejność w helperze testowym ma znaczenie**: `supabase.auth.signUp({email, password})` na lokalnym Supabase (z `enable_confirmations=false`) zwraca od razu aktywną sesję w tym samym wywołaniu — nie jest potrzebny osobny krok `signInWithPassword` ani potwierdzenie e-maila. Użycie losowego e-maila (np. `test-${crypto.randomUUID()}@example.com`) na każde wywołanie helpera zapewnia izolację między testami bez ręcznego czyszczenia `auth.users`.

## Faza 1: Infrastruktura testów integracyjnych

### Przegląd

Ustala helper do tworzenia prawdziwej, uwierzytelnionej sesji Supabase w testach — fundament, z którego korzysta Faza 2 i wszystkie przyszłe fazy integracyjne (Ryzyko #2, #3, #4, #5).

### Wymagane zmiany:

#### 1. Helper klienta testowego

**Plik**: `src/lib/testing/supabase-test-client.ts` (nowy plik i nowy katalog)

**Cel**: Dostarczyć jedną funkcję, którą każdy przyszły test integracyjny wywoła, żeby otrzymać realnego, zalogowanego klienta Supabase plus id świeżo utworzonego usera — bez duplikowania logiki tworzenia konta w każdym pliku testowym.

**Umowa**: Eksportowana funkcja `createTestSupabaseSession(): Promise<{ supabase: SupabaseClient; userId: string }>`:
- Buduje zwykłego klienta `createClient` z `@supabase/supabase-js` (NIE z `@/lib/supabase` — ten wymaga kontekstu Astro), wskazując na lokalny URL/anon key. Oba stałe w kodzie z możliwością nadpisania przez `process.env.SUPABASE_TEST_URL` / `process.env.SUPABASE_TEST_ANON_KEY` (dla CI).
- Wywołuje `supabase.auth.signUp({ email: <losowy>, password: <losowy, min. 6 znaków zgodnie z `config.toml` `minimum_password_length` > })`.
- Zwraca `{ supabase, userId: data.user.id }` — ten sam obiekt `supabase` niesie już aktywną sesję (RLS aktywne przy kolejnych zapytaniach).
- Rzuca czytelny błąd, jeśli `signUp` zwróci błąd (np. Supabase nieuruchomiony) — nie połykać cicho.

#### 2. Wpis w podręczniku testowym

**Plik**: `context/foundation/test-plan.md`

**Cel**: Wypełnić §6.2 ("Dodawanie testu integracyjnego"), zgodnie z regułą test-planu, że każda faza wdrożenia aktualizuje odpowiedni wpis w §6 zamiast zostawiać `TBD`.

**Umowa**: Zamień treść §6.2 na: lokalizację (`src/lib/testing/supabase-test-client.ts`), wzorzec użycia (`const { supabase, userId } = await createTestSupabaseSession()` na początku testu/`beforeAll`), wymóg uruchomionego `npx supabase start` przed `npm run test`, oraz link do testu referencyjnego z Fazy 2 jako przykładu.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Sprawdzanie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`
- Plik `src/lib/testing/supabase-test-client.ts` istnieje i eksportuje `createTestSupabaseSession`

#### Weryfikacja ręczna:

- Po `npx supabase start`, ręczne wywołanie helpera (np. z tymczasowego skryptu lub z pierwszego testu Fazy 2) faktycznie tworzy nowego użytkownika widocznego w Supabase Studio (`http://127.0.0.1:54323`, tabela `auth.users`)

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu wszystkich automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne potwierdzenie od człowieka, że testowanie ręczne zakończyło się sukcesem, zanim przejdziesz do następnej fazy.

---

## Faza 2: Test integracyjny dla Ryzyka #1

### Przegląd

Napisać sam test chroniący Ryzyko #1, korzystając z helpera z Fazy 1.

### Wymagane zmiany:

#### 1. Test integracyjny zapisu włóczki

**Plik**: `src/lib/services/yarns.integration.test.ts` (nowy plik, kolokowany z `yarns.ts` zgodnie z konwencją repo)

**Cel**: Udowodnić dwa zachowania z `test-plan.md §2` (wiersz Ryzyka #1): poprawny zapis tworzy natychmiast odczytywalny wiersz; zapis z brakującą wymaganą ilością jest odrzucany, bez powstania wiersza.

**Umowa**:
- `beforeAll`/`beforeEach`: `const { supabase, userId } = await createTestSupabaseSession()`.
- **Test 1 (happy path)**: wywołaj `createYarn(supabase, userId, { name, manufacturer, quantity_skeins: 3, composition: [], ... })` z kompletnymi poprawnymi danymi. Assercja: zwrócony obiekt ma `id`; **niezależne** zapytanie `supabase.from("yarns").select("*").eq("id", returned.id).single()` (osobne od tego wewnątrz `createYarn`) zwraca wiersz z dokładnie tymi wartościami pól, które wysłano — nie polegaj wyłącznie na wartości zwróconej przez `createYarn` (to ten sam `.select().single()`, który mógłby "zakłamać" wynik przy rozjeździe RLS insert/select, patrz Otwarte Ryzyka).
- **Test 2 (brak wymaganej ilości)**: wywołaj `createYarn(supabase, userId, { name, manufacturer, quantity_skeins: undefined, quantity_grams: undefined, composition: [], ... })`. Assercja: wywołanie rzuca błąd (constraint bazy `yarns_quantity_present`); następnie zapytanie `supabase.from("yarns").select("id").eq("user_id", userId).eq("name", <ta sama nazwa>)` zwraca pustą listę — żaden wiersz nie powstał mimo błędu.
- `afterEach`: usuń wszystkie wiersze `yarns` utworzone przez `userId` tego testu (`supabase.from("yarns").delete().eq("user_id", userId)`), żeby kolejne uruchomienia `npm run test` startowały czysto bez resetu całej lokalnej bazy.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Testy integracyjne przechodzą lokalnie z uruchomionym Supabase: `npx supabase start && npm run test`
- Sprawdzanie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`

#### Weryfikacja ręczna:

- Po uruchomieniu testu, w Supabase Studio (`http://127.0.0.1:54323`) tabela `yarns` nie zawiera osieroconych wierszy testowych (potwierdza, że `afterEach` faktycznie sprząta)
- Celowe zepsucie constraintu (np. tymczasowa zmiana `quantity_skeins: 0, quantity_grams: 0` zamiast `undefined, undefined` w Teście 2) powoduje, że test **przechodzi mimo błędu w logice testu** tylko jeśli asercja jest rzeczywiście błędna — ręcznie zweryfikuj, że Test 2 faktycznie czerwienieje, gdy insert nie jest już celowo niepoprawny (dowód, że asercja nie jest testem-lustrem)

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu wszystkich automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne potwierdzenie od człowieka, że testowanie ręczne zakończyło się sukcesem.

---

## Strategia testowania

### Testy jednostkowe:

- Brak nowych — poza zakresem tej fazy (istniejący `src/lib/validation/yarn.test.ts` już pokrywa część reguł Zod).

### Testy integracyjne:

- Zapis poprawnej włóczki → wiersz istnieje z poprawnymi danymi (niezależny odczyt).
- Zapis bez wymaganej ilości → odrzucony przez bazę, zero wierszy.

### Kroki testowania ręcznego:

1. `npx supabase start`, poczekaj na gotowość wszystkich usług.
2. `npm run test` — oba testy w `yarns.integration.test.ts` przechodzą.
3. Sprawdź w Supabase Studio, że tabela `yarns` jest czysta po teście (brak wierszy z testowych kont).
4. Uruchom `npm run test` bez `npx supabase start` — potwierdź czytelny błąd połączenia, nie cichą ciszę.

## Uwagi dotyczące wydajności

Brak — dwa proste testy, jedno tworzenie konta na test.

## Uwagi dotyczące migracji

Nie dotyczy — brak zmian w schemacie bazy.

## Referencje

- Powiązane badania: `context/changes/protect-yarn-crud-operations/research.md`
- Wzorzec stylu testu: `src/lib/services/substitute-matching.test.ts`
- Serwis testowany: `src/lib/services/yarns.ts:69-93`
- Constraint bazy: `supabase/migrations/20260823120000_create_yarns_table.sql:27`

## Otwarte ryzyka i założenia

- **Rozjazd RLS insert-vs-select** (znaleziony w `research.md`) pozostaje niepokryty — świadoma decyzja tej sesji planowania, żeby nie rozszerzać zakresu. Kandydat do osobnej przyszłej fazy, jeśli okaże się realnym problemem.
- Zakłada się, że lokalny `anon key` z `npx supabase start` jest stabilny między uruchomieniami dewelopera (deterministyczny z `config.toml`) — implementator musi to zweryfikować przy pierwszym uruchomieniu Fazy 1, nie zakładać wartości z pamięci.
- Testowe konta w `auth.users` nie są sprzątane — jeśli lokalna baza kiedyś urośnie na tyle, że to przeszkadza, rozwiązaniem jest `npx supabase db reset`, nie zmiana tego planu.

## Kryteria sukcesu (podsumowanie)

- Uruchomienie `npx supabase start && npm run test` udowadnia, że dodanie poprawnej włóczki faktycznie zapisuje wiersz w bazie — nie tylko że endpoint zwraca sukces.
- To samo uruchomienie udowadnia, że próba zapisu bez wymaganej ilości nie tworzy wiersza.
- Ustalona konwencja (`createTestSupabaseSession`, `test-plan.md §6.2`) jest gotowa do ponownego użycia w Ryzyku #2 i #3.

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Infrastruktura testów integracyjnych

#### Automatyczne

- [x] 1.1 Sprawdzanie typów przechodzi: `npx astro check` — 4c121fd
- [x] 1.2 Linting przechodzi: `npm run lint` — 4c121fd
- [x] 1.3 Plik `src/lib/testing/supabase-test-client.ts` istnieje i eksportuje `createTestSupabaseSession` — 4c121fd

#### Ręczne

- [x] 1.4 Helper faktycznie tworzy nowego użytkownika widocznego w Supabase Studio — 4c121fd

### Faza 2: Test integracyjny dla Ryzyka #1

#### Automatyczne

- [x] 2.1 Testy integracyjne przechodzą lokalnie: `npx supabase start && npm run test` — c682544
- [x] 2.2 Sprawdzanie typów przechodzi: `npx astro check` (1 przedistniejący błąd w `src/components/yarn/DeleteYarnButton.tsx:67`, niezwiązany z tą fazą — istniał już przed commitem 4c121fd; nowy plik testowy nie wprowadza żadnych błędów typów) — c682544
- [x] 2.3 Linting przechodzi: `npm run lint` — c682544

#### Ręczne

- [x] 2.4 Tabela `yarns` w Supabase Studio jest czysta po teście — c682544
- [x] 2.5 Test 2 faktycznie czerwienieje przy celowo zepsutej asercji (dowód, że nie jest testem-lustrem) — c682544
