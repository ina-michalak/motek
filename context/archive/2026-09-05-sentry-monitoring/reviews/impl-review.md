<!-- IMPL-REVIEW-REPORT -->

# Przegląd implementacji: Konfiguracja monitoringu błędów Sentry

- **Plan**: context/changes/sentry-monitoring/plan.md
- **Zakres**: Pełny plan (Fazy 1-4 z 4)
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

Zakres git: `a788442^..59148bd` (7 commitów: instalacja Fazy 1, sekrety Fazy 2, podłączenie catch-bloków Fazy 3, domknięcie recenzji faz 1+3, weryfikacja E2E + naprawa middleware Fazy 4, usunięcie endpointu testowego, epilog).

### Faza 1 — Instalacja i podstawowa konfiguracja

Wszystkie 5 zaplanowanych zmian — **MATCH** 1:1 z umową planu: `package.json` (`@sentry/astro@^10.73.0`), `astro.config.mjs` (`SENTRY_DSN` w `env.schema`, integracja `sentry()`, blok `vite.define`), `sentry.client.config.ts`, `sentry.server.config.ts`. Wcześniejszy przegląd fazowy (`reviews/impl-review-phase-1.md`) zgłosił 3 nieplanowane, ale zaakceptowane w sesji poprawki blokujące (typing `DeleteYarnButton.tsx`, `.gitignore` dla `.claude/worktrees/`, wykluczenie ESLint dla `.claude/hooks/**`) oraz 2 obserwacje (komentarz przy imporcie `astro:env/client` w serwerze, usunięcie zbędnego rzutowania `as string`) — wszystkie poprawki zostały od tego czasu domknięte commitem `86c4ac1`.

### Faza 2 — Sekrety i środowiska

`.env.example` zawiera `SENTRY_DSN=###` zgodnie z umową. Wcześniejszy przegląd fazowy (`reviews/impl-review-phase-2.md`) potwierdził DSN w `.env` lokalnie i w 3 środowiskach Vercela — 0 ustaleń.

### Faza 3 — Podłączenie do istniejących miejsc obsługi błędów

Dokładnie 7 wywołań `Sentry.captureException(error)` w 3 plikach API (`yarns.ts` ×2, `[id].ts` ×4, `substitutes.ts` ×1), zawsze jako pierwsza linia bloku `catch`, z importem `* as Sentry from "@sentry/astro"` w spójnej pozycji (po importach zewnętrznych, przed aliasami `@/`) we wszystkich plikach. Bloki obsługujące błędy walidacji wejścia (zod, parsowanie JSON) świadomie nie wywołują `captureException` — zgodne z zamiarem raportowania tylko realnych awarii usług. Wcześniejszy przegląd fazowy (`reviews/impl-review-phase-3.md`) — 0 ustaleń.

### Faza 4 — Weryfikacja end-to-end

Plik testowy `src/pages/api/debug/sentry-test.ts` utworzony, przetestowany (lokalnie i na Vercel Preview, po odblokowaniu Spike Protection w projekcie Sentry, które chwilowo tłumiło zdarzenia testowe) i usunięty przed zakończeniem fazy — stan końcowy zgodny z zamierzeniem planu.

**Nieplanowane, ale zasadne odkrycie i poprawka**: podczas weryfikacji E2E ujawniono, że `@sentry/astro` inicjalizuje Sentry po stronie serwera wyłącznie przy renderowaniu stron Astro (`injectScript("page-ssr", ...)` opiera się na `astro`'s `isPage()`, które z definicji wyklucza endpointy `.ts`). Żądanie trafiające bezpośrednio w API bez wcześniejszego renderowania strony w tym samym procesie nigdy nie inicjalizowało klienta Sentry — potwierdzone eksperymentalnie (diagnostyczny log `Sentry.getClient()` zwracał `false` na świeżym procesie przy bezpośrednim wywołaniu API, `true` dopiero po wcześniejszym odwiedzeniu strony). To unieważniałoby sens całej Fazy 3. Naprawiono przez `import "../sentry.server.config";` na górze `src/middleware.ts`, które uruchamia się przy każdym żądaniu (strony i API — potwierdzone w `CLAUDE.md`). Zweryfikowane jako bezpieczne: import na najwyższym poziomie modułu wykonuje się raz na proces dzięki cache'owaniu modułów ESM (nie jest to wywołanie per-request), ścieżka względna jest poprawna, a nawet potencjalna wielokrotna inicjalizacja `Sentry.init()` w tym samym procesie nie jest szkodliwa (SDK podmienia globalny klient tymi samymi parametrami, bez duplikowania zdarzeń). Zmiana i jej uzasadnienie są udokumentowane w treści commita `f35e5ad` oraz w historii tej sesji.

## Kryteria sukcesu (weryfikacja końcowa, cały plan)

**Automatyczne**: `npm run typecheck` (0 błędów), `npm run lint` (0 błędów, 11 pre-istniejących ostrzeżeń `no-console` na liniach, które plan świadomie zachowywał), `npm run build` (sukces, build produkcyjny z adapterem Vercel) — wszystkie zielone.

**Ręczne**: potwierdzone na żywo w trakcie sesji — błąd testowy widoczny w Sentry z lokalnego środowiska (`environment: development`, bez adresu e-mail/ID użytkownika w payloadzie, tylko automatyczna geolokalizacja po IP maszyny testującej) oraz z Vercel Preview (`environment: preview`, po wyłączeniu Spike Protection blokującego zdarzenia testowe); plik testowy usunięty.

## Ustalenia

Brak. Wszystkie zaplanowane zmiany zostały zaimplementowane zgodnie z umową planu, jedyne odchylenie (poprawka w `src/middleware.ts`) jest udokumentowane, uzasadnione realnym problemem odkrytym podczas testów i zweryfikowane jako bezpieczne.
