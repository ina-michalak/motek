<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Dodawanie i przeglądanie biblioteki włóczek

- **Plan**: context/changes/add-and-browse-yarn-library/plan.md
- **Zakres**: Faza 2 z 5
- **Data**: 2026-08-23
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 0 obserwacji

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | WARNING |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | PASS |

## Ustalenia

### F1 — attachYarnPhoto może zostawiać osierocone pliki w Storage

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/services/yarns.ts:91-97
- **Szczegóły**: Dwa scenariusze. (a) Jeśli UPDATE na `yarns.photo_url` nie dopasuje żadnego wiersza (np. zły `yarnId`, albo RLS odrzuci dopasowanie), Supabase nie zwraca błędu przy 0 zaktualizowanych wierszach — funkcja zgłasza sukces, a wgrany plik zostaje osierocony w buckecie bez żadnego rekordu, który na niego wskazuje. (b) Przy podmianie zdjęcia (drugie wywołanie dla tego samego `yarnId` z nową nazwą pliku) poprzedni obiekt pod starą ścieżką nigdy nie jest usuwany — bucket rośnie bez ograniczeń wraz z każdą podmianą zdjęcia.
- **Poprawka A ⭐ Zalecana**: Po `update` zweryfikować liczbę dotkniętych wierszy (`.select()` lub `{ count: "exact" }`) i przy 0 lub błędzie usunąć wcześniej wgrany plik (`storage.remove([path])`); przy podmianie zdjęcia usunąć poprzedni obiekt przed zapisaniem nowej ścieżki.
  - Siła: Zamyka oba scenariusze, zgodne z zasadą "nie zostawiaj częściowego/niespójnego stanu" z krytycznych szczegółów planu.
  - Kompromis: Dodatkowe zapytania/round-tripy przy każdym dołączeniu zdjęcia.
  - Pewność: HIGH — Supabase Storage/Postgres API wspiera to wprost, brak nieznanych.
  - Martwy punkt: Brak znaczących.
- **Poprawka B**: Zaakceptować jako znane ograniczenie MVP (mała skala, brak zadania sprzątającego w najbliższym czasie) i odłożyć do przyszłej fazy.
  - Siła: Zero dodatkowej pracy teraz, spójne z tonem NFR w planie ("brak specjalnych wymagań" przy tej skali).
  - Kompromis: Ciche narastanie śmieci w Storage; błąd w warstwie wywołującej (np. spoofing `yarnId` w Fazie 3) byłby trudny do wykrycia później.
  - Pewność: MEDIUM — nie zweryfikowano, jak często w praktyce będą podmiany zdjęć.
  - Martwy punkt: Brak informacji o docelowej częstotliwości edycji zdjęć.
- **Decyzja**: FIXED via Fix A — weryfikacja liczby dotkniętych wierszy po update (rollback uploadu przy 0/błędzie) + usuwanie poprzedniego pliku przy podmianie zdjęcia.

### F2 — resolveYarnPhotoUrl połyka błąd Supabase wbrew ogólnej umowie fazy

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/lib/services/yarns.ts:16-25 (linia 23)
- **Szczegóły**: "Umowa" Fazy 2 mówi ogólnie: "Błąd Supabase (`{ error }`) jest propagowany do wywołującego, nie połykany." `resolveYarnPhotoUrl` robi `if (error) return null` — błąd generowania signed URL jest cicho zamieniany na "brak zdjęcia", bez logowania. To jedyne miejsce w pliku, gdzie błąd Supabase nie jest rzucany dalej. Zachowanie samo w sobie ma sens (jedno zepsute zdjęcie nie powinno wywalać całej listy/szczegółów włóczki), ale odbiega od litery planu i dziś nie zostawia żadnego śladu do diagnozy (np. źle skonfigurowany bucket przejdzie niezauważony).
- **Poprawka A ⭐ Zalecana**: Zostaw soft-fail (return null), ale dodaj `console.warn` z błędem przed zwróceniem `null`, żeby awaria była widoczna w logach bez psucia UX.
  - Siła: Zachowuje sensowne zachowanie (jedno zdjęcie nie wywala strony), a jednocześnie realizuje intencję "nie połykaj po cichu" z planu.
  - Kompromis: Log na `no-console: warn` — zgodnie z regułą eslint w tym repo (ostrzeżenie, nie błąd), więc nie zepsuje lintu.
  - Pewność: HIGH — minimalna, lokalna zmiana.
  - Martwy punkt: Brak znaczących.
- **Poprawka B**: Propaguj błąd (`throw error`) tak jak wszystkie inne funkcje w pliku, dokładnie zgodnie z literą planu.
  - Siła: W 100% zgodne z planem, spójne z resztą pliku.
  - Kompromis: Jedno zepsute zdjęcie (np. wygasły signed URL config) wywali cały odczyt listy/szczegółów włóczki — gorszy UX niż warty tego, biorąc pod uwagę, że zdjęcie jest polem opcjonalnym w całym projekcie.
  - Pewność: MEDIUM — zależy, jak bardzo priorytetowa jest litera planu vs. UX.
  - Martwy punkt: Brak sprawdzenia, jak strony wywołujące (Faza 5) obsłużyłyby taki wyjątek.
- **Decyzja**: FIXED via Fix A — dodano `console.warn` przed `return null`, soft-fail zachowany.

### F3 — getYarnById nie przyjmuje userId, inaczej niż pozostałe funkcje serwisu

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/lib/services/yarns.ts:45
- **Szczegóły**: `listYarns`, `createYarn` i `attachYarnPhoto` przyjmują `userId` jako parametr; `getYarnById` — nie, zgodnie z planem ("getYarnById jednak filtruje też po id"). Bezpieczeństwo jest dziś w pełni zachowane przez RLS, więc to nie jest luka — ale sygnatura jest niespójna z resztą pliku, i gdyby kiedyś ta funkcja została wywołana klientem z uprawnieniami service-role (bez RLS), nic w kodzie by tego nie złapało.
- **Poprawka**: Rozważyć w Fazie 5 (gdy funkcja realnie zacznie być wywoływana) dodanie `userId` i jawnego `.eq("user_id", userId)` dla spójności API i defense-in-depth — nie wymaga zmiany teraz.
- **Decyzja**: SKIPPED — plan wprost specyfikuje sygnaturę `getYarnById(supabase, id)` i Faza 5 ma ją wywoływać jako `getYarnById(supabase, Astro.params.id)`; RLS już w pełni chroni ten odczyt, więc zmiana teraz byłaby odejściem od zaplanowanej sygnatury bez realnej korzyści bezpieczeństwa.

## Uwagi dodatkowe (bez zgłoszenia jako ustalenie)

- Typy (`Yarn`, `CreateYarnInput`) w pełni zgodne z kolumnami migracji i użyciem w serwisie.
- Rzutowania `as {...}` po zapytaniach Supabase są uzasadnione — projekt nie ma wygenerowanego typu `Database`, więc `.from("yarns")` zwraca dane nietypowane; rzutowania nie maskują żadnego realnego błędu.
- `sanitizeFileName` skutecznie neutralizuje ryzyko path traversal w ścieżce obiektu Storage.
- N+1 wywołań `createSignedUrl` w `listYarns` (jedno na włóczkę) — w pełni akceptowalne przy docelowej skali z PRD (dziesiątki włóczek/user), nie wymaga cache'owania w tej fazie.
- Obsługa błędów Supabase (poza F2) konsekwentnie `throw`, zgodnie z konwencją service layer.

## Kryteria sukcesu

- **Automatyczne**: `npx astro check` (0 błędów) i lint pliku `src/lib/services/yarns.ts` (0 błędów) zweryfikowane podczas implementacji tej fazy — PASS.
- **Ręczne**: punkt 2.3 pozostaje świadomie niezaznaczony — użytkownik zdecydował odłożyć weryfikację do Fazy 3/5, co plan wprost dopuszcza. Traktowane jako OCZEKUJĄCE, nie FAIL.
