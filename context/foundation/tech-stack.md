---
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
---

## Why this stack

Solo developer shipping Motek, a yarn-stash catalog with AI-generated substitute
suggestions, in 3 after-hours weeks. The recommended default for `(web, js)` is
10x Astro Starter — Astro + React + TypeScript + Supabase (Postgres, auth,
storage) + Cloudflare — which clears all four agent-friendly gates and covers
the PRD's forcing features out of the box: email+password auth (FR-001) via
Supabase Auth, per-user data isolation via Supabase RLS (guardrail in Success
Criteria), photo storage for yarn entries (FR-002), and a server-side surface
for the substitute-suggestion logic (FR-007–FR-009). Payments, realtime, and
background jobs are out of scope per PRD non-goals, so those flags stay false.
Deployment targets Vercel instead of the starter's Cloudflare default per
explicit choice; CI runs on GitHub Actions with auto-deploy-on-merge, matching
the solo/short-timeline profile.
