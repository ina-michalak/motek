<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Ochrona zapisu nowej włóczki (Ryzyko #1)

- **Plan**: context/changes/protect-yarn-crud-operations/plan.md
- **Zakres**: Faza 1 i 2 z 2 (pełny plan)
- **Data**: 2026-09-05
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 1 ostrzeżenie, 1 obserwacja

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | WARNING |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | PASS |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Kryteria sukcesu | PASS |

## Ustalenia

### F1 — `test-plan.md §6.2` nadal odsyła do testu referencyjnego jako "TBD"

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: context/foundation/test-plan.md:126
- **Szczegóły**: Faza 1 wymagała wypełnienia §6.2 z linkiem do testu referencyjnego z Fazy 2 jako przykładu. W momencie realizacji Fazy 1 ten plik jeszcze nie istniał, więc zostawiono placeholder: "Test referencyjny: `src/lib/services/yarns.integration.test.ts` — TBD, powstanie w Fazie 2 tej zmiany (Ryzyko #1)." Faza 2 dostarczyła ten plik (commit c682544), ale żadna z jej zmian nie wróciła do test-plan.md, by zamknąć ten placeholder. To wprost narusza własną zasadę test-planu przywołaną w samym planie: "każda faza wdrożenia aktualizuje odpowiedni wpis w §6 zamiast zostawiać TBD."
- **Poprawka**: Zamień linię 126 na odniesienie bez "TBD", potwierdzające że plik istnieje i jest gotowym przykładem wzorca (np. "Test referencyjny: `src/lib/services/yarns.integration.test.ts` — dwa testy: zapis z niezależnym odczytem oraz odrzucenie przez constraint bazy bez powstania wiersza.").
- **Decyzja**: FIXED — zaktualizowano `context/foundation/test-plan.md:126`

### F2 — Wspólna sesja `beforeAll` między dwoma testami w pliku

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/lib/services/yarns.integration.test.ts:31-33
- **Szczegóły**: `beforeAll` tworzy jedną sesję Supabase dzieloną przez oba testy w pliku. Dziś jest to bezpieczne, bo Vitest domyślnie uruchamia testy w jednym pliku sekwencyjnie, a `afterEach` sprząta wiersze między testami. Gdyby w przyszłości repo włączyło równoległe uruchamianie testów wewnątrz pliku, dwa testy dzielące `userId` mogłyby wzajemnie zakłócać swoje dane.
- **Poprawka**: Brak działania wymaganego teraz — zostaw jako świadomą notatkę na przyszłość; jeśli konfiguracja Vitest kiedyś zacznie równoległe uruchamianie testów w pliku, przenieść `createTestSupabaseSession()` do `beforeEach`.
- **Decyzja**: FIXED — przeniesiono `createTestSupabaseSession()` z `beforeAll` do `beforeEach` w `yarns.integration.test.ts:31-33` (na życzenie użytkownika, mimo że plan pierwotnie dopuszczał oba warianty)
