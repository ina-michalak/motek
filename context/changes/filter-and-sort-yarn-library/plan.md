# Filtrowanie i sortowanie biblioteki włóczek — Plan implementacji

## Przegląd

Dodajemy filtrowanie i sortowanie do widoku biblioteki włóczek (`/dashboard`), realizując S-04 z roadmapy (FR-004). Użytkownik zawęża listę własnych włóczek po sześciu kryteriach (producent, dostępność, kolor, skład, rozmiar drutów, rozmiar szydełka, próg ilości) i porządkuje ją po pięciu polach (data dodania, nazwa, ocena, motki, gramatura) — wszystko przez parametry URL w stylu SSR, spójnie z resztą aplikacji.

## Analiza stanu obecnego

`src/pages/dashboard.astro` renderuje pełną, niefiltrowaną listę przez `listYarns()` (`src/lib/services/yarns.ts:30`), zawsze posortowaną `created_at desc`. Brak jakichkolwiek kontrolek filtrowania/sortowania w UI. Biblioteka docelowego użytkownika liczy ~30-100 pozycji (persona z PRD: "30+ motków") — to mała skala, więc filtrowanie/sortowanie może odbywać się w pamięci po jednym istniejącym zapytaniu do Supabase, bez zmian w warstwie danych czy nowych zapytań Postgrest.

### Kluczowe odkrycia:

- `isYarnExhausted()` (`src/lib/utils.ts:9`) już definiuje "wyczerpana" jako: wszystkie zdefiniowane pola ilości (`quantity_skeins`, `quantity_grams`) równe 0. Filtr dostępności używa tej samej funkcji.
- Formularz dodawania/edycji (`YarnForm.tsx`) używa statycznych list sugestii (`KNOWN_MANUFACTURERS`, `COMMON_FIBERS`, `COMMON_NEEDLE_HOOK_SIZES_MM` z `src/lib/validation/yarn.ts`) jako `<datalist>`/podpowiedzi przy swobodnym wpisywaniu tekstu — to inny mechanizm niż filtry, które mają pokazywać tylko wartości faktycznie obecne w bibliotece usera (patrz "Krytyczne szczegóły implementacji").
- Pole `composition[].fiber` jest dowolnym tekstem (walidacja: `z.string().trim().min(1)`), nieograniczonym do `COMMON_FIBERS` — to lista podpowiedzi, nie enum.
- Ustalony wzorzec dla prostych operacji list/formularzy w tym repo: natywny `<form>` (GET/POST) + przeładowanie strony SSR, zamiast client-side state. `dashboard.astro` już czyta `Astro.url.searchParams` (parametr `warning`), więc filtrowanie przez query params w URL jest spójne z istniejącą konwencją.
- Konwencja testowania z S-03 (`context/archive/2026-08-29-manage-saved-yarn-entry/plan-brief.md`): testy jednostkowe tylko dla czystej logiki bez I/O (np. `yarn.test.ts` dla walidacji Zod) — testy serwisów zależnych od Supabase są pomijane jako nieproporcjonalne do zakresu. Ta sama zasada obowiązuje tutaj: cała logika filtrowania/sortowania trafia do czystej, w pełni testowalnej funkcji.
- React islands montowane są przez `client:load` (`EditYarnDialog`, `DeleteYarnButton`, `YarnForm` — patrz `src/pages/yarns/[id].astro:74-75`), z propem `defaultOpen` sterowanym z Astro frontmatteru — ten sam wzorzec posłuży do domyślnego stanu (rozwinięty/zwinięty) panelu filtrów.

## Pożądany stan końcowy

Na `/dashboard` widoczny jest pasek z rozwijaną listą sortowania (zawsze widoczną) oraz przyciskiem "Filtry" (rozwija/zwija panel z 6 kontrolkami). Zmiana dowolnego filtra lub sortowania natychmiast przeładowuje listę (przez URL). Stan filtrów żyje wyłącznie w URL — działa wstecz/dalej w przeglądarce, link jest współdzielny, ale `/dashboard` bez parametrów zawsze pokazuje wszystko, posortowane jak dziś (najnowsze pierwsze). Gdy filtry nie dają wyników, użytkownik widzi komunikat odróżnialny od "biblioteka jest pusta" oraz przycisk czyszczący filtry.

Weryfikacja: `npm run test`, `npm run lint`, `npm run build` przechodzą; ręczne przejście każdego filtra i opcji sortowania (patrz Strategia testowania) w przeglądarce lokalnie i na widoku mobilnym.

## Czego NIE robimy

- Filtrowania/sortowania na poziomie zapytania Postgrest/DB — skala biblioteki (~30-100 pozycji) i złożoność filtra składu (tablica w JSONB) nie uzasadniają tego nakładu.
- Zapamiętywania filtrów między wizytami (localStorage) — ustalono: tylko URL, reset przy nowej wizycie.
- Zmiany domyślnego zachowania listy — filtr dostępności jest opt-in, domyślnie pokazywane są też wyczerpane włóczki (jak dziś).
- Wyszukiwania tekstowego (search bar) po nazwie/notatce — poza zakresem FR-004, tylko ustalone pola filtrów.
- Konwersji/łączenia jednostek ilości (motki ↔ gramy) — pozostają dwa niezależne progi filtra i dwie niezależne opcje sortowania.
- Multi-select dla producenta, koloru, rozmiaru drutów lub szydełka — tylko filtr składu jest wielokrotnego wyboru (dopasowanie: dowolny zaznaczony), reszta to pojedynczy wybór.
- Zmian schematu bazy danych / nowych migracji.
- Nowego endpointu API — cała logika działa po stronie renderowania `dashboard.astro` (SSR) na już pobranych danych.

## Podejście do implementacji

Cała logika filtrowania/sortowania trafia do jednej czystej, testowalnej funkcji w `src/lib/yarn-filters.ts` (bez zależności od Supabase), operującej na już pobranej (przez istniejące `listYarns()`) liście włóczek. `dashboard.astro` parsuje `Astro.url.searchParams`, przepuszcza pełną listę przez tę funkcję i renderuje wynik. Kontrolki UI to nowy React island `YarnFilters.tsx`, który jest jednym `<form method="GET" action="/dashboard">` — każda zmiana kontrolki (poza polami liczbowymi progu ilości) submituje formularz natychmiast (`form.requestSubmit()`), pola liczbowe submitują po Enter/blur. To utrzymuje wzorzec pełnego przeładowania strony SSR używany już w projekcie, bez nowego stanu klienckiego czy wywołań `fetch`.

## Krytyczne szczegóły implementacji

- **Źródło list opcji filtrów**: Listy opcji dla producenta, koloru, rozmiaru drutów, rozmiaru szydełka i składu MUSZĄ być budowane z wartości faktycznie obecnych w bibliotece bieżącego usera (z pełnej, niefiltrowanej listy), a NIE z istniejących stałych `KNOWN_MANUFACTURERS`, `COMMON_FIBERS`, `COMMON_NEEDLE_HOOK_SIZES_MM` w `src/lib/validation/yarn.ts`. Te stałe zasilają podpowiedzi (`<datalist>`) przy swobodnym wpisywaniu w formularzu dodawania/edycji i pokazywałyby userowi opcje filtra, dla których ma zero włóczek (albo ukrywały wartości, które faktycznie wpisał, a które nie są na statycznej liście).
- **Sortowanie po ilości przy brakującym polu**: Włóczka ma zawsze co najmniej jedno z `quantity_skeins`/`quantity_grams`, ale nie musi mieć obu (walidacja `createYarnSchema` wymaga tylko jednego). Przy sortowaniu "po motkach" włóczki z `quantity_skeins === null` lądują na końcu listy (niezależnie od kierunku rosnąco/malejąco) zamiast być traktowane jak `0` lub przerywać sortowanie — analogicznie dla "po gramaturze" i `quantity_grams`.

## Faza 1: Fundament — logika filtrowania i sortowania

### Przegląd

Czysta, w pełni przetestowana logika filtrowania/sortowania i parsowania parametrów URL — bez żadnych zmian w UI. Ta faza jest samodzielnie weryfikowalna testami jednostkowymi.

### Wymagane zmiany:

#### 1. Nowy moduł logiki filtrów/sortowania

**Plik**: `src/lib/yarn-filters.ts`

**Cel**: Scentralizować całą logikę biznesową filtrowania i sortowania w jednym miejscu, niezależnym od Supabase/Astro, żeby dało się ją w pełni przetestować i żeby `dashboard.astro` pozostał cienką warstwą renderującą.

**Umowa**:
- `export type YarnSortKey = "created_desc" | "created_asc" | "name_asc" | "name_desc" | "rating_desc" | "rating_asc" | "skeins_desc" | "skeins_asc" | "grams_desc" | "grams_asc"` — `"created_desc"` jest wartością domyślną (zachowuje dzisiejsze zachowanie).
- `export interface YarnFilterCriteria { manufacturer?: string; color?: string; fibers?: string[]; needleSizeMm?: number; hookSizeMm?: number; hideExhausted?: boolean; minSkeins?: number; minGrams?: number }` — wszystkie pola opcjonalne; brak pola = filtr nieaktywny.
- `export function parseYarnFilters(searchParams: URLSearchParams): { criteria: YarnFilterCriteria; sort: YarnSortKey }` — czyta parametry `manufacturer`, `color`, powtarzalny `fiber` (przez `getAll`), `needle`, `hook`, `hideExhausted` (obecność = `"1"` → `true`), `minSkeins`, `minGrams`, `sort`. Brak/niepoprawna wartość liczbowa lub nieznany klucz `sort` → pole pominięte / wartość domyślna (nigdy nie rzuca wyjątku — dane pochodzą z URL i mogą być zmanipulowane ręcznie).
- `export function filterAndSortYarns<T extends Pick<Yarn, "manufacturer" | "color" | "composition" | "needle_size_mm" | "hook_size_mm" | "quantity_skeins" | "quantity_grams" | "name" | "rating" | "created_at">>(yarns: T[], criteria: YarnFilterCriteria, sort: YarnSortKey): T[]` — filtry łączone przez AND (włóczka musi spełniać wszystkie aktywne filtry); dopasowanie składu (`fibers`) przez OR (wystarczy jedno z zaznaczonych włókien obecne w `composition`); progi ilości (`minSkeins`/`minGrams`) to porównanie `>=` na odpowiednim polu (włóczka bez tego pola nie przechodzi progu dla tego pola). Zwraca nową tablicę, nie mutuje wejścia.
- `export function getYarnFilterOptions(yarns: Pick<Yarn, "manufacturer" | "color" | "composition" | "needle_size_mm" | "hook_size_mm">[]): { manufacturers: string[]; colors: string[]; fibers: string[]; needleSizes: number[]; hookSizes: number[] }` — zwraca unikalne wartości obecne w przekazanej (pełnej, niefiltrowanej) liście, teksty posortowane `localeCompare("pl")`, liczby rosnąco; puste/`null` wartości pominięte.
- `export function hasActiveYarnFilters(criteria: YarnFilterCriteria): boolean` — `true`, jeśli którekolwiek pole `criteria` jest ustawione (używane do domyślnego stanu panelu i widoczności przycisku "Wyczyść filtry"; sortowanie inne niż domyślne NIE liczy się jako "aktywny filtr").

#### 2. Testy jednostkowe

**Plik**: `src/lib/yarn-filters.test.ts`

**Cel**: Pokryć każdy filtr osobno, kombinację filtrów (AND), dopasowanie składu (OR), domyślne "pokaż wszystko", każdy wariant sortowania (w tym kolejkowanie brakujących pól ilości na koniec), parsowanie URL (w tym brakujące/niepoprawne parametry) i `hasActiveYarnFilters`.

**Umowa**: Struktura `describe`/`it` z `vitest`, wzorowana na `src/lib/validation/yarn.test.ts`. Fixture kilku włóczek pokrywających przypadki brzegowe (brak koloru, tylko motki, tylko gramy, wyczerpana, wielowłóknowy skład).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Testy jednostkowe przechodzą: `npm run test`
- Linting (w tym sprawdzanie typów) przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Weryfikacja ręczna:

- Brak — ta faza nie ma UI; poprawność potwierdzają testy automatyczne.

**Uwaga implementacyjna**: Ta faza nie wymaga ręcznej weryfikacji w przeglądarce (brak zmian UI) — po zielonych testach automatycznych można przejść od razu do Fazy 2.

---

## Faza 2: UI — kontrolki filtrów i sortowania

### Przegląd

Nowy React island z kontrolkami filtrów/sortowania, wpięty w `dashboard.astro`. Po tej fazie filtrowanie i sortowanie są w pełni funkcjonalne (puste stany i "Wyczyść filtry" dopracowujemy w Fazie 3).

### Wymagane zmiany:

#### 1. Komponent kontrolek filtrów/sortowania

**Plik**: `src/components/yarn/YarnFilters.tsx`

**Cel**: Jeden React island renderujący pasek z zawsze widocznym dropdownem sortowania i przyciskiem "Filtry" (toggle), oraz warunkowo renderowany panel z 6 kontrolkami filtrów. Wszystkie kontrolki żyją w jednym `<form method="GET" action="/dashboard">`, więc submit wysyła kompletny stan niezależnie od tego, czy panel jest rozwinięty.

**Umowa**:
- Props: `{ options: ReturnType<typeof getYarnFilterOptions>; initialCriteria: YarnFilterCriteria; initialSort: YarnSortKey; defaultOpen: boolean }` (import typów z `@/lib/yarn-filters`).
- Sortowanie: pojedynczy `<select name="sort">` z opcjami-etykietami po polsku (np. "Najnowsze", "Najstarsze", "Nazwa A-Z", "Nazwa Z-A", "Ocena: najwyżej", "Ocena: najniżej", "Motki: najwięcej", "Motki: najmniej", "Gramatura: najwięcej", "Gramatura: najmniej"), `value`/`defaultValue` z `initialSort`, `onChange` wywołuje `event.currentTarget.form?.requestSubmit()`.
- Panel filtrów (widoczność sterowana lokalnym `useState(defaultOpen)`, bez własnej persystencji w URL — to czysto prezentacyjny stan):
  - Producent: `<select name="manufacturer">` z opcją "Wszyscy" + `options.manufacturers`.
  - Kolor: `<select name="color">` z opcją "Wszystkie" + `options.colors`.
  - Skład: `<select name="fiber" multiple>` z `options.fibers` (dopasowanie OR opisane w Fazie 1).
  - Rozmiar drutów: `<select name="needle">` z opcją "Wszystkie" + `options.needleSizes` (wyświetlane jako `${size} mm`).
  - Rozmiar szydełka: `<select name="hook">` analogicznie z `options.hookSizes`.
  - Dostępność: `<input type="checkbox" name="hideExhausted" value="1">`, etykieta "Ukryj wyczerpane", domyślnie odznaczony.
  - Ilość: dwa `<input type="number" name="minSkeins">` / `name="minGrams">` (etykiety "Min. motków" / "Min. gramów"), `onKeyDown` submituje na Enter, `onBlur` submituje zawsze (idempotentne — te same wartości dają ten sam URL/nawigację).
  - Wszystkie `<select>` (poza `fiber`) i checkbox mają `onChange={(e) => e.currentTarget.form?.requestSubmit()}`.

#### 2. Wpięcie w stronę biblioteki

**Plik**: `src/pages/dashboard.astro`

**Cel**: Sparsować parametry URL, przefiltrować/posortować już pobraną listę, obliczyć opcje filtrów z pełnej listy i wyrenderować `YarnFilters` nad siatką kart, podmieniając siatkę na przefiltrowany wynik.

**Umowa**: Po `const yarns = ...` dodać `const { criteria, sort } = parseYarnFilters(Astro.url.searchParams)`, `const options = getYarnFilterOptions(yarns)`, `const visibleYarns = filterAndSortYarns(yarns, criteria, sort)`. Renderować `<YarnFilters options={options} initialCriteria={criteria} initialSort={sort} defaultOpen={hasActiveYarnFilters(criteria)} client:load />` tuż nad blokiem `{yarns.length === 0 ? (...) : (...)}`, a siatkę kart (`{yarns.map(...)}`) zamienić na `{visibleYarns.map(...)}`. Nagłówek "Twoje włóczki (N)" na razie nadal liczy pełne `yarns.length` — dopracowanie licznika "X z Y" i pustego stanu filtrów to Faza 3.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Linting (w tym sprawdzanie typów) przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Weryfikacja ręczna:

- Każdy z 6 filtrów samodzielnie zawęża listę do oczekiwanych włóczek (test na koncie z co najmniej kilkoma zróżnicowanymi włóczkami — różne producenty, kolory, składy, rozmiary, ilości, w tym jedna wyczerpana).
- Kombinacja kilku filtrów jednocześnie działa jako AND (węższy wynik niż każdy filtr osobno).
- Zaznaczenie kilku wartości w filtrze składu rozszerza wynik (OR) zamiast go zawężać.
- Każda z 10 opcji sortowania daje poprawną kolejność; sortowanie po motkach/gramaturze umieszcza włóczki bez danego pola na końcu.
- Zmiana filtra/sortowania faktycznie przeładowuje stronę i URL zawiera odpowiednie parametry; przycisk wstecz w przeglądarce cofa do poprzedniego stanu filtrów.
- Panel filtrów domyślnie zwinięty przy wejściu na `/dashboard` bez parametrów; rozwinięty automatycznie po wejściu z linku zawierającego aktywny filtr.
- Odświeżenie strony z parametrami w URL odtwarza poprawny stan wszystkich kontrolek (zaznaczone opcje, wartości pól liczbowych, stan checkboxa).

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu wszystkich automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne potwierdzenie od człowieka, że testowanie ręczne zakończyło się sukcesem, zanim przejdziesz do następnej fazy.

---

## Faza 3: UX polish — puste stany, licznik i wyczyść filtry

### Przegląd

Dopracowanie doświadczenia wokół filtrów: rozróżnienie "biblioteka jest pusta" od "żadna włóczka nie pasuje do filtrów", licznik wyników, przycisk czyszczący filtry oraz weryfikacja mobilna panelu.

### Wymagane zmiany:

#### 1. Puste stany i licznik w widoku biblioteki

**Plik**: `src/pages/dashboard.astro`

**Cel**: Odróżnić brak jakichkolwiek włóczek (istniejący pusty stan z linkiem "+ Dodaj włóczkę") od zera wyników pasujących do aktywnych filtrów (nowy stan z komunikatem i linkiem czyszczącym filtry), oraz pokazać licznik "Pokazano X z Y" gdy filtry są aktywne.

**Umowa**: Warunek renderowania trzystanowy: `yarns.length === 0` → istniejący pusty stan biblioteki (bez zmian); `yarns.length > 0 && visibleYarns.length === 0` → nowy komunikat, np. "Żadna włóczka nie pasuje do wybranych filtrów." z linkiem `<a href="/dashboard">Wyczyść filtry</a>`; w przeciwnym razie → siatka `visibleYarns`. Nagłówek: gdy `hasActiveYarnFilters(criteria)` jest `true`, pokazać `Pokazano {visibleYarns.length} z {yarns.length}`, w przeciwnym razie zachować dzisiejsze `({yarns.length})`.

#### 2. Przycisk "Wyczyść filtry" w panelu

**Plik**: `src/components/yarn/YarnFilters.tsx`

**Cel**: Umożliwić jednym kliknięciem powrót do stanu bez filtrów (sortowanie zostaje zachowane — to nie jest "filtr" w rozumieniu `hasActiveYarnFilters`).

**Umowa**: Widoczny tylko gdy `hasActiveYarnFilters(initialCriteria)`; link/przycisk nawigujący do `/dashboard?sort=${initialSort}` (zachowuje bieżące sortowanie, zeruje resztę parametrów).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Testy jednostkowe (jeśli dodano nowe przypadki dla `hasActiveYarnFilters` w kontekście licznika) przechodzą: `npm run test`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Weryfikacza ręczna:

- Ustawienie filtrów bez wyników pokazuje nowy komunikat (nie "brak włóczek w bibliotece") i link czyszczący filtry działa.
- Licznik "Pokazano X z Y" pojawia się tylko przy aktywnych filtrach, znika po ich wyczyszczeniu.
- Przycisk "Wyczyść filtry" zeruje wszystkie filtry, ale zachowuje wybrane sortowanie.
- Panel filtrów jest użyteczny na widoku mobilnym (przycisk "Filtry" i kontrolki nie wychodzą poza ekran, da się je obsłużyć dotykiem).
- Brak regresji na istniejącym pustym stanie biblioteki (konto bez żadnej włóczki nadal widzi oryginalny komunikat "Dodaj pierwszą").

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu wszystkich automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne potwierdzenie od człowieka, że testowanie ręczne zakończyło się sukcesem.

---

## Strategia testowania

### Testy jednostkowe:

- `filterAndSortYarns`: każdy filtr osobno (producent, kolor, skład, druty, szydełko, dostępność, min. motki, min. gramy), kombinacja wielu filtrów naraz (AND), wielokrotne zaznaczenie składu (OR), każdy z 10 wariantów sortowania, kolejkowanie brakujących pól ilości na koniec przy sortowaniu po ilości, brak filtrów → zwraca wszystko w domyślnej kolejności.
- `getYarnFilterOptions`: deduplikacja, pomijanie `null`/pustych wartości, sortowanie alfabetyczne/numeryczne.
- `parseYarnFilters`: poprawne parsowanie każdego parametru, wielokrotny `fiber`, brak parametrów → puste `criteria` + `sort: "created_desc"`, niepoprawne/nieznane wartości nie rzucają wyjątku.
- `hasActiveYarnFilters`: `false` dla pustego `criteria`, `true` dla każdego pojedynczego ustawionego pola.

### Testy integracyjne:

- Brak — projekt nie ma harnessu do testów integracyjnych/E2E; pokrycie end-to-end realizowane przez kroki ręczne poniżej (zgodnie z konwencją z S-03).

### Kroki testowania ręcznego:

1. Na koncie z kilkunastoma zróżnicowanymi włóczkami (różni producenci, kolory, składy wielowłóknowe, rozmiary drutów/szydełka, ilości w motkach i/lub gramach, co najmniej jedna wyczerpana) przejść każdy filtr osobno i zweryfikować wynik.
2. Połączyć 2-3 filtry naraz i zweryfikować logikę AND.
3. Zaznaczyć 2+ wartości w filtrze składu i zweryfikować logikę OR.
4. Przejść każdą z 10 opcji sortowania, ze szczególną uwagą na sortowanie po motkach/gramaturze przy włóczkach z brakującym odpowiednim polem.
5. Wpisać próg ilości i zatwierdzić przez Enter oraz przez kliknięcie poza polem (blur) — oba mają submitować.
6. Odświeżyć stronę z aktywnymi filtrami w URL i sprawdzić, czy kontrolki poprawnie odtwarzają stan.
7. Użyć przycisków wstecz/dalej przeglądarki po kilku zmianach filtrów.
8. Ustawić filtry bez wyników i sprawdzić komunikat + link czyszczący.
9. Sprawdzić konto bez żadnej włóczki — musi wyświetlić oryginalny pusty stan, nie nowy komunikat "brak wyników".
10. Sprawdzić panel na widoku mobilnym (szerokość ~375px) — toggle, kontrolki, scroll.

## Uwagi dotyczące wydajności

Brak istotnych implikacji — filtrowanie/sortowanie w pamięci nad tablicą rzędu dziesiątek elementów jest pomijalnie tanie; brak nowych zapytań do Supabase ponad istniejące `listYarns()`.

## Uwagi dotyczące migracji

Brak — zero zmian schematu bazy danych, zero zmian istniejących endpointów API. Zmiana jest w pełni addytywna: `/dashboard` bez parametrów URL zachowuje się identycznie jak dziś.

## Referencje

- Roadmapa: `context/foundation/roadmap.md`, sekcja S-04 (parametry filtrów/sortowania ustalone z userem, patrz "Niewiadome")
- Wzorzec konwencji projektowych z podobnej zmiany: `context/archive/2026-08-29-manage-saved-yarn-entry/plan-brief.md`
- Istniejąca logika "wyczerpana": `src/lib/utils.ts:9`
- Istniejące pobieranie listy: `src/lib/services/yarns.ts:30`
- Wzorzec React island + `defaultOpen` z Astro: `src/pages/yarns/[id].astro:74`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Fundament — logika filtrowania i sortowania

#### Automatyczne

- [x] 1.1 Testy jednostkowe przechodzą: `npm run test` — f3761e2
- [x] 1.2 Linting przechodzi: `npm run lint` — f3761e2
- [x] 1.3 Build przechodzi: `npm run build` — f3761e2

### Faza 2: UI — kontrolki filtrów i sortowania

#### Automatyczne

- [x] 2.1 Linting przechodzi: `npm run lint` — 372049c
- [x] 2.2 Build przechodzi: `npm run build` — 372049c

#### Ręczne

- [x] 2.3 Każdy z 6 filtrów samodzielnie zawęża listę poprawnie
- [x] 2.4 Kombinacja filtrów działa jako AND
- [x] 2.5 Wielokrotny wybór składu działa jako OR
- [x] 2.6 Wszystkie 10 opcji sortowania daje poprawną kolejność (w tym brakujące pola na końcu)
- [x] 2.7 Zmiana filtra/sortowania przeładowuje URL; wstecz/dalej działa
- [x] 2.8 Panel domyślnie zwinięty/rozwinięty zgodnie z obecnością aktywnych filtrów
- [x] 2.9 Odświeżenie strony odtwarza stan kontrolek z URL

### Faza 3: UX polish — puste stany, licznik i wyczyść filtry

#### Automatyczne

- [x] 3.1 Testy jednostkowe przechodzą: `npm run test`
- [x] 3.2 Linting przechodzi: `npm run lint`
- [x] 3.3 Build przechodzi: `npm run build`

#### Ręczne

- [x] 3.4 Komunikat "brak wyników" i link czyszczący działają przy zerowych wynikach filtrów
- [x] 3.5 Licznik "Pokazano X z Y" pojawia się/znika poprawnie
- [x] 3.6 "Wyczyść filtry" zeruje filtry, zachowuje sortowanie
- [x] 3.7 Panel użyteczny na widoku mobilnym
- [x] 3.8 Brak regresji na pustym stanie biblioteki bez żadnej włóczki
