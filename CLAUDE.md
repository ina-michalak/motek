# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication preferences

- Odpowiadaj zawsze w języku polskim.
- Kiedy użytkownik prosi o wytłumaczenie czegoś, unikaj technicznego, skomplikowanego języka — tłumacz tak, jakbyś tłumaczył osobie, która nie jest programistą.

## Hard rules

- Never write to `context/archive/` — archived changes are immutable. If a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead." (full rule detailed at the bottom of this file, in the 10x-cli toolkit block)

## Commands

- `npm run dev` — start dev server
- `npm run dev:test` — start dev server in `test` mode (loads `.env.test`, used by e2e tests)
- `npm run build` — production build (SSR via `@astrojs/vercel`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)
- `npm run typecheck` — `astro check`
- `npm run test` — unit + integration tests (Vitest)
- `npm run test:e2e` — e2e tests (Playwright)

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Architecture

**Astro 6 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Vercel.

### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY`, optional `SENTRY_DSN` (copy `.env.example` to `.env`; gitignored)
- Local Supabase: `npx supabase start` (requires Docker)
- Deploy: push to `main` (production) or any other branch (preview) — the Vercel GitHub integration deploys automatically. Manual deploy: `npx vercel --prod`.

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint + build on every push and PR to main. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for the build step.

<!-- BEGIN @przeprogramowani/10x-cli -->

---

name: 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)
description: End-to-end testing with AI
license: CC BY-NC-ND 4.0
metadata:
tags: AI, E2E, testing, Playwright
version: 1.0.0
module: 3
lesson: 4

---

## 10xDevs AI Toolkit - Moduł 3, Lekcja 4 (Testy E2E)

**Do testów E2E użyj umiejętności `/10x-e2e`.** Jest to jedyne źródło prawdy
dla przepływu pracy — ryzyko → test początkowy + zasady → generowanie → przegląd pod kątem pięciu
antywzorców → ponowne zapytanie → weryfikacja. `references/` umiejętności zawierają pełne
zasady, antywzorce, wzorzec początkowy i szablon promptu.

Kilka twardych zasad, które obowiązują jeszcze przed wywołaniem umiejętności:

- **Lokalizatory:** Najpierw `getByRole` / `getByLabel` / `getByText`; `getByTestId`
  tylko wtedy, gdy atrybuty dostępności są niejednoznaczne. Nigdy selektory CSS, XPath
  ani struktura DOM.
- **Nigdy `page.waitForTimeout()`.** Czekaj na stan: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Niezależność testów + czyszczenie.** Każdy test działa samodzielnie — własna konfiguracja,
  akcja, asercja i czyszczenie; unikalne identyfikatory (sufiks znacznika czasu), aby równoległe uruchomienia
  i ponowne uruchomienia nie kolidowały.

Dwie granice, które należy rozróżnić:

- **DOM (migawka) jest domyślny.** Wizja (`--caps=vision`) jest uzupełnieniem dla
  ryzyk wizualnych (układ, z-index, animacja); dla regresji pikseli preferuj
  narzędzia deterministyczne (`toMatchSnapshot`, Argos, Lost Pixel). Wybór/koszt modelu VLM
  to temat debugowania (Lekcja 5), a nie testowania.
- **Healer pomaga w selektorach, szkodzi w logice.** Zmieniony selektor → healer
  odnajduje go ponownie (trasa przez przegląd PR). Zmienione zachowanie biznesowe → healer
  maskuje błąd; ten przypadek nieudanego testu do naprawy to Lekcja 5.

<!-- END @przeprogramowani/10x-cli -->
