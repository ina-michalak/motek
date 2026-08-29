<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: AI substitute suggestions

- **Plan**: context/changes/ai-substitute-suggestions/plan.md
- **Zakres**: Pełny plan (Fazy 1-4). Fazy 1-3 mają już osobne przeglądy (`impl-review-phase-{1,2,3}.md`) — ten przegląd skupia się głównie na Fazie 4 (dotąd nieprzeglądanej) plus spójności między fazami.
- **Data**: 2026-08-29
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 4 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | WARNING |

## Ustalenia

### F1 — Generyczny komunikat błędu zamiast treści z API

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/components/yarn/SubstituteSuggestions.tsx:61
- **Szczegóły**: `if (!response.ok) throw new Error("Request failed")` ignoruje treść odpowiedzi błędu z API. Endpoint `src/pages/api/yarns/[id]/substitutes.ts` zwraca konkretny komunikat (`Response.json({ error: message })`, np. "Włóczka nie może być swoim własnym zamiennikiem" albo błąd własności włóczki), ale komponent zawsze pokazuje generyczne "Nie udało się zapisać decyzji. Spróbuj ponownie." `AddYarnForm.tsx` ma wzorzec przekazywania realnego `serverError` do `ServerError`.
- **Poprawka**: Sparsować JSON z odpowiedzi (`await response.json().catch(() => null)`) i użyć pola `error`, jeśli dostępne, z fallbackiem do generycznego komunikatu.
- **Decyzja**: FIXED

### F2 — `aria-label` przycisków accept/reject bez kontekstu nazwy włóczki

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/yarn/SubstituteSuggestions.tsx:124,134
- **Szczegóły**: `aria-label="Akceptuj"` / `"Odrzuć"` nie identyfikuje, której włóczki dotyczy. Przy liście kilku sugestii użytkownik czytnika ekranu nawigujący po przyciskach usłyszy powtarzające się "Akceptuj"/"Odrzuć" bez kontekstu. `StarRatingInput.tsx` ma wzorzec etykiet niosących kontekst wartości.
- **Poprawka**: `` aria-label={`Akceptuj ${suggestion.yarn.name} jako zamiennik`} `` (analogicznie dla odrzucenia).
- **Decyzja**: FIXED

### F3 — Krok ręcznej weryfikacji 3.5 pozostaje niezaadresowany

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; wymaga tylko wykonania testu, nie zmiany kodu
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: N/A (Progress 3.5, `src/lib/services/substitutes.ts` `recordSubstituteDecision`)
- **Szczegóły**: Krok "Żądanie z cudzym `substituteYarnId` jest odrzucane" nigdy nie został ręcznie zweryfikowany — świadomie odłożony przez użytkownika do wspólnego testu wielu kont. Kod ma już zabezpieczenie (`recordSubstituteDecision` weryfikuje przez `getYarnById`, że obie włóczki należą do wywołującego), więc to luka w weryfikacji, nie w implementacji.
- **Poprawka**: Wykonaj krok 3.5 przy najbliższej sesji testów z drugim kontem; zaznacz w Progress po potwierdzeniu.
- **Decyzja**: SKIPPED (odłożone do wspólnego testu wielu kont)

### F4 — Duplikat typu `SubstituteSuggestion` zamiast importu

- **Ważność**: 👁️ OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/yarn/SubstituteSuggestions.tsx:8-11 (vs. src/lib/services/substitutes.ts:6-9)
- **Szczegóły**: Lokalny `interface SubstituteSuggestion` w komponencie strukturalnie duplikuje już wyeksportowany typ z `substitutes.ts`. Ryzyko rozjazdu przy przyszłej zmianie kształtu.
- **Poprawka**: `import type { SubstituteSuggestion } from "@/lib/services/substitutes"` zamiast redefiniowania.
- **Decyzja**: FIXED

### F5 — `pendingIds`/`disabled` nigdy się wizualnie nie ujawnia

- **Ważność**: 👁️ OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/components/yarn/SubstituteSuggestions.tsx:43,49,69-74,125,135
- **Szczegóły**: `setSuggestions` usuwa element z listy w tym samym synchronicznym batchu co `setPendingIds`, więc karta (i jej przyciski) znika z DOM zanim mogłoby dojść do drugiego kliknięcia — nie jest to bug (nie ma realnego race), ale mechanizm sugeruje ochronę, która nigdy się nie ujawnia.
- **Poprawka**: Bez akcji — zostawić jako zabezpieczenie na wypadek przyszłej zmiany (np. usunięcia optymistycznego filtrowania) albo uprościć, jeśli komuś przeszkadza martwy kod.
- **Decyzja**: SKIPPED

### F6 — Brak `loading="lazy"` na miniaturze

- **Ważność**: 👁️ OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/yarn/SubstituteSuggestions.tsx:23 (vs. src/components/yarn/YarnCard.astro:21)
- **Szczegóły**: `<img>` w `YarnThumbnail` nie ma `loading="lazy"`, w przeciwieństwie do `YarnCard.astro`. Przy MVP-owej bibliotece nieistotne wydajnościowo, drobna niespójność konwencji.
- **Poprawka**: Dodać `loading="lazy"` do `<img>` w `YarnThumbnail`.
- **Decyzja**: FIXED

### F7 — Brak cleanup przy odmontowaniu podczas oczekującego fetcha

- **Ważność**: 👁️ OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/components/yarn/SubstituteSuggestions.tsx:46-75
- **Szczegóły**: Brak `AbortController`/ochrony przed `setState` po odmontowaniu (np. szybka nawigacja podczas oczekującego fetcha). W React 18 nieszkodliwe, żaden istniejący wzorzec w repo (`AddYarnForm.tsx` używa natywnego POST formularza) nie ustanawia konwencji do porównania.
- **Poprawka**: Bez akcji na teraz — do rozważenia, jeśli w przyszłości pojawią się dłuższe/wolniejsze zapytania na tej stronie.
- **Decyzja**: SKIPPED

## Weryfikacja automatyczna (uruchomiona ponownie dla całego planu)

- `npm run lint` — 0 błędów (4 pre-istniejące ostrzeżenia `no-console`, niezwiązane ze zmianą)
- `npx astro check` — 0 błędów, 0 ostrzeżeń związanych ze zmianą
- `npm run test` — 10/10 testów przechodzi
- `npx supabase db reset` — wszystkie migracje (w tym `20260829150000_create_yarn_substitute_decisions_table.sql`) aplikują się czysto

## Uwaga o zakresie

Fazy 1-3 mają już zaakceptowane osobne przeglądy z konkretnymi ustaleniami rozstrzygniętymi w swoim czasie (patrz `impl-review-phase-1.md`, `impl-review-phase-2.md`, `impl-review-phase-3.md`). Ten przegląd nie powtarza tamtej analizy — potwierdza tylko, że Faza 4 poprawnie korzysta z ich wyników (typy, kontrakty serwisów) bez rozjazdów.
