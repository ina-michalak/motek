<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Filtrowanie i sortowanie biblioteki włóczek

- **Plan**: context/changes/filter-and-sort-yarn-library/plan.md
- **Zakres**: Faza 2 z 3
- **Data**: 2026-09-01
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 2 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | WARNING |
| Dyscyplina zakresu | WARNING |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Kryteria sukcesu | PASS |

## Ustalenia

### F1 — Hidden controlled inputy bez `readOnly` (ostrzeżenie React w konsoli)

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/components/yarn/YarnFilters.tsx:74-75
- **Szczegóły**: Hidden inputy `sort` i `filtersOpen` mają `value={...}` sterowane przez React bez `onChange`/`readOnly`. To generuje ostrzeżenie Reacta w konsoli deweloperskiej ("You provided a value prop to a form field without an onChange handler"). Nie psuje działania — wartość `sort` i tak jest nadpisywana bezpośrednio przez DOM w `submitSort` przed `requestSubmit()` — ale to anti-pattern.
- **Poprawka**: Dodaj `readOnly` do obu hidden inputów.
- **Decyzja**: FIXED

### F2 — Odejście od spisanej "Umowy" planu (filtr składu, sortowanie) nieudokumentowane w change.md

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: plan.md (Faza 2, sekcja "Umowa") vs src/components/yarn/YarnFilters.tsx
- **Szczegóły**: Plan określał `<select name="fiber" multiple>` i pojedynczy 10-opcjowy `<select name="sort">`. Podczas ręcznego testowania Fazy 2 użytkownik poprosił o zmianę na listę checkboxów (natywny multi-select miał fatalny UX — wymagał Ctrl+klik, nie dawał się łatwo odznaczyć) oraz na "dzielony input" sortowania (pole + osobny przycisk kierunku). Intencja planu (działające filtrowanie/sortowanie przez URL, bez nowego stanu klienckiego poza UI) w pełni zachowana, ale spisana "Umowa" w plan.md nie odzwierciedla już rzeczywistej implementacji.
- **Poprawka**: Dopisz notatkę do `change.md` → `## Notes` dokumentującą tę decyzję UX i jej uzasadnienie (blok fazy w plan.md pozostaje tylko do odczytu zgodnie z konwencją `/10x-implement`).
- **Decyzja**: FIXED

### F3 — Elementy z Fazy 3 wdrożone wcześniej + nowy nieplanowany parametr URL

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: src/pages/dashboard.astro (licznik wyników, parsowanie `filtersOpen`), src/components/yarn/YarnFilters.tsx (przycisk "Wyczyść filtry")
- **Szczegóły**: Na wyraźną prośbę użytkownika podczas testów Fazy 2 dodano: licznik "Pokazano X z Y" i przycisk "Wyczyść filtry" (oba zaplanowane na Fazę 3), oraz zupełnie nowy, nigdzie nieplanowany parametr URL `filtersOpen` (utrwala stan otwarcia panelu filtrów między submitami, żeby panel się nie zamykał sam). Nieszkodliwe — Faza 3 i tak obejmuje pierwsze dwa elementy — ale plan robi się częściowo nieaktualny jako źródło prawdy.
- **Poprawka**: Brak akcji koniecznej teraz. Przy starcie Fazy 3: potwierdź, że kryteria 3.5 ("licznik pojawia się/znika poprawnie") i 3.6 ("Wyczyść filtry zeruje filtry, zachowuje sortowanie") są już spełnione (potwierdzone manualnie przez użytkownika w tej sesji) i skup weryfikację na pozostałych elementach fazy (rozróżnienie pustych stanów, mobile).
- **Decyzja**: ACCEPTED — udokumentowane w change.md razem z F2.

### F4 — Brak `aria-controls` na przycisku "Filtry"

- **Ważność**: OBSERVACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Spójność wzorców / Dostępność
- **Lokalizacja**: src/components/yarn/YarnFilters.tsx:126-137
- **Szczegóły**: Przycisk toggle ma poprawne `aria-expanded={isOpen}`, ale brak `aria-controls` wskazującego na panel filtrów (kontener nie ma `id`). Drobne usprawnienie dla czytników ekranu, niekrytyczne.
- **Poprawka**: Opcjonalnie dodać `id` do kontenera panelu i `aria-controls` do przycisku.
- **Decyzja**: FIXED

### F5 — Duplikacja `YarnSortKey` jako `SortField`+`SortDirection`

- **Ważność**: OBSERVACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Architektura
- **Lokalizacja**: src/components/yarn/YarnFilters.tsx:22-40
- **Szczegóły**: Lokalne typy `SortField`/`SortDirection` i funkcje `splitSort`/`combineSort` rozkładają `YarnSortKey` na dwie części dla potrzeb dzielonego UI. Uzasadnione, ale każde nowe pole sortowania w przyszłości wymaga zmiany w dwóch miejscach (`SORT_KEYS` w `yarn-filters.ts` i `SORT_FIELDS` tutaj). TypeScript złapie niezgodność przy próbie zwrócenia nieistniejącego klucza z `combineSort`, więc ryzyko jest niskie.
- **Poprawka**: Brak akcji — wystarczające zabezpieczenie przez typy.
- **Decyzja**: ACCEPTED
