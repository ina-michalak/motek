# CI/CD Code Review — Krótki plan

> Pełny plan: `context/changes/ci-cd-code-review/plan.md`
> Badania: `context/changes/ci-cd-code-review/research.md`

## Co i dlaczego

Budujemy samodzielnego agenta AI do code review pull requestów w Motku, uruchamianego automatycznie w GitHub Actions. Agent nie jest gotowym narzędziem typu Claude Code Action — to własny, skryptowy "scorer" na Vercel AI SDK 6 + OpenRouter: diff PR-a wchodzi, ocena w 7 kryteriach (1–10) wychodzi jako komentarz PR i etykieta pass/fail.

## Punkt wyjścia

Repo ma dziś tylko jeden workflow (`ci.yml`: lint + build) i żaden mechanizm automatycznej recenzji ani osobnego pakietu Node poza aplikacją Astro. `requirements.md` i `research.md` już rozstrzygnęły kryteria oceny, próg werdyktu i wersje bibliotek.

## Pożądany stan końcowy

Każdy PR do `main` (albo oznaczony etykietą `ai-cr:review`) dostaje automatyczny komentarz z tabelą 7 ocen i etykietę `ai-cr:passed`/`ai-cr:failed`. Pakiet ma własne testy wpięte do CI, jest lintowany jak reszta repo, a jego prompt/model da się porównywać lokalnie przez promptfoo.

## Kluczowe podjęte decyzje

| Decyzja                          | Wybór                                                                              | Dlaczego (1 zdanie)                                                                | Źródło           |
| -------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------- |
| Technologia agenta               | Vercel AI SDK 6 (`generateText`+`Output.object`) + OpenRouter, bez `ToolLoopAgent` | Jednostrzałowy scorer bez narzędzi nie potrzebuje mechaniki pętli agentowej        | Wymagania        |
| Wersje bibliotek                 | `ai@6.0.282` + `@openrouter/ai-sdk-provider@2.9.1` (przypięte)                     | `latest` złapałby niekompatybilne AI SDK 7                                         | Badania          |
| Zakres oceny w schemacie         | `.describe()` zamiast `.min()/.max()` na `score`                                   | Potwierdzone ryzyko odrzucenia ograniczeń JSON Schema przez niektóre modele        | Badania          |
| Pobieranie diffu/tytułu/opisu    | `gh pr view`/`gh pr diff` (nie lokalny `git diff`)                                 | Spójne z resztą zabezpieczeń Kroku 4 (heredoc, fork-guard) z jednego źródła prawdy | Plan             |
| Izolacja lint/typecheck pakietu  | Zagnieżdżony `tsconfig.json`, auto-wykrywany przez `projectService`                | Pakiet oceniający "idiomatyczność" innych powinien sam być lintowany               | Sesja planowania |
| CI dla własnych testów pakietu   | Wpięte do istniejącego `ci.yml` (`--prefix packages/code-reviewer`)                | Regresja w agencie nie powinna wejść na `main` niezauważona                        | Sesja planowania |
| Model-sędzia w evalach promptfoo | Jeden z 3 testowanych modeli (`z-ai/glm-5.1`)                                      | Prostsza konfiguracja niż osobny model wyłącznie do oceniania                      | Sesja planowania |
| Trigger workflow                 | Tylko `pull_request` (opened/reopened/labeled), bez `workflow_dispatch`            | Ścisłe trzymanie się uzgodnionego zakresu                                          | Sesja planowania |
| Błąd structured output z LLM-a   | Bez retry — od razu fail, workflow pokazuje fallback                               | Prostszy kod; człowiek robi retry przez etykietę `ai-cr:review`                    | Sesja planowania |

## Zakres

**W zakresie:** pakiet `packages/code-reviewer/` (logika + `review.ts` + testy), composite action, główny workflow z fork-guard/label-gate/retry, wpięcie testów pakietu do `ci.yml`, evale promptfoo (lokalne), dokumentacja, etykiety, testowy PR.

**Poza zakresem:** pętla narzędziowa (`ToolLoopAgent` z narzędziami), blokująca bramka merge'a, promptfoo w CI, dopasowanie biznesowe/architektoniczne, `workflow_dispatch`, retry automatyczny przy błędzie LLM-a.

## Architektura / Podejście

`PR → GHA workflow (code-review.yml) → gh pr view/diff → composite action (.github/actions/code-review) → packages/code-reviewer/src/review.ts → OpenRouter (generateText+Output.object) → werdykt+komentarz → gh pr comment + gh pr edit --add-label`.

## Fazy w skrócie

| Faza                           | Co dostarcza                                                        | Kluczowe ryzyko                                                           |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Fundament pakietu           | criteria/schema/prompt/verdict/format-comment + testy               | Błędny podział definicji kryteriów między prompt a UI komentarza          |
| 2. Orkiestracja recenzji       | `review.ts` (`runReview`+CLI) + testy z mockiem                     | Niezgodność wersji AI SDK psująca typy w runtime                          |
| 3. Composite Action + workflow | `.github/actions/code-review/`, `.github/workflows/code-review.yml` | Pominięty detal bezpieczeństwa z Kroku 4 (fork-guard/heredoc/`\|\| true`) |
| 4. CI dla pakietu              | Rozszerzony `ci.yml`                                                | Dłuższy czas budowy CI                                                    |
| 5. Evale promptfoo             | `evals/` (config+provider+fixture)                                  | Niepewność co do wymogu `cross-env`/`tsx` dla providera TS                |
| 6. Dokumentacja + E2E          | README, `.env.example`, etykiety, testowy PR                        | Wymaga klucza OpenRouter i zgody na akcje na żywym repo                   |

**Wymagania wstępne:** klucz API OpenRouter (Faza 2 ręczna weryfikacja i Faza 6); zgoda użytkownika na utworzenie etykiet, dodanie sekretu i otwarcie testowego PR-a (Faza 6).
**Szacowany wysiłek:** ~6 sesji implementacyjnych (po jednej na fazę), część 1-2 mogą się połączyć w jedną sesję.

## Otwarte ryzyka i założenia

- Nie potwierdzono w 100%, czy `z.number()` bez `.min()/.max()` faktycznie unika problemu ze strukturalnym wyjściem dla wszystkich 3 modeli testowanych w evalach — do zweryfikowania w Fazie 5.
- Nie potwierdzono, czy `promptfoo` faktycznie ładuje `evals/provider.ts` bez `cross-env NODE_OPTIONS="--import tsx"` — do zweryfikowania empirycznie w Fazie 5, z udokumentowanym fallbackiem.
- Node wymagany przez `promptfoo` (≥22.22.0) jest nowszy niż `.nvmrc` repo (22.14.0) — nieistotne dla CI (evale tam nie wchodzą), ale developer uruchamiający `npm run eval` lokalnie może potrzebować nowszego Node.

## Kryteria sukcesu (podsumowanie)

- Testowy PR pokazuje realny komentarz z tabelą ocen i poprawną etykietę `ai-cr:passed`/`ai-cr:failed`
- Dodanie etykiety `ai-cr:review` czyści poprzedni komentarz/etykietę i tworzy nowe
- `npm test`/`npm run lint`/`npm run typecheck` (root i pakiet) przechodzą w CI
