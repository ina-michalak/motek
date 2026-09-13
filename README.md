# Motek

Motek to aplikacja webowa dla robiących na drutach i szydełku, którzy mają średni-duży zapas włóczki (30+ motków) i nie mają wygodnego sposobu na jego przeszukiwanie. Motek to osobista, prywatna biblioteka włóczki: dodajesz to, co masz w zapasie (nazwa, producent, ilość, kolor, skład, dobrane druty/szydełko, ocena, zdjęcie), przeglądasz i filtrujesz swoją kolekcję, a przy każdej włóczce dostajesz sugestie zamienników wyliczone na podstawie parametrów technicznych innych włóczek z Twojej własnej biblioteki — nigdy z zewnętrznej bazy czy od innych użytkowników.

Pełna specyfikacja produktowa: [context/foundation/prd.md](context/foundation/prd.md).

## Stos technologiczny

- [Astro](https://astro.build/) v6 — pełne SSR (`output: "server"`)
- [React](https://react.dev/) v19 — interaktywne komponenty (wyspy)
- [TypeScript](https://www.typescriptlang.org/) v5
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Supabase](https://supabase.com/) — uwierzytelnianie, baza (Postgres + RLS) i storage na zdjęcia włóczki
- [Vercel](https://vercel.com/) — adapter `@astrojs/vercel`, hosting/wdrożenie
- [Sentry](https://sentry.io/) — monitoring błędów (klient + serwer)
- [shadcn/ui](https://ui.shadcn.com/) (styl "new-york") — komponenty UI w `src/components/ui/`

## Wymagania

- Node.js v22.14.0 (patrz `.nvmrc`)
- npm
- [Docker](https://www.docker.com/) — tylko jeśli używasz lokalnego Supabase (~7 GB RAM)

## Szybki start

1. Sklonuj repozytorium i zainstaluj zależności:

```bash
npm install
```

2. Skonfiguruj Supabase — patrz sekcja [Konfiguracja Supabase](#konfiguracja-supabase) poniżej.

3. Utwórz plik `.env` na podstawie `.env.example` i wypełnij zmienne (`SUPABASE_URL`, `SUPABASE_KEY`, opcjonalnie `SENTRY_DSN`):

```bash
cp .env.example .env
```

4. Uruchom serwer dev:

```bash
npm run dev
```

## Skrypty npm

| Skrypt              | Opis                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `npm run dev`       | Serwer dev (`.env`)                                                |
| `npm run dev:test`  | Serwer dev w trybie `test` (`.env.test`) — używany przez testy e2e |
| `npm run build`     | Build produkcyjny                                                  |
| `npm run preview`   | Podgląd builda produkcyjnego                                       |
| `npm run lint`      | ESLint (reguły z type-checkingiem)                                 |
| `npm run lint:fix`  | ESLint z automatycznymi poprawkami                                 |
| `npm run format`    | Prettier (`prettier-plugin-astro`, `prettier-plugin-tailwindcss`)  |
| `npm run typecheck` | `astro check`                                                      |
| `npm run test`      | Testy jednostkowe i integracyjne (Vitest)                          |
| `npm run test:e2e`  | Testy e2e (Playwright)                                             |

Pre-commit hooki (husky + lint-staged) uruchamiają `eslint --fix` na `*.{ts,tsx,astro}` i `prettier --write` na `*.{json,css,md}`.

## Konfiguracja Supabase

Zmienne środowiskowe są deklarowane przez schemat `astro:env` (`astro.config.mjs`) i traktowane jako **sekrety tylko serwerowe** — nigdy nie trafiają do klienta.

### Lokalnie (bez zdalnego projektu)

Wymaga Dockera.

1. `cp .env.example .env`
2. `npx supabase init` (tworzy folder `supabase/` — w tym repo już istnieje wraz z migracjami)
3. `npx supabase start` (przy pierwszym uruchomieniu ściągnie obrazy Dockera i zaaplikuje migracje z `supabase/migrations/`)
4. Skopiuj dane wypisane przez CLI do `.env`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key z wyjścia CLI>
```

5. Zatrzymanie stosu: `npx supabase stop`

Lokalny Studio UI jest dostępny na `http://localhost:54323`.

### Ze zdalnym projektem Supabase

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key z dashboardu Supabase → Settings → API>
```

### Potwierdzanie e-maila lokalnie

Domyślnie Supabase wymaga potwierdzenia e-maila przed logowaniem. W lokalnym dev można to wyłączyć: Supabase Studio → **Authentication → Email → Confirm email** → off.

## Funkcjonalności (MVP)

- **Konto i dostęp** — rejestracja/logowanie e-mail + hasło (Supabase Auth); `src/middleware.ts` chroni `/dashboard` i `/yarns` i przypisuje zalogowanego użytkownika do `context.locals.user`.
- **Biblioteka włóczek** — dodawanie, przegląd, filtrowanie i sortowanie, edycja (w tym ustawienie ilości na 0 przy wyczerpaniu) oraz usuwanie własnych włóczek, ze zdjęciem opcjonalnie zapisywanym w Supabase Storage. Każda operacja działa wyłącznie na włóczkach należących do zalogowanego użytkownika — wymuszone jednocześnie przez RLS w Postgresie i filtrowanie po `user_id` w warstwie serwisów.
- **Sugestie zamienników** — lokalny algorytm dopasowania (skład włókien, rozmiar drutów/szydełka, kolor) liczony wyłącznie na bazie własnej biblioteki użytkownika, bez wywołań do zewnętrznego dostawcy AI. Sugestię można trwale zaakceptować lub odrzucić.

### Trasy auth

| Trasa                 | Opis                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `/auth/signin`        | Formularz logowania e-mail/hasło                                                             |
| `/auth/signup`        | Formularz rejestracji                                                                        |
| `/auth/confirm-email` | Strona "sprawdź skrzynkę" po rejestracji                                                     |
| `/dashboard`          | Lista włóczek zalogowanego użytkownika (przekierowuje do `/auth/signin` dla niezalogowanych) |
| `/yarns/new`          | Formularz dodania nowej włóczki                                                              |
| `/yarns/[id]`         | Szczegóły włóczki, edycja, usuwanie, sugestie zamienników                                    |

## Testy

Strategia testów i mapa ryzyk: [context/foundation/test-plan.md](context/foundation/test-plan.md).

- **Jednostkowe/integracyjne (Vitest)** — `npm run test`. Testy integracyjne (`*.integration.test.ts`) uderzają w prawdziwego, uwierzytelnionego klienta Supabase (RLS aktywne) i wymagają uruchomionego lokalnego stosu: `npx supabase start`.
- **E2e (Playwright)** — `npm run test:e2e`. Wymaga serwera dev w trybie testowym (`npm run dev:test`, ładuje `.env.test`) i zapisanej sesji w `playwright/.auth/user.json`. Szczegóły konwencji i konfiguracji konta testowego: [tests/e2e/CLAUDE.md](tests/e2e/CLAUDE.md).

## Wdrożenie

Aplikacja jest wdrażana na [Vercel](https://vercel.com/) (adapter `@astrojs/vercel`, region `fra1` — patrz `vercel.json`). Repozytorium GitHub jest podłączone do projektu Vercel: push na `main` trafia na produkcję, inne branche jako preview. Zmienne środowiskowe (`SUPABASE_URL`, `SUPABASE_KEY`, `SENTRY_DSN`) są skonfigurowane w dashboardzie Vercela osobno dla Production/Preview/Development.

Deploy manualny (rzadko potrzebny — zwykle robi to integracja Vercel + GitHub):

```bash
npm run build
npx vercel --prod
```

## CI

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) uruchamia lint + build na każdy push/PR do `main`. Wymaga sekretów repo `SUPABASE_URL` i `SUPABASE_KEY` dla kroku builda.

### Automatyczny code review AI

Każdy PR otwarty, ponownie otwarty lub oznaczony etykietą `ai-cr:review` do `main` dostaje automatyczną recenzję z `packages/code-reviewer/` — samodzielnego agenta oceniającego diff wg 7 kryteriów, który dodaje komentarz oraz etykietę `ai-cr:passed`/`ai-cr:failed`.

- **Powtórzenie**: dodaj etykietę `ai-cr:review` do PR, żeby ponownie uruchomić recenzję — usuwa poprzedni komentarz/etykietę i dodaje nowe.
- **Uruchomienie lokalne**: z korzenia repo `npm run review --prefix packages/code-reviewer` (jedna recenzja) lub `npm run eval --prefix packages/code-reviewer` (porównanie modeli/promptów przez promptfoo). Obie komendy wymagają `OPENROUTER_API_KEY` — skopiuj `packages/code-reviewer/.env.example` do `packages/code-reviewer/.env` i wypełnij.
- Workflow wymaga `OPENROUTER_API_KEY` (opcjonalnie `OPENROUTER_MODEL`) jako sekretów/zmiennych repo w GitHub.

## Dokumentacja projektu

Pisemna podstawa projektu (wizja, person, wymagania funkcjonalne, roadmapa, wybór stosu, plan testów) żyje w `context/foundation/`:

- [`prd.md`](context/foundation/prd.md) — pełna specyfikacja produktowa
- [`roadmap.md`](context/foundation/roadmap.md) — sekwencja kamieni milowych
- [`tech-stack.md`](context/foundation/tech-stack.md) — wybór stosu i uzasadnienie
- [`test-plan.md`](context/foundation/test-plan.md) — mapa ryzyk i fazowe wdrożenie testów
- [`infrastructure.md`](context/foundation/infrastructure.md) — wybór platformy wdrożeniowej

## Licencja

MIT
