---
date: 2026-09-12T10:20:04+00:00
researcher: Claude (Sonnet 5)
git_commit: 784ea03e540a4d57938d0f88d0ad08eae674ed3f
branch: develop
repository: ina-michalak/motek
topic: "CI/CD workflow do AI code review pull requestów (Vercel AI SDK 6 + OpenRouter)"
tags: [research, codebase, ci-cd, github-actions, ai-sdk, openrouter, promptfoo, code-review]
status: complete
last_updated: 2026-09-12
last_updated_by: Claude (Sonnet 5)
---

# Research: CI/CD workflow do AI code review pull requestów

**Date**: 2026-09-12T10:20:04+00:00
**Researcher**: Claude (Sonnet 5)
**Git Commit**: 784ea03e540a4d57938d0f88d0ad08eae674ed3f
**Branch**: develop
**Repository**: ina-michalak/motek

## Pytanie badawcze

Na podstawie `context/changes/ci-cd-code-review/requirements.md`: jak wprowadzić do repo Motek samodzielnego, skryptowego agenta code-review (Vercel AI SDK 6 + `@openrouter/ai-sdk-provider` + zod) uruchamianego jako composite action w GitHub Actions przy każdym PR do `main`, zgodnie z konwencjami tego repo i aktualną (2026) dokumentacją użytych bibliotek?

## Streszczenie

Repo **nie ma żadnego precedensu** osobnego pakietu Node poza `src/` — nowy `packages/code-reviewer/` będzie pierwszym tego typu. Istnieje jednak bezpośredni wzorzec izolacji kodu od głównego tsconfig (`.claude/hooks/**`, jawnie wykluczony w ESLint) oraz spójny wzorzec walidacji zod na granicach systemu, który da się powielić w schemacie wyniku recenzji. Skill `10x-impl-review-ci` już obecny w repo pokazuje dokładnie ten sam podział „mechanika vs kryteria”, który wymaga `requirements.md` (SKILL.md ↔ `review.ts`, `impl-review-instructions.md` ↔ `criteria.ts`).

Kluczowe ustalenie biblioteczne, które **zmienia plan instalacji** względem naiwnego `npm install ai @openrouter/ai-sdk-provider zod`: `npm install ai` bez przypięcia wersji złapie **AI SDK 7** (obecny `latest`), a `@openrouter/ai-sdk-provider@latest` (3.0.0) wymaga `ai@^7`. Dla AI SDK 6 (zgodnie z wymaganiami — `ToolLoopAgent`/`generateText`+`Output.object` w wersji stabilnej od grudnia 2025) trzeba **jawnie przypiąć**: `ai@6.0.282` i `@openrouter/ai-sdk-provider@2.9.1` (oznaczony w README providera jako „(LEGACY) Setup for AI SDK v6”).

Drugie istotne ustalenie: dla czysto jednokrokowego scorera bez narzędzi, oficjalna dokumentacja i sam setup-prompt (Krok 2, `src/review.ts`) **rekomendują `generateText({ output: Output.object(...) })` bezpośrednio**, a nie `ToolLoopAgent` — mniej mechanizmu do świadomego przycinania (domyślny `stopWhen` klasy to teraz `stepCountIs(20)`, nieistotny przy prostym `generateText`).

Trzecie: `z.number().min(1).max(10)` w schemacie dla modeli Anthropic przez natywne API łamie się na `minimum`/`maximum` w JSON Schema (potwierdzony bug, naprawiony w AI SDK dla bezpośredniego providera Anthropic) — ale nie jest jasne, czy ten sam problem występuje przez OpenRouter (inna warstwa tłumaczenia schematu). **Wymaga testu empirycznego w fazie implementacji**; bezpieczne obejście: `z.number()` bez ograniczeń w schemacie + walidacja/clamp zakresu w kodzie po stronie `schema.ts`/`verdict.ts`, z zakresem opisanym tylko w `.describe()` i w prompcie (dokładnie jak w przykładzie z lekcji M5L2).

## Szczegółowe ustalenia

### Struktura pakietu i izolacja od reszty repo

- Brak jakiegokolwiek istniejącego `scripts/`, `tools/` czy osobnego `package.json` w repo poza rootem — `packages/code-reviewer/` będzie pierwszym tego typu ([package.json](../../../package.json)).
- Precedens izolacji kodu od głównego tsconfig: `.claude/hooks/**` jest jawnie wykluczony w [eslint.config.js:79](../../../eslint.config.js#L79) komentarzem _„Full ESLint ignore (not just type-aware linting) — these are Node scripts run by the Claude Code harness, not part of the tsconfig project.”_ — to bezpośredni wzorzec do rozważenia dla `packages/code-reviewer/**`, jeśli ma być całkowicie odseparowany.
- Root `tsconfig.json` ma `"include": ["**/*"]` bez wykluczenia `packages/` ([tsconfig.json:3](../../../tsconfig.json#L3)) — ale `typescript-eslint`'owy `projectService: true` ([eslint.config.js:17-20](../../../eslint.config.js#L17-L20)) automatycznie wykrywa najbliższy `tsconfig.json` dla każdego lintowanego pliku (monorepo-aware), więc **nowy, samodzielny `packages/code-reviewer/tsconfig.json` zadziała bez wpinania go do root configu** — pod warunkiem, że lint/format faktycznie potrafią go znaleźć (patrz sekcja husky niżej).
- `.gitignore` już pokrywa rekurencyjnie `node_modules/` ([.gitignore:8](../../../.gitignore#L8)) i `.env*` ([.gitignore:17-18,28](../../../.gitignore#L17)) na dowolnej głębokości — **nie trzeba dopisywać nic** dla `packages/code-reviewer/node_modules` ani `.env`.
- `husky`/`lint-staged`: glob `"*.{ts,tsx,astro}"` ([package.json:69-72](../../../package.json#L69-L72)) nie ma ograniczenia katalogu, więc automatycznie złapie też pliki w `packages/code-reviewer/`. **Ryzyko**: jeśli ESLint nie znajdzie właściwego tsconfig dla tych plików, `eslint --fix` rzuci błędem i zablokuje commit — trzeba to zweryfikować przy pierwszym commicie (nested tsconfig powinien to rozwiązać automatycznie dzięki `projectService`, ale warto potwierdzić empirycznie).

### Istniejący CI i wzorce sekretów

- Pełna treść [.github/workflows/ci.yml](../../../.github/workflows/ci.yml): trigger `push`/`pull_request` na `main`, `actions/checkout@v4` + `actions/setup-node@v4` (`node-version: 22`, `cache: npm`) + `npm ci` + `npx astro sync` + `npm run lint` + `npm run build` (z `SUPABASE_URL`/`SUPABASE_KEY` przekazanymi **lokalnie do kroku**, nie jako globalny `env:` joba — wzorzec do powielenia dla `OPENROUTER_API_KEY`).
- `cache: npm` w `setup-node@v4` zakłada jeden `package-lock.json` w roocie — osobny `packages/code-reviewer/package-lock.json` będzie wymagał w nowym workflow/composite action albo `working-directory: packages/code-reviewer` przy `npm ci`, albo osobnego `cache-dependency-path`.
- Wzorzec zarządzania sekretami z `context/archive/2026-09-05-sentry-monitoring/plan.md:37`: świadoma decyzja **nie dodawać** do sekretów GHA zmiennej nieużywanej w CI (`SENTRY_DSN` pominięty, bo build przechodzi bez niego) — potwierdza, że `OPENROUTER_API_KEY` powinien trafić do sekretów GHA tylko dlatego, że code-review workflow faktycznie go potrzebuje, zgodnie z tym samym rygorem.
- Wzorzec zod na granicach systemu powtarza się konsekwentnie: `context/archive/2026-08-23-add-and-browse-yarn-library/plan.md:58-105` (`createYarnSchema` + `.refine()`), `context/archive/2026-08-29-ai-substitute-suggestions/plan.md:170-182` (`substituteDecisionSchema`, `safeParse` → 400 przy błędzie) — ten sam wzorzec (`z.object` + `safeParse`) powinien napędzać `packages/code-reviewer/src/schema.ts` przy walidacji structured output z LLM-a.

### Wzorzec separacji mechanika/kryteria — `10x-impl-review-ci`

Skill już obecny w `.claude/skills/10x-impl-review-ci/` pokazuje dokładnie ten podział, którego wymaga `requirements.md`:

- `SKILL.md` (508 linii) = **mechanika**: odkrywanie planu, liczenie diffu, orkiestracja, commit + push, publikowanie komentarzy — zero kryteriów wpisanych na twardo, tylko odwołania typu „Stosuje wymiar 1”.
- `references/impl-review-instructions.md` (208 linii) = **kryteria**: definicje wymiarów, progi, gramatyka wniosków — samodzielny dokument.
- `references/workflow-template.yml` (300 linii) = gotowy szablon `.github/workflows/impl-review.yml` z komentarzami wyjaśniającymi label-gate, fork-guard, `[skip ci]`.

Bezpośrednia analogia dla naszego pakietu: `src/criteria.ts` (dane/kryteria — odpowiednik `impl-review-instructions.md`) vs `src/review.ts` (orkiestracja — odpowiednik `SKILL.md`). Ten istniejący szablon (`workflow-template.yml`) warto też przejrzeć w fazie planowania jako drugie źródło sprawdzonych wzorców GHA (label-gate, fork-guard) obok tych z `requirements.md`.

### Dług dokumentacyjny do NIE powielania

`README.md:169-171` (sekcja „## CI”) mówi o branchu `master`, choć faktyczny `ci.yml` triggeruje na `main` — potwierdzony, znany dług (`context/archive/2026-09-05-sentry-monitoring/plan-brief.md:11` wspomina też nieaktualną wzmiankę o Cloudflare w CLAUDE.md przy realnym stacku Vercel). Nowa dokumentacja workflow code-review w README powinna używać `main` i nie powielać tego błędu.

### Vercel AI SDK 6 + `@openrouter/ai-sdk-provider` — wersje i API

**Wersje do przypięcia (krytyczne — `latest` złapie niewłaściwe major):**

- `ai@6.0.282` (dist-tag `ai-v6`; `latest` na npm to już AI SDK **7**.0.99).
- `@openrouter/ai-sdk-provider@2.9.1` (oznaczony w README jako „(LEGACY) Setup for AI SDK v6”; `latest`=3.0.0 wymaga `ai@^7`).
- `zod@^4` (albo `^3.25`) — provider akceptuje oba.

**Rekomendacja architektoniczna:** dla jednokrokowego scorera bez narzędzi użyć `generateText({ output: Output.object(...) })` bezpośrednio (tak jak w kodzie z `code-review-agent-setup-prompt.md` Krok 2), a nie `ToolLoopAgent` — mniej konfiguracji do pilnowania, bo `ToolLoopAgent`'owy domyślny `stopWhen` to teraz `stepCountIs(20)` (zmiana z `isStepCount(1)` w AI SDK 5), co dla czystego `generateText` jest nieistotne.

```ts
import { generateText, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({ apiKey });
const { output, totalUsage } = await generateText({
  model: openrouter(modelId),
  output: Output.object({ schema: REVIEW_SCHEMA }),
  prompt: buildPrompt({ title, body, diff }),
});
```

- Zwraca pole **`output`** (nie `object` — ta nazwa należy do zdeprecjonowanego `generateObject`).
- Koszt w USD: `openrouter(modelId, { usage: { include: true } })` (opcja przy **tworzeniu modelu**, nie per-request) → `result.providerMetadata.openrouter.usage.cost`.
- Tokeny: `result.totalUsage.{inputTokens,outputTokens,totalTokens}` (w AI SDK 6 `usage` to zużycie tylko ostatniego kroku — `totalUsage` to suma; w v7 to się zmieniło, więc uważać przy ewentualnej migracji).

**Niepewność wymagająca testu empirycznego:** `z.number().min(1).max(10)` na `score` w schemacie — potwierdzony bug (GitHub issue vercel/ai#14342) dla **bezpośredniego** providera `@ai-sdk/anthropic` (native structured output odrzuca `minimum`/`maximum`), naprawiony w PR #14790. Nie potwierdzono, czy ten sam problem występuje przez OpenRouter (inna warstwa routingu/tłumaczenia schematu — może iść przez function-calling zamiast native structured-output beta). **Plan implementacji powinien albo przetestować to na jednym z docelowych modeli przed finalizacją schematu, albo od razu przyjąć bezpieczny wariant z setup-promptu**: `z.number()` bez `.min()/.max()`, zakres 1–10 tylko w `.describe()` i w prompcie (dokładnie tak, jak zaleca `code-review-agent-setup-prompt.md:106` i przykład z M5L2).

### promptfoo — wersja i integracja

- **`promptfoo@0.123.0`**, wymaga **Node ≥22.22.0** (repo ma `.nvmrc` = 22.14.0 — do sprawdzenia w planie, czy runner CI/lokalne środowisko dev spełnia ten wymóg dla samych evali, które i tak nie wchodzą do CI).
- Custom provider musi być **klasą eksportowaną jako default**, implementującą `id()` i `callApi(prompt, context)`:
  ```ts
  export default class ReviewProvider implements ApiProvider {
    id() {
      return "code-review-agent";
    }
    async callApi(prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
      const result = await runReview(context?.vars);
      return { output: result };
    }
  }
  ```
  Rejestracja: `providers: [{ id: "file://./evals/provider.ts", label: "Code Review Agent" }]`.
- `is-json` przyjmuje opcjonalny `value` z JSON Schema (jako YAML, bo JSON jest poprawnym YAML-em).
- `javascript` — **`output` dociera jako surowy string**, trzeba samemu `JSON.parse(output)` przed sprawdzeniem `.verdict`.
- `llm-rubric` — domyślny sędzia wybierany wg dostępnych kluczy API (OpenAI/Anthropic/Google/Mistral) — **wymaga jawnego override'u na OpenRouter**: `provider: { id: "openrouter:...", config: { apiKeyEnvar: "OPENROUTER_API_KEY" } }`, inaczej promptfoo spróbuje użyć klucza OpenAI, którego nie mamy.
- `PROMPTFOO_PASS_RATE_THRESHOLD` domyślnie **100%** (jeden fail = cała ewaluacja czerwona, zgodnie z `requirements.md`); exit code 100 przy przekroczeniu progu, 1 przy innych błędach.
- **Niejednoznaczność do zweryfikowania empirycznie**: skoro `promptfooconfig.yaml` zostaje w YAML (nie `.ts`), a tylko `provider.ts` jest w TypeScript, prawdopodobnie **nie** jest potrzebny `cross-env NODE_OPTIONS="--import tsx"` z setup-promptu — to wymaganie dotyczy configu w całości napisanego w `.ts`. Provider `.ts` ładowany przez `file://...ts` ma wbudowany "TypeScript loader" w promptfoo. Rekomendacja: przetestować najpierw bez `tsx`/`cross-env` w skrypcie `eval`, dodać tylko jeśli faktycznie zawiedzie.

## Odniesienia do kodu

- [package.json](../../../package.json) — brak workspaces, npm jako package manager, `lint-staged` config.
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — jedyny istniejący workflow, wzorzec przekazywania sekretów per-krok.
- [eslint.config.js:14-21,79](../../../eslint.config.js#L14-L21) — `projectService` (auto-discovery tsconfig) i precedens pełnego wykluczenia folderu (`.claude/hooks/**`).
- [tsconfig.json](../../../tsconfig.json) — `include: ["**/*"]`, alias `@/*` → `./src/*` (nie musi być dziedziczony przez nowy pakiet).
- [.gitignore:8,17-18,28](../../../.gitignore#L8) — rekurencyjne wzorce `node_modules/`, `.env*`.
- [README.md:50-57,169-171](../../../README.md#L50-L57) — konwencja formatowania sekcji „Available Scripts” i nieaktualna sekcja „CI” (branch `master`).
- `.claude/skills/10x-impl-review-ci/SKILL.md` i `references/impl-review-instructions.md`, `references/workflow-template.yml` — wzorzec separacji mechanika/kryteria + gotowy szablon GHA z fork-guard/label-gate.

## Architecture Insights

- Ten sam wzorzec „dane/kryteria oceny” vs „przepływ wykonania”, który repo już stosuje w `10x-impl-review-ci`, jest bezpośrednio przenośny na podział plików z `requirements.md` (`criteria.ts`/`schema.ts` = dane, `review.ts` = orkiestracja, `format-comment.ts`/`verdict.ts` = prezentacja/decyzja).
- Repo konsekwentnie trzyma walidację zod na granicach (API endpoints, formularze) z `safeParse` + jawną obsługą błędu — ten sam idiom powinien rządzić walidacją structured output z LLM-a w `schema.ts`.
- `.claude/hooks/**` jest precedensem na to, że kod pomocniczy (nie-aplikacyjny) bywa świadomie **całkowicie** wyłączony z głównego procesu lint/type-check repo — wybór między tym a nested-tsconfig-auto-discovery to jedna z decyzji do podjęcia w planie.

## Historical Context (from prior changes)

- `context/archive/2026-09-05-sentry-monitoring/plan.md:37,152` — decyzja o dodawaniu/pomijaniu sekretów GHA w zależności od tego, czy CI faktycznie ich używa; wzorzec zarządzania env vars (`astro:env` + `.env` gitignored + panel Vercela).
- `context/archive/2026-08-23-add-and-browse-yarn-library/plan.md:58-105`, `context/archive/2026-08-29-ai-substitute-suggestions/plan.md:170-182` — konsekwentny wzorzec zod + `safeParse` na granicach systemu.
- Brak wcześniejszych zmian dot. drugiego, równoległego workflow GHA w tym repo — `ci-cd-code-review` będzie pierwszym takim precedensem poza samym `ci.yml`.

## Related Research

- `.claude/skills/10x-impl-review-ci/references/impl-review-instructions.md` i `references/workflow-template.yml` — nie jest to `research.md` w sensie 10x-workflow, ale funkcjonalnie pełni analogiczną rolę jako gotowy wzorzec do zaimplementowania podobnej integracji w przyszłości (poza zakresem tej zmiany).

## Open Questions

1. **Zod `.min()/.max()` na `score` przez OpenRouter dla różnych modeli** (`openai/gpt-4o-mini`, `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`) — czy faktycznie działa bez ograniczeń, czy trzeba przejść na wariant bez ograniczeń w schemacie + walidację w kodzie? Do przetestowania w fazie implementacji/evali.
2. **Izolacja lint/type-check dla `packages/code-reviewer/`** — nested `tsconfig.json` z auto-discovery (`projectService`) vs jawny blok `ignores` w `eslint.config.js` (wzorem `.claude/hooks/**`)? Wpływa na to, czy `eslint --fix` w pre-commit hooku (husky) zadziała bez błędów od razu, czy wymaga dodatkowej konfiguracji.
3. **Wymóg `cross-env NODE_OPTIONS="--import tsx"` dla `evals/provider.ts`** — prawdopodobnie zbędny przy `promptfooconfig.yaml` w YAML, ale niepotwierdzony w 100% w dokumentacji promptfoo; do zweryfikowania szybkim testem przed dopisaniem do `package.json`.
4. **Wersja Node dla promptfoo** (`>=22.22.0`) vs `.nvmrc` repo (22.14.0) — czy to problem tylko dla lokalnego dev (evale nie wchodzą do CI, więc nie blokuje pipeline'u), czy wymaga wzmianki w README/dokumentacji pakietu.
5. **`cache-dependency-path` / `working-directory` dla `npm ci` w composite action** — osobny `package-lock.json` w `packages/code-reviewer/` wymaga jawnej konfiguracji `setup-node@v4`, żeby cache działał poprawnie.
