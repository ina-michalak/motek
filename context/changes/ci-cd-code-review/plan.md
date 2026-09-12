# CI/CD Code Review — Plan implementacji

## Przegląd

Wprowadzamy do repo Motek samodzielnego, skryptowego agenta code-review (pakiet `packages/code-reviewer/` na Vercel AI SDK 6 + `@openrouter/ai-sdk-provider` + zod), uruchamianego jako composite action z głównego workflow GitHub Actions przy każdym PR do `main`. Agent jest celowo wąski — diff wchodzi, ustrukturyzowany JSON (7 kryteriów 1–10) wychodzi, workflow zamienia to na komentarz PR i etykietę `ai-cr:passed`/`ai-cr:failed`. Dokładamy testy vitest (wpięte do istniejącego `ci.yml`) i evale promptfoo (lokalne, poza CI) jako bramkę regresji promptu/modelu.

## Analiza stanu obecnego

Repo nie ma dziś żadnego mechanizmu automatycznej recenzji PR-ów — jedyny workflow (`.github/workflows/ci.yml`) robi lint + build. Nie istnieje też żaden precedens osobnego pakietu Node poza `src/`. `context/changes/ci-cd-code-review/requirements.md` i `research.md` już rozstrzygają większość pytań projektowych (kryteria, próg werdyktu 6, podział plików, wersje bibliotek) — ten plan przekłada je na konkretne pliki i kolejność pracy.

## Pożądany stan końcowy

Po zakończeniu tego planu: każdy PR otwarty/ponownie otwarty do `main` (lub oznaczony etykietą `ai-cr:review`) automatycznie dostaje komentarz z tabelą 7 ocen i etykietę `ai-cr:passed`/`ai-cr:failed`. Pakiet `packages/code-reviewer/` ma własne testy jednostkowe wpięte do `ci.yml`, jest w pełni lintowany/typowany, a jego prompt/model da się porównywać lokalnie przez `npm run eval` (promptfoo). Weryfikacja: testowy PR pokazuje realny komentarz + etykietę, retry przez dodanie `ai-cr:review` czyści poprzedni komentarz/etykietę i tworzy nowe, `npm test` (root i w pakiecie) oraz `npm run lint`/`typecheck` przechodzą.

### Kluczowe odkrycia:

- Naiwna instalacja `npm install ai @openrouter/ai-sdk-provider` złapałaby AI SDK 7 (`ai@latest`=7.0.99) niekompatybilny z resztą specyfikacji — wymagane jawne przypięcie `ai@6.0.282` + `@openrouter/ai-sdk-provider@2.9.1` (`research.md`, sekcja „Vercel AI SDK 6…”).
- `.claude/hooks/**` ([eslint.config.js:79](../../../eslint.config.js#L79)) to precedens pełnego wykluczenia kodu z lintowania — **odrzucony** na rzecz zagnieżdżonego `tsconfig.json`, bo `projectService: true` ([eslint.config.js:17-20](../../../eslint.config.js#L17-L20)) automatycznie wykrywa najbliższy tsconfig i pakiet zostaje w pełni lintowany (decyzja użytkownika).
- `.gitignore` już rekurencyjnie pokrywa `node_modules/` i `.env*` w podkatalogach — zero zmian potrzebnych.
- `10x-impl-review-ci` (`.claude/skills/10x-impl-review-ci/`) to żywy precedens podziału mechanika/kryteria (`SKILL.md` ↔ `references/impl-review-instructions.md`) — bezpośrednia analogia do `review.ts` ↔ `criteria.ts`.

## Czego NIE robimy

- Pętli narzędziowej (`ToolLoopAgent` z narzędziami czytającymi repo/plan) — jednostrzałowy scorer, `generateText` + `Output.object`, bez `tools`.
- Blokującej bramki na merge (branch protection) — czysto informacyjny gate (komentarz + etykieta).
- Wpięcia promptfoo do CI — narzędzie deweloperskie, uruchamiane lokalnie.
- Dopasowania biznesowego/architektonicznego w recenzji — tylko diff, bez szerszego kontekstu repo.
- `workflow_dispatch` jako dodatkowy trigger — tylko `pull_request` (decyzja użytkownika).
- Retry przy niepoprawnym structured output z LLM-a — pierwszy błąd `safeParse` od razu kończy przebieg błędem (decyzja użytkownika; retry robi człowiek przez etykietę `ai-cr:review`).
- Cache'owania osobnego `package-lock.json` pakietu w `setup-node` (`cache-dependency-path`) — pomijamy jako optymalizację poza zakresem MVP; `npm ci` bez cache w tym jednym miejscu jest akceptowalnym kosztem czasu budowy.

## Podejście do implementacji

Budujemy od wewnątrz na zewnątrz: najpierw czysta logika pakietu (kryteria → schemat → prompt → werdykt → format komentarza, wszystko testowalne bez sieci), potem orkiestracja wywołania LLM-a (`review.ts`), potem opakowanie w GitHub Actions (composite action → workflow), potem wpięcie jakości pakietu do istniejącego CI, na końcu evale promptfoo i dokumentacja + weryfikacja end-to-end na żywym PR-ze.

## Krytyczne szczegóły implementacji

- **Przypięcie wersji AI SDK**: `package.json` pakietu musi jawnie wskazywać `"ai": "6.0.282"` i `"@openrouter/ai-sdk-provider": "2.9.1"` (nie zakresy `^`/`latest`) — `ai@latest` to już AI SDK 7 z inną semantyką (`usage` zamiast `totalUsage`, inny domyślny `stopWhen`), a `@openrouter/ai-sdk-provider@latest` (3.0.0) wymaga `ai@^7`. Pomyłka tutaj wygląda na "działające" `npm install`, ale wywali się dopiero w runtime na niezgodnych typach.
- **Zakres oceny TYLKO w opisie, nie w schemacie**: pole `score` w `criterionResultSchema` to zwykłe `z.number().describe("... skala 1-10 ...")`, **bez** `.int().min(1).max(10)`. Bezpośrednie API Anthropica potwierdzone odrzuca `minimum`/`maximum` na typie integer w JSON Schema (vercel/ai#14342); nie jest jasne, czy OpenRouter to samo dziedziczy dla wszystkich modeli — bezpieczny wariant z `research.md` i z Twojego setup-promptu to zakres tylko w tekście opisu i w prompcie.
- **Diff/tytuł/opis PR-a przez `gh`, nie przez lokalny `git diff`**: workflow pobiera dane przez `gh pr view`/`gh pr diff` (zgodnie z Krokiem 4 setup-promptu — heredoc na tytuł, fork-guard, `|| true`), NIE przez `git diff origin/main...HEAD` z pełnym checkoutem. Dzięki temu `actions/checkout@v4` w `code-review.yml` może zostać **płytki** (bez `fetch-depth: 0`) — diff przychodzi z GitHub API, nie z lokalnego repo.

## Faza 1: Fundament pakietu — dane, schemat, prompt, werdykt, format komentarza

### Przegląd

Tworzymy `packages/code-reviewer/` jako w pełni niezależny pakiet npm (własny `package.json`, `tsconfig.json`, lockfile) i implementujemy pięć czysto logicznych modułów, testowalnych bez żadnego wywołania sieciowego.

### Wymagane zmiany:

#### 1. Szkielet pakietu

**Plik**: `packages/code-reviewer/package.json`

**Cel**: Niezależny pakiet ESM z własnym zestawem zależności produkcyjnych (`ai`, `@openrouter/ai-sdk-provider`, `zod`) i deweloperskich (`tsx`, `typescript`, `vitest`, `promptfoo`, `@types/node`), niepowiązany z workspaces (repo ich nie ma).

**Umowa**: `"type": "module"`, `"private": true`, deps przypięte dokładnie jak w sekcji „Krytyczne szczegóły" (`ai@6.0.282`, `@openrouter/ai-sdk-provider@2.9.1`). Skrypty: `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"review": "tsx src/review.ts"`, `"eval": "promptfoo eval -c evals/promptfooconfig.yaml"` (patrz Faza 5 co do ew. `cross-env`/`tsx`).

**Plik**: `packages/code-reviewer/tsconfig.json`

**Cel**: Konfiguracja niezależna od root `tsconfig.json` (który rozszerza `astro/tsconfigs/strict` — nieprzydatne dla czystego Node/CLI) — strict, ESNext/Bundler, bez aliasu `@/*` (niepotrzebny, pakiet nie importuje niczego z `src/` aplikacji).

**Umowa**: `"compilerOptions"`: `strict: true`, `target: "ESNext"`, `module: "ESNext"`, `moduleResolution: "Bundler"`, `noEmit: true`, `skipLibCheck: true`. `"include": ["src/**/*", "evals/**/*"]`. Ten plik, dzięki `projectService: true` w root `eslint.config.js`, zostanie automatycznie znaleziony przez ESLint dla plików w tym katalogu — **bez żadnej zmiany w `eslint.config.js`**.

#### 2. Kryteria oceny

**Plik**: `packages/code-reviewer/src/criteria.ts`

**Cel**: Jedno źródło prawdy dla 7 kryteriów z `requirements.md` — dane, z których wyprowadzamy zarówno schemat zod, jak i treść promptu.

**Umowa**: `export const CRITERIA: { id: string; label: string; definition: string }[]` z dokładnie 7 wpisami (id w camelCase: `correctness`, `idiomaticity`, `complexity`, `testCoverage`, `documentation`, `typeSafety`, `security`), `label` i `definition` przepisane z `requirements.md` (definition zawiera opis stanu "1" i "10", po polsku — dokładnie ten tekst trafi do `.describe()` w schemacie i do promptu).

#### 3. Schemat structured output

**Plik**: `packages/code-reviewer/src/schema.ts`

**Cel**: Zod schema budowana programatycznie z `CRITERIA`, jedno źródło prawdy dla `Output.object` w `review.ts` i dla walidacji w testach.

**Umowa**:

```ts
const criterionResultSchema = z.object({
  score: z.number().describe(criterion.definition), // zakres 1-10 tylko w opisie — patrz "Krytyczne szczegóły"
  rationale: z.string().describe("Krótkie uzasadnienie oceny w języku polskim (1-2 zdania)."),
});
export const REVIEW_SCHEMA = z.object(Object.fromEntries(CRITERIA.map((c) => [c.id, criterionResultSchema])));
export type Review = z.infer<typeof REVIEW_SCHEMA>;
```

Uwaga: `.describe()` na polu `score` musi być per-kryterium (różny tekst dla każdego z 7 pól), więc budowany w pętli po `CRITERIA`, nie jako jeden stały schemat.

#### 4. Budowanie promptu

**Plik**: `packages/code-reviewer/src/prompt.ts`

**Cel**: Złożenie promptu dla modelu z tytułu/opisu/diffa PR-a i kryteriów, z twardym limitem długości diffa.

**Umowa**: `export const MAX_DIFF_CHARS = 60_000;`. `export function truncateDiff(diff: string): { diff: string; truncated: boolean }` — obcina do `MAX_DIFF_CHARS` znaków, `truncated: true` tylko gdy realnie obcięto. `export function buildPrompt({ title, body, diff }: { title: string; body: string; diff: string }): string` — składa instrukcję po polsku ("Jesteś recenzentem PR-a...", 7 kryteriów z `CRITERIA` wypisanych z definicjami, sekcje Tytuł/Opis/Diff), dołącza notatkę o obcięciu diffa gdy `truncated === true`.

#### 5. Werdykt

**Plik**: `packages/code-reviewer/src/verdict.ts`

**Cel**: Deterministyczna decyzja pass/fail na podstawie ocen zwróconych przez model — próg per-kryterium, nie średnia.

**Umowa**: `export const PASS_THRESHOLD = 6;`. `export function computeVerdict(review: Review): "pass" | "fail"` — `"fail"` jeśli `Object.values(review).some((r) => r.score < PASS_THRESHOLD)`, inaczej `"pass"`.

#### 6. Format komentarza PR

**Plik**: `packages/code-reviewer/src/format-comment.ts`

**Cel**: Wyrenderowanie komentarza markdown do PR-a — marker do identyfikacji przy retry, banner werdyktu (po polsku), tabela ocen.

**Umowa**: `export const COMMENT_MARKER = "<!-- ai-cr:review-comment -->";`. `export function formatComment(review: Review, verdict: "pass" | "fail", opts?: { diffTruncated?: boolean }): string` — zwraca string zaczynający się od `COMMENT_MARKER`, banner `## ✅ Recenzja AI: PRZESZŁO` / `## ❌ Recenzja AI: NIE PRZESZŁO`, tabelę markdown `| Kryterium | Ocena | Uzasadnienie |` (jeden wiersz na kryterium z `CRITERIA`, w tej samej kolejności, `label` jako nazwa kryterium), opcjonalną linię `> ⚠️ Diff został obcięty do {MAX_DIFF_CHARS} znaków przed oceną.` gdy `opts?.diffTruncated`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm test --prefix packages/code-reviewer` przechodzi (testy dla `verdict.ts`, `format-comment.ts`, `prompt.ts`)
- `npm run typecheck --prefix packages/code-reviewer` przechodzi
- `npx eslint packages/code-reviewer` (z roota) nie zgłasza błędów type-aware (potwierdza, że `projectService` znalazł zagnieżdżony `tsconfig.json`)

#### Weryfikacja ręczna:

- Ręczny przegląd treści `criteria.ts` — 7 definicji zgodnych z `requirements.md`, bez literówek/urwanych zdań

---

## Faza 2: Orkiestracja recenzji (`review.ts`)

### Przegląd

Łączymy moduły z Fazy 1 w `runReview()` — wywołanie `generateText` z `Output.object` przez `@openrouter/ai-sdk-provider` — oraz CLI entry point (`main()`) czytający dane wejściowe z env vars/plików i piszący wynik do `$GITHUB_OUTPUT`.

### Wymagane zmiany:

#### 1. `runReview` i CLI

**Plik**: `packages/code-reviewer/src/review.ts`

**Cel**: Pojedyncza funkcja orkiestrująca wywołanie LLM-a i przetworzenie wyniku na werdykt + komentarz, plus samodzielny entry point uruchamialny przez `tsx`/composite action.

**Umowa**:

```ts
export async function runReview(input: {
  title: string;
  body: string;
  diff: string;
  apiKey: string;
  model: string;
}): Promise<{ review: Review; verdict: "pass" | "fail"; comment: string }> {
  const openrouter = createOpenRouter({ apiKey: input.apiKey });
  const { diff, truncated } = truncateDiff(input.diff);
  const { output } = await generateText({
    model: openrouter(input.model),
    output: Output.object({ schema: REVIEW_SCHEMA }),
    prompt: buildPrompt({ title: input.title, body: input.body, diff }),
  });
  const parsed = REVIEW_SCHEMA.safeParse(output);
  if (!parsed.success) throw new Error(`Niepoprawny structured output: ${parsed.error.message}`);
  const verdict = computeVerdict(parsed.data);
  return { review: parsed.data, verdict, comment: formatComment(parsed.data, verdict, { diffTruncated: truncated }) };
}
```

`main()`: zod-waliduje env (`OPENROUTER_API_KEY` wymagany, `OPENROUTER_MODEL` opcjonalny, domyślnie `"openai/gpt-4o-mini"`, `PR_TITLE` wymagany string, `PR_BODY_FILE`/`PR_DIFF_FILE` wymagane ścieżki do plików — czytane przez `readFileSync`, NIE ze zmiennych stringowych), woła `runReview()`, zapisuje do `process.env.GITHUB_OUTPUT` dwie wartości: `verdict=<pass|fail>` oraz wieloliniowy `comment-body` przez losowy delimiter heredoc (`comment-body<<GHADELIM_<random>` / `GHADELIM_<random>`, żeby treść komentarza zawierająca `EOF` nie złamała zapisu). Guard: `if (process.argv[1] === fileURLToPath(import.meta.url)) { main(); }`.

**Plik**: `packages/code-reviewer/src/review.test.ts`

**Cel**: Testy `runReview()` na ścieżce pass i fail, bez realnego wywołania sieciowego.

**Umowa**: `vi.mock("ai", ...)` mockuje `generateText` (zwraca `{ output: <fixture> }`) i `Output.object` (przepuszcza argument), `vi.mock("@openrouter/ai-sdk-provider", ...)` mockuje `createOpenRouter` jako funkcję zwracającą funkcję-model. Dwa przypadki: (a) wszystkie oceny ≥6 → `verdict === "pass"`, komentarz zawiera banner sukcesu; (b) jedna ocena <6 → `verdict === "fail"`, komentarz zawiera banner porażki. Trzeci przypadek: `generateText` zwraca `output` niezgodny ze schematem (np. brakujące pole) → `runReview()` rzuca błąd.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm test --prefix packages/code-reviewer` przechodzi (wraz z `review.test.ts`)
- `npm run typecheck --prefix packages/code-reviewer` przechodzi

#### Weryfikacja ręczna:

- Lokalne uruchomienie z prawdziwym kluczem OpenRouter (dostarczonym przez użytkownika w `packages/code-reviewer/.env`, wczytanym np. przez `--env-file` przy `tsx`) na spreparowanym mini-diffie: `PR_TITLE="test" PR_BODY_FILE=... PR_DIFF_FILE=... OPENROUTER_API_KEY=... npm run review --prefix packages/code-reviewer` — potwierdza, że `runReview()` zwraca sensowny JSON i `computeVerdict` poprawnie łapie próg (Krok 7 pkt 2 z setup-promptu)

---

## Faza 3: Composite Action + workflow GHA

### Przegląd

Opakowujemy `review.ts` w composite action i główny workflow uruchamiany na PR do `main`, z pięcioma detalami bezpieczeństwa/niezawodności z Kroku 4 setup-promptu wbudowanymi od razu.

### Wymagane zmiany:

#### 1. Composite action

**Plik**: `.github/actions/code-review/action.yml`

**Cel**: Reużywalny krok „uruchom recenzję i zwróć werdykt + komentarz", niezależny od triggera/OS (o tym decyduje konsument).

**Umowa**: `inputs`: `pr-title` (required), `pr-body-file` (required), `pr-diff-file` (required), `openrouter-api-key` (required), `openrouter-model` (optional). `outputs`: `verdict`, `comment-body` (oba `value: ${{ steps.run-review.outputs.<pole> }}`). `runs: using: composite`, kroki: `actions/setup-node@v4` (`node-version: 22`, `cache: npm` — bez `cache-dependency-path`, patrz „Czego NIE robimy"), `npm ci` z `working-directory: packages/code-reviewer`, krok `id: run-review` z `working-directory: packages/code-reviewer`, `shell: bash` (wymagane dla każdego kroku `run` w composite action), `run: npx tsx src/review.ts`, `env:` przekazujący `PR_TITLE: ${{ inputs.pr-title }}`, `PR_BODY_FILE: ${{ inputs.pr-body-file }}`, `PR_DIFF_FILE: ${{ inputs.pr-diff-file }}`, `OPENROUTER_API_KEY: ${{ inputs.openrouter-api-key }}`, `OPENROUTER_MODEL: ${{ inputs.openrouter-model }}`.

#### 2. Główny workflow

**Plik**: `.github/workflows/code-review.yml`

**Cel**: Trigger na PR do `main`, pobranie danych PR-a, wywołanie composite action, publikacja komentarza + etykiety, obsługa retry i błędów.

**Umowa**: `on.pull_request.types: [opened, reopened, labeled]`, `branches: [main]`. `permissions: contents: read, pull-requests: write`. `concurrency: group: ai-cr-${{ github.event.pull_request.number }}, cancel-in-progress: true`. Job `code-review` z `if:` łączącym fork-guard (`github.event.pull_request.head.repo.full_name == github.repository`) i label-gate (`github.event.action != 'labeled' || github.event.label.name == 'ai-cr:review'`). `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` na poziomie joba (potrzebne dla wszystkich kroków `gh`). Kroki dokładnie jak w Kroku 4 setup-promptu: `actions/checkout@v4` (bez `fetch-depth: 0` — patrz „Krytyczne szczegóły"), krok `pr-data` (heredoc na tytuł: `title<<GH_OUTPUT_TITLE_EOF` / `echo "$TITLE"` / `GH_OUTPUT_TITLE_EOF`, `gh pr view --json body --jq .body > pr-body.txt`, `gh pr diff > pr-diff.txt`), krok czyszczący etykietę `ai-cr:review` (`|| true`), krok `uses: ./.github/actions/code-review` z sekretem `OPENROUTER_API_KEY` i zmienną `OPENROUTER_MODEL`, krok usuwający poprzedni komentarz po markerze (`gh api ... --jq '... | tail -1'`, `|| true`), krok publikujący nowy komentarz (`gh pr comment --body-file`), krok ustawiający etykietę `ai-cr:passed`/`ai-cr:failed` w zależności od `steps.review.outputs.verdict`, krok `if: failure()` publikujący komentarz fallback z linkiem do logów runa.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `actionlint .github/workflows/code-review.yml .github/actions/code-review/action.yml` (lub walidacja YAML, jeśli `actionlint` niedostępny lokalnie) nie zgłasza błędów składniowych
- Composite action i workflow nie kolidują z istniejącym `ci.yml` (inny plik, inny trigger scope)

#### Weryfikacja ręczna:

- Przegląd `action.yml`/`code-review.yml` pod kątem wszystkich 5 punktów z Kroku 4 setup-promptu: fork-guard obecny, label-gate obecny, czyszczenie etykiety `ai-cr:review` na starcie, tytuł PR przez heredoc (nie `echo`), `|| true` na krokach `gh api`/`gh pr edit`, które mogą nic nie znaleźć
- Pełna weryfikacja end-to-end (realny komentarz + etykieta na PR-ze) przeniesiona do Fazy 6 — ta faza wymaga sekretu `OPENROUTER_API_KEY` w repo, którego jeszcze nie ma

---

## Faza 4: Wpięcie jakości pakietu do istniejącego CI

### Przegląd

Root `ci.yml` dostaje dodatkowe kroki weryfikujące `packages/code-reviewer` (instalacja, typecheck, testy), żeby regresja w agencie (zepsuty schemat, zepsuty prompt) była złapana na każdym PR-ze, nie tylko przy pierwszym realnym użyciu.

### Wymagane zmiany:

#### 1. Rozszerzenie root CI

**Plik**: `.github/workflows/ci.yml`

**Cel**: Dodać instalację i weryfikację `packages/code-reviewer` do istniejącego joba `ci`, bez zmiany jego triggera ani istniejących kroków dla aplikacji Astro.

**Umowa**: Po istniejącym kroku `npm run build` dopisać trzy nowe kroki: `run: npm ci --prefix packages/code-reviewer`, `run: npm run typecheck --prefix packages/code-reviewer`, `run: npm test --prefix packages/code-reviewer`. `npm run lint` (już istniejący krok, `eslint .` z roota) automatycznie obejmie też `packages/code-reviewer/**/*.ts` dzięki zagnieżdżonemu `tsconfig.json` z Fazy 1 — nie wymaga zmian.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Zmieniony `ci.yml` przechodzi walidację YAML
- Push/PR testowy pokazuje, że nowe kroki (`npm ci`/`typecheck`/`test --prefix packages/code-reviewer`) faktycznie się wykonują i przechodzą w GitHub Actions

#### Weryfikacja ręczna:

- Ręczne potwierdzenie w logach Actions (po pierwszym pushu), że `npm run lint` z roota rzeczywiście objął pliki `packages/code-reviewer/**/*.ts` (np. przez chwilowe wprowadzenie celowego błędu lint i sprawdzenie, że krok go łapie — potem cofnięte)

---

## Faza 5: Evale promptfoo

### Przegląd

Lokalny zestaw evali porównujący 3 modele (baseline + 2 alternatywy) na jednym złożonym diffie ze spreparowanymi wadami — bramka regresji promptu/modelu, nie wpięta do CI.

### Wymagane zmiany:

#### 1. Fixture z wadami

**Plik**: `packages/code-reviewer/evals/fixtures/motek-flaws.diff`

**Cel**: Jeden realistyczny diff w stylu Motka (nowy endpoint API + migracja Supabase + komponent React) z 3 celowo wstrzykniętymi wadami odpowiadającymi kryteriom `security`/`typeSafety`/`correctness`.

**Umowa**: Diff musi zawierać dokładnie te trzy wady, każda jednoznacznie wykrywalna: (a) nowa migracja Supabase tworząca tabelę **bez `ENABLE ROW LEVEL SECURITY`** i bez polityk, (b) nowy endpoint API (`export const POST`) **bez walidacji zod** wejścia i **bez `export const prerender = false`**, (c) nowy komponent React z `useEffect` rejestrującym listener/subskrypcję **bez funkcji czyszczącej** w return.

#### 2. Custom provider

**Plik**: `packages/code-reviewer/evals/provider.ts`

**Cel**: Provider promptfoo wołający bezpośrednio `runReview()` z `../src/review`, ignorujący wyrenderowany przez promptfoo prompt — testujemy realny kod produkcyjny.

**Umowa**: `export default class ReviewProvider implements ApiProvider { id() { return "code-review-agent"; } async callApi(_prompt, context) { const result = await runReview({ title: context.vars.title, body: context.vars.body, diff: readFileSync(context.vars.diffPath, "utf8"), apiKey: process.env.OPENROUTER_API_KEY!, model: context.vars.model }); return { output: JSON.stringify(result) }; } }` — `output` musi być stringiem (asercja `javascript` w promptfoo dostaje surowy string, patrz `research.md`).

#### 3. Konfiguracja evali

**Plik**: `packages/code-reviewer/evals/promptfooconfig.yaml`

**Cel**: Macierz 3 modele × 1 fixture, z trzema warstwami asercji.

**Umowa**: `providers`: trzy warianty `{ id: "file://./evals/provider.ts", label: "<model>", config: { model: "<vendor/model>" } }` dla `openai/gpt-4o-mini`, `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`. `tests`: jeden test z `vars: { diffPath: "fixtures/motek-flaws.diff", title: "...", body: "..." }` i `assert`: `is-json`, `javascript` (`JSON.parse(output).verdict === "fail"`), `llm-rubric` × 3 (po jednym na każdą wstrzykniętą wadę — RLS, walidacja/prerender, cleanup) z `provider: { id: "openrouter:z-ai/glm-5.1", config: { apiKeyEnvar: "OPENROUTER_API_KEY" } }` jako stały sędzia (decyzja: reużyć jeden z trzech testowanych modeli, `z-ai/glm-5.1` — nie jest to model domyślny produkcyjnie, więc ryzyko samo-oceniania jest ograniczone do dwóch pozostałych wariantów).

#### 4. Skrypt uruchomienia

**Plik**: `packages/code-reviewer/package.json` (aktualizacja)

**Cel**: Jedno polecenie do uruchomienia evali.

**Umowa**: `"eval": "promptfoo eval -c evals/promptfooconfig.yaml"` — **bez** `cross-env NODE_OPTIONS="--import tsx"` na start (`promptfooconfig.yaml` zostaje w YAML, tylko `provider.ts` jest w TS, ładowany przez wbudowany loader TS promptfoo — `research.md` sekcja promptfoo, punkt 5). Jeśli przy pierwszym uruchomieniu promptfoo nie potrafi załadować `provider.ts`, dopisać `cross-env` + `tsx` jako fallback (decyzja techniczna do zweryfikowania empirycznie w tej fazie, nie wcześniej).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run eval --prefix packages/code-reviewer` uruchamia się bez błędów konfiguracji (niezależnie od wyniku pass/fail per model — to jest ocena jakości, nie bramka CI)

#### Weryfikacja ręczna:

- Przegląd macierzy wyników promptfoo: czy `openai/gpt-4o-mini` (domyślny model produkcyjny) faktycznie łapie `verdict === "fail"` i wskazuje przynajmniej część trzech wstrzykniętych wad — jeśli nie, wróć do `prompt.ts`/`criteria.ts` przed zamknięciem zmiany

---

## Faza 6: Dokumentacja i weryfikacja end-to-end

### Przegląd

Domykamy zmianę: dokumentacja, sekrety/etykiety w repo, realny testowy PR, review implementacji.

### Wymagane zmiany:

#### 1. Zmienne środowiskowe pakietu

**Plik**: `packages/code-reviewer/.env.example`

**Cel**: Wzorzec lokalnego `.env` dla dewelopera uruchamiającego `npm run review`/`npm run eval` lokalnie (osobny od root `.env.example`, bo `OPENROUTER_API_KEY` nie jest używany przez aplikację Astro).

**Umowa**: `OPENROUTER_API_KEY=###  # klucz z https://openrouter.ai/keys, wymagany do npm run review i npm run eval` + `OPENROUTER_MODEL=###  # opcjonalny override modelu, domyślnie openai/gpt-4o-mini` z komentarzem, do czego służy.

#### 2. Dokumentacja w README

**Plik**: `README.md`

**Cel**: Nowa sekcja opisująca workflow code-review — kiedy się odpala, co robią etykiety, jak zrobić retry, jak uruchomić lokalnie.

**Umowa**: Rozszerzyć istniejącą sekcję „## CI" (i przy okazji poprawić `master`→`main`, zgodny z faktycznym `ci.yml`) o akapit: trigger (`opened`/`reopened`/`labeled` na PR do `main`), etykiety `ai-cr:passed`/`ai-cr:failed`, retry przez dodanie `ai-cr:review`, link do `packages/code-reviewer/` i komend `npm run review`/`npm run eval` (uruchamianych z `--prefix packages/code-reviewer` lub po `cd`).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run lint` i `npm run build` w roocie nadal przechodzą (żadna zmiana dokumentacyjna/env nie psuje istniejącego CI)

#### Weryfikacja ręczna:

- Sekret `OPENROUTER_API_KEY` i zmienna `OPENROUTER_MODEL` dodane w ustawieniach repo GitHub (Settings → Secrets and variables → Actions) — **wymaga Twojego klucza OpenRouter**, wykonuję po Twoim potwierdzeniu
- Etykiety `ai-cr:review`, `ai-cr:passed` (`#2ea44f`), `ai-cr:failed` (`#d73a4a`) utworzone przez `gh label create` — pytam o zgodę przed wykonaniem
- Otwarty testowy PR do `main` (np. drobna zmiana dokumentacji) — pytam o zgodę przed wykonaniem — potwierdza: komentarz z markerem pojawia się, etykieta `ai-cr:passed`/`ai-cr:failed` jest ustawiona poprawnie, dodanie etykiety `ai-cr:review` usuwa stary komentarz/etykietę i tworzy nowe
- `/10x-impl-review` uruchomiony na tej zmianie przed zamknięciem, `/10x-archive` na końcu

---

## Strategia testowania

### Testy jednostkowe:

- `verdict.ts` — granice progu 6 per kryterium (nie średnia), wszystkie kryteria dokładnie na progu, jedno kryterium poniżej progu przy reszcie maksymalnej
- `format-comment.ts` — obecność markera na początku, poprawny banner dla obu werdyktów, kolejność wierszy tabeli zgodna z `CRITERIA`, linia o obcięciu diffa tylko gdy `diffTruncated: true`
- `prompt.ts` — `truncateDiff` na granicy `MAX_DIFF_CHARS` (dokładnie na granicy, jeden znak nad, znacząco poniżej), `buildPrompt` zawiera tytuł/opis/diff i wszystkie 7 definicji kryteriów
- `review.ts` — ścieżka pass, ścieżka fail, ścieżka błędu walidacji (malformed output → rzucony błąd, bez retry)

### Kroki testowania ręcznego:

1. Lokalne uruchomienie `npm run review --prefix packages/code-reviewer` na spreparowanym mini-diffie z prawdziwym kluczem OpenRouter
2. `npm run eval --prefix packages/code-reviewer` — przegląd macierzy wyników 3 modeli na fixture z wadami
3. Testowy PR na żywym repo — pełna pętla: otwarcie → komentarz + etykieta → dodanie `ai-cr:review` → nowy komentarz + etykieta, stare usunięte

## Referencje

- Wymagania: `context/changes/ci-cd-code-review/requirements.md`
- Badania: `context/changes/ci-cd-code-review/research.md`
- Wzorzec separacji mechanika/kryteria: `.claude/skills/10x-impl-review-ci/SKILL.md`, `.claude/skills/10x-impl-review-ci/references/impl-review-instructions.md`
- Istniejące CI: `.github/workflows/ci.yml`
- Wzorzec zod na granicach: `context/archive/2026-08-23-add-and-browse-yarn-library/plan.md`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Fundament pakietu — dane, schemat, prompt, werdykt, format komentarza

#### Automatyczne

- [x] 1.1 `npm test --prefix packages/code-reviewer` przechodzi — a1d0930
- [x] 1.2 `npm run typecheck --prefix packages/code-reviewer` przechodzi — a1d0930
- [x] 1.3 `npx eslint packages/code-reviewer` bez błędów type-aware — a1d0930

#### Ręczne

- [x] 1.4 Ręczny przegląd treści `criteria.ts` — a1d0930

### Faza 2: Orkiestracja recenzji (`review.ts`)

#### Automatyczne

- [x] 2.1 `npm test --prefix packages/code-reviewer` przechodzi (z `review.test.ts`) — a3db9e5
- [x] 2.2 `npm run typecheck --prefix packages/code-reviewer` przechodzi — a3db9e5

#### Ręczne

- [x] 2.3 Lokalne uruchomienie z prawdziwym kluczem OpenRouter na mini-diffie — a3db9e5

### Faza 3: Composite Action + workflow GHA

#### Automatyczne

- [x] 3.1 Walidacja YAML `code-review.yml` i `action.yml` bez błędów składniowych
- [x] 3.2 Brak kolizji z istniejącym `ci.yml`

#### Ręczne

- [x] 3.3 Przegląd wszystkich 5 punktów z Kroku 4 setup-promptu (fork-guard, label-gate, czyszczenie etykiety, heredoc tytułu, `|| true`)

### Faza 4: Wpięcie jakości pakietu do istniejącego CI

#### Automatyczne

- [ ] 4.1 Zmieniony `ci.yml` przechodzi walidację YAML
- [ ] 4.2 Nowe kroki (`npm ci`/`typecheck`/`test --prefix`) wykonują się i przechodzą w Actions

#### Ręczne

- [ ] 4.3 Potwierdzenie, że `npm run lint` z roota obejmuje `packages/code-reviewer/**/*.ts`

### Faza 5: Evale promptfoo

#### Automatyczne

- [ ] 5.1 `npm run eval --prefix packages/code-reviewer` uruchamia się bez błędów konfiguracji

#### Ręczne

- [ ] 5.2 Przegląd macierzy wyników — model domyślny łapie `verdict === "fail"` na fixture z wadami

### Faza 6: Dokumentacja i weryfikacja end-to-end

#### Automatyczne

- [ ] 6.1 `npm run lint` i `npm run build` w roocie nadal przechodzą

#### Ręczne

- [ ] 6.2 Sekret `OPENROUTER_API_KEY` i zmienna `OPENROUTER_MODEL` dodane w GitHub
- [ ] 6.3 Etykiety `ai-cr:review`/`ai-cr:passed`/`ai-cr:failed` utworzone
- [ ] 6.4 Testowy PR potwierdza pełną pętlę (komentarz, etykieta, retry)
- [ ] 6.5 `/10x-impl-review` uruchomiony, `/10x-archive` na końcu
