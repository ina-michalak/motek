<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Zarządzanie zapisaną włóczką (S-03)

- **Plan**: context/changes/manage-saved-yarn-entry/plan.md
- **Zakres**: Faza 1 z 3 (Fundament backendu)
- **Data**: 2026-08-31
- **Werdykt**: ZAAKCEPTOWANY
- **Ustalenia**: 0 krytycznych, 1 ostrzeżenie, 0 obserwacji

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

### F1 — Kolejność Storage/DB w `deleteYarn` ryzykuje bezpowrotną utratę zdjęcia

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość (Bezpieczeństwo danych)
- **Lokalizacja**: src/lib/services/yarns.ts:152-178
- **Szczegóły**: `deleteYarn` usuwa plik ze Storage (linia 163) **przed** usunięciem wiersza z tabeli `yarns` (linia 169). To odwrotna kolejność niż w `removeYarnPhoto` (linie 127-150), gdzie DB jest źródłem prawdy first — najpierw `.update({ photo_url: null })`, dopiero po potwierdzonym sukcesie zapisu czyszczony jest Storage. W `deleteYarn`, jeśli `delete` wiersza zawiedzie (przejściowy błąd sieci/DB) po tym, jak plik już zniknął ze Storage, zdjęcie jest bezpowrotnie utracone, a rekord `yarn` nadal istnieje z martwym `photo_url` wskazującym na nieistniejący obiekt (`resolveYarnPhotoUrl` po prostu zwróci `null` po cichu przy kolejnym odczycie — brak sygnału dla użytkownika o utracie zdjęcia). Warto odnotować: ta kolejność była tak dosłownie zapisana w umowie planu (Faza 1, punkt 1) — to nie jest odchylenie implementacji od planu, tylko wada samego planu, którą przegląd wychwytuje.
- **Poprawka**: Odwróć kolejność — najpierw `.delete().select("id")` z weryfikacją dopasowanego wiersza (już obecną), a usunięcie z Storage wykonaj dopiero po potwierdzonym sukcesie DB, analogicznie do `removeYarnPhoto`. Błąd samego Storage pozostaje `console.warn`, nie throw — ryzyko zamienia się wtedy z "utrata danych" na nieszkodliwy, już akceptowany w kodzie orphaned-blob w buckecie.
  - Siła: Ujednolica `deleteYarn` z już istniejącym, bezpieczniejszym wzorcem DB-first z `removeYarnPhoto` w tym samym pliku; eliminuje scenariusz nieodwracalnej utraty zdjęcia bez utraty danych włóczki.
  - Kompromis: Brak istotnego — to przestawienie kilku linii, bez zmiany sygnatury ani zachowania w ścieżce sukcesu.
  - Pewność: HIGH — identyczny wzorzec (DB first, Storage cleanup po sukcesie, warn zamiast throw na błędzie Storage) już działa obok, w tym samym pliku.
  - Martwy punkt: Brak znaczących — scenariusz awarii jest wąski (przejściowy błąd DB dokładnie między dwoma krokami), ale poprawka jest praktycznie bezkosztowa, więc warto ją zastosować mimo niskiego prawdopodobieństwa.
- **Decyzja**: FIXED — kolejność odwrócona w src/lib/services/yarns.ts (delete wiersza przed cleanup Storage), zweryfikowane npm run lint + npm run test (16/16)

## Dodatkowe uwagi (bez osobnych ustaleń)

- Agent 1 (zgodność z planem): pełny MATCH na wszystkich 4 punktach Fazy 1 (serwis, helper `isYarnExhausted`, instalacja shadcn dialog/alert-dialog, route `[id].ts` POST+DELETE) — kolejność operacji, warianty redirectów (`/yarns/${id}?warning=` zamiast `/dashboard?warning=` przy błędzie zdjęcia — celowa różnica względem `api/yarns.ts`, zgodna z planem) i walidacja pól zweryfikowane linia po linii. Brak elementów MISSING/EXTRA.
- Agent 2: autoryzacja i izolacja per `user_id` w nowym route potwierdzone poprawne (brak IDOR) — middleware nie chroni `/api/yarns*`, więc jawna kontrola `context.locals.user` w route jest wymagana i obecna. `toErrorMessage` zduplikowany identycznie jak w istniejących routes — świadomy, akceptowalny wzorzec repo, nie zgłoszony jako problem.
- Kryteria sukcesu automatyczne (`npm run lint`, `npm run test` — 16/16, `npm run build`) zweryfikowane przed commitem `c999bf7` — wszystkie PASS.
- Kryteria sukcesu ręczne (1.5, 1.6, 1.7) potwierdzone live-testami z realnymi dowodami w trakcie sesji (fetch z konsoli przeglądarki, w tym prawdziwy test izolacji między dwoma kontami Supabase) — nie "podpisane na ślepo".
