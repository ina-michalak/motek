<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Fundament danych biblioteki włóczek

- **Plan**: `context/changes/yarn-data-foundation/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-08-23
- **Werdykt**: DO POPRAWY → **SOLIDNY** (po zastosowaniu poprawek)
- **Ustalenia**: 1 krytyczne, 3 ostrzeżenia, 0 obserwacji

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność ze stanem końcowym | ZALICZONY |
| Oszczędne wykonanie | ZALICZONY |
| Dopasowanie architektoniczne | ZALICZONY |
| Martwe punkty | NIEZALICZONY (przed poprawkami) |
| Kompletność planu | OSTRZEŻENIE (przed poprawkami) |

## Ugruntowanie

5/6 odniesień ✓ (1 błędna ścieżka — naprawiona), symbole zweryfikowane ✓ (`src/middleware.ts:12-13`, `astro.config.mjs:17-22`), brief↔plan ✓. Sprawdzono blast radius: brak istniejącego kodu importującego `src/types.ts` lub odwołującego się do `Yarn` — potwierdzone czysto greenfieldowe wprowadzenie.

## Ustalenia

### F1 — Ręczny test RLS mógł dać fałszywy wynik pozytywny

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 1 — Weryfikacja ręczna / Kroki testowania ręcznego
- **Szczegóły**: Plan kazał testować izolację RLS przez Supabase Studio SQL Editor, który domyślnie łączy się jako superużytkownik `postgres` omijający RLS — test mógłby "przejść" nawet przy całkowicie zepsutych politykach.
- **Poprawka A ⭐ Zalecana**: Testuj przez prawdziwy mechanizm logowania (Supabase Auth token endpoint) + REST API (PostgREST) zamiast Studio SQL Editor.
  - Siła: RLS wymuszane dokładnie tak jak w produkcji (anon key + prawdziwy JWT `authenticated`), zero ryzyka fałszywego wyniku.
  - Kompromis: Trochę więcej kroków niż wklejenie SQL w Studio.
  - Pewność: WYSOKA — to dokładnie mechanizm, którego użyje docelowa aplikacja.
  - Martwy punkt: Brak.
- **Poprawka B**: Zostań przy Studio SQL Editor, ale dopisz jawne przełączenie roli/JWT przed każdym zapytaniem.
  - Siła: Zostaje przy jednym narzędziu.
  - Kompromis: Łatwo pominąć krok i wrócić do fałszywego testu.
  - Pewność: ŚREDNIA — technika udokumentowana przez Supabase, nie zweryfikowana bezpośrednio w tym środowisku.
  - Martwy punkt: Zachowanie lokalnej wersji Supabase CLI/Studio niezweryfikowane.
- **Decyzja**: NAPRAWIONE (Poprawka A) — kroki testowe w Fazie 1 zastąpione testem przez REST API z prawdziwymi access tokenami dwóch użytkowników; jawna notatka ostrzegająca przed użyciem Studio SQL Editor do tego testu.

### F2 — Błędna ścieżka do infrastructure.md

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: "Kluczowe odkrycia" i "Uwagi dotyczące migracji"
- **Szczegóły**: Plan dwukrotnie odwoływał się do `context/deployment/infrastructure.md`; plik faktycznie leży pod `context/foundation/infrastructure.md` (`context/deployment/` zawiera tylko `deploy-plan.md`).
- **Poprawka**: Zmień obie ścieżki na `context/foundation/infrastructure.md`.
- **Decyzja**: NAPRAWIONE — obie ścieżki poprawione.

### F3 — Brak DEFAULT dla user_id zwiększał ryzyko błędu przy przyszłych zapisach

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 1 — Kontrakt kolumn
- **Szczegóły**: `user_id` nie miał wartości domyślnej — każdy przyszły kod zapisujący wiersz (S-01) musiałby pamiętać o jawnym podaniu `user_id`; pominięcie nie powodowałoby wycieku danych (polityka `WITH CHECK` i tak by zablokowała), ale mylący błąd insertu.
- **Poprawka**: Dodano `default auth.uid()` do kolumny `user_id`.
- **Decyzja**: NAPRAWIONE — kontrakt kolumny zaktualizowany o `default auth.uid()`.

### F4 — `supabase migration list` mógł wymagać połączenia z projektem zdalnym

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1 — Weryfikacja automatyczna
- **Szczegóły**: `npx supabase migration list` domyślnie porównuje migracje lokalne ze zdalnym projektem i mógłby zawieść błędem braku linkowania projektu — fałszywy alarm niezwiązany z jakością migracji.
- **Poprawka**: Usunięto ten krok; `npx supabase db reset` pozostaje wystarczającym automatycznym dowodem (zawodzi głośno przy wadliwej migracji).
- **Decyzja**: NAPRAWIONE — krok usunięty z weryfikacji automatycznej i z sekcji Postęp (indeks 1.2 pozostaje jako celowa luka, zgodnie z konwencją niekonewracania).
