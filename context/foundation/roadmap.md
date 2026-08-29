---
project: "Motek"
version: 1
status: draft
created: 2026-08-19
updated: 2026-08-23
prd_version: 1
main_goal: market-feedback
top_blocker: capacity
---

# Mapa drogowa: Motek

> Wygenerowano z `context/foundation/prd.md` (v1) + automatycznie zbadana baza kodu.
> Edytuj na miejscu; archiwizuj, gdy zostanie zastąpiona.
> Fragmenty poniżej są wymienione w kolejności zależności. Tabela "W skrócie" jest indeksem.

## Podsumowanie wizji

Rękodzielniczki i rękodzielnicy z zapasem włóczki (30+ motków) nie mają wygodnego sposobu na przechowywanie i przeszukiwanie swojej kolekcji — fizyczne przekopywanie zapasu prowadzi do bałaganu, zbędnych zakupów duplikatów i utraty subiektywnych notatek o włóczce (czy drapie, jaki daje przelicznik oczek). Ogólne narzędzia (arkusze, notatki) i platformy społecznościowe jak Ravelry nie rozumieją specyfiki dziedziny ani nie podpowiadają zamienników na podstawie tego, co user faktycznie posiada.

## Gwiazda przewodnia

**S-02: Użytkownik widzi sugestie AI zamienników i akceptuje lub odrzuca je** — to jedyna historyjka użytkownika w PRD (US-01) i jedyny fragment bezpośrednio mierzony Kryterium Sukcesu Primary (75% akceptacji sugestii).

> Gwiazda przewodnia — jednowierszowe wyjaśnienie: najmniejszy kompleksowy fragment, którego pomyślne dostarczenie udowadnia podstawową hipotezę produktu (czy dopasowanie zamienników z własnej biblioteki faktycznie trafia w gusta użytkownika). Umieszczona tak wcześnie, jak pozwala na to jej jedyne wymaganie wstępne (S-01), ponieważ wszystko inne ma znaczenie tylko wtedy, gdy to działa.

## W skrócie

| ID   | ID zmiany                    | Wynik (użytkownik może…)                                              | Wymagania wstępne | Odniesienia do PRD          | Status   |
| ---- | ----------------------------- | ---------------------------------------------------------------------- | ------------------ | ---------------------------- | -------- |
| F-01 | yarn-data-foundation          | (fundament) schemat danych biblioteki włóczek z RLS wdrożony            | —                   | Guardrail, NFR (izolacja)     | done |
| S-01 | add-and-browse-yarn-library   | dodać włóczkę i przeglądać swoją bibliotekę                            | F-01                | FR-002, FR-003, US-01         | in-progress |
| S-02 | ai-substitute-suggestions     | zobaczyć sugestie AI zamienników i zaakceptować/odrzucić je            | S-01                | FR-007, FR-008, FR-009, US-01 | proposed |
| S-03 | manage-saved-yarn-entry       | edytować zapisaną włóczkę (w tym oznaczyć jako wyczerpaną) lub usunąć  | S-01                | FR-005, FR-006                | proposed |
| S-04 | filter-and-sort-yarn-library  | filtrować i sortować listę włóczek                                     | S-01                | FR-004                        | proposed |

## Baza

Co już jest na miejscu w bazie kodu na dzień `2026-08-19` (automatycznie zbadane + potwierdzone przez użytkownika).
Fundamenty poniżej zakładają, że te elementy są obecne i NIE tworzą ich ponownie.

- **Frontend:** obecny — Astro 6 + React 19 + Tailwind 4 + shadcn/ui, ale tylko strony auth i pusty dashboard (`src/pages/index.astro`, `src/pages/dashboard.astro`) — brak jeszcze widoków biblioteki włóczek.
- **Backend / API:** częściowy — wzorzec API ustalony (`src/pages/api/auth/{signin,signout,signup}.ts`), ale brak endpointów domenowych (włóczki, zamienniki).
- **Dane:** nieobecny — brak katalogu `supabase/migrations`, brak schematu tabel dla włóczek/zamienników, brak `src/types.ts`.
- **Auth:** obecny — pełny flow rejestracji/logowania/wylogowania (`src/pages/api/auth/*`, `src/pages/auth/*`), middleware z ochroną tras (`src/middleware.ts`), potwierdzenie emaila, klient Supabase SSR (`src/lib/supabase.ts`).
- **Wdrożenie / infrastruktura:** obecny — adapter Vercel skonfigurowany (`astro.config.mjs`), CI lint+build (`.github/workflows/ci.yml`), zatwierdzony plan wdrożenia w `context/deployment/deploy-plan.md`.
- **Obserwowalność:** nieobecny — brak bibliotek logowania błędów/monitoringu.

**Uwaga dot. pokrycia PRD:** FR-001 (rejestracja i logowanie email+hasło) jest już w pełni zaimplementowane — widoczne w bazie jako warstwa Auth "obecna" (pełny flow signup/signin/signout + middleware). Zgodnie z zasadą, że fundament nie odtwarza warstwy zgłoszonej jako obecna, FR-001 **nie** otrzymuje własnego elementu mapy drogowej — nie ma już żadnej pracy do zaplanowania w tym zakresie.

## Fundamenty

### F-01: Fundament danych biblioteki włóczek

- **Wynik:** (fundament) tabela włóczek z politykami RLS (izolacja danych między kontami) oraz podstawowy model typów (`src/types.ts`) wdrożone — gotowe do zapisu i odczytu wpisów.
- **ID zmiany:** yarn-data-foundation
- **Odniesienia do PRD:** Guardrail ("dane biblioteki widoczne wyłącznie dla właściciela konta"), NFR (izolacja danych między użytkownikami)
- **Odblokowuje:** S-01, S-03, S-04 (wszystkie operują bezpośrednio na tabeli włóczek); zmniejsza niewiadomą, czy schemat udźwignie parametry potrzebne do dopasowania w S-02
- **Wymagania wstępne:** —
- **Równolegle z:** —
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** Baza kodu potwierdza całkowity brak schematu danych — to jedyny fundament na tej mapie drogowej i musi być gotowy, zanim jakikolwiek pionowy fragment będzie mógł cokolwiek zapisać; słaby projekt tabeli spowoduje przeróbki w każdym fragmencie w dół.
- **Status:** done

## Fragmenty

### S-01: Użytkownik dodaje włóczkę i przegląda swoją bibliotekę

- **Wynik:** użytkownik dodaje włóczkę do biblioteki (pola wymagane: nazwa, producent, ilość; pola opcjonalne: kolor, farbowanie, skład, druty/szydełko, próbka, ocena/notatka, zdjęcie) i widzi listę własnych włóczek.
- **ID zmiany:** add-and-browse-yarn-library
- **Odniesienia do PRD:** FR-002, FR-003, US-01 (część "When dodaje kolejną włóczkę")
- **Wymagania wstępne:** F-01
- **Równolegle z:** —
- **Blokady:** —
- **Niewiadome:**
  - Jak formularz dodawania włóczki powinien poprowadzić usera do rozdzielenia nazwy i producenta (np. "Drops Karisma")? — Właściciel: user/projektant UX. Blokuje: nie.
- **Ryzyko:** Pierwszy fragment, który faktycznie zapisuje dane do nowego schematu (F-01) — tu wyjdą na jaw ewentualne braki w projekcie tabeli, zanim dotkną kolejnych fragmentów.
- **Status:** in-progress

### S-02: Użytkownik widzi sugestie AI zamienników i akceptuje lub odrzuca je

- **Wynik:** użytkownik otwiera szczegóły włóczki i widzi sekcję zamienników z sugestiami AI wygenerowanymi z własnej biblioteki; może każdą sugestię zaakceptować (dodać jako zamiennik) albo trwale odrzucić.
- **ID zmiany:** ai-substitute-suggestions
- **Odniesienia do PRD:** FR-007, FR-008, FR-009, US-01 (pełny przepływ), Success Criteria — Primary
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-03, S-04
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** To jest gwiazda przewodnia — najbardziej ryzykowna hipoteza produktu (czy dopasowanie parametrów daje trafne sugestie) jest tu testowana po raz pierwszy; słaby wynik podważa całe założenie produktu, dlatego fragment jest sekwencjonowany tak wcześnie, jak pozwala na to jego jedyne wymaganie wstępne (S-01).
- **Status:** proposed

### S-03: Użytkownik zarządza zapisaną włóczką

- **Wynik:** użytkownik edytuje dane zapisanej włóczki — w tym ustawia ilość na 0, sygnalizując wyczerpanie — albo usuwa włóczkę ze swojej biblioteki.
- **ID zmiany:** manage-saved-yarn-entry
- **Odniesienia do PRD:** FR-005, FR-006
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-04
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** Niska złożoność techniczna, ale ważne dla wiarygodności danych w czasie — bez edycji ilości biblioteka szybko traci aktualność, co osłabia Kryterium Sukcesu Secondary (powracający użytkownicy).
- **Status:** proposed

### S-04: Użytkownik filtruje i sortuje listę włóczek

- **Wynik:** użytkownik zawęża i porządkuje listę własnych włóczek według wybranych parametrów.
- **ID zmiany:** filter-and-sort-yarn-library
- **Odniesienia do PRD:** FR-004
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-03
- **Blokady:** —
- **Niewiadome:**
  - Które konkretnie parametry sortowania są potrzebne na start? (PRD dopuszcza, by sortowanie na starcie nie obejmowało wszystkich parametrów) — Właściciel: user. Blokuje: nie.
- **Ryzyko:** Wartość rośnie wraz z wielkością biblioteki (docelowa persona ma 30+ motków) — przy małej liczbie testowych włóczek na start ryzyko niskiej użyteczności jest niewielkie, ale odkładanie tego fragmentu zbyt daleko utrudnia korzystanie z rosnącej biblioteki.
- **Status:** proposed

## Przekazanie do backlogu

| ID mapy drogowej | ID zmiany                   | Sugerowany tytuł zadania                                         | Gotowe do `/10x-plan` | Uwagi                                              |
| ----------------- | ---------------------------- | ------------------------------------------------------------------ | ---------------------- | --------------------------------------------------- |
| F-01               | yarn-data-foundation         | Zaprojektować schemat danych biblioteki włóczek (tabela + RLS)     | yes                    | Jedyny fundament na mapie — odblokowuje wszystko poniżej |
| S-01               | add-and-browse-yarn-library  | Dodawanie i przeglądanie biblioteki włóczek                        | no                      | Czeka na F-01                                        |
| S-02               | ai-substitute-suggestions    | Sugestie AI zamienników z akceptacją/odrzuceniem                   | no                      | Gwiazda przewodnia — czeka na S-01                   |
| S-03               | manage-saved-yarn-entry      | Edycja i usuwanie zapisanej włóczki                                 | no                      | Czeka na S-01; równoległe z S-02, S-04               |
| S-04               | filter-and-sort-yarn-library | Filtrowanie i sortowanie biblioteki włóczek                        | no                      | Czeka na S-01; równoległe z S-02, S-03               |

## Otwarte pytania dotyczące mapy drogowej

Brak pytań przekrojowych (obejmujących wiele fragmentów) w tej chwili. Jedyne otwarte pytanie z PRD dotyczy konkretnie formularza dodawania włóczki i znajduje się przy niewiadomych fragmentu S-01. Pytanie o zakres sortowania (S-04) jest lokalne dla tego fragmentu.

## Zaparkowane

- **Dodawanie projektów (swetry, czapki itp.) i rekomendacje projektów do włóczki** — Dlaczego zaparkowane: PRD §Non-Goals — osobny temat, poza zakresem MVP skupionego na bibliotece włóczek.
- **Rekomendacje zamienników spoza własnej biblioteki usera** — Dlaczego zaparkowane: PRD §Non-Goals — AI sugeruje wyłącznie z tego, co user sam dodał.
- **Współdzielenie/interakcje między użytkownikami** — Dlaczego zaparkowane: PRD §Non-Goals — brak funkcji społecznościowych, każda biblioteka jest prywatna i odizolowana.
- **Masowe dodawanie włóczek na podstawie faktur/paragonów** — Dlaczego zaparkowane: PRD §Non-Goals — włóczki dodaje się ręcznie, pojedynczo.
- **Aplikacja mobilna** — Dlaczego zaparkowane: PRD §Non-Goals — na start tylko web.
- **Uczenie się ogólnych preferencji usera z historii decyzji ("AI uczące się gustu")** — Dlaczego zaparkowane: PRD §Non-Goals — zamiast tego proste dopasowanie parametrów + trwałe odrzucenie danej pary.
- **Sugestie zamienników na podstawie szerszej bazy danych o włóczkach z internetu** — Dlaczego zaparkowane: shape-notes §Forward — świadomie odłożone poza MVP.
- **Wyjaśnienie userowi "dlaczego to jest rekomendacja"** — Dlaczego zaparkowane: shape-notes §Forward — nie blokuje MVP, do rozważenia jako rozszerzenie.

## Zrobione

- **F-01: (fundament) schemat danych biblioteki włóczek z RLS wdrożony** — Archived 2026-08-23 → `context/archive/2026-08-23-yarn-data-foundation/`. Lesson: —.
