# Dodawanie i przeglądanie biblioteki włóczek — Plan implementacji

## Przegląd

Implementujemy S-01 z mapy drogowej: formularz dodawania włóczki do biblioteki oraz widok listy własnych włóczek. `/dashboard` przestaje być pustym ekranem powitalnym i staje się widokiem biblioteki (kafelki włóczek) — to pierwszy ekran, jaki user widzi po zalogowaniu. Dokładamy też stronę szczegółów pojedynczej włóczki (`/yarns/[id]`), żeby S-02 (sugestie AI zamienników) i S-03 (edycja) miały gdzie się zaczepić bez przebudowy routingu.

## Analiza stanu obecnego

- Tabela `yarns` i typ `Yarn` (`src/types.ts`) już istnieją (F-01), z RLS filtrującym po `user_id = auth.uid()`. Kolumny odzwierciedlają wszystkie pola z PRD (FR-002), w tym `composition: jsonb`, dwie niezależne kolumny ilości, dwie niezależne kolumny rozmiaru (druty/szydełko), `photo_url`.
- Brak Supabase Storage bucketu — żadne zdjęcie nie ma dziś gdzie wylądować.
- Zod nie jest zainstalowany, mimo że CLAUDE.md wymaga go do walidacji API — obecne endpointy auth (`src/pages/api/auth/*.ts`) nie walidują wejścia w ogóle poza rzutowaniem typu.
- Wzorzec formularza jest ustalony w `src/components/auth/`: kontrolowany React island (`client:load`), walidacja inline po stronie klienta, współdzielone `FormField`/`SubmitButton`/`ServerError`, `useFormStatus` z `react-dom` do stanu ładowania, natywny `<form method="POST" action="/api/...">` (progressive enhancement, pełny redirect po submicie).
- `src/components/ui/` ma zainstalowany tylko `button.tsx` z shadcn (styl "new-york").
- `src/middleware.ts` chroni trasy przez prefiks (`PROTECTED_ROUTES.some(route => pathname.startsWith(route))`) — dodanie `/yarns` do tej listy wystarczy, by objąć zarówno `/yarns/new`, jak i `/yarns/[id]`.

## Pożądany stan końcowy

Zalogowany user, po wejściu na `/dashboard`, widzi siatkę kafelków swoich włóczek (albo czytelny stan pusty, jeśli biblioteka jest pusta) z przyciskiem dodania nowej włóczki. Formularz `/yarns/new` pozwala zapisać włóczkę z polami wymaganymi (nazwa, producent, ilość) i opcjonalnymi (kolor, farbowanie, skład włókien, druty/szydełko, próbka, ocena, notatka, zdjęcie). Kliknięcie kafelka otwiera `/yarns/[id]` ze wszystkimi zapisanymi danymi. Dane jednej osoby pozostają całkowicie niewidoczne dla innej (RLS na tabeli i na Storage).

Weryfikacja: ręczne dodanie kilku włóczek (z i bez zdjęcia, z i bez pełnego składu) na dwóch różnych kontach testowych, potwierdzenie izolacji danych i poprawnego wyświetlania w obu widokach.

### Kluczowe odkrycia:

- `context/archive/2026-08-23-yarn-data-foundation/plan.md` — pełny schemat tabeli `yarns`, w tym nazwy kolumn i ograniczenia CHECK.
- `src/pages/api/auth/signup.ts:4-20` — jedyny istniejący wzorzec API route: `context.request.formData()`, redirect z `?error=` przy błędzie.
- `src/components/auth/FormField.tsx` — styl inputów (`inputBase` klasa Tailwind) do naśladowania w nowych polach.
- `context/foundation/lessons.md` — każda funkcja Postgres w migracjach musi mieć jawny `search_path`; dotyczy to też triggera/funkcji, jeśli jakiejś dodamy w tej fazie (nie przewidujemy nowej, ale gdyby powstała, reguła obowiązuje).

## Czego NIE robimy

- Edycji ani usuwania włóczki (S-03) — tylko tworzenie i odczyt.
- Filtrowania i sortowania listy (S-04).
- Sekcji sugestii AI zamienników (S-02) — `/yarns/[id]` na razie pokazuje wyłącznie zapisane dane włóczki.
- Zewnętrznej bazy producentów/rozmiarów — listy podpowiedzi (`<datalist>`) to statyczne stałe w kodzie frontendu, nie osobna tabela.
- Automatycznego uzupełniania metrażu na podstawie gramatury i producenta (wspomniane przez usera jako pomysł na przyszłość, poza zakresem).

## Podejście do implementacji

Rozszerzamy istniejące wzorce zamiast wprowadzać nowe: kolejny natywny `<form>` POST do API route, kolejny kontrolowany React island z walidacją inline, kolejna Astro strona SSR do odczytu. Jedyne nowe elementy infrastrukturalne to zod (walidacja) i Supabase Storage bucket (zdjęcia) — oba minimalne i domykane w Fazie 1, żeby kolejne fazy budowały na gotowym fundamencie.

Dane składu włókien (dynamiczna lista wierszy w UI) są serializowane do JSON i przesyłane jako jedno ukryte pole formularza — pozwala to zachować pełny natywny POST (bez fetch/JS-owego przechwytywania submitu) przy jednoczesnym trzymaniu się formatu `jsonb` z F-01.

## Krytyczne szczegóły implementacji

- **`photo_url` przechowuje ścieżkę w bucketcie, nie publiczny URL.** Bucket jest prywatny, więc kolumna `photo_url` zapisuje ścieżkę obiektu (`{user_id}/{yarn_id}-{filename}`), a warstwa serwisowa (`src/lib/services/yarns.ts`) rozwiązuje ją na signed URL dopiero przy odczycie (`createSignedUrl`, krótki czas ważności, np. 1h). Nazwa kolumny sugeruje gotowy URL — to nieoczywiste i łatwo o pomyłkę przy późniejszym użyciu w S-02/S-03.
- **Kolejność zapisu przy tworzeniu włóczki ze zdjęciem**: najpierw INSERT wiersza `yarns` (bez `photo_url`), dopiero potem upload pliku do Storage pod ścieżką zawierającą `yarn.id`, na końcu UPDATE `photo_url` na wyliczoną ścieżkę. Ścieżka w bucketcie zawiera `yarn.id`, więc upload nie może poprzedzać insertu. Jeśli upload się nie powiedzie po udanym INSERT-cie, wiersz zostaje zapisany bez zdjęcia (soft-fail — nie wycofujemy całego zapisu z powodu samego zdjęcia, bo pole jest opcjonalne).
- **"Ilość" jako pojedyncze wymaganie PRD nad dwiema opcjonalnymi kolumnami**: schemat bazy (F-01) ma `quantity_skeins` i `quantity_grams` jako niezależnie nullable, ale PRD (FR-002) traktuje "ilość" jako pole wymagane. Reguła walidacji (klient + zod): formularz jest niepoprawny, jeśli **oba** pola ilości są puste; wypełnienie jednego, drugiego lub obu jest poprawne.
- **Walidacja sumy procentów składu dotyczy tylko niepustej listy.** Jeśli user nie doda żadnego wiersza składu, pole jest poprawne (opcjonalne, zgodnie z PRD). Walidacja sumy = 100% aktywuje się dopiero, gdy lista ma ≥1 wiersz.

## Faza 1: Fundament backendu — zależności, storage, walidacja

### Przegląd

Domyka wszystkie elementy infrastrukturalne, których żadna kolejna faza nie może obejść: zod jako zależność, bucket na zdjęcia z RLS, schemat walidacji.

### Wymagane zmiany:

#### 1. Instalacja zod

**Plik**: `package.json`

**Cel**: Dodać zod jako zależność produkcyjną — pierwsza faktyczna walidacja API route w projekcie, zgodnie z konwencją z CLAUDE.md.

**Umowa**: `npm install zod` (najnowsza stabilna 3.x, zgodna z Astro 6 / Cloudflare workerd runtime).

#### 2. Migracja: bucket Storage na zdjęcia + polityki RLS

**Plik**: `supabase/migrations/<timestamp>_create_yarn_photos_bucket.sql`

**Cel**: Utworzyć prywatny bucket `yarn-photos` i polityki RLS na `storage.objects`, tak żeby user mógł zarządzać wyłącznie plikami we własnym folderze (`{user_id}/...`).

**Umowa**:
```sql
insert into storage.buckets (id, name, public)
values ('yarn-photos', 'yarn-photos', false);

create policy "yarn_photos_select_own"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'yarn-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "yarn_photos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'yarn-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "yarn_photos_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'yarn-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "yarn_photos_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'yarn-photos' and (storage.foldername(name))[1] = auth.uid()::text);
```
Ścieżka obiektu w kodzie aplikacji: `${user.id}/${yarn.id}-${sanitizedFileName}` — pierwszy segment ścieżki (`storage.foldername(name)[1]`) musi być równy `auth.uid()`, stąd ten format.

#### 3. Schemat walidacji zod

**Plik**: `src/lib/validation/yarn.ts`

**Cel**: Jedno źródło prawdy dla reguł walidacji formularza dodawania włóczki, używane przez API route (Faza 3) i lustrzanie odtwarzane po stronie klienta (Faza 4).

**Umowa**: Eksportuje `createYarnSchema` (zod object) walidujący pola tekstowe/liczby z `FormData` (stringi z formularza rzutowane na liczby przez `z.coerce.number()`), z `.refine()` wymuszającym: (a) co najmniej jedno z `quantity_skeins`/`quantity_grams` obecne, (b) jeśli `composition` (sparsowany z JSON stringa) ma ≥1 wpis, suma `percent` = 100 (z tolerancją zaokrąglenia ±0.5). Eksportuje też osobno stałe listy podpowiedzi: `KNOWN_MANUFACTURERS`, `COMMON_NEEDLE_HOOK_SIZES_MM`, `COMMON_FIBERS` — używane przez `<datalist>` w formularzu.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run lint` przechodzi po dodaniu nowych plików
- `npx astro check` przechodzi bez błędów typów
- Migracja aplikuje się czysto lokalnie: `npx supabase db reset` (lub `npx supabase migration up`)

#### Weryfikacja ręczna:

- W Supabase Studio bucket `yarn-photos` istnieje, `public = false`, cztery polityki RLS widoczne na `storage.objects`

---

## Faza 2: Warstwa dostępu do danych

### Przegląd

Izoluje wszystkie zapytania do Supabase (tabela `yarns` + Storage) za service helperami, żeby API route i strony SSR nie duplikowały logiki zapytań.

### Wymagane zmiany:

#### 1. Serwis włóczek

**Plik**: `src/lib/services/yarns.ts`

**Cel**: Dostarczyć funkcje `listYarns(supabase, userId)`, `getYarnById(supabase, id)`, `createYarn(supabase, userId, data)` (insert wiersza) i `attachYarnPhoto(supabase, userId, yarnId, file)` (upload + update `photo_url`). Każda funkcja odczytu rozwiązuje `photo_url` (ścieżkę) na signed URL przez `resolveYarnPhotoUrl` (helper w tym samym pliku), zwracając wynik jako `photoUrl` obok surowego rekordu `Yarn`.

**Umowa**: Sygnatury operują na kliencie Supabase przekazanym z warstwy wywołującej (ten sam wzorzec co `createClient` w `src/lib/supabase.ts` — brak własnego tworzenia klienta w serwisie). `listYarns`/`getYarnById` polegają wyłącznie na RLS (żadnego ręcznego filtra `user_id` poza tym, co RLS i tak wymusza; `getYarnById` jednak filtruje też po `id`). Błąd Supabase (`{ error }`) jest propagowany do wywołującego, nie połykany.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npx astro check` przechodzi
- `npm run lint` przechodzi

#### Weryfikacja ręczna:

- Ręczne wywołanie funkcji z tymczasowego skryptu/konsoli (lub przez Fazę 3/5 po ich ukończeniu) potwierdza poprawny odczyt/zapis na koncie testowym

---

## Faza 3: API endpoint tworzenia włóczki

### Przegląd

`POST /api/yarns` — jedyny punkt zapisu nowej włóczki, używany przez formularz z Fazy 4.

### Wymagane zmiany:

#### 1. Endpoint tworzenia

**Plik**: `src/pages/api/yarns.ts`

**Cel**: Odebrać `multipart/form-data` (pola tekstowe + opcjonalny plik zdjęcia), zwalidować przez `createYarnSchema`, zapisać wiersz przez `createYarn`, opcjonalnie doczepić zdjęcie przez `attachYarnPhoto`, przekierować.

**Umowa**: `export const POST: APIRoute = async (context) => {...}`, `export const prerender = false`. Sukces → `context.redirect("/dashboard")`. Błąd walidacji lub zapisu → `context.redirect(\`/yarns/new?error=${encodeURIComponent(message)}\`)`, zgodnie z wzorcem `signup.ts`. Autoryzacja: jeśli `context.locals.user` jest `null`, endpoint zwraca redirect do `/auth/signin` (spójnie z middleware, jako druga linia obrony).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npx astro check` i `npm run lint` przechodzą

#### Weryfikacja ręczna:

- POST z poprawnymi danymi zapisuje wiersz widoczny w Supabase Studio i przekierowuje na `/dashboard`
- POST z brakującą nazwą/producentem/ilością przekierowuje z powrotem z czytelnym komunikatem błędu
- POST z niepoprawną sumą składu (np. 90%) zwraca błąd walidacji

---

## Faza 4: Formularz dodawania włóczki

### Przegląd

`/yarns/new` — strona z formularzem obejmującym wszystkie pola z FR-002.

### Wymagane zmiany:

#### 1. Strona formularza

**Plik**: `src/pages/yarns/new.astro`

**Cel**: Layout + odczyt `?error=` z query stringu (jak `signin.astro`/`signup.astro`), osadzenie React islandu formularza.

**Umowa**: `export const prerender = false` (chroniona trasa, potrzebuje `Astro.locals.user`). Wzorzec identyczny z `src/pages/auth/signup.astro`.

#### 2. Formularz React

**Plik**: `src/components/yarn/AddYarnForm.tsx`

**Cel**: Kontrolowany formularz ze wszystkimi polami FR-002, walidacją inline lustrzaną wobec `createYarnSchema`, natywnym submitem POST do `/api/yarns` jako `multipart/form-data`.

**Umowa**: Pola wymagane: `name`, `manufacturer` (`<input list="manufacturers">` + `<datalist id="manufacturers">` z `KNOWN_MANUFACTURERS`), `quantity_skeins`/`quantity_grams` (dwa niezależne pola liczbowe, walidacja "co najmniej jedno wypełnione" opisana w Krytycznych szczegółach). Pola opcjonalne: `color`, `dye_lot`, `needle_size_mm`/`hook_size_mm` (każde jako `<input list>` z `COMMON_NEEDLE_HOOK_SIZES_MM`), `gauge_note` (textarea), `rating` (nowy `StarRatingInput`), `note` (textarea), `photo` (`<input type="file" accept="image/jpeg,image/png,image/webp">`, max 5MB, z podglądem lokalnym przez `URL.createObjectURL`).

#### 3. Dynamiczna lista składu włókien

**Plik**: `src/components/yarn/CompositionRows.tsx`

**Cel**: Lista wierszy `{fiber, percent}` z przyciskami dodaj/usuń, `fiber` jako `<input list>` z `COMMON_FIBERS`, `percent` jako input liczbowy. Wynik serializowany do JSON i wpisywany do ukrytego pola `<input type="hidden" name="composition">` w formularzu nadrzędnym przy każdej zmianie.

**Umowa**: Kontrolowany przez stan `AddYarnForm` (`composition: YarnFiberComposition[]`, przekazywany jako props `value`/`onChange`) — nie własny wewnętrzny stan niezależny od rodzica, żeby rodzic mógł zsumować procenty do walidacji na bieżąco.

#### 4. Widget oceny gwiazdkowej

**Plik**: `src/components/yarn/StarRatingInput.tsx`

**Cel**: Pięć klikalnych gwiazdek (`lucide-react` `Star`), kontrolowane przez `value: number | null` / `onChange`.

**Umowa**: Klik na tę samą gwiazdkę, która już jest aktywna najwyższa, czyści ocenę do `null` (możliwość rezygnacji z oceny po jej ustawieniu).

#### 5. Komponenty shadcn/ui

**Plik**: `src/components/ui/{input,label,textarea,card}.tsx`

**Cel**: Doinstalować brakujące prymitywy shadcn potrzebne do formularza i (Faza 5) kart listy.

**Umowa**: `npx shadcn@latest add input label textarea card` — styl "new-york" zgodnie z `components.json`, bez ręcznych modyfikacji wygenerowanego kodu poza ewentualnym dopasowaniem klas do istniejącej palety `bg-cosmic`/`blue-100`/`purple` z auth.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npx astro check` i `npm run lint` przechodzą

#### Weryfikacja ręczna:

- Wypełnienie i zapis formularza ze wszystkimi polami (w tym zdjęciem i 3-wierszowym składem sumującym się do 100%) kończy się przekierowaniem na `/dashboard` i widocznym wpisem
- Próba zapisu bez nazwy / bez producenta / bez żadnej ilości pokazuje błąd inline i blokuje submit
- Próba zapisu ze składem sumującym się do np. 90% pokazuje błąd inline
- Zapis bez zdjęcia działa poprawnie (pole faktycznie opcjonalne)
- Kliknięcie aktywnej gwiazdki oceny czyści ocenę

---

## Faza 5: Biblioteka (lista) i szczegóły włóczki

### Przegląd

Przebudowuje `/dashboard` na widok biblioteki i dodaje `/yarns/[id]`.

### Wymagane zmiany:

#### 1. Middleware — nowa chroniona trasa

**Plik**: `src/middleware.ts`

**Cel**: Objąć ochroną `/yarns/*`.

**Umowa**: `PROTECTED_ROUTES = ["/dashboard", "/yarns"]` — dopasowanie już działa przez `startsWith`, więc jedna dodatkowa pozycja w tablicy wystarcza.

#### 2. Przebudowa dashboardu na widok biblioteki

**Plik**: `src/pages/dashboard.astro`

**Cel**: Zamiast statycznego powitania — SSR odczyt `listYarns(supabase, user.id)`, siatka kart (`YarnCard.astro`), przycisk "Dodaj włóczkę" linkujący do `/yarns/new`, czytelny stan pusty (`Nie masz jeszcze żadnej włóczki — dodaj pierwszą`) gdy lista jest pusta. Zachować istniejący przycisk wylogowania.

**Umowa**: `export const prerender = false` (już wynika z SSR + `context.locals.user`, ale wpis jawny dla klarowności). Siatka: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` w stylu spójnym z `bg-cosmic`/glassmorphism reszty auth UI.

#### 3. Karta włóczki

**Plik**: `src/components/yarn/YarnCard.astro`

**Cel**: Kafelek pojedynczej włóczki na liście — zdjęcie (lub placeholder SVG, gdy `photoUrl` jest `null`), nazwa, producent, kolor (jeśli jest), ocena gwiazdkowa (tylko do odczytu), link do `/yarns/[id]`.

**Umowa**: Przyjmuje jako props `Yarn & { photoUrl: string | null }`. Placeholder to statyczny inline SVG (ikona motka włóczki) — brak zależności sieciowej.

#### 4. Placeholder zdjęcia

**Plik**: `src/components/yarn/YarnPhotoPlaceholder.astro`

**Cel**: Współdzielony inline SVG placeholder używany zarówno na karcie listy, jak i na stronie szczegółów, gdy włóczka nie ma zdjęcia.

**Umowa**: Bezparametrowy komponent Astro zwracający `<svg>` (prosty motyw motka włóczki), stylowany przez `class` przekazywany z zewnątrz.

#### 5. Strona szczegółów włóczki

**Plik**: `src/pages/yarns/[id].astro`

**Cel**: SSR odczyt `getYarnById(supabase, Astro.params.id)`, wyświetlenie wszystkich zapisanych pól (zdjęcie/placeholder, nazwa, producent, ilość, kolor, farbowanie, skład, druty/szydełko, próbka, ocena, notatka). Jeśli włóczka nie istnieje lub nie należy do zalogowanego usera (RLS zwraca `null`), redirect na `/dashboard`.

**Umowa**: `export const prerender = false`. Struktura strony zostawia miejsce (osobna sekcja/kontener) pod przyszłą sekcję zamienników z S-02, ale nie renderuje dla niej żadnej zawartości teraz — brak martwego kodu czy zakomentowanych fragmentów, po prostu naturalny podział na sekcje ułatwiający późniejsze dołożenie.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npx astro check` i `npm run lint` przechodzą
- `npm run build` kończy się sukcesem

#### Weryfikacja ręczna:

- `/dashboard` z pustą biblioteką pokazuje stan pusty z CTA
- `/dashboard` z kilkoma włóczkami pokazuje siatkę kart z poprawnymi zdjęciami/placeholderami
- Kliknięcie karty otwiera `/yarns/[id]` z pełnymi, poprawnymi danymi
- Wejście na `/yarns/<cudzy-id>` (włóczka innego konta testowego) przekierowuje na `/dashboard`, nie pokazuje danych
- Wejście na `/yarns/new` i `/yarns/<id>` bez zalogowania przekierowuje na `/auth/signin`

---

## Strategia testowania

Projekt nie ma skonfigurowanego test runnera (`package.json` nie zawiera skryptu `test`) — weryfikacja opiera się na `npx astro check`, `npm run lint`, `npm run build` oraz ręcznym testowaniu opisanym w kryteriach sukcesu każdej fazy.

### Kroki testowania ręcznego (end-to-end, po Fazie 5):

1. Zarejestruj dwa konta testowe (A i B) przez istniejący flow auth.
2. Na koncie A dodaj 3 włóczki: jedną z pełnymi danymi (zdjęcie, skład sumujący się do 100%, ocena, notatka), jedną z tylko wymaganymi polami, jedną z niepoprawnym składem (sprawdź, że formularz blokuje zapis).
3. Sprawdź `/dashboard` konta A — siatka kart, poprawne zdjęcia/placeholder.
4. Otwórz szczegóły każdej włóczki — porównaj z danymi wpisanymi w formularzu.
5. Zaloguj się na konto B — `/dashboard` puste, stan pusty widoczny.
6. Spróbuj wejść na `/yarns/<id-włóczki-konta-A>` będąc zalogowanym jako B — oczekiwany redirect na `/dashboard` konta B, brak wycieku danych.
7. Wyloguj się, spróbuj wejść na `/dashboard`, `/yarns/new`, `/yarns/<dowolne-id>` — oczekiwany redirect na `/auth/signin` w każdym przypadku.

## Uwagi dotyczące wydajności

Brak specjalnych wymagań — NFR z PRD (<1s zapis, <5s otwarcie sekcji zamienników) dotyczą małej skali (target_scale: users=small, qps=low, data_volume=small z PRD). Signed URL dla zdjęć generowany przy każdym odczycie listy — przy docelowej skali (30+ włóczek na użytkownika, mało użytkowników) to pomijalny koszt; nie wymaga cache'owania w tej fazie.

## Uwagi dotyczące migracji

Brak istniejących danych do migracji — to pierwszy zapis do tabeli `yarns` w praktyce.

## Referencje

- Fundament danych: `context/archive/2026-08-23-yarn-data-foundation/plan.md`, `src/types.ts`
- Wzorzec API route: `src/pages/api/auth/signup.ts:4-20`
- Wzorzec formularza: `src/components/auth/SignUpForm.tsx`, `src/components/auth/FormField.tsx`
- Wzorzec strony chronionej: `src/pages/dashboard.astro`, `src/middleware.ts`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Fundament backendu — zależności, storage, walidacja

#### Automatyczne

- [x] 1.1 `npm run lint` przechodzi po dodaniu nowych plików — be018c5
- [x] 1.2 `npx astro check` przechodzi bez błędów typów — be018c5
- [x] 1.3 Migracja aplikuje się czysto lokalnie — be018c5

#### Ręczne

- [x] 1.4 Bucket `yarn-photos` i cztery polityki RLS widoczne w Supabase Studio — be018c5

### Faza 2: Warstwa dostępu do danych

#### Automatyczne

- [x] 2.1 `npx astro check` przechodzi — f94e8f5
- [x] 2.2 `npm run lint` przechodzi — f94e8f5

#### Ręczne

- [x] 2.3 Ręczna weryfikacja odczytu/zapisu przez serwis na koncie testowym — 6dc8f1d

### Faza 3: API endpoint tworzenia włóczki

#### Automatyczne

- [x] 3.1 `npx astro check` i `npm run lint` przechodzą — 6dc8f1d

#### Ręczne

- [x] 3.2 POST z poprawnymi danymi zapisuje wiersz i przekierowuje na `/dashboard` — 6dc8f1d
- [x] 3.3 POST z brakującymi wymaganymi polami przekierowuje z komunikatem błędu — 6dc8f1d
- [x] 3.4 POST z niepoprawną sumą składu zwraca błąd walidacji — 6dc8f1d

### Faza 4: Formularz dodawania włóczki

#### Automatyczne

- [x] 4.1 `npx astro check` i `npm run lint` przechodzą — ab3a168

#### Ręczne

- [x] 4.2 Pełny formularz (w tym zdjęcie i skład sumujący się do 100%) zapisuje się poprawnie — ab3a168
- [x] 4.3 Brak nazwy / producenta / ilości blokuje submit z błędem inline — ab3a168
- [x] 4.4 Niepoprawna suma składu pokazuje błąd inline — ab3a168
- [x] 4.5 Zapis bez zdjęcia działa poprawnie — ab3a168
- [x] 4.6 Kliknięcie aktywnej gwiazdki czyści ocenę — ab3a168

### Faza 5: Biblioteka (lista) i szczegóły włóczki

#### Automatyczne

- [x] 5.1 `npx astro check` i `npm run lint` przechodzą
- [x] 5.2 `npm run build` kończy się sukcesem

#### Ręczne

- [ ] 5.3 Pusta biblioteka pokazuje stan pusty z CTA
- [x] 5.4 Biblioteka z włóczkami pokazuje siatkę kart z poprawnymi zdjęciami/placeholderami
- [x] 5.5 Kliknięcie karty otwiera poprawne szczegóły
- [ ] 5.6 Próba dostępu do cudzej włóczki przekierowuje bez wycieku danych
- [x] 5.7 Dostęp bez zalogowania przekierowuje do `/auth/signin`
