<!-- IMPL-REVIEW-REPORT -->

# Przegląd implementacji: Konfiguracja monitoringu błędów Sentry

- **Plan**: context/changes/sentry-monitoring/plan.md
- **Zakres**: Faza 3 z 4
- **Data**: 2026-09-05
- **Werdykt**: ZAAKCEPTOWANY
- **Ustalenia**: 0 krytycznych, 0 ostrzeżeń, 0 obserwacji

## Werdykty

| Wymiar                  | Werdykt |
| ----------------------- | ------- |
| Zgodność z planem       | PASS    |
| Dyscyplina zakresu      | PASS    |
| Bezpieczeństwo i jakość | PASS    |
| Architektura            | PASS    |
| Spójność wzorców        | PASS    |
| Kryteria sukcesu        | PASS    |

## Kontekst weryfikacji

- Commit fazy: `5b446bf` — `feat(sentry-monitoring): podłączenie do istniejących miejsc obsługi błędów (p3)`
- Zmienione pliki (dokładnie zgodne z planem): `src/pages/api/yarns.ts`, `src/pages/api/yarns/[id].ts`, `src/pages/api/yarns/[id]/substitutes.ts`, `context/changes/sentry-monitoring/plan.md`.
- `npm run typecheck` — 0 błędów, 0 ostrzeżeń (5 niezwiązanych hintów w innych plikach).
- `npm run lint` — 0 błędów; 11 ostrzeżeń `no-console`, wszystkie na tych samych liniach `console.error`/`console.warn`, które plan wprost zachowywał bez zmian.
- Ręczne potwierdzenie wykonane przez użytkownika i zweryfikowane w pełnym diffie: wszystkie 7 bloków `catch` (2 w `yarns.ts`, 4 w `[id].ts`, 1 w `substitutes.ts`) wywołuje `Sentry.captureException(error)` jako pierwszą instrukcję, przed istniejącym logowaniem do konsoli — dokładnie zgodnie z umową planu.
- Potwierdzono w runtime, że `@sentry/astro` eksportuje `captureException` jako funkcję (`node -e "require('@sentry/astro').captureException"` → `function`).

## Uwagi

Mechaniczna, jednorodna zmiana bez odchyleń: import `* as Sentry from "@sentry/astro"` dodany w tej samej pozycji (po importach zewnętrznych pakietów, przed aliasami `@/`) we wszystkich trzech plikach; brak nieplanowanych zmian; brak zmian zachowania widocznego dla użytkownika (komunikaty błędów w UI bez zmian, zgodnie z "Uwagi dotyczące migracji" planu). Brak ustaleń do posortowania.
