# AI substitute suggestions — Plan implementacji

## Przegląd

Implementujemy S-02 z roadmapy: sekcję "zamienniki" na stronie szczegółów włóczki (`/yarns/[id]`), która pokazuje sugestie wygenerowane deterministycznym dopasowaniem parametrów (skład, grubość drutów/szydełka, opcjonalnie kolor) z własnej biblioteki użytkownika. Użytkownik może zaakceptować sugestię (staje się trwałym, widocznym zamiennikiem) albo ją odrzucić (trwale znika z przyszłych sugestii dla tej pary włóczek). To pierwsza funkcja w repo z realnym algorytmem dopasowania, pierwszym JSON API route i pierwszym fetch-based React islandem.

## Analiza stanu obecnego

- Tabela `yarns` (`supabase/migrations/20260823120000_create_yarns_table.sql`) istnieje i była świadomie zaprojektowana pod S-02, ale nie ma żadnej tabeli substitute/decision — to czysta karta.
- Wzorzec serwisu (`src/lib/services/yarns.ts`) i walidacji (`src/lib/validation/yarn.ts`) jest spójny i ma zostać powielony: plain async functions, pierwszy param `SupabaseClient`, drugi `userId`, `.eq("user_id", userId)` jako defense-in-depth obok RLS, `if (error) throw error`.
- `src/pages/api/yarns.ts` to jedyny istniejący endpoint API — classic form-POST z redirectem, **nie JSON**. `/api/yarns` nie jest w `PROTECTED_ROUTES` (`src/middleware.ts:4`), chroniony tylko ręcznym guardem w handlerze.
- `src/pages/yarns/[id].astro` jest statyczną stroną Astro (SSR, zero React islands) z miejscem świadomie zostawionym na sekcję zamienników po sekcji notatki.
- `src/components/hooks/` jest puste — brak wzorca fetch-based React komponentu w tym repo; `AddYarnForm.tsx` (jedyny większy island) używa natywnego form-POST, nie `fetch`.
- Repo nie ma skonfigurowanego test runnera (brak `vitest`/`jest` w `package.json`).
- `context/foundation/lessons.md` zawiera dwie reguły obowiązujące tu wprost: funkcje Postgres muszą mieć jawny `search_path`, a frontmatter `.astro` nie może zawierać `return` (crashuje ESLint) — trzeba użyć `Astro.response.status` + warunkowego renderowania, jak już robi `yarns/[id].astro`.

## Pożądany stan końcowy

Użytkownik otwiera szczegóły włóczki i widzi sekcję "Zamienniki" z dwiema częściami: listą już zaakceptowanych zamienników oraz listą nowych sugestii do oceny (posortowaną malejąco po podobieństwie), z przyciskami akceptuj/odrzuć działającymi bez przeładowania strony. Jeśli brak wystarczająco podobnych włóczek w bibliotece (niezależnie od tego, czy powodem jest za mała biblioteka, czy zbyt duża różnorodność), widoczny jest jeden spójny stan zachęcający do dodania kolejnych włóczek. Odrzucone pary nigdy nie wracają; zaakceptowane pary widoczne są symetrycznie z obu stron.

Weryfikacja: `npm run lint`, `npx astro check` i `npm run test` przechodzą; `npx supabase db reset` aplikuje nową migrację czysto; ręczne przejście przez akceptację/odrzucenie w przeglądarce potwierdza natychmiastową reakcję UI i trwałość decyzji po odświeżeniu strony.

### Kluczowe odkrycia:

- PRD Business Logic (`context/foundation/prd.md:87`) wymienia dokładnie trzy parametry dopasowania: skład, grubość drutów/szydełka, opcjonalnie kolor — `gauge_note` nie jest wymieniony, co potwierdza decyzję o jego pominięciu.
- FK do `yarns(id) on delete cascade` na obu kolumnach nowej tabeli automatycznie usuwa powiązane decyzje przy usunięciu włóczki (FR-006) — bez tego trzeba by ręcznie sprzątać osierocone wiersze.
- Symetria (ustalona z userem) oznacza zapis **dwóch wierszy** na akcję (yarn_id/substitute_yarn_id zamienione miejscami) zamiast normalizacji pary — prostsze mentalnie, spójne z resztą repo, które woli prostotę nad sprytem.

## Czego NIE robimy

- Cofanie lub edycja już podjętej decyzji (zmiana akceptacji na odrzucenie lub odwrotnie, "usunięcie" zaakceptowanego zamiennika) — poza zakresem PRD, tylko akcje na nowych sugestiach.
- Jakiekolwiek wywołanie modelu AI/LLM — "AI" to nazwa produktowa dla deterministycznego dopasowania parametrów (Non-Goals PRD).
- Sugestie spoza własnej biblioteki użytkownika (Non-Goals PRD).
- Restrukturyzacja `gauge_note` do ustrukturyzowanych kolumn — świadomie odłożone, może wrócić w przyszłej iteracji.
- Konfigurowalne przez użytkownika wagi/progi algorytmu — stałe w kodzie, do dostrojenia po zebraniu danych o rzeczywistym acceptance rate.
- Paginacja/limit liczby sugestii ponad rozsądne domyślne "top N" — biblioteki na etapie MVP są małe.

## Podejście do implementacji

Cztery fazy, każda budująca na poprzedniej: (1) model danych, (2) czysty algorytm dopasowania z testami jednostkowymi, (3) JSON API do akcji accept/reject, (4) frontend spinający wszystko w React islandzie. Sugestie są liczone server-side przy renderowaniu strony (SSR) — nie potrzeba API do samego wyliczania, tylko do zapisu decyzji użytkownika.

## Krytyczne szczegóły implementacji

- **Ochrona przed cudzą włóczką jako substytutem**: klucz obcy w Postgresie weryfikuje tylko, że `substitute_yarn_id` istnieje w tabeli `yarns` — nie że należy do bieżącego użytkownika (FK constraint checks pomijają RLS). Serwis `recordSubstituteDecision` musi jawnie zweryfikować przez `getYarnById(supabase, userId, ...)`, że **obie** włóczki należą do wywołującego, zanim zapisze decyzję — analogiczne defense-in-depth do tego, co już robi `attachYarnPhoto`.
- **Kolejność zapisu przy symetrii**: oba wiersze (kierunek A→B i B→A) muszą być zapisane w jednej operacji `upsert` z `onConflict: "user_id,yarn_id,substitute_yarn_id"`, żeby ponowna akcja (np. zmiana zdania z odrzucenia na... nie, to poza zakresem) nie tworzyła duplikatów przy powtórnym wywołaniu tego samego accept.

## Faza 1: Model danych

### Przegląd

Nowa tabela przechowująca decyzje użytkownika (akceptacja/odrzucenie) o parach włóczek, z RLS i grantami wzorowanymi na `yarns`, plus odpowiadający typ TypeScript.

### Wymagane zmiany:

#### 1. Migracja: tabela `yarn_substitute_decisions`

**Plik**: `supabase/migrations/20260829150000_create_yarn_substitute_decisions_table.sql`

**Cel**: Przechowuje trwałe decyzje użytkownika o konkretnych parach włóczek (zamiast tabeli sugestii — sugestie są liczone on-the-fly, nie materializowane). Brak wiersza dla pary = sugestia jeszcze nieoceniona.

**Umowa**:
- Kolumny: `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, `yarn_id uuid not null references yarns(id) on delete cascade`, `substitute_yarn_id uuid not null references yarns(id) on delete cascade`, `status text not null check (status in ('accepted','rejected'))`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.
- Ograniczenia: `check (yarn_id <> substitute_yarn_id)` (włóczka nie jest swoim własnym zamiennikiem); `unique (user_id, yarn_id, substitute_yarn_id)` (jedna decyzja na parę na usera, umożliwia `upsert` z `onConflict`).
- Indeks: `(user_id, yarn_id)` — pod zapytanie "wszystkie decyzje dla tej włóczki".
- Trigger `before update` wywołujący istniejącą funkcję `set_updated_at()` (już ma poprawny `search_path`, nie definiuj drugiej funkcji) — nazwij trigger `yarn_substitute_decisions_set_updated_at`, analogicznie do `yarns_set_updated_at`.
- RLS: `enable row level security` + 4 polityki (`select`/`insert`/`update`/`delete`), wszystkie `to authenticated using/with check (auth.uid() = user_id)`, wzorowane 1:1 na politykach `yarns` (`supabase/migrations/20260823120000_create_yarns_table.sql:55-74`).
- `grant select, insert, update, delete on yarn_substitute_decisions to authenticated;` w **tej samej migracji** (nie osobnym pliku — poprzedni podział na dwa pliki dla `yarns` był naprawą przeoczenia, nie świadomym wzorcem do powielania).

#### 2. Typ TypeScript

**Plik**: `src/types.ts`

**Cel**: Reprezentacja wiersza nowej tabeli, analogicznie do `Yarn`.

**Umowa**: Dodaj `export type SubstituteDecisionStatus = "accepted" | "rejected";` i `export interface YarnSubstituteDecision { id: string; user_id: string; yarn_id: string; substitute_yarn_id: string; status: SubstituteDecisionStatus; created_at: string; updated_at: string; }`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Migracja stosuje się czysto lokalnie: `npx supabase db reset`
- Sprawdzanie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`

#### Weryfikacja ręczna:

- W Supabase Studio (lokalnym) widoczna jest tabela `yarn_substitute_decisions` z 4 politykami RLS i grantami dla roli `authenticated`
- Próba insertu z `user_id` innym niż `auth.uid()` (np. przez SQL editor jako inny user) jest odrzucana przez RLS

---

## Faza 2: Algorytm dopasowania

### Przegląd

Czysta, testowalna funkcja obliczająca wynik podobieństwa (0-100) między dwiema włóczkami, plus serwis spinający ją z danymi z Supabase (lista sugestii, lista zaakceptowanych, zapis decyzji). Wprowadza pierwszy test runner w repo.

### Wymagane zmiany:

#### 1. Konfiguracja Vitest

**Plik**: `package.json`, nowy plik `vitest.config.ts`

**Cel**: Repo nie ma dziś żadnego test runnera; algorytm dopasowania jest najbardziej ryzykowną częścią funkcji (mierzy ją Success Criteria Primary — 75% acceptance rate), więc potrzebuje siatki bezpieczeństwa w postaci testów jednostkowych.

**Umowa**: Dodaj `vitest` jako devDependency i skrypt `"test": "vitest run"` do `package.json`. `vitest.config.ts` w katalogu root definiuje alias `@` → `./src` (spójny z `tsconfig.json` `paths`), żeby testy mogły importować przez `@/lib/...` tak jak reszta kodu.

#### 2. Czysta funkcja scoringu

**Plik**: `src/lib/services/substitute-matching.ts`

**Cel**: Oblicza wynik podobieństwa dwóch włóczek na podstawie składu, rozmiaru drutów/szydełka i koloru — bez żadnej zależności od Supabase, w pełni testowalna w izolacji.

**Umowa**: Eksportuje `MIN_SUBSTITUTE_SCORE = 50` (stała progu, w skali 0-100) i `scoreYarnSimilarity(a: Yarn, b: Yarn): number | null`. Zwraca `null`, gdy żaden z trzech wymiarów nie jest porównywalny dla obu włóczek (para jest wtedy całkowicie wykluczona z sugestii). W przeciwnym razie zwraca ważoną średnią (0-100) z podwymiarów, które są porównywalne, renormalizowaną tak, by wagi porównywalnych wymiarów sumowały się do 100%:

  - **Skład** (waga 40, pomijany jeśli `composition` jest `null`/puste po którejkolwiek stronie): dla sumy zbioru nazw włókien występujących w A lub B oblicz różnicę bezwzględną procentów (brakujące włókno po jednej stronie liczy się jako 0%); `totalDiff` = suma tych różnic (zakres 0-200). `compositionScore = max(0, 1 - totalDiff / 200)`.
  - **Rozmiar** (waga 40, pomijany jeśli żaden z typów `needle_size_mm`/`hook_size_mm` nie jest wypełniony po obu stronach jednocześnie; jeśli wypełnione są oba typy po obu stronach, uśrednij wyniki obu): dla różnicy `diff = |sizeA - sizeB|`, `sizeScore = diff <= 0.5 ? 1 : max(0, 1 - (diff - 0.5) / 2)` (pełne dopasowanie w tolerancji ±0.5mm, potem liniowy spadek do 0 przy różnicy 2.5mm).
  - **Kolor** (waga 20, pomijany jeśli `color` jest pusty po którejkolwiek stronie): znormalizuj (`trim().toLowerCase()`); pełna zgodność = 1, jedna wartość zawiera drugą jako podciąg = 0.5, w przeciwnym razie 0.
  - Wynik końcowy = `round(100 * sum(dostępne_wagi_znormalizowane * sub_score))`.

Ten formuła jest jedyną nieoczywistą logiką w tym planie — implementator nie powinien jej wymyślać na nowo, tylko przenieść 1:1.

#### 3. Serwis zamienników

**Plik**: `src/lib/services/substitutes.ts`

**Cel**: Spina czystą funkcję scoringu z danymi użytkownika z Supabase — lista sugestii do oceny, lista już zaakceptowanych, zapis decyzji. Wzorzec identyczny jak `src/lib/services/yarns.ts` (plain functions, `SupabaseClient` + `userId` jako pierwsze dwa argumenty, `.eq("user_id", userId)`, `if (error) throw error`).

**Umowa**:
- `listSubstituteSuggestions(supabase, userId, yarnId): Promise<{ yarn: YarnWithPhotoUrl; score: number }[]>` — pobiera docelową włóczkę (`getYarnById`) i resztę biblioteki (`listYarns`, odfiltrowując `yarnId`), pobiera istniejące decyzje dla `yarnId` z `yarn_substitute_decisions` (dowolny `status`) i wyklucza te `substitute_yarn_id` z kandydatów, liczy `scoreYarnSimilarity` dla pozostałych, filtruje `score !== null && score >= MIN_SUBSTITUTE_SCORE`, sortuje malejąco po score. Zwraca `[]`, jeśli docelowa włóczka nie istnieje lub nie ma kandydatów.
- `getAcceptedSubstitutes(supabase, userId, yarnId): Promise<YarnWithPhotoUrl[]>` — pobiera wiersze `yarn_substitute_decisions` dla `yarn_id = yarnId AND status = 'accepted'`, następnie odpowiadające włóczki (`listYarns` + filtr po zbiorze ID, lub bezpośrednie zapytanie `.in("id", ids)` analogiczne do `getYarnById`).
- `recordSubstituteDecision(supabase, userId, yarnId, substituteYarnId, status: SubstituteDecisionStatus): Promise<void>` — najpierw weryfikuje przez `getYarnById(supabase, userId, ...)`, że **obie** włóczki należą do `userId` (rzuca błąd, jeśli nie — patrz Krytyczne szczegóły implementacji), potem `upsert` **dwóch** wierszy (kierunek `yarnId→substituteYarnId` i odwrotny) z `onConflict: "user_id,yarn_id,substitute_yarn_id"`, ustawiając `status` i pozwalając triggerowi zaktualizować `updated_at`.

#### 4. Testy jednostkowe

**Plik**: `src/lib/services/substitute-matching.test.ts`

**Cel**: Pokrycie funkcji scoringu tabelą przypadków — najważniejsza logika biznesowa w tej zmianie.

**Umowa**: Przypadki: identyczne parametry (score ~100); całkowicie rozłączny skład i rozmiar poza tolerancją (score niski, poniżej `MIN_SUBSTITUTE_SCORE`); różnica rozmiaru dokładnie na granicy tolerancji (0.5mm → pełny score rozmiaru) i tuż poza nią (0.6mm → score < 1); brak `composition` po jednej stronie (wymiar pomijany, wagi renormalizowane); brak żadnego porównywalnego wymiaru (`scoreYarnSimilarity` zwraca `null`); różne typy rozmiaru wypełnione po obu stronach (jedna ma `needle_size_mm`, druga tylko `hook_size_mm` → wymiar rozmiaru pomijany jako nieporównywalny); dopasowanie koloru dokładne / substring / brak.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Testy jednostkowe przechodzą: `npm run test`
- Sprawdzanie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`

#### Weryfikacja ręczna:

- Brak — logika w tej fazie nie ma jeszcze interfejsu użytkownika (pokryta testami automatycznymi)

---

## Faza 3: API route accept/reject

### Przegląd

Pierwszy w repo JSON API route — pozwala zapisać decyzję użytkownika (akceptacja/odrzucenie) bez przeładowania strony.

### Wymagane zmiany:

#### 1. Walidacja żądania

**Plik**: `src/lib/validation/substitute.ts`

**Cel**: Waliduje ciało żądania JSON dla akcji accept/reject.

**Umowa**: `export const substituteDecisionSchema = z.object({ substituteYarnId: z.uuid(), status: z.enum(["accepted", "rejected"]) });` i `export type SubstituteDecisionInput = z.infer<typeof substituteDecisionSchema>;`.

#### 2. API endpoint

**Plik**: `src/pages/api/yarns/[id]/substitutes.ts`

**Cel**: Przyjmuje decyzję użytkownika o konkretnej sugestii i zapisuje ją przez serwis, zwracając JSON zamiast redirectu — to pierwszy taki wzorzec w repo, ponieważ akceptacja/odrzucenie wymaga natychmiastowego feedbacku UI.

**Umowa**:
- `export const prerender = false;`, `export const POST: APIRoute`.
- Guard uwierzytelnienia ręczny w handlerze (tak jak `src/pages/api/yarns.ts:16-18`), bo `/api/yarns` nie jest objęte `PROTECTED_ROUTES` — ale zwraca `Response.json({ error: "Unauthorized" }, { status: 401 })` zamiast redirectu (to JSON API, klient robi `fetch`, redirect nie ma tu sensu).
- `context.params.id` to `yarnId` z URL; zwaliduj jako `z.uuid()` przed użyciem — nieprawidłowy format → `400`.
- Parsuje `await context.request.json()` przez `substituteDecisionSchema.safeParse` — błąd walidacji → `Response.json({ error: ... }, { status: 400 })`.
- Wywołuje `recordSubstituteDecision`; błąd z serwisu (np. włóczka nie należy do usera) → `Response.json({ error: ... }, { status: 400 })`; sukces → `Response.json({ ok: true }, { status: 200 })`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Sprawdzanie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`

#### Weryfikacja ręczna:

- `curl`/klient HTTP bez sesji dostaje `401`
- Poprawne żądanie z prawidłową sesją zapisuje wiersz (widoczny w Supabase Studio) i zwraca `200`
- Żądanie z `substituteYarnId` należącym do innego użytkownika zwraca błąd, nie zapisuje wiersza

---

## Faza 4: Frontend — sekcja zamienników

### Przegląd

React island wyświetlający zaakceptowane zamienniki i nowe sugestie z akcjami accept/reject, wpięty w stronę szczegółów włóczki.

### Wymagane zmiany:

#### 1. Komponent React

**Plik**: `src/components/yarn/SubstituteSuggestions.tsx`

**Cel**: Wyświetla dwie sekcje — "Twoje zamienniki" (zaakceptowane, bez akcji) i "Sugerowane zamienniki" (do oceny, z przyciskami akceptuj/odrzuć) — oraz spójny stan pusty, gdy brak sugestii i brak zaakceptowanych. Lokalny `useState` + `fetch`, bez ekstrakcji do hooka (pierwsze użycie tego wzorca w repo — nie buduj abstrakcji przed drugim użyciem, zgodnie z `src/components/hooks/` będącym pustym).

**Umowa**:
- `interface Props { yarnId: string; initialSuggestions: { yarn: YarnWithPhotoUrl; score: number }[]; initialAccepted: YarnWithPhotoUrl[]; }`.
- Stan lokalny inicjalizowany z propsów; akcja accept/reject: optymistycznie usuwa element z listy sugestii (i dopisuje do zaakceptowanych przy accept), wysyła `fetch(`/api/yarns/${yarnId}/substitutes`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ substituteYarnId, status }) })`; przy błędzie odpowiedzi przywraca poprzedni stan i pokazuje `ServerError` (reużyj `@/components/auth/ServerError`).
- Karty renderowane inline (JSX, nie osobny komponent — Astro `YarnCard.astro` nie może być użyty wewnątrz React islandu), w stylu zbliżonym do `YarnCard.astro`: miniatura (`photoUrl` lub `YarnPhotoPlaceholder`), nazwa, producent; przyciski `Button` (`variant="outline"`/`"ghost"`, ikony `Check`/`X` z `lucide-react`) z `aria-label`.
- Stan pusty (brak sugestii i brak zaakceptowanych): jeden spójny komunikat, styl analogiczny do pustego stanu na `src/pages/dashboard.astro:52-62` (`border-border bg-card rounded-2xl border p-12 text-center`) — zachęca do dodania kolejnych włóczek, bez rozróżniania przyczyny ("za mało" vs "za mało podobnych").

#### 2. Wpięcie w stronę szczegółów

**Plik**: `src/pages/yarns/[id].astro`

**Cel**: Dolicza sugestie i zaakceptowane zamienniki server-side i renderuje nową sekcję po istniejącej sekcji notatki.

**Umowa**: Importuj `listSubstituteSuggestions`, `getAcceptedSubstitutes` z `@/lib/services/substitutes` i `SubstituteSuggestions` z `@/components/yarn/SubstituteSuggestions`. W bloku, gdzie dziś liczone jest `yarn` (linia ~16), dolicz `const suggestions = yarn ? await listSubstituteSuggestions(supabase, user.id, yarn.id) : [];` i analogicznie `acceptedSubstitutes`. W template, wewnątrz `space-y-6 p-6`, po sekcji notatki (linia ~106), dodaj `<SubstituteSuggestions yarnId={yarn.id} initialSuggestions={suggestions} initialAccepted={acceptedSubstitutes} client:load />` — zgodnie z regułą z `lessons.md`, nie dodawaj żadnego `return` na najwyższym poziomie frontmatteru.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Sprawdzanie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`
- Testy jednostkowe nadal przechodzą: `npm run test`

#### Weryfikacja ręczna:

- Otwarcie `/yarns/[id]` dla włóczki z podobnymi włóczkami w bibliotece pokazuje posortowaną listę sugestii
- Kliknięcie "akceptuj" natychmiast przenosi włóczkę do sekcji "Twoje zamienniki" bez przeładowania strony; po ręcznym odświeżeniu strony stan jest zachowany
- Kliknięcie "odrzuć" natychmiast usuwa sugestię; po odświeżeniu strony ta sama para nie pojawia się ponownie
- Otwarcie tej samej sugestii z drugiej strony (strona szczegółów włóczki B, gdy A→B zaakceptowano) pokazuje A jako już zaakceptowany zamiennik (symetria)
- Włóczka bez wystarczająco podobnych włóczek w bibliotece (lub user z jedną włóczką) pokazuje spójny stan pusty
- Brak regresji na istniejących sekcjach strony szczegółów i na liście/dashboardzie

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu wszystkich automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne potwierdzenie od człowieka, że testowanie ręczne zakończyło się sukcesem.

---

## Strategia testowania

### Testy jednostkowe:

- `scoreYarnSimilarity` — tabela przypadków opisana w Fazie 2 (pełne dopasowanie, brak dopasowania, granice tolerancji, brakujące wymiary, niekompatybilne typy rozmiaru)

### Testy integracyjne:

- Brak automatycznych testów integracyjnych w tym zakresie (repo nie ma infrastruktury do testów z realną bazą) — pokryte weryfikacją ręczną w Fazach 3-4

### Kroki testowania ręcznego:

1. Utwórz (lub użyj istniejących) co najmniej dwie podobne parametrowo włóczki w bibliotece testowej — otwórz szczegóły jednej, potwierdź że druga pojawia się jako sugestia
2. Zaakceptuj sugestię, sprawdź natychmiastową zmianę UI i trwałość po odświeżeniu
3. Otwórz szczegóły drugiej włóczki, potwierdź symetryczne pojawienie się zamiennika
4. Odrzuć inną sugestię, odśwież stronę, potwierdź że nie wraca
5. Sprawdź stan pusty dla włóczki bez podobnych odpowiedników w bibliotece

## Uwagi dotyczące wydajności

Brak realnego budżetu wydajności na etapie MVP — algorytm to `O(n)` porównań w pamięci dla biblioteki użytkownika (dziesiątki, nie tysiące włóczek), liczone raz na request SSR.

## Uwagi dotyczące migracji

Nowa tabela, brak istniejących danych do migracji. `on delete cascade` na obu FK do `yarns` gwarantuje automatyczne sprzątanie przy usuwaniu włóczek (FR-006) bez dodatkowej logiki.

## Referencje

- Powiązane badania: `context/changes/ai-substitute-suggestions/research.md`
- Wzorzec serwisu/walidacji: `src/lib/services/yarns.ts`, `src/lib/validation/yarn.ts`
- Wzorzec migracji + RLS: `supabase/migrations/20260823120000_create_yarns_table.sql`
- Wzorzec React islandu: `src/components/yarn/AddYarnForm.tsx`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Model danych

#### Automatyczne

- [x] 1.1 Migracja stosuje się czysto lokalnie: `npx supabase db reset` — 9f1f50d
- [x] 1.2 Sprawdzanie typów przechodzi: `npx astro check` — 9f1f50d
- [x] 1.3 Linting przechodzi: `npm run lint` — 9f1f50d

#### Ręczne

- [x] 1.4 Tabela `yarn_substitute_decisions` widoczna w Supabase Studio z 4 politykami RLS i grantami — 9f1f50d
- [x] 1.5 RLS odrzuca insert z `user_id` innym niż `auth.uid()` — 9f1f50d

### Faza 2: Algorytm dopasowania

#### Automatyczne

- [x] 2.1 Testy jednostkowe przechodzą: `npm run test`
- [x] 2.2 Sprawdzanie typów przechodzi: `npx astro check`
- [x] 2.3 Linting przechodzi: `npm run lint`

### Faza 3: API route accept/reject

#### Automatyczne

- [ ] 3.1 Sprawdzanie typów przechodzi: `npx astro check`
- [ ] 3.2 Linting przechodzi: `npm run lint`

#### Ręczne

- [ ] 3.3 Żądanie bez sesji zwraca 401
- [ ] 3.4 Poprawne żądanie zapisuje wiersz i zwraca 200
- [ ] 3.5 Żądanie z cudzym `substituteYarnId` jest odrzucane

### Faza 4: Frontend — sekcja zamienników

#### Automatyczne

- [ ] 4.1 Sprawdzanie typów przechodzi: `npx astro check`
- [ ] 4.2 Linting przechodzi: `npm run lint`
- [ ] 4.3 Testy jednostkowe nadal przechodzą: `npm run test`

#### Ręczne

- [ ] 4.4 Sugestie pokazują się posortowane malejąco po podobieństwie
- [ ] 4.5 Akceptacja działa natychmiast i jest trwała po odświeżeniu
- [ ] 4.6 Odrzucenie działa natychmiast i jest trwałe po odświeżeniu
- [ ] 4.7 Symetria potwierdzona z obu stron pary
- [ ] 4.8 Spójny stan pusty przy braku wystarczająco podobnych włóczek
- [ ] 4.9 Brak regresji na istniejących sekcjach strony i dashboardzie
