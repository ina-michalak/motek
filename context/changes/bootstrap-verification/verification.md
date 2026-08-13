---
bootstrapped_at: 2026-08-13T11:18:57Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: motek
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: motek
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

**Why this stack**: Solo developer shipping Motek, a yarn-stash catalog with AI-generated substitute suggestions, in 3 after-hours weeks. The recommended default for `(web, js)` is 10x Astro Starter — Astro + React + TypeScript + Supabase (Postgres, auth, storage) + Cloudflare — which clears all four agent-friendly gates and covers the PRD's forcing features out of the box: email+password auth (FR-001) via Supabase Auth, per-user data isolation via Supabase RLS (guardrail in Success Criteria), photo storage for yarn entries (FR-002), and a server-side surface for the substitute-suggestion logic (FR-007–FR-009). Payments, realtime, and background jobs are out of scope per PRD non-goals, so those flags stay false. Deployment targets Vercel instead of the starter's Cloudflare default per explicit choice; CI runs on GitHub Actions with auto-deploy-on-merge, matching the solo/short-timeline profile.

## Pre-scaffold verification

| Signal      | Value                                                    | Severity | Notes                       |
| ----------- | --------------------------------------------------------- | -------- | ---------------------------- |
| npm package | not run                                                   | n/a      | `cmd_template` starts with `git clone`; no npm CLI package to check |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-05-17 | fresh    | from card `docs_url`, within 3 months of run date |

Recency: przeprogramowani/10x-astro-starter last pushed 2026-05-17 (fresh). Proceeding.

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 18 top-level entries (`.env.example`, `.github`, `.gitignore`, `.husky`, `.nvmrc`, `.prettierrc.json`, `.vscode`, `README.md`, `astro.config.mjs`, `components.json`, `eslint.config.js`, `node_modules`, `package-lock.json`, `package.json`, `public`, `src`, `supabase`, `tsconfig.json`, `wrangler.jsonc`)
**Conflicts (.scaffold siblings)**: CLAUDE.md.scaffold (cwd already had a project CLAUDE.md; existing wins)
**.gitignore handling**: moved silently (cwd had no pre-existing `.gitignore`)
**.bootstrap-scaffold cleanup**: deleted (including its cloned `.git/`, removed before move-up)

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 1 CRITICAL, 13 HIGH, 7 MODERATE, 2 LOW
**Direct vs transitive**: 0/1/2/0 direct of total 1/13/7/2 (per-package `isDirect` flag; `metadata.dependencies.direct` not emitted by this npm version)

#### CRITICAL findings

- **tar** (transitive, range `<=7.5.20`, fix available) — multiple advisories: PAX header parser confusion / file-smuggling (GHSA-vmf3-w455-68vh), process crash via PAX numeric path type confusion (GHSA-w8wr-v893-vjvp), decompression/parse DoS (GHSA-23hp-3jrh-7fpw), infinite loop via negative entry size (GHSA-8x88-c5mf-7j5w), uncaught exception DoS via NUL byte in path records (GHSA-gvwx-54wh-qm9j), stack-overflow DoS via crafted long-path tar (GHSA-r292-9mhp-454m).

#### HIGH findings

- **astro** (direct, range `<=7.0.9`, fix available) — multiple XSS advisories (unescaped spread props/attribute names, `transition:*` directive values, View Transition animation properties, unescaped slot name) plus a Host-header SSRF in the prerendered error page fetch. Direct dependency — most immediately actionable finding in this run.
- **brace-expansion** (transitive, fix available) — DoS via exponential-time/unbounded expansion.
- **devalue** (transitive, fix available) — DoS via sparse array deserialization.
- **fast-uri** (transitive, fix available) — host confusion via backslash authority delimiter / failed IDN canonicalization.
- **js-yaml** (transitive, fix available) — quadratic-complexity DoS in merge-key/omap handling.
- **miniflare** (transitive, fix available) — inherits sharp/undici/ws advisories.
- **nanoid** (transitive, fix available) — non-secure generator can loop indefinitely with negative/zero size.
- **postcss** (transitive, fix available) — path traversal via `sourceMappingURL` auto-loading, arbitrary `.map` file disclosure.
- **sharp** (transitive, range `<0.35.0`, fix available) — inherited libvips CVEs (CVE-2026-33327/33328/35590/35591).
- **svgo** (transitive, fix available) — `removeScripts` plugin leaves some executable scripts intact.
- **undici** (transitive, fix available) — 12 advisories including TLS validation bypass via SOCKS5 proxy, HTTP header/CRLF injection, cache poisoning/cross-user disclosure, response desync.
- **vite** (transitive, fix available) — `server.fs.deny` bypass on Windows alternate paths; launch-editor NTLMv2 hash disclosure.
- **ws** (transitive, fix available) — uninitialized memory disclosure; memory-exhaustion DoS from tiny fragments.

#### MODERATE findings

7 findings — logged in the raw `npm audit --json` output (not reproduced here; re-run `npm audit` in the project root for the live list).

#### LOW / INFO findings

2 findings — logged in the raw `npm audit --json` output (not reproduced here; re-run `npm audit` in the project root for the live list).

## Hints recorded but not acted on

| Hint                     | Value         |
| ------------------------ | -------------- |
| bootstrapper_confidence  | first-class    |
| quality_override         | false          |
| path_taken               | standard       |
| self_check_answers       | null           |
| team_size                | solo           |
| deployment_target        | vercel         |
| ci_provider               | github-actions |
| ci_default_flow          | auto-deploy-on-merge |
| has_auth                 | true           |
| has_payments             | false          |
| has_realtime             | false          |
| has_ai                   | true           |
| has_background_jobs      | false          |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep — this run created `CLAUDE.md.scaffold` (compare against your existing `CLAUDE.md`).
- Address audit findings per your project's risk tolerance — the `astro` finding is a direct dependency and the most immediately actionable; run `npm audit fix` (review the diff first) or `npm audit` for the live list.
