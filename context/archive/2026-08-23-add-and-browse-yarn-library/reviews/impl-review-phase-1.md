<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Dodawanie i przeglądanie biblioteki włóczek

- **Plan**: context/changes/add-and-browse-yarn-library/plan.md
- **Zakres**: Faza 1 z 5
- **Data**: 2026-08-23
- **Werdykt**: ZAAKCEPTOWANY
- **Ustalenia**: 0 krytycznych, 1 ostrzeżenie, 2 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Kryteria sukcesu | PASS |

## Ustalenia

### F1 — Brak górnych limitów długości w polach tekstowych schematu walidacji

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/validation/yarn.ts (pola `name`, `manufacturer`, `color`, `dye_lot`, `gauge_note`, `note`)
- **Szczegóły**: Pola tekstowe walidowane są tylko `min(1)`/`trim()`, bez `.max()`. Kolumny w tabeli `yarns` to nieograniczony `text`, więc nic nie powstrzyma nadmiernie długich stringów, gdy schemat trafi do API route w Fazie 3. Nie blokuje Fazy 1 (schemat nie jest jeszcze podłączony do żadnego endpointu), ale warto zaadresować przy Fazie 3/4.
- **Poprawka**: Dodać rozsądne `.max()` do pól tekstowych (np. 200 dla `name`/`manufacturer`/`color`/`dye_lot`, 1000 dla `gauge_note`/`note`) przy okazji Fazy 3.
- **Decyzja**: FIXED — dodano `.max(200)` do `name`/`manufacturer`/`color`/`dye_lot`, `.max(1000)` do `gauge_note`/`note`; `optionalTrimmedString` zmienione na funkcję przyjmującą `maxLength`. Zweryfikowano `npx eslint` i `npx astro check` — 0 błędów.

### F2 — `optionalNumber` zamienia `null` na `0`, nie na `undefined`

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/lib/validation/yarn.ts:33-37 (`emptyToUndefined`, `optionalNumber`)
- **Szczegóły**: `emptyToUndefined` obsługiwał tylko puste stringi; `null` nie był przechwytywany, więc `z.coerce.number()` przekształcał `null` na `0` zamiast `undefined`. `FormData.get()` zwraca `null` dla pól całkowicie nieobecnych w formularzu (np. pusty `<input type="file">` albo pole warunkowo nierenderowane) — to realna, choć rzadka ścieżka, nie tylko czysto hipotetyczna.
- **Decyzja**: FIXED — `emptyToUndefined` rozszerzone o `value === null`. Zweryfikowano `npx eslint` i `npx astro check` — 0 błędów.

### F3 — Zainstalowana wersja zod (4.4.3) różni się od zakładanej w planie (3.x)

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: package.json
- **Szczegóły**: Plan zakładał "najnowszą stabilną 3.x". W momencie `npm install zod` najnowszą stabilną była już 4.x, więc zainstalowano `^4.4.3`. Zweryfikowano (typy + test runtime), że wszystkie użyte API (`z.coerce.number()`, `.refine()` z `path`, `z.preprocess()`) działają identycznie w v4 — brak realnej niezgodności funkcjonalnej. Już zakomunikowane użytkownikowi w trakcie implementacji fazy.
- **Decyzja**: ZAAKCEPTOWANE (bez naprawy — wersja jest celowo nowsza niż plan zakładał, brak wpływu funkcjonalnego)

## Dodatkowe potwierdzenia (bez ustaleń)

- Reguła `search_path` z `context/foundation/lessons.md` nie dotyczy tej fazy — migracja nie definiuje żadnej funkcji Postgres.
- Brak osobnego `GRANT` dla `storage.objects`/`storage.buckets` (w przeciwieństwie do tabeli `yarns`) nie jest luką — Supabase Storage nadaje domyślne uprawnienia tabelowe rolom `authenticated`/`anon` przy instalacji rozszerzenia; RLS jest tu jedynym potrzebnym mechanizmem. Potwierdzone lokalnym `supabase db reset`, który przeszedł bez błędów.
- Zakres commita `be018c5` zawiera wyłącznie pliki planowane dla Fazy 1 (plus scaffolding zmiany w `context/changes/`) — brak rozszerzenia zakresu.
- Kryteria sukcesu: automatyczne (`npm run lint`, `npx astro check`, `npx supabase db reset`) przeszły z dowodami w commicie; ręczne (bucket + 4 polityki RLS w Supabase Studio) potwierdzone przez użytkownika na zrzucie ekranu.
