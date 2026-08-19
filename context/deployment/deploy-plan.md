---
project: motek
approved_at: 2026-08-19
platform: Vercel
tech_stack_ref: context/foundation/tech-stack.md
infrastructure_ref: context/foundation/infrastructure.md
---

# Motek — plan integracji i wdrożenia (Cloudflare → Vercel)

## Kontekst

`context/foundation/infrastructure.md` już rozstrzygnął platformę: **Vercel** (nie Cloudflare, mimo że kod wciąż ma wpięty `@astrojs/cloudflare` w `astro.config.mjs` i plik `wrangler.jsonc`). Decyzja padła po kontroli anty-uprzedzeniowej — Cloudflare był tańszym/domyślnym wyborem, ale 10ms CPU cap na darmowym planie i luka dev/prod wokół `astro:env` przeważyły na korzyść Vercela. Ten plan realizuje krok "Plan Mode deploy" z łańcucha 10xDevs opisanego w `CLAUDE.md`: zamienić adapter, podłączyć realne zewnętrzne integracje (Supabase, GitHub Actions, Vercel) i wykonać pierwsze wdrożenie z pełną weryfikacją, zanim jakikolwiek prawdziwy użytkownik dotknie aplikacji.

Repo jest na wczesnym etapie — istnieje tylko szkielet auth (signup/signin/signout, middleware, `dashboard.astro` jako placeholder). Żadna tabela w Supabase jeszcze nie istnieje (`supabase/migrations/` nie istnieje), więc ten plan **nie** obejmuje budowy biblioteki włóczek (FR-002–009) — tylko fundament integracyjny i deploymentowy, zgodnie z `infrastructure.md` i `tech-stack.md`.

Ważne odkrycie z eksploracji: mimo że `tech-stack.md` ma flagę `has_ai: true`, funkcja "sugestii AI" (FR-007–009) w PRD jest w rzeczywistości lokalnym algorytmem dopasowania parametrów (skład, grubość, kolor) we własnej bibliotece usera — nie wywołuje żadnego zewnętrznego dostawcy LLM (brak jakichkolwiek śladów OpenAI/Anthropic/OpenRouter w repo). **Ten plan świadomie nie prowizjonuje żadnego klucza API do AI** — to nie przeoczenie.

Znaleziona rozbieżność do naprawienia po drodze: `.github/workflows/ci.yml` triguje na branch `master`, ale realna gałąź główna repo to `main` (potwierdzone w metadanych sesji), a `CLAUDE.md` też błędnie mówi o `master`.

## Faza 1 — Migracja adaptera (Cloudflare → Vercel) ✅

- [x] `npm install @astrojs/vercel@^10.0.8` (import tylko z korzenia pakietu — v10 usunęło subpath `/serverless`)
- [x] `npm uninstall @astrojs/cloudflare wrangler`
- [x] `astro.config.mjs`: zamień `import cloudflare from "@astrojs/cloudflare"` → `import vercel from "@astrojs/vercel"`, oraz `adapter: cloudflare()` → `adapter: vercel()`; `output: "server"` zostaje bez zmian
- [x] Zostaw `SUPABASE_URL`/`SUPABASE_KEY` jako `optional: true` w `env.schema` na razie — dopiero po realnym wpięciu Supabase (Faza 2) i ustawieniu zmiennych we wszystkich środowiskach Vercela (Faza 4) rozważ `optional: false`. Wcześniejsza zmiana zepsułaby lokalny dev/CI dla każdego bez skonfigurowanych zmiennych — banner "Supabase nie skonfigurowany" (`src/lib/config-status.ts`) istnieje właśnie po to, by ten stan był bezpieczny.
- [x] Usuń `wrangler.jsonc` z korzenia repo
- [x] `.gitignore`: usuń blok `# cloudflare` (`.dev.vars`, `.wrangler/`), dodaj `.vercel` (katalog tworzony przez `vercel link`/`vercel dev`, zawiera lokalne ID projektu/organizacji — nie powinien trafić do repo)
- [x] Grep po repo za pozostałościami Cloudflare: `context.locals.runtime`, `@astrojs/cloudflare`, `wrangler`, `.dev.vars` — sprawdź zwłaszcza `src/middleware.ts` i API routes. Wynik: brak trafień w `src/`; jedyne wzmianki o Cloudflare/wrangler zostały w dokumentacji (`CLAUDE.md`, `README.md`, `context/`) — poza zakresem tej fazy.
- [x] `npm install` (odśwież `package-lock.json`) i `npx astro sync` (przeregeneruj typy pod nowy adapter)
- [x] Lokalna weryfikacja: `npm run build` — sukces, wygenerował `.vercel/output/` z funkcją `_render.func` (adapter: `@astrojs/vercel`). To warunek konieczny, ale niewystarczający — realny test środowiska Vercela dopiero w Fazie 5.

## Faza 2 — Zewnętrzna integracja: Supabase (provisioning)

- [x] Utwórz zdalny projekt Supabase — projekt `motek` utworzony (region West EU/Ireland zamiast Frankfurtu — Frankfurt nie był dostępny w prostym selektorze regionu; akceptowalne, różnica rzędu kilkunastu-kilkudziesięciu ms, spory zapas względem budżetów NFR z PRD). "Automatically expose new tables" wyłączone, "Enable automatic RLS" włączone przy tworzeniu projektu.
- [x] Zapisz `Project URL` (`https://euiknkydnmjovnrpksya.supabase.co`) i klucz **anon/publishable** (nowy format `sb_publishable_...`) — zapisane lokalnie w `.env` (gitignored, nigdy nie trafiły do commitów)
- [ ] Podepnij lokalny CLI Supabase do nowego projektu: `supabase link --project-ref <ref>` — pominięte na razie, nie blokuje deploymentu; do zrobienia przed pierwszą migracją SQL
- [ ] **Przypomnienie o RLS** (twarda zasada z `CLAUDE.md`: każda nowa tabela wymaga granularnych polityk RLS per operacja/rola): dziś nie ma żadnych tabel do zabezpieczenia, ale to jest bramka na przyszłość — pierwsza migracja w `supabase/migrations/` (katalog jeszcze nie istnieje) musi od razu zawierać komplet polityk RLS w tym samym PR, nie jako follow-up
- [x] Skonfiguruj w Supabase Auth (Authentication → URL Configuration): **Site URL** = `https://motek-kappa.vercel.app` (pierwszy deployment Vercel automatycznie awansował na produkcję — patrz Faza 5), **Redirect URLs** = `https://motek-kappa.vercel.app/**` — zapisane i zweryfikowane realnym signupem.
  - **Skrajny przypadek — preview deploye**: Vercel generuje dynamiczne URL-e per branch/PR, których Supabase nie umie whitelistować wildcardem. Rekomendacja (dopasowana do solo-dev MVP): testuj pełny flow auth tylko na Production i lokalnie; nie próbuj wpuszczać preview URL-i na allowlistę. Jeśli w przyszłości to za mało — alternatywa to stały alias Vercela (`vercel alias`) wskazujący na jeden deployment brancha `develop`, dodany jako jedyny dodatkowy wpis.
- [x] Decyzja o dostarczaniu maili potwierdzających: **Opcja A** (wbudowany mailer Supabase) — potwierdzone działające, mail z realnym linkiem potwierdzającym dotarł przy pierwszym teście signupu. Przejście na własny SMTP (Opcja B) zostaje jako eskalacja, gdyby limit ~2–4 maile/h zaczął przeszkadzać (patrz Faza 6).
- [x] Dodaj `SUPABASE_URL`/`SUPABASE_KEY` do lokalnego `.env`, żeby dev wskazywał na prawdziwy projekt zamiast pustego stubu

## Faza 3 — Uzgodnienie CI / GitHub Actions

- [x] Potwierdź realną domyślną/chronioną gałąź na GitHubie — sprawdzone przez `gh repo view ina-michalak/motek --json defaultBranchRef`: **repozytorium zdalne `ina-michalak/motek` na GitHubie istnieje, ale jest puste** (`git ls-remote --heads origin` nie zwraca żadnych gałęzi) — nic jeszcze nie zostało wypchnięte. `main` zostaje przyjęte jako docelowa gałąź domyślna zgodnie z konwencją repo, ale realnie nie będzie ustawiona, dopóki pierwszy push nie utworzy tej gałęzi zdalnie.
- [x] Napraw `.github/workflows/ci.yml`: `branches: [master]` → `[main]` (dla `push` i `pull_request`)
- [x] Napraw tę samą literówkę w `CLAUDE.md` (linia o "runs lint + build on every push and PR to master")
- [x] `SUPABASE_URL`/`SUPABASE_KEY` ustawione jako sekrety GitHub Actions (`gh secret set`), te same wartości co w Vercelu
- [ ] Nie dodawaj żadnych kroków Vercel CLI do `ci.yml` — integracja GitHub Vercela (Faza 4) obsługuje deploy niezależnie od tego workflow; `ci.yml` pozostaje czystą bramką lint/build
- [ ] Zweryfikuj, że `npm run build` w CI nadal przechodzi po zmianie adaptera (nowy kształt outputu: `.vercel/output/` zamiast `dist/`) — sprawdzi się to automatycznie, gdy PR z Fazy 1 przejdzie przez poprawiony workflow

## Faza 4 — Konfiguracja projektu Vercel

- [x] `npm i -g vercel`, `vercel login`, `vercel link` z korzenia repo — projekt utworzony jako `im-6b4e/motek`, lokalny `.vercel/project.json` utworzony (zignorowany w Fazie 1)
- [x] Podłącz repozytorium GitHub przez integrację Vercela — pierwsza próba (`vercel link`/`vercel git connect`) nieudana, bo zdalne repo było jeszcze puste; po wypchnięciu `develop`+`main` i zmianie domyślnego brancha GitHuba na `main`, połączenie przez dashboard (Project Settings → Git → Connect Git Repository) zadziałało.
- [x] Branch produkcyjny w Vercelu: **potwierdzone przez API** (`GET /v9/projects/{id}` → `link.productionBranch: "main"`) — ustawiony automatycznie od domyślnego brancha GitHuba w momencie łączenia, nowszy dashboard nie ma już osobnego pola do tego w UI
- [x] Utwórz `vercel.json` w korzeniu repo z `{ "regions": ["fra1"] }`
- [x] Skonfiguruj zmienne środowiskowe w dashboardzie Vercela (przez CLI: `vercel env add`), osobno dla Production / Preview / Development: `SUPABASE_URL`, `SUPABASE_KEY` — wszystkie 6 kombinacji dodane
- [x] **Decyzja o izolacji danych w Preview**: podjęta — Preview wskazuje na ten sam projekt Supabase co Production (brak jeszcze realnych danych userów/tabel biblioteki). **Przypomnienie na przyszłość**: w chwili gdy powstaną tabele biblioteki (FR-002+), przed wypuszczeniem realnych danych osobnych trzeba założyć osobny projekt Supabase pod Preview/staging.
- [ ] Zanotuj zastrzeżenie ToS planu Hobby ("non-commercial use") jako punkt decyzyjny, nie akcję: jeśli kiedykolwiek pojawi się monetyzacja (nawet dobrowolne napiwki), upgrade do Pro ($20/mo) zanim ta funkcja wejdzie na produkcję, nie po fakcie

## Faza 5 — Pierwszy deploy i weryfikacja

- [x] Wypchnij zmiany z Faz 1–4 na `develop`, otwórz PR do `main` — CI zielone (https://github.com/ina-michalak/motek/pull/1). **Odchylenie od planu**: pierwszy deployment w ogóle dla tego projektu Vercel automatycznie awansował na produkcję (`readySubstate: PROMOTED`), mimo że kod poszedł z `develop`, nie z `main` — to udokumentowane zachowanie Vercela przy zupełnie pierwszym deployu (bootstrap aliasu produkcyjnego), nie błąd konfiguracji. Kolejne pushe na `develop` będą już poprawnie trafiać jako Preview.
- [x] Pełny smoke test flow autoryzacji na realnym środowisku Vercela (`https://motek-kappa.vercel.app`), wykonany częściowo ręcznie przez użytkownika, częściowo zweryfikowany automatycznie przeglądarką:
  1. ✅ Rejestracja testowego konta na `/auth/signup` → mail potwierdzający dotarł (Opcja A, wbudowany mailer Supabase — działa)
  2. ✅ Link w mailu zadziałał, konto potwierdzone
  3. ✅ Logowanie na `/auth/signin` — potwierdzone (widoczny email + "Dashboard/Sign out" w topbarze)
  4. ✅ Middleware poprawnie odczytuje `context.locals.user` na Vercelu — zweryfikowane niezależnie: anonimowa wizyta na `/dashboard` poprawnie przekierowuje na `/auth/signin` (test z osobnej, niezalogowanej sesji przeglądarki)
  5. ✅ Wylogowanie przez `/api/auth/signout` potwierdzone — powrót do stanu niezalogowanego
- [x] Potwierdzone: banner "Supabase nie skonfigurowany" **nie** pojawia się — ani dla zalogowanego, ani dla anonimowego widoku
- [x] PR #1 scalony do `main` (2026-08-19T10:52Z, merge commit `5f84fa1`) — Vercel automatycznie wdrożył nowy production deployment z `main` (`motek-30gdvox9v-im-6b4e.vercel.app`, alias `motek-kappa.vercel.app`), potwierdzony `READY`, HTTP 200. Kolejny push na `develop` po tym momencie poprawnie poszedł jako Preview (nie produkcja) — potwierdza, że branch produkcyjny działa teraz zgodnie z planem.
- [x] Zapisany hash ostatniego dobrego commita: `git tag pre-deploy-20260819 5f84fa1`, wypchnięty na origin
- [x] Production i Preview używają tego samego projektu Supabase (decyzja z Fazy 4) i tej samej domeny na tym etapie — pełny smoke test z punktu wyżej już pokrył produkcję (to ta sama aplikacja, ten sam URL od pierwszego auto-promowanego deployu)
- [x] `vercel logs <deployment>` i `vercel inspect <deployment>` zweryfikowane — oba działają, zwracają realne dane (logi requestów, aliasy, status)

## Faza 6 — Skrajne przypadki i dodatkowe kroki wsparcia

- [ ] **Cicha regresja migracji adaptera tylko na produkcji**: zaadresowane proceduralnie przez wymóg smoke testu preview→produkcja w Fazie 5; nie pomijaj tego testu nawet przy "drobnych" zmianach tuż po migracji
- [ ] **Próg rewizji ToS planu Hobby**: jasno zdefiniowany trigger — moment, w którym jakakolwiek płatna funkcja (nawet napiwki) trafia do zakresu, upgrade do Pro musi nastąpić przed wdrożeniem tej funkcji, nie po
- [ ] **Procedura rollbacku**: `vercel rollback` cofa tylko jeden deployment. Dla starszej regresji: znajdź zapisany hash ostatniego dobrego commita (Faza 5) i zrób redeploy tego konkretnego commita (branch roboczy + `vercel --prod`, albo "redeploy" konkretnego wcześniejszego deploymentu z dashboardu) zamiast wielokrotnych `vercel rollback`. Migracje schematu Supabase nigdy nie cofają się automatycznie z kodem — jeśli zły deploy zawierał migrację, wymaga to osobnej migracji cofającej
- [ ] **Wzorzec uploadu zdjęć (na przyszłość, FR-002)**: zdecyduj już teraz, że upload zdjęć włóczki pójdzie bezpośrednio z klienta do Supabase Storage przez podpisany URL, nie przez funkcję Vercela jako proxy — omija to limit 4.5MB na body requestu na planie Hobby, zamiast obchodzić go później. Zapisz to jako ograniczenie dla przyszłej implementacji FR-002.
- [ ] **Limit maili Supabase wyczerpany podczas testów**: jeśli maile potwierdzające przestaną przychodzić podczas smoke testów (najpewniej limit ~2–4/h), fallback: (a) poczekaj na reset limitu, (b) ręcznie potwierdź testowe konto w dashboardzie Supabase (Authentication → Users), (c) jeśli testowanie tego wymaga częściej — eskaluj do własnego SMTP (opcja B z Fazy 2). Nie zużywaj limitu powtarzanymi pełnymi testami e2e — po pierwszym potwierdzeniu, że dostarczanie maili działa, kolejne konta testowe potwierdzaj ręcznie.
- [ ] **Brak integracji AI/LLM — świadomie**: mimo flagi `has_ai: true` w `tech-stack.md`, funkcja sugestii zamienników (FR-007–009) to lokalny algorytm dopasowania parametrów, bez wywołań zewnętrznego dostawcy LLM (patrz Business Logic w PRD + jawny non-goal "uczenia się gustu"). Ten plan **nie** prowizjonuje żadnego klucza API do AI. Jeśli taki krok pojawi się w przyszłej iteracji tego planu albo w zmiennych środowiskowych Vercela, potraktuj to jako błąd zakresu i zweryfikuj z PRD przed wykonaniem.

## Weryfikacja końcowa

Po Fazie 5 aplikacja powinna: (1) budować się i wdrażać z adaptera Vercel bez błędów, (2) obsługiwać pełny cykl signup → mail potwierdzający → signin → `/dashboard` → signout zarówno na preview, jak i na produkcji, (3) mieć zielony CI na poprawionym branchu, (4) nie pokazywać bannera "Supabase nie skonfigurowany" na żadnym środowisku, (5) odpowiadać z regionu `fra1`. Dodatkowo: hash ostatniego dobrego commita zapisany przed promocją produkcyjną, a `vercel logs`/`vercel inspect` potwierdzone jako działające narzędzia diagnostyczne.

### Kluczowe pliki
- `astro.config.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- `wrangler.jsonc` (do usunięcia)
- `.gitignore`
- `vercel.json` (do utworzenia)
- `src/pages/api/auth/signup.ts`
- `src/lib/supabase.ts`, `src/middleware.ts`, `src/lib/config-status.ts`
- `CLAUDE.md` (literówka master→main)
