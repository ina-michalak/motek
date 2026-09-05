# Konfiguracja monitoringu błędów Sentry — krótki plan

> Pełny plan: `context/changes/sentry-monitoring/plan.md`

## Co i dlaczego

Dodajemy Sentry (monitoring błędów) do aplikacji Motek — praktyczne zadanie z lekcji 5 modułu 3 kursu 10xDevs. Dziś aplikacja nie ma żadnego monitoringu produkcyjnego: jeśli coś się zepsuje na Vercelu, jedynym śladem są logi, których nikt na bieżąco nie ogląda.

## Punkt wyjścia

Projekt jest wdrażany na **Vercel** (nie Cloudflare, mimo że `CLAUDE.md` tak wciąż mówi — to nieaktualny opis po migracji z 19 sierpnia). Zmienne środowiskowe idą przez `astro:env` + `.env` lokalnie + panel Vercela, tak jak `SUPABASE_URL`/`SUPABASE_KEY` dziś. W trzech plikach API (`yarns.ts`, `[id].ts`, `substitutes.ts`) jest łącznie 7 miejsc, które już łapią błąd, ale tylko logują go do konsoli — nic nie wysyłają dalej.

## Pożądany stan końcowy

Każdy błąd serwerowy (API, SSR) i każdy nieobsłużony błąd w przeglądarce trafia do Sentry, otagowany, z którego środowiska przyszedł (dev / preview / produkcja), bez żadnych danych osobowych. Te same 7 miejsc w API dodatkowo jawnie zgłasza swój błąd do Sentry.

## Kluczowe podjęte decyzje

| Decyzja                             | Wybór                                   | Dlaczego (1 zdanie)                                                             |
| ----------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| Zakres przechwytywania              | Serwer + przeglądarka                   | Pełny obraz błędów, SDK robi to niemal automatycznie                            |
| Podłączenie do istniejących `catch` | Tak, wszystkie 7 miejsc w 3 plikach API | Realne błędy produkcyjne mają być widoczne w Sentry, nie tylko w logach Vercela |
| Śledzenie wydajności (tracing)      | Wyłączone                               | Prościej, z zapasem mieści się w darmowym planie                                |
| Dane osobowe                        | Brak (`sendDefaultPii: false`)          | Bezpieczniej pod kątem RODO, nic do pilnowania                                  |
| Mapy źródłowe (czytelne błędy)      | Odłożone na później                     | Wymagałoby dodatkowego tokena i kroku w buildzie                                |
| Środowiska (dev/preview/prod)       | Rozróżniane przez tag `environment`     | Odróżnia własne testy od realnych użytkowników                                  |
| Weryfikacja                         | Tymczasowy testowy błąd, potem usunięty | Pewność, że cała ścieżka faktycznie działa                                      |

## Zakres

**W zakresie:**

- Instalacja `@sentry/astro`, konfiguracja klienta i serwera
- `SENTRY_DSN` w `.env`, `.env.example`, panelu Vercela (3 środowiska)
- `Sentry.captureException()` w 7 istniejących blokach `catch` w API
- Testowy błąd na końcu, żeby potwierdzić że wszystko działa

**Poza zakresem:**

- Mapy źródłowe / `SENTRY_AUTH_TOKEN`
- Śledzenie wydajności (performance tracing)
- Dane identyfikujące użytkownika w zgłoszeniach błędów
- Zmiany w komponentach React (`DeleteYarnButton`, `SubstituteSuggestions`) — ich obsługa błędów w UI zostaje bez zmian
- Sekret w GitHub Actions CI (niepotrzebny — zmienna opcjonalna, CI tylko lintuje/buduje)
- Poprawa nieaktualnego opisu Cloudflare w `CLAUDE.md`

## Architektura / Podejście

Oficjalny SDK Sentry dla Astro (`@sentry/astro`), zarejestrowany jako integracja w `astro.config.mjs`, z dwoma plikami inicjalizującymi (`sentry.client.config.ts`, `sentry.server.config.ts`). DSN idzie tą samą ścieżką co istniejące zmienne Supabase. Tag środowiska po stronie serwera czyta `VERCEL_ENV` wprost (Vercel dostarcza automatycznie); po stronie przeglądarki wymaga jednorazowego wstrzyknięcia w konfiguracji Vite (`define`), bo `process.env` nie istnieje w kodzie przeglądarki w runtime.

## Fazy w skrócie

| Faza                                | Co dostarcza                                   | Kluczowe ryzyko                                      |
| ----------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| 1. Instalacja i konfiguracja        | Działający SDK, wyłączony tracing, bez PII     | Błąd w konfiguracji `astro.config.mjs` psuje build   |
| 2. Sekrety i środowiska             | DSN dostępny w dev/preview/prod                | Zapomnienie o dodaniu zmiennej w panelu Vercela      |
| 3. Podłączenie istniejących `catch` | 7 miejsc w API realnie zgłasza błędy do Sentry | Pominięcie któregoś z 7 miejsc                       |
| 4. Weryfikacja end-to-end           | Potwierdzenie, że cała ścieżka działa          | Zapomnienie o usunięciu tymczasowego pliku testowego |

**Wymagania wstępne:** Konto Sentry i DSN (już masz). Repo już podlinkowane z Vercelem (`vercel` CLI działa lokalnie).
**Szacowany wysiłek:** ~1 sesja, 4 małe fazy.

## Otwarte ryzyka i założenia

- Zakładamy, że adapter Vercel używa domyślnie Node.js Serverless Functions (nie Edge) — Sentry dla Astro nie wspiera Edge/Cloudflare Workers. To zgodne z obecną konfiguracją (`adapter: vercel()` bez trybu edge), ale warto to mieć z tyłu głowy, gdyby ktoś kiedyś zmienił tryb adaptera.
- `CLAUDE.md` pozostaje nieaktualny w kwestii Cloudflare — nie naprawiamy tego w tym zadaniu, ale warto wiedzieć, że dokumentacja i rzeczywistość się rozjeżdżają.

## Kryteria sukcesu (podsumowanie)

- Testowy błąd pojawia się w Sentry i lokalnie, i z Vercel Preview, poprawnie otagowany środowiskiem
- Żadne dane osobowe nie trafiają do Sentry
- 7 istniejących miejsc obsługi błędów w API realnie zgłasza błędy do Sentry
- `npm run lint`, `npm run typecheck`, `npm run build` przechodzą
