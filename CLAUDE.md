# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication preferences

- Odpowiadaj zawsze w języku polskim.
- Kiedy użytkownik prosi o wytłumaczenie czegoś, unikaj technicznego, skomplikowanego języka — tłumacz tak, jakbyś tłumaczył osobie, która nie jest programistą.

## Hard rules

- Never write to `context/archive/` — archived changes are immutable. If a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead." (full rule detailed at the bottom of this file, in the 10x-cli toolkit block)

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

No test runner is configured yet (no test script in `package.json`).

## Architecture

**Astro 6 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

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
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint + build on every push and PR to main. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for the build step.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Moduł 2, Lekcja 4

Przygotuj się na trudniejszy strumień implementacji z **łańcuchem planowania opartym na badaniach**:

```
badania wewnętrzne (/10x-research) + badania zewnętrzne (exa.ai, Context7) -> /10x-plan -> /10x-implement -> sukces
```

Lekcja koncentruje się na rozróżnianiu badań wewnętrznych od zewnętrznych oraz wykorzystywaniu dowodów do wspierania decyzji planistycznych.

### Router zadań - Od czego zacząć

| Umiejętność | Kiedy jej używać |
| --- | --- |
| **Badania wewnętrzne (fokus lekcji)** | |
| `/10x-research <change-id>` | Potrzebujesz dowodów z istniejącej bazy kodu — wzorców, konwencji, punktów integracji lub istniejących implementacji. Uruchamia równoległe sub-agenty w repozytorium i zapisuje ustrukturyzowane wyniki do `research.md`. |
| **Badania zewnętrzne (fokus lekcji)** | |
| exa.ai | Potrzebujesz natywnego dla AI wyszukiwania w sieci w celu porównania bibliotek, najlepszych praktyk lub kontekstu ekosystemu, na które baza kodu nie może odpowiedzieć. |
| Context7 (`resolve-library-id` → `get-library-docs`) | Potrzebujesz aktualnej dokumentacji dla konkretnej biblioteki lub frameworka. Najpierw rozwiązuje ID biblioteki, a następnie pobiera odpowiednie strony dokumentacji. |
| **Kadrowanie koła zapasowego** | |
| `/10x-frame <change-id>` | Plan nie zbiega się, plan nie przynosi oczekiwanych rezultatów, lub uporczywe odchylenia ciągle psują implementację. Użyj jako wyjścia awaryjnego dla oddzielnego problemu (zademonstrowane na przykładzie Space Explorers), a nie jako rytuału przed badaniami. |
| **Planowanie i wykonanie** | |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Użyj tego samego łańcucha planowania i wykonania z Lekcji 2, teraz z dowodami z badań wstępnych zasilającymi plan. |

### Dyscyplina badawcza

- Badania wewnętrzne (`/10x-research`) odpowiadają na pytanie "co już robi nasza baza kodu?" — wzorce, schematy, konwencje, punkty integracji.
- Badania zewnętrzne (exa.ai, Context7) odpowiadają na pytanie "co powinniśmy zrobić?" — możliwości bibliotek, dokumentacja API, najlepsze praktyki ek

<!-- END @przeprogramowani/10x-cli -->
