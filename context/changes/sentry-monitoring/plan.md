# Konfiguracja monitoringu błędów Sentry — plan implementacji

## Przegląd

Dodajemy Sentry do aplikacji Motek: przechwytywanie błędów po stronie serwera (API, SSR) i przeglądarki, z rozróżnieniem środowisk (development/preview/production), bez danych osobowych i bez śledzenia wydajności (na razie). Przy okazji podłączamy istniejące miejsca w API, które dziś tylko logują błąd do konsoli, żeby realne awarie produkcyjne stały się widoczne w dashboardzie Sentry, a nie tylko w logach Vercela.

## Analiza stanu obecnego

- Projekt jest wdrażany na **Vercel** (adapter `@astrojs/vercel`), nie na Cloudflare — mimo że `CLAUDE.md` wciąż opisuje Cloudflare Workers. To świadoma, udokumentowana zmiana z 2026-08-19 (`context/deployment/deploy-plan.md`); `CLAUDE.md` po prostu nie został zaktualizowany. Ten plan opiera się na rzeczywistym stanie (Vercel).
- `context/foundation/test-plan.md` wprost odnotowuje brak monitoringu jako lukę: "Obserwowalność: nieobecny — brak bibliotek logowania błędów/monitoringu."
- Zmienne środowiskowe są dziś zarządzane przez `astro:env` (`astro.config.mjs`) + lokalny `.env` (gitignored) + panel Vercela (osobno dla Production/Preview/Development) — patrz `SUPABASE_URL`/`SUPABASE_KEY` jako wzorzec.
- W trzech plikach API istnieje łącznie **7 bloków `catch`**, które dziś tylko logują do konsoli i zwracają komunikat użytkownikowi, ale nigdzie nie wysyłają błędu dalej:
  - `src/pages/api/yarns.ts` — 1× `console.error` (linia 58), 1× `console.warn` (linia 67)
  - `src/pages/api/yarns/[id].ts` — 2× `console.error` (linie 65, 110), 2× `console.warn` (linie 74, 82)
  - `src/pages/api/yarns/[id]/substitutes.ts` — 1× `console.error` (linia 53)
- Dwa komponenty React (`DeleteYarnButton.tsx`, `SubstituteSuggestions.tsx`) też łapią błędy po stronie przeglądarki i pokazują je w UI (`setError`) — te **zostają bez zmian** (patrz "Czego NIE robimy").
- Brak dziś jakiegokolwiek pakietu Sentry/monitoringu w `package.json`.
- `@sentry/astro` w wersji stabilnej `10.x` działa tylko na runtime Node.js (Serverless Functions), nie na Vercel Edge/Cloudflare Workers — adapter `vercel()` w `astro.config.mjs` używa domyślnie Serverless Functions (Node.js), więc jest kompatybilny bez dodatkowej konfiguracji.

## Pożądany stan końcowy

Po zakończeniu tego planu: każdy błąd rzucony w API lub renderowaniu serwerowym, oraz każdy nieobsłużony błąd w przeglądarce, trafia do Sentry z poprawnym tagiem środowiska (`development` / `preview` / `production`) i bez żadnych danych osobowych. Trzy pliki API dodatkowo jawnie wysyłają swoje już-złapane wyjątki do Sentry. Weryfikacja: testowy błąd wywołany ręcznie pojawia się w dashboardzie Sentry zarówno z lokalnego środowiska, jak i z Vercel Preview.

### Kluczowe odkrycia:

- `context/deployment/deploy-plan.md` — potwierdza platformę (Vercel) i wzorzec zarządzania sekretami (panel Vercela, trzy środowiska).
- `astro.config.mjs:17-22` — istniejący wzorzec `env.schema` z `envField` (`context`, `access`, `optional: true`) do naśladowania dla `SENTRY_DSN`.
- `src/lib/config-status.ts` — istniejący wzorzec "graceful degradation" dla brakującej konfiguracji (Supabase); Sentry **nie** potrzebuje własnego banera — brak DSN ma po prostu wyłączyć wysyłkę, SDK robi to samo z natury, gdy `dsn` jest puste.
- Sentry dla Astro oczekuje dwóch plików w korzeniu repo: `sentry.client.config.ts` i `sentry.server.config.ts`, rejestrowanych automatycznie przez integrację `sentry()` w `astro.config.mjs`.

## Czego NIE robimy

- Nie konfigurujemy map źródłowych (source maps) ani `SENTRY_AUTH_TOKEN` — odłożone na później, błędy na razie pokazują zminifikowany kod.
- Nie włączamy śledzenia wydajności (performance tracing) — `tracesSampleRate` zostaje `0`.
- Nie wysyłamy żadnych danych identyfikujących użytkownika (`sendDefaultPii: false`, bez `Sentry.setUser`).
- Nie dodajemy `Sentry.captureException` do dwóch komponentów React po stronie przeglądarki (`DeleteYarnButton.tsx`, `SubstituteSuggestions.tsx`) — ich dzisiejsze zachowanie (`setError` + komunikat w UI) zostaje bez zmian; nieobsłużone błędy przeglądarki i tak łapie automatycznie SDK kliencki.
- Nie dodajemy `SENTRY_DSN` do sekretów GitHub Actions — CI tylko lintuje i buduje, zmienna jest opcjonalna w schemacie, więc build przejdzie bez niej.
- Nie naprawiamy nieaktualnego opisu "Cloudflare Workers" w `CLAUDE.md` — to osobna sprawa dokumentacyjna, poza zakresem tej zmiany.

## Podejście do implementacji

Standardowa instalacja oficjalnego SDK (`@sentry/astro`), konfiguracja przez dwa pliki inicjalizujące (client/server) + rejestracja integracji w `astro.config.mjs`, rollout sekretu przez te same trzy miejsca co dla Supabase (`.env`, `.env.example`, panel Vercela), następnie mechaniczne dopisanie `Sentry.captureException()` w istniejących blokach `catch`, na końcu jednorazowy testowy błąd do potwierdzenia całej ścieżki.

## Krytyczne szczegóły implementacji

- **Tag środowiska po stronie przeglądarki wymaga jawnego wstrzyknięcia w czasie builda.** Po stronie serwera `process.env.VERCEL_ENV` (`"production" | "preview" | "development"`, dostarczane automatycznie przez Vercel, bez żadnej konfiguracji) działa wprost w runtime Node.js. W kodzie przeglądarki `process` nie istnieje w runtime — wartość trzeba wstrzyknąć w momencie builda przez Vite:

  ```js
  // astro.config.mjs, obok istniejącego vite.plugins
  vite: {
    plugins: [tailwindcss()],
    define: {
      "import.meta.env.SENTRY_ENVIRONMENT": JSON.stringify(process.env.VERCEL_ENV ?? "development"),
    },
  },
  ```

  `sentry.client.config.ts` czyta wtedy `import.meta.env.SENTRY_ENVIRONMENT`; `sentry.server.config.ts` czyta `process.env.VERCEL_ENV` bezpośrednio (bez `define`).

## Faza 1: Instalacja i podstawowa konfiguracja Sentry

### Przegląd

Dodajemy pakiet, rejestrujemy integrację, tworzymy pliki inicjalizujące dla klienta i serwera, z wyłączonym tracingiem i bez danych osobowych.

### Wymagane zmiany:

#### 1. Zależność pakietu

**Plik**: `package.json`

**Cel**: Dodać oficjalny SDK Sentry dla Astro.

**Umowa**: `npm install @sentry/astro@^10.73.0` (pinowana obecna stabilna major-wersja; **nie** uruchamiaj `npx astro add @sentry/astro` — ten wizard jest interaktywny i próbuje logować do konta Sentry).

#### 2. Zmienna środowiskowa DSN

**Plik**: `astro.config.mjs`

**Cel**: Udostępnić DSN Sentry zarówno kodowi serwerowemu, jak i przeglądarce (DSN nie jest sekretem — jest z natury publiczny, wystarczy wysyłać zdarzenia).

**Umowa**: W `env.schema`, obok `SUPABASE_URL`/`SUPABASE_KEY`, dodaj `SENTRY_DSN: envField.string({ context: "client", access: "public", optional: true })`.

#### 3. Rejestracja integracji i tag środowiska

**Plik**: `astro.config.mjs`

**Cel**: Podłączyć Sentry do buildu Astro i wstrzyknąć tag środowiska do przeglądarki (patrz "Krytyczne szczegóły implementacji" powyżej).

**Umowa**: `import sentry from "@sentry/astro"`; dodaj `sentry()` do tablicy `integrations` (obok `react()`, `sitemap()`); dodaj blok `define` do `vite` zgodnie z fragmentem wyżej.

#### 4. Konfiguracja klienta

**Plik**: `sentry.client.config.ts` (nowy, korzeń repo)

**Cel**: Zainicjalizować Sentry po stronie przeglądarki.

**Umowa**: `Sentry.init({ dsn: SENTRY_DSN, environment: import.meta.env.SENTRY_ENVIRONMENT, tracesSampleRate: 0, sendDefaultPii: false })`, gdzie `SENTRY_DSN` pochodzi z `import { SENTRY_DSN } from "astro:env/client"`.

#### 5. Konfiguracja serwera

**Plik**: `sentry.server.config.ts` (nowy, korzeń repo)

**Cel**: Zainicjalizować Sentry po stronie serwera (API routes, SSR).

**Umowa**: `Sentry.init({ dsn: SENTRY_DSN, environment: process.env.VERCEL_ENV ?? "development", tracesSampleRate: 0, sendDefaultPii: false })`, `SENTRY_DSN` z tego samego `astro:env/client` importu (działa też po stronie serwera, patrz dokumentacja Astro o `context: "client"`).

### Kryteria sukcesu:

#### Automatyczne

- [ ] `npm run typecheck` przechodzi
- [ ] `npm run lint` przechodzi
- [ ] `npm run build` kończy się sukcesem

#### Ręczne

- [ ] `npm run dev` startuje bez nowych błędów/ostrzeżeń w konsoli związanych z Sentry

---

## Faza 2: Sekrety i środowiska

### Przegląd

Dostarczamy `SENTRY_DSN` do wszystkich miejsc, gdzie aplikacja działa: lokalnie, w Preview i w Production na Vercelu.

### Wymagane zmiany:

#### 1. Lokalna zmienna środowiskowa

**Plik**: `.env` (gitignored, nie commitować)

**Cel**: Umożliwić lokalny `npm run dev`/`npm run build` z prawdziwym DSN.

**Umowa**: Dodaj linię `SENTRY_DSN=https://8f1c0dd2c44a2aa194b489a5a5737470@o4512035118448640.ingest.de.sentry.io/4512035135160400`.

#### 2. Szablon zmiennych

**Plik**: `.env.example`

**Cel**: Udokumentować wymaganą zmienną dla przyszłych współpracowników/sesji, zgodnie z istniejącym wzorcem (`SUPABASE_URL=###`).

**Umowa**: Dodaj linię `SENTRY_DSN=###`.

#### 3. Zmienne środowiskowe Vercela

**Plik**: n/a (konfiguracja w Vercelu, nie w repo)

**Cel**: Ta sama wartość DSN musi być dostępna w Production, Preview i Development na Vercelu — repo jest już podlinkowane (`vercel` CLI dostępne, `.vercel/` istnieje).

**Umowa**: `vercel env add SENTRY_DSN production`, `vercel env add SENTRY_DSN preview`, `vercel env add SENTRY_DSN development` (ta sama wartość DSN we wszystkich trzech — to sam projekt Sentry; rozróżnienie dev/preview/prod załatwia tag `environment`, nie osobne DSN-y). `VERCEL_ENV` nie wymaga żadnej akcji — Vercel dostarcza go automatycznie w runtime.

### Kryteria sukcesu:

#### Automatyczne

- [ ] `.env.example` zawiera linię `SENTRY_DSN=###`

#### Ręczne

- [ ] `vercel env ls` pokazuje `SENTRY_DSN` ustawiony dla Production, Preview i Development

---

## Faza 3: Podłączenie do istniejących miejsc obsługi błędów

### Przegląd

Siedem bloków `catch` w trzech plikach API dziś tylko loguje do konsoli. Dopisujemy wysyłkę do Sentry, żeby te same, już wykryte błędy były widoczne w dashboardzie, nie tylko w logach Vercela.

### Wymagane zmiany:

#### 1. `src/pages/api/yarns.ts`

**Plik**: `src/pages/api/yarns.ts`

**Cel**: Wysłać do Sentry błąd z tworzenia włóczki (linia 58, `console.error`) i błąd z dołączania zdjęcia (linia 67, `console.warn`).

**Umowa**: `import * as Sentry from "@sentry/astro";` na górze pliku; `Sentry.captureException(error);` jako pierwsza linia w obu blokach `catch`, przed istniejącym `console.error`/`console.warn`.

#### 2. `src/pages/api/yarns/[id].ts`

**Plik**: `src/pages/api/yarns/[id].ts`

**Cel**: Wysłać do Sentry cztery błędy: aktualizacja włóczki (linia 65), dołączenie zdjęcia (linia 74), usunięcie zdjęcia (linia 82), usunięcie włóczki (linia 110).

**Umowa**: Ten sam import i wzorzec co wyżej, zastosowany do wszystkich czterech bloków `catch`.

#### 3. `src/pages/api/yarns/[id]/substitutes.ts`

**Plik**: `src/pages/api/yarns/[id]/substitutes.ts`

**Cel**: Wysłać do Sentry błąd z zapisu decyzji o zamienniku (linia 53).

**Umowa**: Ten sam import i wzorzec.

### Kryteria sukcesu:

#### Automatyczne

- [ ] `npm run typecheck` przechodzi
- [ ] `npm run lint` przechodzi

#### Ręczne

- [ ] Przegląd kodu: wszystkie 7 bloków `catch` w tych 3 plikach wywołuje `Sentry.captureException(error)`

---

## Faza 4: Weryfikacja end-to-end

### Przegląd

Potwierdzamy, że cała ścieżka (kod → Sentry → dashboard) faktycznie działa, zanim uznamy zadanie za zrobione — zarówno lokalnie, jak i na Vercel Preview.

### Wymagane zmiany:

#### 1. Tymczasowy endpoint testowy

**Plik**: `src/pages/api/debug/sentry-test.ts` (nowy, tymczasowy — do usunięcia na końcu tej fazy)

**Cel**: Dostarczyć celowy, kontrolowany błąd do przetestowania całej ścieżki.

**Umowa**: `export const prerender = false;` + `export const GET: APIRoute = async () => { throw new Error("Sentry test error — safe to ignore"); };`

### Kryteria sukcesu:

#### Automatyczne

- [ ] `npm run typecheck` i `npm run lint` przechodzą z nowym plikiem testowym

#### Ręczne

- [ ] `npm run dev`, odwiedź `/api/debug/sentry-test` → błąd pojawia się w Sentry (Issues) otagowany `environment: development`, bez adresu e-mail/ID użytkownika w payloadzie
- [ ] Wypchnij na branch `develop` (Vercel Preview), odwiedź `/api/debug/sentry-test` na URL-u preview → drugi wpis w Sentry otagowany `environment: preview`
- [ ] Usuń `src/pages/api/debug/sentry-test.ts` przed połączeniem z `main`

---

## Strategia testowania

Zgodnie z zasadą "koszt × sygnał" z `test-plan.md`: to zadanie to konfiguracja SDK i okablowanie, nie logika biznesowa — pisanie testów jednostkowych dla wywołań `Sentry.captureException` dałoby niski sygnał (testowałoby, że SDK wywołuje własne API, nie że aplikacja działa poprawnie). Zamiast tego:

### Kroki testowania ręcznego:

1. Po Fazie 1: `npm run dev` bez nowych błędów w konsoli.
2. Po Fazie 2: `vercel env ls` potwierdza `SENTRY_DSN` w 3 środowiskach.
3. Po Fazie 3: przegląd kodu — 7 bloków `catch` wywołuje `captureException`.
4. Po Fazie 4: dwa realne zdarzenia w dashboardzie Sentry (dev + preview), poprawnie otagowane, bez danych osobowych; plik testowy usunięty.

## Uwagi dotyczące wydajności

Brak — `tracesSampleRate: 0` oznacza, że Sentry nie dodaje żadnego narzutu na śledzenie wydajności w tej implementacji.

## Uwagi dotyczące migracji

Brak — to czysto addytywna zmiana, nowa integracja bez modyfikacji istniejących modeli danych ani zachowania widocznego dla użytkownika (komunikaty błędów w UI zostają identyczne; Sentry to dodatkowy, niewidoczny dla użytkownika odbiorca tych samych błędów).

## Referencje

- `context/deployment/deploy-plan.md` — platforma (Vercel), wzorzec zarządzania sekretami
- `context/foundation/test-plan.md:48` — zidentyfikowana luka w obserwowalności
- `astro.config.mjs:17-22` — istniejący wzorzec `env.schema`
- `src/lib/config-status.ts` — wzorzec graceful degradation dla brakującej konfiguracji

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Instalacja i podstawowa konfiguracja Sentry

#### Automatyczne

- [x] 1.1 npm run typecheck przechodzi — a788442
- [x] 1.2 npm run lint przechodzi — a788442
- [x] 1.3 npm run build kończy się sukcesem — a788442

#### Ręczne

- [x] 1.4 npm run dev startuje bez nowych błędów/ostrzeżeń związanych z Sentry — a788442

### Faza 2: Sekrety i środowiska

#### Automatyczne

- [x] 2.1 .env.example zawiera linię SENTRY_DSN=###

#### Ręczne

- [x] 2.2 vercel env ls pokazuje SENTRY_DSN dla Production, Preview i Development

### Faza 3: Podłączenie do istniejących miejsc obsługi błędów

#### Automatyczne

- [ ] 3.1 npm run typecheck przechodzi
- [ ] 3.2 npm run lint przechodzi

#### Ręczne

- [ ] 3.3 Przegląd kodu: wszystkie 7 bloków catch wywołuje Sentry.captureException(error)

### Faza 4: Weryfikacja end-to-end

#### Automatyczne

- [ ] 4.1 npm run typecheck i npm run lint przechodzą z nowym plikiem testowym

#### Ręczne

- [ ] 4.2 Błąd lokalny widoczny w Sentry z environment: development, bez danych osobowych
- [ ] 4.3 Błąd z Vercel Preview widoczny w Sentry z environment: preview
- [ ] 4.4 Plik src/pages/api/debug/sentry-test.ts usunięty przed połączeniem z main
