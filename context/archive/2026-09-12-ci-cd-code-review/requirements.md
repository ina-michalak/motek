# Wymagania: CI/CD Code Review

## Ogólna koncepcja

- Workflow GHA uruchamiany dla każdego nowego pull requestu do `main` (zgodnie z flow tego repo: PR-y trafiają `develop → main`).
- Recenzja wydzielona do composite action, żeby główny workflow był łatwy do ogarnięcia.
- To NIE jest `claude-code-action` ani Claude Agent SDK — samodzielny, skryptowy agent na Vercel AI SDK 6 (`ai`) + `@openrouter/ai-sdk-provider` + `zod`. Bez pętli narzędziowej (`ToolLoopAgent` z narzędziami) — jednokrokowy "scorer": diff wchodzi, ustrukturyzowany JSON wychodzi.

## Parametry wejściowe

- tytuł pull requestu
- opis pull requestu
- git diff (względem brancha bazowego `main`)

## Kryteria przeglądu kodu

Każde kryterium oceniane jest w skali 1–10, gdzie 1 to najgorszy wynik, a 10 to najlepszy. Werdykt to `fail`, jeśli **którekolwiek** kryterium jest < 6 (próg per-kryterium, nie średnia) — jedno krytyczne kryterium (np. bezpieczeństwo) nie może zostać "uśrednione" przez resztę.

1. **poprawność implementacji** — czy kod faktycznie robi to, co deklaruje, obsługując ścieżkę główną, przypadki brzegowe i błędy, bez wprowadzania regresji?
   - _1_: logika jest zepsuta, pomija oczywiste przypadki brzegowe/błędów lub po cichu psuje istniejące zachowanie.
   - _10_: zachowuje się poprawnie na ścieżce głównej, w przypadkach brzegowych i trybach awarii, bez regresji.

2. **idiomatyczność** — czy kod jest zgodny z twardymi regułami i konwencjami tego repo (Astro SSR, React 19, Tailwind 4, shadcn/ui), których oczekiwałby doświadczony współautor?
   - _1_: łamie twarde reguły repo (np. brakujące `prerender = false` na endpoincie API, ręczne łączenie klas zamiast `cn()`, komponent React tam gdzie wystarczyłby statyczny Astro) lub czyta się jak obcy kod.
   - _10_: nie do odróżnienia od dobrze napisanego otaczającego kodu, naturalnie stosuje idiomy Astro/React/shadcn i konwencje z `CLAUDE.md`.

3. **złożoność** — czy rozwiązanie jest tak proste, jak pozwala na to problem, bez zbędnej abstrakcji?
   - _1_: nadmiernie zaprojektowane lub splątane — przedwczesne abstrakcje, trudne do prześledzenia intencje.
   - _10_: minimalistyczne i przejrzyste, najprostszy projekt w pełni rozwiązujący problem.

4. **pokrycie testami / ryzykiem** — czy istotne zachowania i ryzykowne ścieżki są testowane proporcjonalnie do ryzyka, zgodnie z runnerami tego repo (vitest dla logiki/serwisów, Playwright dla E2E)?
   - _1_: ryzykowna logika (np. serwis, walidacja, endpoint API) dostarczona bez testów; testy nieobecne, trywialne lub niczego realnie nie potwierdzają.
   - _10_: pokrycie ważone ryzykiem — części najbardziej podatne na błędy są testowane celowo i dobrze, E2E tam gdzie faktycznie potrzebna jest przeglądarka.

5. **dokumentacja** — czy nieoczywiste decyzje, publiczne interfejsy i trudne fragmenty są wyjaśnione tam, gdzie czytelnik by tego potrzebował?
   - _1_: nieprzejrzyste — brak komentarzy/dokumentacji tam, gdzie są potrzebne, intencje trzeba odtwarzać z kodu.
   - _10_: wystarczająca dokumentacja/komentarze, żeby wyjaśnić "dlaczego" bez powtarzania oczywistości; zmiana zrozumiała bez czytania całej historii PR-a.

6. **integralność typów** — czy dane wejściowe są walidowane na granicach systemu (zod), a typy spójne od API po UI (`src/types.ts`)?
   - _1_: brak walidacji na granicy (np. endpoint API bez zod), typy `any`/rozjeżdżające się między warstwami, DTO niespójne z bazą.
   - _10_: każda granica (API, formularz) waliduje zod-em, typy end-to-end spójne, współdzielone typy w `src/types.ts`.

7. **bezpieczeństwo** — czy zmiana unika wprowadzania luk, wycieku sekretów i niebezpiecznego przetwarzania niezaufanych danych, zgodnie ze specyfiką stosu (Supabase + Astro)?
   - _1_: wprowadza możliwą do wykorzystania lukę, wycieka sekrety, ufa niezaufanym danym wejściowym, brakuje RLS na nowej tabeli Supabase, sekret czytany poza `astro:env/server`.
   - _10_: dane wejściowe walidowane, sekrety obsługiwane wyłącznie przez `astro:env/server`, RLS z granularnymi politykami na każdej nowej tabeli, autoryzacja sprawdzana tam, gdzie potrzebna (middleware, właściciel danych).

## Odłożone na później

- zgodność biznesowa (wymaga szerszego kontekstu niż diff)
- dopasowanie architektoniczne (wymaga szerszego kontekstu niż diff)
- pętla narzędziowa (`ToolLoopAgent` z narzędziami czytającymi repo, plan implementacji, komentującymi inline) — świadome ograniczenie kosztu i nieprzewidywalności w tym MVP
- wpięcie promptfoo do CI (narzędzie deweloperskie/lokalne na start)
- blokująca bramka na merge (branch protection / required status check) — na razie czysto informacyjny gate

## Oczekiwane efekty uboczne

- komentarz PR z podsumowaniem (tabela markdown: kryterium | ocena | uzasadnienie), banner PASSED/FAILED, po polsku
- etykiety: `ai-cr:failed` (czerwona) LUB `ai-cr:passed` (zielona)

## Oczekiwane zachowanie

- ponowna próba na żądanie po dodaniu etykiety `ai-cr:review` (stary komentarz i etykieta usuwane, żeby retry było czyste)
- trigger: `opened`, `reopened`, `labeled` na PR do `main` — świadomie BEZ `synchronize` (kontrola kosztu; nowe commity nie odpalają recenzji automatycznie, retry przez etykietę)
- fork-guard: PR z forka nie uruchamia recenzji (brak dostępu do `OPENROUTER_API_KEY`)

## Kontekst repo (rozpoznanie)

- Stack: Astro 6 SSR (`output: "server"`) + React 19 + Tailwind 4 + Supabase (`@supabase/ssr`) + shadcn/ui ("new-york"), deploy na Vercel (`@astrojs/vercel`).
- Package manager: npm (`package-lock.json`), NIE monorepo (brak workspaces).
- Node: 22.14.0 (`.nvmrc`).
- Branch domyślny: `main`. Flow PR-ów w tym repo: `develop → main`.
- Istniejące CI: `.github/workflows/ci.yml` (lint + build na push/PR do `main`) — nowy workflow nie koliduje.
- Testy: vitest (`npm test`, pliki `*.test.ts` w `src/`) + Playwright (`npm run test:e2e`, `tests/e2e/*.spec.ts`).
- 10x-workflow: repo używa `context/changes/`, skille `/10x-new`, `/10x-research`, `/10x-plan`, `/10x-plan-review`, `/10x-implement`, `/10x-impl-review`, `/10x-impl-review-ci` (już obecny w `.claude/skills/`, ale nie wpinany w tej zmianie).
- Etykiety `ai-cr:*` jeszcze nie istnieją w repo (do utworzenia ręcznie w Kroku 5).
- Sekrety/zmienne do dodania: `OPENROUTER_API_KEY` (secret, wymagany), `OPENROUTER_MODEL` (variable, opcjonalny override; domyślny `openai/gpt-4o-mini`).
- Komentarze i uzasadnienia z recenzji — po polsku.

## Struktura kodu (Krok 2 z setup promptu)

Repo nie jest monorepo, więc pakiet `packages/code-reviewer/` z **własnym** `package.json` i lockfile (niezależny od workspaces aplikacji) — importowalny zarówno z CLI (`tsx`), jak i z przyszłego providera promptfoo. Własny `tsconfig.json` (strict, ESNext/Bundler), nierozszerzający configu frontendowego.

Podział plików źródłowych (do potwierdzenia w planie):

- `src/criteria.ts` — 7 kryteriów jako `{ id, label, definition }`
- `src/schema.ts` — zod schema budowana z `criteria.ts`
- `src/prompt.ts` — `MAX_DIFF_CHARS` + `truncateDiff()` + `buildPrompt()`
- `src/verdict.ts` — `PASS_THRESHOLD = 6`, `computeVerdict()` (min-per-kryterium)
- `src/format-comment.ts` — `COMMENT_MARKER`, banner PASSED/FAILED, tabela markdown
- `src/review.ts` — `runReview()` + `main()` jako CLI entry point (z guardem `import.meta.url`)
- testy vitest dla `verdict.ts`, `format-comment.ts`, `prompt.ts`, `review.ts` (mock `generateText`)

## Evale promptfoo (Krok 6 z setup promptu)

- `evals/promptfooconfig.yaml` — modele: `openai/gpt-4o-mini` (baseline), `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`, wszystkie przez OpenRouter.
- `evals/provider.ts` — custom `ApiProvider`, woła bezpośrednio `runReview()` z `../src/review`, ignorując wyrenderowany przez promptfoo prompt.
- `evals/fixtures/<nazwa>.diff` — jeden złożony, realistyczny diff w stylu Motka (np. nowy endpoint API + migracja Supabase + komponent React) z 3 wstrzykniętymi wadami: brak RLS na nowej tabeli, brak walidacji zod / brakujące `prerender = false`, brak cleanupu w `useEffect`.
- Asercje: `is-json`, `javascript` (twardy warunek na `verdict === "fail"`), `llm-rubric` (czy recenzja wykryła każdą z trzech wstrzykniętych wad).
- Nie wpinane do CI na tym etapie — narzędzie deweloperskie do porównywania modeli/promptów.
