<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Dodawanie i przeglądanie biblioteki włóczek

- **Plan**: context/changes/add-and-browse-yarn-library/plan.md
- **Zakres**: Faza 5 z 5 (Biblioteka (lista) i szczegóły włóczki)
- **Data**: 2026-08-29
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 4 ostrzeżenia, 1 obserwacja

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | WARNING |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | PASS (F5 okazało się false positive — patrz Decyzja) |
| Kryteria sukcesu | PASS |

## Ustalenia

### F1 — `getYarnById` bez filtra `user_id`, mimo że przegląd Fazy 2 odroczył tę decyzję właśnie do Fazy 5

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/services/yarns.ts:48, src/pages/yarns/[id].astro:14
- **Szczegóły**: `getYarnById(supabase, id)` filtruje wyłącznie po `id`, nie po `user_id` — bezpieczeństwo dziś w pełni zależy od polityki RLS `auth.uid() = user_id` na tabeli `yarns`. Przegląd Fazy 2 (`reviews/impl-review-phase-2.md`, ustalenie o niespójnej sygnaturze) świadomie zostawił to bez zmian z rekomendacją: *"Rozważyć w Fazie 5 (gdy funkcja realnie zacznie być wywoływana) dodanie `userId` i jawnego `.eq('user_id', userId)` dla spójności API i defense-in-depth"*. Faza 5 rzeczywiście uruchamia tę ścieżkę (`getYarnById(supabase, Astro.params.id)` w `[id].astro`), a filtr nadal nie został dodany. Nie jest to dziś luka (RLS chroni), ale to dokładnie moment, w którym odroczona rekomendacja miała zostać ponownie rozważona.
- **Poprawka**: Dodać parametr `userId` do `getYarnById` i `.eq("user_id", userId)` obok `.eq("id", id)`, przekazując `user.id` z `[id].astro`.
  - Siła: Domyka defense-in-depth zanim funkcja zyska kolejnych wywołujących (S-02/S-03); ujednolica sygnaturę z `listYarns`/`createYarn`/`attachYarnPhoto`, które już przyjmują `userId`.
  - Kompromis: Zmiana sygnatury publicznej funkcji serwisowej — jedno miejsce wywołania do zaktualizowania.
  - Pewność: HIGH — rekomendacja już raz precyzyjnie opisana i zaakceptowana logicznie w Fazie 2, tylko odroczona.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: FIXED — dodano `userId` do `getYarnById` (`src/lib/services/yarns.ts`) i `.eq("user_id", userId)`; zaktualizowano jedyne wywołanie w `src/pages/yarns/[id].astro`. `npx astro check` — 0 błędów.

### F2 — `getYarnById` nie łapie błędu castowania dla niepoprawnego `id` → 500 zamiast przekierowania

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość (Niezawodność)
- **Lokalizacja**: src/lib/services/yarns.ts:48-54, src/pages/yarns/[id].astro:14
- **Szczegóły**: Wejście na `/yarns/<dowolny-nie-UUID>` (np. `/yarns/foo`, literówka w linku, stary/uszkodzony URL) powoduje, że Postgres rzuca błąd castowania typu na kolumnie `id` (uuid). `getYarnById` propaguje ten błąd (`if (error) throw error`), nic w `[id].astro` go nie łapie — SSR kończy się generyczną stroną 500 zamiast zaplanowanego zachowania "włóczka nie istnieje → redirect na `/dashboard`". Kryterium sukcesu Fazy 5 mówi tylko o "nie istnieje lub nie należy do usera", ale malformed ID to podzbiór "nie istnieje" z perspektywy użytkownika.
- **Poprawka A ⭐ Zalecana**: Walidować format `id` (regex UUID lub `z.string().uuid().safeParse`) na początku frontmatteru `[id].astro`, przed wywołaniem `getYarnById` — przy niepoprawnym formacie ustawić ten sam redirect co dla "nie znaleziono".
  - Siła: Zmiana lokalna, nie dotyka kontraktu serwisu; jawnie widoczna w miejscu, gdzie plan już opisuje logikę "nie istnieje → redirect".
  - Kompromis: Jeśli powstaną kolejne strony wywołujące `getYarnById` bezpośrednio z URL-a, każda musi powtórzyć tę walidację.
  - Pewność: HIGH — najmniejsza zmiana, zero ryzyka efektów ubocznych.
  - Martwy punkt: Nie sprawdzono, czy Supabase JS zawsze rzuca ten sam kształt błędu dla złego UUID we wszystkich wersjach — założenie oparte na standardowym zachowaniu PostgREST.
- **Poprawka B**: Złapać błąd wewnątrz `getYarnById` (rozróżnić błąd castowania typu od innych błędów DB) i zwrócić `null` zamiast rzucać.
  - Siła: Chroni wszystkich przyszłych wywołujących serwis, nie tylko tę stronę.
  - Kompromis: Serwis zaczyna interpretować szczegóły błędu Postgresa (kod `22P02`), co jest bardziej kruche i zaciera granicę między "nie znaleziono" a "prawdziwy błąd DB", który powinien nadal się propagować.
  - Pewność: MEDIUM — działa, ale miesza odpowiedzialności serwisu.
  - Martwy punkt: Inne prawdziwe błędy DB o tym samym kodzie mogłyby zostać błędnie połknięte jako "nie znaleziono".
- **Decyzja**: FIXED (Poprawka A) — dodano `isValidId = id != null && z.uuid().safeParse(id).success` w `src/pages/yarns/[id].astro`, `getYarnById` wywoływane tylko przy poprawnym formacie; w przeciwnym razie ten sam redirect na `/dashboard`. `npx astro check` — 0 błędów.

### F3 — `YarnCard` nie wyświetla koloru, mimo że plan tego wymagał

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/components/yarn/YarnCard.astro:29-30
- **Szczegóły**: Plan Fazy 5 wprost wymienia zawartość karty: "zdjęcie [...], nazwa, producent, kolor (jeśli jest), ocena gwiazdkowa". Karta renderuje nazwę (linia 29) i producenta (linia 30), ale pole `yarn.color` (istnieje w `Yarn` z `src/types.ts:13`) nigdzie nie jest odczytywane ani wyświetlane.
- **Poprawka**: Dodać `{yarn.color && <p class="truncate text-xs text-blue-100/50">{yarn.color}</p>}` pod linią producenta.
- **Decyzja**: FIXED — dodano wiersz koloru w `src/components/yarn/YarnCard.astro` pod producentem. `npx astro check` — 0 błędów.

### F4 — Placeholder zdjęcia to ikona `Volleyball` (piłka siatkowa) z lucide-react, nie dedykowany SVG motka włóczki

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/components/yarn/YarnPhotoPlaceholder.astro:2,10
- **Szczegóły**: Plan opisuje placeholder jako "statyczny inline SVG (ikona motka włóczki)". Implementacja renderuje `<Volleyball className={className} strokeWidth={1.25} aria-hidden="true" />` z `lucide-react` — ikonę piłki siatkowej, nie motka włóczki. To komponent widoczny na każdej karcie biblioteki i na stronie szczegółów, gdy brak zdjęcia — więc ikonografia myląca dla usera pojawia się często, nie w rogu przypadku. Część umowy "brak zależności sieciowej" jest technicznie spełniona (import statyczny, nie fetch), ale motyw wizualny jest błędny.
- **Poprawka A ⭐ Zalecana**: Zamienić `Volleyball` na inną, tematycznie neutralną ikonę z już używanej biblioteki `lucide-react` (np. `ImageOff` lub `CircleDot`) — szybka zmiana jednej linii, bez wprowadzania nowego SVG.
  - Siła: Minimalna zmiana, zero nowego kodu do utrzymania, spójne z resztą projektu, który już używa `lucide-react` (`Star` w `YarnCard`/`[id].astro`).
  - Kompromis: Nadal nie jest to dosłowny "motek włóczki" z planu — kompromis wizualny, nie pełna zgodność z opisem.
  - Pewność: MEDIUM — `lucide-react` nie ma gotowej ikony motka włóczki, więc każdy wybór z tej biblioteki to przybliżenie.
  - Martwy punkt: Nie sprawdzono, czy w najnowszej wersji `lucide-react` pojawiła się ikona bliższa tematycznie (np. kłębek/przędza).
- **Poprawka B**: Zbudować własny inline `<svg>` z motywem motka włóczki, zgodnie z dosłownym brzmieniem planu.
  - Siła: Pełna zgodność z planem i najlepsza trafność tematyczna dla usera.
  - Kompromis: Wymaga własnej grafiki SVG (czas, jakość zależna od wykonania) zamiast gotowej ikony z biblioteki już w projekcie.
  - Pewność: MEDIUM — wykonalne, ale koszt wyższy niż zamiana ikony.
  - Martwy punkt: Brak.
- **Decyzja**: FIXED (Poprawka A) — zamieniono `Volleyball` na `Spool` (istniejąca ikona szpulki nici w `lucide-react`, dokładniejsza tematycznie niż piłka siatkowa) w `src/components/yarn/YarnPhotoPlaceholder.astro`. `npx astro check` — 0 błędów.

### F5 — `class:list` użyty na zwykłym stringu zamiast `class`

- **Ważność**: 👁️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/pages/yarns/[id].astro:61-64
- **Szczegóły**: `class:list={chipClass}` jest używane wielokrotnie, choć `chipClass` to zwykły string, nie tablica/obiekt do scalenia — działa poprawnie, ale to myląca konwencja Astro; żaden inny plik w tym diffie tego nie robi.
- **Poprawka**: Zamienić na `class={chipClass}` w czterech miejscach (linie 61-64 i dalsze wystąpienia w pliku).
- **Decyzja**: SKIPPED — false positive. Reguła ESLint `astro/prefer-class-list-directive`, aktywna w tym projekcie, wymusza `class:list` dla dowolnego wyrażenia (nie tylko tablicy/obiektu do scalenia) — `class={chipClass}` daje 6 ostrzeżeń lintera. Oryginalny kod był zgodny z konwencją repo; cofnięto próbę "poprawki".

## Uwagi dodatkowe (bez osobnych ustaleń)

- **Kryteria sukcesu 5.3 i 5.6 pozostają celowo nieoznaczone** w `## Progress` planu — commit epilogu (`3ef13e1`) dokumentuje, że wymagają warunków niedostępnych teraz (usuwanie włóczek poza zakresem Fazy 5; drugie konto testowe). To uczciwe śledzenie stanu, nie "podpisywanie na ślepo" — nie traktuję tego jako ustalenie.
- **`listYarns` generuje osobny signed URL dla każdej włóczki przy każdym wejściu na `/dashboard`** (N wywołań Supabase Storage) — plan wprost przewidział to w sekcji "Uwagi dotyczące wydajności" jako pomijalne przy obecnej skali i nie wymaga cache'owania w tej fazie. Zgodne z planem, nie jest to nowe ustalenie.
- `npx astro check` — 0 błędów. `npx eslint` na 5 zmienionych plikach — brak błędów specyficznych dla tej fazy (pozostałe błędy `prettier/prettier: Delete ␍` w całym repo to CRLF/line-ending noise środowiska Windows, niezwiązane z tą fazą).
