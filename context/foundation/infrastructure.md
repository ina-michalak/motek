---
project: motek
researched_at: 2026-08-18
recommended_platform: Vercel
runner_up: Cloudflare Workers
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 (SSR) + React 19 islands
  runtime: Node.js (Vercel serverless functions via @astrojs/vercel)
---

## Recommendation

**Deploy on Vercel.**

Vercel scored 4 Pass / 1 Partial on the agent-friendly criteria (only the MCP integration is in public beta), has a CLI-first deploy/rollback/log-tail loop, and its docs are agent-readable via `llms.txt` and `.md`-suffixed pages. The anti-bias cross-check confirmed the code's already-configured Cloudflare adapter was the stronger *default* pick on cost and zero-migration-effort grounds, but after reviewing the Cloudflare-specific risks (10ms CPU cap on the free tier colliding with the AI substitute-suggestion logic, and a documented dev/prod parity gap around `astro:env` in prerendered routes) the developer chose to swap to Vercel, accepting the adapter-migration cost and the Hobby-tier "non-commercial use" ToS caveat in exchange for a more conventional Node.js runtime and mature tooling.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | 5 Pass |
| **Vercel** | Pass | Pass | Pass | Pass | Partial (public beta) | 4 Pass / 1 Partial |
| Railway | Partial (no rollback subcommand) | Pass | Pass | Pass | Pass | 4 Pass / 1 Partial |
| Netlify | Partial (rollback is dashboard-only) | Pass | Partial (unconfirmed markdown source) | Pass | Pass | 3 Pass / 2 Partial |
| Render | Partial (CLI secondary to dashboard/API) | Pass | Partial (closed-source docs) | Pass | Pass | 3 Pass / 2 Partial |
| Fly.io | Partial (rollback is a manual workaround) | Partial (container/Docker, not fully abstracted) | Pass | Pass | Partial (early-stage MCP) | 2 Pass / 3 Partial |

Notes:
- **Cloudflare Workers** — the repo already ships `@astrojs/cloudflare` configured in `astro.config.mjs`, so this was the zero-migration default. Free tier covers ~3M requests/month, well beyond this project's low-QPS single-region scale. Swapped away from after the cross-check surfaced the CPU-limit and prerendering-env risks below.
- **Vercel** — requires swapping the adapter (`@astrojs/cloudflare` → `@astrojs/vercel`), but the codebase already uses the framework-level `astro:env/server` import (not Cloudflare's `context.locals.runtime.env` directly), which meaningfully lowers the migration risk versus a codebase that accessed platform bindings directly.
- **Railway / Render / Fly.io** — all score reasonably on the technical criteria but carry a real monthly cost floor ($5–15, $7 flat, and $2–10 respectively) even at this app's low traffic, which conflicts with the interview's cost-minimization priority. None offer a Poland region (closest: Frankfurt or Amsterdam).
- **Netlify** — free credit tier likely covers this volume, but rollback has no dedicated CLI subcommand (dashboard-only), a real gap for unattended agent operation.

### Shortlisted Platforms

#### 1. Vercel (Recommended)

Wins on tooling maturity and a Node.js-based serverless model that will feel familiar without prior platform-specific quirks. The adapter swap is a one-time, well-documented cost; the free Hobby tier is sufficient for this project's traffic, with the caveat that its ToS technically restricts Hobby to non-commercial use — worth revisiting if Motek is ever monetized.

#### 2. Cloudflare Workers

The zero-effort default (already wired in code) and the strongest score on paper (5/5 Pass), with the most generous free tier. Set aside after the cross-check flagged two stack-specific risks: the AI substitute-suggestion logic could brush against the 10ms/request CPU cap on the free plan if it runs inside the same Worker, and there's a documented gap between the Astro dev server and the real `workerd` runtime that can hide bugs (env access, dynamic-route prerendering) until first production deploy.

#### 3. Netlify

A reasonable middle ground if Vercel's ToS caveat becomes a blocker: free-tier credits likely cover this app's volume, official MCP server is available, and the Astro adapter has confirmed day-one support for Astro 6. Scored lower mainly because rollback is not scriptable via CLI — an agent doing unattended recovery would be blocked and need a human at the dashboard.

## Anti-Bias Cross-Check: Vercel

### Devil's Advocate — Weaknesses

1. **Hobby tier ToS restricts to non-commercial/personal use.** If Motek is ever monetized (even informally, e.g. tip-based support), this technically violates the free tier's terms; Vercel can suspend the project without warning. The developer should decide now whether to budget for Pro ($20/mo) rather than discover this reactively.
2. **`@astrojs/vercel` v10 dropped subpath exports** (`@astrojs/vercel/serverless` → import from the package root). Older tutorials and community answers referencing the old import path will not work and can cause confusion mid-migration.
3. **Different env-var delivery model.** Vercel auto-injects into `process.env` rather than Cloudflare's binding pattern. The codebase's use of `astro:env/server` abstracts most of this away, but any code that assumes Cloudflare-specific behavior (none found in `src/lib/supabase.ts` or `src/lib/config-status.ts` at the time of this research) would need re-verification after the swap.
4. **Default function region is `iad1` (US East).** For Polish users this is worse latency than Cloudflare's edge-everywhere model unless manually changed to `fra1`; Hobby tier has no multi-region option.
5. **4.5MB request/response body cap on Hobby.** Not a problem for CRUD text data today, but yarn-entry photo uploads (FR-002) could hit this limit later if uploads are proxied through a Vercel function rather than sent directly to Supabase Storage.

### Pre-Mortem — How This Could Fail

Six months after deploying Motek on Vercel, the decision turns out to be a slow-burn disaster. The developer deployed on the free Hobby tier assuming "free" meant "free regardless of use." Motek picked up a small circle of users supporting the project with tips — technically commercial use under Vercel's ToS — and nobody revisited that until a routine enforcement email threatened suspension mid-project, forcing a rushed upgrade to Pro. Separately, the adapter migration from Cloudflare was done quickly to hit a launch date; one server-only code path assumed the wrong env-access pattern and silently returned `undefined` only in production, breaking the substitute-suggestion feature for a week — invisible locally because the Astro dev server never exercised the real Vercel runtime. Nobody changed the default `iad1` region to Frankfurt either, so every Polish user paid an unnecessary ~100ms round trip on every request, quietly undermining the PRD's sub-1-second guardrail until a user complained about the app feeling slow.

### Unknown Unknowns

- The Hobby-tier "non-commercial use only" clause is not prominently surfaced during onboarding — many solo developers discover it only when Vercel enforces it, often right as a project starts gaining traction. Worth deciding now, not later.
- Vercel's native Postgres/KV storage products were deprecated in favor of a third-party marketplace (Neon/Upstash) with separate billing — irrelevant here since Supabase is external, but a trap for anyone following older Vercel-native-storage tutorials.
- Function region is a project-level, build-time setting, not something changeable per-deploy — a one-time decision with real latency consequences if skipped, unlike Cloudflare's inherently distributed model.
- WebSocket support exists only via Fluid Compute in public beta — irrelevant today (real-time is an explicit PRD non-goal) but relevant if that scope ever changes.
- `vercel rollback` on Hobby only reverts to the *immediately preceding* production deployment — recovering from a regression two deploys back requires manually redeploying an older git commit, not a single rollback command.

## Operational Story

- **Preview deploys**: every git push to a non-production branch gets an automatic preview URL via Vercel's GitHub integration; no extra configuration needed. Preview URLs are unauthenticated by default on Hobby (no built-in access protection tier) — avoid pushing real user data to preview environments.
- **Secrets**: `SUPABASE_URL` / `SUPABASE_KEY` are set as Environment Variables in the Vercel dashboard (or via `vercel env add`), scoped per environment (Production/Preview/Development), and auto-injected into `process.env` at runtime — consumed through `astro:env/server` in `src/lib/supabase.ts`. Only project members with dashboard/CLI access can read them.
- **Rollback**: `vercel rollback` reverts to the immediately preceding production deployment (Hobby-tier limit — no arbitrary N-versions-back rollback without redeploying an older commit manually). Rollback reverts code only; Supabase schema migrations are not rolled back automatically and must be reasoned about separately.
- **Approval**: routine deploys (`vercel deploy` on preview branches) can run unattended. Promoting to production (`vercel --prod` or merging to the production branch) and any change to environment variables/secrets should have a human in the loop, consistent with this project's solo-dev, low-blast-radius setup.
- **Logs**: `vercel logs --environment production` tails runtime logs; `vercel inspect <deployment-url> --logs` pulls logs for a specific deployment — both are read-only CLI operations an agent can run without dashboard access.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Hobby-tier ToS ("non-commercial use") triggers enforcement if Motek is ever monetized | Devil's advocate | M | M | Decide monetization intent now; if any paid/donation feature is added, upgrade to Pro proactively rather than reactively |
| Adapter migration (`@astrojs/cloudflare` → `@astrojs/vercel`) introduces a missed env-access assumption that only breaks in production | Pre-mortem | L | M | After swapping the adapter, do one full `vercel deploy` (preview) smoke test of both the auth flow and the substitute-suggestion feature before promoting to production — don't rely on `npm run dev` alone |
| Default `iad1` region adds latency for Polish users, undermining the PRD's <1s guardrail | Devil's advocate / Research finding | H | L | Set the function region to `fra1` in Vercel project settings before first production deploy |
| Photo uploads for yarn entries (FR-002) later exceed the 4.5MB Hobby body cap | Devil's advocate | L | M | Upload yarn photos directly to Supabase Storage from the client (signed URL) rather than proxying through a Vercel function |
| `vercel rollback` only reverts one step; a two-deploy-old regression needs manual redeploy | Unknown unknowns | L | L | Note the last known-good git commit hash before each production promotion so manual redeploy is fast if needed |
| Vercel MCP integration is in public beta — behavior may change | Research finding | L | L | Treat MCP as a convenience layer only; keep `vercel` CLI as the primary, stable operational path |

## Getting Started

1. Install the Vercel adapter: `npm install @astrojs/vercel@^10.0.8`
2. In `astro.config.mjs`, replace the Cloudflare adapter with Vercel's (root import, not the old `@astrojs/vercel/serverless` subpath — removed in v10):
   ```js
   import vercel from "@astrojs/vercel";
   // ...
   adapter: vercel(),
   ```
   and remove the now-unused `@astrojs/cloudflare` import and dependency.
3. Set the function region to Frankfurt for lower latency to Polish users: in the Vercel project's dashboard settings (or `vercel.json`), set `"regions": ["fra1"]`.
4. Add `SUPABASE_URL` and `SUPABASE_KEY` as Environment Variables in the Vercel dashboard (Production + Preview) — no code changes needed since the project already reads them through `astro:env/server`.
5. Install the Vercel CLI and link the project: `npm i -g vercel`, then `vercel link`, then `vercel deploy` for a preview smoke test before `vercel --prod`.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
