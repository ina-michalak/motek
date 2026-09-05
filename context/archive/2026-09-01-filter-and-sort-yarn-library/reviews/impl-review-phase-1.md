<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Filtrowanie i sortowanie biblioteki włóczek

- **Plan**: context/changes/filter-and-sort-yarn-library/plan.md
- **Zakres**: Faza 1 z 3
- **Data**: 2026-09-01
- **Werdykt**: ZAAKCEPTOWANY
- **Ustalenia**: 0 krytycznych, 0 ostrzeżeń, 3 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | PASS |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Kryteria sukcesu | PASS |

Commit: f3761e2. Testy: 49/49. Lint: 0 błędów. Build: przeszedł.

## Ustalenia

### F1 — Null-safe sortowanie zastosowane też do oceny (rating), poza literą planu

- **Ważność**: OBSERVACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; nie wymaga akcji
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: src/lib/yarn-filters.ts:167-171
- **Szczegóły**: Plan jawnie wymagał "nulle na końcu niezależnie od kierunku" tylko dla sortowania po ilości (motki/gramatura). Implementacja zastosowała ten sam bezpieczny `compareNullableNumber` też dla `rating_desc`/`rating_asc` — pole `rating` też jest `number | null`. To wykracza poza dosłowną literę umowy, ale jest spójne z resztą API i poprawia jakość (bez tego brak oceny mógłby się mylnie posortować jako "0" zamiast trafić na koniec).
- **Poprawka**: Brak koniecznej akcji — to świadome, korzystne rozszerzenie zakresu, nie błąd.
- **Decyzja**: SKIPPED

### F2 — Brak dedykowanego testu na niemutowalność wejścia

- **Ważność**: OBSERVACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: src/lib/yarn-filters.test.ts (brak takiego testu)
- **Szczegóły**: Umowa w planie jawnie wymaga "zwraca nową tablicę, nie mutuje wejścia". Kod to spełnia (`[...yarns]` w `sortYarns`, `yarns.filter()` w `filterAndSortYarns` — zweryfikowane przez agenta jako poprawne), ale żaden test nie asercjonuje tego wprost.
- **Poprawka**: Dodać jeden test sprawdzający, że wejściowa tablica nie zmienia kolejności/referencji po wywołaniu `filterAndSortYarns`.
- **Decyzja**: FIXED — dodano test "nie mutuje ani nie zmienia kolejności wejściowej tablicy" w nowym `describe("filterAndSortYarns — niemutowalność")`

### F3 — Nazwy testów po polsku odbiegają od angielskiej konwencji reszty repo

- **Ważność**: OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/lib/yarn-filters.test.ts (wszystkie bloki describe/it)
- **Szczegóły**: Trzy istniejące pliki testowe (`utils.test.ts`, `validation/yarn.test.ts`, `services/substitute-matching.test.ts`) używają angielskich nazw testów. Nowy plik używa polskich.
- **Poprawka A ⭐ Zalecana**: Zostaw po polsku.
  - Siła: CLAUDE.md wymaga polskiego dla komunikacji z użytkownikiem/projektem; z tylko 3 istniejącymi plikami testowymi trudno mówić o mocno ugruntowanej konwencji angielskiej; zero pracy.
  - Kompromis: Repo będzie miało mieszane języki nazw testów, dopóki ktoś nie ujednolici.
  - Pewność: MEDIUM — to decyzja stylistyczna zespołu, nie techniczna.
  - Martwy punkt: Nie sprawdzono, czy istnieje gdzieś jawna reguła projektu preferująca angielski w kodzie/testach.
- **Poprawka B**: Przepisz wszystkie nazwy testów na angielski dla spójności z 3 istniejącymi plikami.
  - Siła: Jednolita konwencja w całym repo.
  - Kompromis: Czysto kosmetyczna przeróbka 49 nazw testów bez wpływu na funkcjonalność.
  - Pewność: MEDIUM.
  - Martwy punkt: Brak.
- **Decyzja**: SKIPPED (zostawiono polskie nazwy testów)
