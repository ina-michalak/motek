<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Zarządzanie zapisaną włóczką (S-03)

- **Plan**: context/changes/manage-saved-yarn-entry/plan.md
- **Zakres**: Faza 3 z 3 (pełny przegląd planu — wszystkie fazy ukończone)
- **Data**: 2026-08-31
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 4 ostrzeżenia, 2 obserwacje

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

### F1 — Kolejność storage.remove vs delete wiersza w `deleteYarn` odwrócona względem opisu w planie

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/lib/services/yarns.ts:152-178
- **Szczegóły**: Plan opisywał kolejność: odczyt `photo_url` → `storage.remove` (best-effort, warn) → `delete` wiersza w DB. Rzeczywisty kod robi: odczyt `photo_url` → `delete` wiersza w DB (z weryfikacją, że dopasowano dokładnie 1 rekord) → dopiero potem `storage.remove`. Krytyczna zasada planu ("odczyt photo_url musi być przed delete") jest zachowana, ale kolejność storage/DB jest odwrócona. Praktycznie obecna kolejność jest bezpieczniejsza — nie kasuje pliku ze Storage, dopóki nie ma potwierdzenia, że wiersz naprawdę zniknął z bazy — ale to odejście od dosłownego opisu w planie.
- **Poprawka**: Zaktualizować opis kroku "Kolejność w usuwaniu" w planie, żeby odzwierciedlał faktyczną (bezpieczniejszą) kolejność — kod nie wymaga zmiany.
- **Decyzja**: FIXED — opis `deleteYarn` w plan.md (Faza 1, punkt 1) zaktualizowany, żeby odzwierciedlał faktyczną kolejność (delete → storage.remove) i wyjaśniał, dlaczego jest bezpieczniejsza.

### F2 — Błąd usunięcia zdjęcia ze Storage w `removeYarnPhoto` nigdy nie dociera do użytkownika jako ostrzeżenie

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość (Niezawodność)
- **Lokalizacja**: src/lib/services/yarns.ts:139-149, src/pages/api/yarns/[id].ts:78-86
- **Szczegóły**: `removeYarnPhoto` loguje błąd usunięcia pliku ze Storage przez `console.warn`, ale nigdy nie rzuca — więc handler POST w `[id].ts` nigdy nie wchodzi w blok `catch` dla tej ścieżki i przekierowuje na `/yarns/${id}` bez `?warning=...`. To niespójne z `attachYarnPhoto`, gdzie analogiczny błąd (nieudane przypięcie zdjęcia) poprawnie generuje ostrzeżenie widoczne dla użytkownika. Z drugiej strony, plan świadomie zaprojektował `removeYarnPhoto` jako "best-effort, nie throw", uzasadniając to tym, że osierocony plik w prywatnym folderze usera to marnotrawstwo miejsca, a nie wyciek danych ani błąd widoczny dla użytkownika (dane w DB są już poprawnie zaktualizowane).
- **Poprawka A**: Przepuść błąd Storage w `removeYarnPhoto` (throw zamiast tylko warn), żeby handler POST mógł pokazać `?warning=...` spójnie z `attachYarnPhoto`.
  - Siła: Spójna konwencja ostrzeżeń w całym API route; użytkownik dowiaduje się o niepełnym sprzątaniu.
  - Kompromis: Zmienia świadomie zaprojektowany kontrakt `removeYarnPhoto` z Fazy 1 (plan jawnie chciał "nie throw").
  - Pewność: MED — zależy, czy priorytetem jest spójność UX czy trzymanie się pierwotnej decyzji planu.
  - Martwy punkt: Nie sprawdzono, czy istnieje scenariusz, w którym ten warning wprowadziłby użytkownika w błąd (dane już poprawne, tylko plik osierocony).
- **Poprawka B ⭐ Zalecana**: Zaakceptuj obecne zachowanie — plan świadomie zaprojektował `removeYarnPhoto` jako no-throw, a efekt end-user jest nieszkodliwy (zdjęcie znika z UI; tylko fizyczny plik zostaje osierocony w prywatnym, per-user folderze Storage).
  - Siła: Zero ryzyka regresji; zgodne z jawną decyzją architektoniczną z Fazy 1.
  - Kompromis: Drobna niespójność UX między dwiema ścieżkami błędów storage (attach vs remove).
  - Pewność: HIGH — plan uzasadnia to explicite w "Krytycznych szczegółach implementacji".
  - Martwy punkt: Brak znaczących.
- **Decyzja**: ACCEPTED (Fix B) — zaakceptowano obecne zachowanie jako zgodne ze świadomą decyzją planu z Fazy 1; brak zmian w kodzie.

### F3 — Brak logowania błędu przy usuwaniu starego zdjęcia w `attachYarnPhoto`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość (Niezawodność)
- **Lokalizacja**: src/lib/services/yarns.ts:214-217
- **Szczegóły**: Usunięcie starego zdjęcia przy podmianie (`previousPath`) nie ma żadnej obsługi błędu — nawet `console.warn`, w odróżnieniu od `removeYarnPhoto` i `deleteYarn` w tym samym pliku. Ta ścieżka istniała już przed tą zmianą, ale funkcja edycji (nowa w tej pracy) sprawia, że będzie wywoływana regularnie przy każdej podmianie zdjęcia, więc ryzyko cichego narastania osieroconych plików rośnie.
- **Poprawka**: Opakować `supabase.storage.from(YARN_PHOTOS_BUCKET).remove([previousPath])` w sprawdzenie błędu z `console.warn`, analogicznie do `removeYarnPhoto`/`deleteYarn`.
- **Decyzja**: FIXED — src/lib/services/yarns.ts:215-219 teraz sprawdza `removeError` i loguje `console.warn`, spójnie z resztą pliku.

### F4 — Podwójne wyświetlanie tego samego błędu edycji (baner + dialog)

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/pages/yarns/[id].astro:55-60, src/components/yarn/EditYarnDialog.tsx:45
- **Szczegóły**: Po nieudanej walidacji edycji (`?error=...&edit=1`) ten sam komunikat błędu wyświetla się dwukrotnie: raz w bannerze na górze strony, drugi raz wewnątrz automatycznie otwartego dialogu edycji (przez `serverError` przekazane do `YarnForm`). Strona `/yarns/new` (wzorzec referencyjny) pokazuje błąd tylko raz.
- **Poprawka**: W `[id].astro` nie renderować górnego banera `error`, gdy `editOpen` jest `true` (np. `{error && !editOpen && (...)}`) — błąd i tak jest widoczny w otwartym dialogu, tam gdzie użytkownik aktualnie patrzy.
- **Decyzja**: FIXED — src/pages/yarns/[id].astro warunek banera zmieniony na `{error && !editOpen && (...)}`.

### F5 — Surowa treść błędu Supabase/PostgREST trafia bezpośrednio do klienta

- **Ważność**: 👁️ OBSERWACJA
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/yarns/[id].ts:9-14, 62-68, 107-113
- **Szczegóły**: `toErrorMessage`/`error.message` z rzuconych wyjątków (w tym potencjalnie surowa treść `PostgrestError`) trafia wprost do JSON-a/redirectu widocznego dla użytkownika. To ten sam wzorzec co w istniejących `api/yarns.ts` i `substitutes.ts` — nie jest to regresja wprowadzona tą zmianą, tylko istniejące ryzyko systemowe, odnotowane dla świadomości.
- **Decyzja**: SKIPPED — poza zakresem tej zmiany; dotyczy istniejącego wzorca całego API, nie tylko tego pliku.

### F6 — Stan błędu w `DeleteYarnButton` nie czyści się przy ponownym otwarciu dialogu

- **Ważność**: 👁️ OBSERWACJA
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/yarn/DeleteYarnButton.tsx:24-42
- **Szczegóły**: Jeśli użytkownik zamknie dialog po nieudanej próbie usunięcia i otworzy go ponownie bez klikania „Usuń”, zobaczy stary komunikat błędu z poprzedniej próby. Drobne, kosmetyczne.
- **Poprawka**: Wyczyścić `error` w `onOpenChange`, gdy dialog się zamyka.
- **Decyzja**: FIXED — src/components/yarn/DeleteYarnButton.tsx: `AlertDialog` ma teraz `onOpenChange`, który czyści `error` przy zamknięciu.
