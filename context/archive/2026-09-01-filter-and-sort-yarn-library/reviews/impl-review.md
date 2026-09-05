<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Filtrowanie i sortowanie biblioteki włóczek

- **Plan**: context/changes/filter-and-sort-yarn-library/plan.md
- **Zakres**: Faza 3 z 3 (pełny plan)
- **Data**: 2026-09-05
- **Werdykt**: ZAAKCEPTOWANY
- **Ustalenia**: 0 krytycznych, 2 ostrzeżenia, 1 obserwacja (wszystkie 3 naprawione podczas sortowania)

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | PASS |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | PASS |

Commity: f3761e2, 372049c, 6fa1b32, bf79f9a, b16e0e6. Testy: 50/50. Lint: 0 błędów. Build: przeszedł.

Fazy 1-2 ponownie zweryfikowane wzgl. aktualnego kodu — bez regresji (poprawki z poprzednich przeglądów: `readOnly` na hidden inputach, `aria-controls`, null-safe sort dla `rating`, test niemutowalności — wszystkie nadal obecne).

Dodatek poza "Umową" Fazy 3, udokumentowany w change.md (przycisk "Pokaż wyniki" zamykający panel na mobile) — sprawdzony pod kątem "Czego NIE robimy" i nowych parametrów URL/stanu: brak konfliktów, czysto prezentacyjny. MATCH względem własnego opisu w change.md.

## Ustalenia

### F1 — Kwadratowy róg paska "Pokaż wyniki" wystaje poza zaokrąglenie karty

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/yarn/YarnFilters.tsx:323-337
- **Szczegóły**: Formularz ma `rounded-2xl` bez `overflow-hidden`. Sticky pasek z ujemnymi marginesami (`-mx-4 -mb-4`) sięga do wewnętrznej krawędzi obramowania, ale ma kwadratowe rogi — na widoku mobilnym (<sm, panel otwarty) wystają one ponad łuk zaokrąglenia karty w obu dolnych rogach.
- **Poprawka**: Dodać `rounded-b-2xl sm:rounded-none` do klas paska (albo `overflow-hidden` na `<form>`).
- **Decyzja**: FIXED — dodano `rounded-b-2xl` / `sm:rounded-none` do klas sticky paska

### F2 — Przycisk "Pokaż wyniki" może nachodzić na pływający ThemeToggle (mobile)

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/yarn/YarnFilters.tsx:323-337 vs src/layouts/Layout.astro:47-49
- **Szczegóły**: `Layout.astro` renderuje globalny `ThemeToggle` jako `fixed right-4 bottom-4 z-50` na każdej stronie. Nowy pasek jest `sticky bottom-0`, wyrównany do prawej, bez własnego `z-index`. Gdy panel filtrów jest otwarty i użytkownik przewinie do dołu na mobile, obszar przycisku "Pokaż wyniki" pokrywa się z rogiem, w którym siedzi ThemeToggle (renderowany później w DOM, wyższy z-index) — może wizualnie przykrywać lub utrudniać kliknięcie.
- **Poprawka**: Dodać pasku `pr-14 sm:pr-4` (odstęp od prawej krawędzi na mobile) i jawny `z-10`, żeby uniknąć kolizji z ThemeToggle.
- **Decyzja**: FIXED — dodano `pr-14`/`sm:pr-0` i `z-10` do klas sticky paska

### F3 — parseNumberParam akceptuje wartości ujemne z URL

- **Ważność**: OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/yarn-filters.ts:96-100
- **Szczegóły**: UI wymusza `min={0}`, ale ręcznie spreparowany URL (`?minSkeins=-5`) przechodzi przez `parseNumberParam` bez odrzucenia. Niegroźne funkcjonalnie (filtr staje się no-opem), ale niespójne z założeniem "nieujemna wartość".
- **Poprawka**: Opcjonalnie odrzucać wartości ujemne (`parsed < 0 ? undefined : parsed`).
- **Decyzja**: FIXED — `parseNumberParam` odrzuca teraz wartości ujemne; dodano test
