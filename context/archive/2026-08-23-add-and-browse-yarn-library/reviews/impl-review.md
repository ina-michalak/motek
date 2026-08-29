<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Dodawanie i przeglądanie biblioteki włóczek

- **Plan**: context/changes/add-and-browse-yarn-library/plan.md
- **Zakres**: Faza 5 z 5 (pełny przegląd całego slice'a + poprawki UX dodane po epilogu)
- **Data**: 2026-08-29
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 2 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | WARNING |
| Dyscyplina zakresu | WARNING |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Kryteria sukcesu | WARNING |

## Kryteria sukcesu — weryfikacja automatyczna

- `npm run lint` (pliki tej funkcji) — PASS (0 błędów, 3 istniejące ostrzeżenia `no-console`)
- `npx astro check` — PASS (0 błędów)
- `npm run build` — PASS

## Ustalenia

### F1 — Niespójne zawężanie po `user_id` w `src/lib/services/yarns.ts`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/lib/services/yarns.ts:101-119 (por. 30-58)
- **Szczegóły**: Plan (Faza 2) mówi wprost, że `listYarns`/`getYarnById` mają polegać wyłącznie na RLS, bez ręcznego filtra `user_id`, a `getYarnById` ma mieć sygnaturę `(supabase, id)`. W kodzie obie funkcje jednak filtrują explicit po `user_id`, a `getYarnById` ma sygnaturę `(supabase, userId, id)` — to udokumentowana poprawka z wcześniejszego przeglądu Fazy 5 (commit `9186b73`), nie przeoczenie. Problem: ta sama warstwa defense-in-depth NIE została zastosowana w `attachYarnPhoto` (linie 101-105, 115-119) — `select` i `update` filtrują tam tylko po `id`, nie po `user_id`. Dziś nieszkodliwe (RLS chroni, a `yarnId` pochodzi zawsze ze świeżo wstawionego, własnego wiersza), ale niespójne w obrębie tego samego pliku — jeśli w przyszłości (S-03: edycja) coś wywoła `attachYarnPhoto` z ID cudzej włóczki albo klientem service-role, zabraknie zabezpieczenia na poziomie aplikacji.
- **Poprawka A ⭐ Zalecana**: Dodaj `.eq("user_id", userId)` do obu zapytań w `attachYarnPhoto`, ujednolicając wzorzec z resztą pliku.
  - Siła: Jedna spójna reguła w całym serwisie; przygotowuje grunt pod bezpieczne dodanie edycji (S-03).
  - Kompromis: Drobna zmiana — dwie linie, bez wpływu na obecne działanie.
  - Pewność: HIGH — dokładnie ten sam wzorzec już istnieje w dwóch innych funkcjach tego pliku.
  - Martwy punkt: Brak znaczących.
- **Poprawka B**: Zostaw jak jest, udokumentuj w planie jako świadomie zaakceptowane odejście (RLS wystarcza).
  - Siła: Zero zmian w kodzie.
  - Kompromis: Zostawia niespójność wzorca w jednym pliku; przyszła edycja będzie musiała pamiętać o dodaniu filtra.
  - Pewność: MEDIUM — RLS faktycznie chroni dziś, ale to założenie kruche przy przyszłych zmianach.
  - Martwy punkt: Nie sprawdzono, czy S-03 jest blisko w roadmapie.
- **Decyzja**: FIXED (Poprawka A) — dodano `.eq("user_id", userId)` do select/update w `attachYarnPhoto`.

### F2 — Brak informacji dla użytkownika przy nieudanym uploadzie zdjęcia

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/yarns.ts:63-69
- **Szczegóły**: Gdy `attachYarnPhoto` rzuci błąd po udanym utworzeniu włóczki, endpoint loguje tylko `console.warn` i przekierowuje na `/dashboard` tak, jakby wszystko się udało — użytkownik nie dowiaduje się, że zdjęcie się nie zapisało. Plan świadomie akceptuje "soft-fail" (wiersz bez zdjęcia), ale nie precyzuje informowania użytkownika — to nie jest złamanie planu, tylko luka jakościowa.
- **Poprawka A ⭐ Zalecana**: Przekaż ostrzeżenie przez query param (`/dashboard?warning=...`) i wyświetl je na dashboardzie, analogicznie do istniejącego wzorca `?error=` na `/yarns/new`.
  - Siła: Reużywa istniejący wzorzec komunikatów w projekcie; user od razu wie, że coś wymaga uwagi.
  - Kompromis: Dotyka dwóch plików (api/yarns.ts + dashboard.astro).
  - Pewność: MED — wzorzec komunikatu istnieje, ale dashboard nie ma dziś miejsca na komunikaty ogólne.
  - Martwy punkt: Nie sprawdzono, czy jest już gdzieś w UI miejsce na non-blocking notyfikacje.
- **Poprawka B**: Zaakceptuj ciche soft-fail zgodnie z literą planu — brak zmian.
  - Siła: Zero dodatkowej pracy, zgodne z tym, co plan faktycznie obiecywał.
  - Kompromis: User nie dowie się, że zdjęcie zniknęło, dopóki sam nie zauważy braku na karcie.
  - Pewność: HIGH — to dosłownie to, co plan opisuje.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: FIXED (Poprawka A) — `src/pages/api/yarns.ts` przekierowuje na `/dashboard?warning=...` przy nieudanym uploadzie, `src/pages/dashboard.astro` wyświetla banner ostrzeżenia.

### F3 — Poprawki UX z tej sesji nie są udokumentowane w planie

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: src/components/yarn/AddYarnForm.tsx, CompositionRows.tsx, PhotoDropzone.tsx (nowy), src/lib/numeric-input.ts (nowy)
- **Szczegóły**: 6 zmian UX (kolejność Producent/Nazwa, blokada liter/wartości ujemnych w polach numerycznych, domyślny 1 wiersz składu, drag&drop na zdjęcie, naprawa braku komunikatu błędu dla druty/szydełko) zostało wprowadzonych po zamknięciu planu (epilog już scommitowany), na wyraźną prośbę użytkowniczki w rozmowie — nie są opisane w żadnym pliku planu. Zweryfikowane jako poprawnie zaimplementowane (patrz raport podagenta Plan Adherence), ale formalnie to rozszerzenie zakresu poza `plan.md`.
- **Poprawka A ⭐ Zalecana**: Dopisz krótki aneks do `plan.md` (lub notatkę w `change.md`) dokumentujący te 6 zmian jako świadome post-epilogowe poprawki UX.
  - Siła: Przyszły przegląd albo ktoś czytający historię zmiany zobaczy pełny obraz bez grzebania w konwersacji.
  - Kompromis: Drobna praca dokumentacyjna nad już zamkniętym planem.
  - Pewność: HIGH — to dokładnie wzorzec aneksu już używany w tym repo (commity "przegląd Fazy N" dopisywane po epilogu).
  - Martwy punkt: Brak znaczących.
- **Poprawka B**: Zostaw bez dokumentowania — commit message i ten raport wystarczą jako ślad.
  - Siła: Zero dodatkowej pracy.
  - Kompromis: `plan.md` przestaje być pełnym źródłem prawdy o tym, co faktycznie istnieje w `AddYarnForm`.
  - Pewność: MEDIUM.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: FIXED (Poprawka A) — aneks dopisany do `change.md`.

### F4 — Brak limitów rozmiaru/MIME na poziomie Storage bucket

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: supabase/migrations/20260823130000_create_yarn_photos_bucket.sql:5-6
- **Szczegóły**: Bucket `yarn-photos` nie ma ustawionych `file_size_limit`/`allowed_mime_types` na poziomie Storage — limity (5MB, JPEG/PNG/WEBP) istnieją tylko w warstwie aplikacji. Wystarczające dziś (upload zawsze idzie przez serwer), ale to dodatkowa warstwa obrony na przyszłość.
- **Poprawka**: Dodaj nową migrację ustawiającą `file_size_limit`/`allowed_mime_types` na buckecie `yarn-photos`.
- **Decyzja**: FIXED (niezweryfikowane lokalnie — Docker niedostępny) — `supabase/migrations/20260829140000_yarn_photos_bucket_limits.sql`.

### F5 — Kryteria 5.3/5.6 niepotwierdzone ręcznie w przeglądarce

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: context/changes/add-and-browse-yarn-library/plan.md (Progress, pozycje 5.3 i 5.6)
- **Szczegóły**: Dwa ręczne kryteria Fazy 5 nigdy nie zostały odhaczone: "5.3 Pusta biblioteka pokazuje stan pusty z CTA" i "5.6 Próba dostępu do cudzej włóczki przekierowuje bez wycieku danych". Kod potwierdza poprawną implementację obu (`src/pages/dashboard.astro:40-51` — stan pusty z CTA; `src/pages/yarns/[id].astro:16` — filtr po `user_id`+`id`, redirect na `!yarn`), ale nie udało się tego potwierdzić end-to-end w przeglądarce w tej sesji (problem z narzędziem podglądu, nie z kodem).
- **Poprawka**: Odhacz 5.3 i 5.6 w Progress po szybkim ręcznym kliknięciu w przeglądarce.
- **Decyzja**: SKIPPED — zamrożone na razie, użytkowniczka zrobi ręczny test z dwoma kontami później.
