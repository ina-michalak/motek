# Zarządzanie zapisaną włóczką — Krótki plan

> Pełny plan: `context/changes/manage-saved-yarn-entry/plan.md`

## Co i dlaczego

Budujemy S-03 z roadmapy: użytkownik edytuje zapisaną włóczkę (wszystkie pola z formularza dodawania, w tym ustawienie ilości na 0 = "wyczerpana", oraz jawne usunięcie zdjęcia) albo usuwa ją całkowicie. Realizuje FR-005 i FR-006 z PRD — bez tego biblioteka szybko traci aktualność, bo nie da się poprawić błędu ani zasygnalizować zużycia zapasu.

## Punkt wyjścia

Baza danych ma już gotowe RLS/granty na `update`/`delete` dla `yarns` i storage bucketu zdjęć (przewidziane w F-01) — zero nowych migracji. Strona szczegółów (`/yarns/[id]`) jest dziś czysto prezentacyjna, bez żadnego przycisku edycji/usuwania. Formularz dodawania (`AddYarnForm.tsx`) jest zahardkodowany pod tworzenie i nie da się go użyć do edycji bez zmian. W repo nie ma jeszcze żadnego komponentu modal/dialog.

## Pożądany stan końcowy

Na `/yarns/[id]` widoczne są przyciski „Edytuj” (otwiera modal z pełnym formularzem, wypełnionym aktualnymi danymi) i „Usuń” (dialog potwierdzenia → natychmiastowe usunięcie i powrót do `/dashboard`). Włóczka z ilością = 0 ma widoczny badge „Wyczerpana” na karcie i szczegółach.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
| --- | --- | --- | --- |
| Miejsce formularza edycji | Modal na `/yarns/[id]` | User: wybrał modal zamiast osobnej strony lub edycji inline | Plan (decyzja usera w sesji) |
| Reużycie formularza | Uogólnić do wspólnego `YarnForm` | Jedno miejsce do utrzymania listy pól i walidacji zamiast dwóch rozjeżdżających się kopii | Plan (decyzja usera w sesji) |
| Zapis edycji | Natywny form POST + redirect | Spójne z jedynym wzorcem formularza multi-pole w repo; NFR "<1s" już spełniane tą drogą | Plan (decyzja usera w sesji) |
| Usuwanie (API + UX) | JSON DELETE + dialog potwierdzenia | Natychmiastowa reakcja, spójne z wzorcem JSON z S-02 (SubstituteSuggestions) | Plan (decyzja usera w sesji) |
| Komponent modala/dialogu | shadcn `dialog` + `alert-dialog` | Spójne z resztą UI kit, dostępność (focus trap, ESC) za darmo z Radix | Plan (decyzja usera w sesji) |
| Usuwanie zdjęcia | Zastąpienie + jawny przycisk "Usuń zdjęcie" | Pełna kontrola nad opcjonalnym polem, zgodne z PRD (zdjęcie w pełni opcjonalne) | Plan (decyzja usera w sesji) |
| Oznaczenie wyczerpania | Badge "Wyczerpana" na karcie i szczegółach | Realizuje intencję FR-005 w sposób widoczny, nie tylko liczbowo | Plan (decyzja usera w sesji) |
| Testowanie | Testy jednostkowe dla logiki bez I/O (helper + walidacja) | Vitest już skonfigurowany od S-02; testowanie funkcji serwisu opartych o Supabase pominięte — brak istniejącego harnessu do mockowania klienta, nieproporcjonalny zakres na tę zmianę | Plan (decyzja usera w sesji) |

## Zakres

**W zakresie:** edycja wszystkich pól z FR-002 (w tym zdjęcia z podmianą lub jawnym usunięciem), usunięcie całej włóczki, badge "Wyczerpana", nowe funkcje serwisu (`updateYarn`, `removeYarnPhoto`, `deleteYarn`), nowy route `POST`/`DELETE /api/yarns/[id]`, instalacja shadcn `dialog`/`alert-dialog`.

**Poza zakresem:** historia zmian/cofanie edycji, dodatkowe ostrzeżenie przy usuwaniu o powiązanych zamiennikach (DB kaskada wystarcza, zgodnie z decyzją PRD), testy service-layer wymagające mocka Supabase, jakiekolwiek zmiany schematu bazy danych.

## Architektura / Podejście

Rozszerzamy istniejące wzorce: edycja = natywny form-POST + redirect (jak tworzenie), tylko przez nowy route `/api/yarns/[id]` zamiast `/api/yarns`; usuwanie = JSON `fetch` + `DELETE` (jak accept/reject zamiennika z S-02). `AddYarnForm.tsx` staje się `YarnForm.tsx` z propsami `mode`/`action`/`initialValues` — jeden komponent dla obu przypadków. Dwa nowe małe React islands (`EditYarnDialog`, `DeleteYarnButton`) osadzają go i obsługę usuwania na stronie szczegółów.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Fundament backendu | `updateYarn`/`deleteYarn`/`removeYarnPhoto`, route `/api/yarns/[id]` (POST+DELETE), shadcn dialog/alert-dialog, helper "wyczerpana" + testy | Brak sprawdzenia dopasowania wiersza (`id`+`user_id`) przy update/delete otworzyłoby dostęp do cudzej włóczki |
| 2. Formularz edycji (UI) | `YarnForm` (uogólniony), `EditYarnDialog`, wpięcie w stronę szczegółów, badge "Wyczerpana" | Regresja formularza dodawania przy refaktoryzacji `AddYarnForm` → `YarnForm` |
| 3. Usuwanie (UI) | `DeleteYarnButton` + `AlertDialog`, wpięcie i redirect do `/dashboard` | Usunięcie włóczki będącej zaakceptowanym zamiennikiem musi nie psuć strony drugiej włóczki (kaskada DB) |

**Wymagania wstępne:** S-01 (gotowe), lokalne środowisko Supabase do weryfikacji ręcznej.
**Szacowany wysiłek:** ~2-3 sesje, 3 fazy.

## Otwarte ryzyka i założenia

- Znana, dziedziczona pułapka `attachYarnPhoto`: nowy plik o identycznej (po sanitacji) nazwie jak obecne zdjęcie spowoduje błąd uploadu (`upsert: false`, stary obiekt jeszcze nie usunięty) — istnieje od S-01, nie naprawiamy tego w S-03.
- Brak testów service-layer (Supabase-zależnych) oznacza, że regresje w `updateYarn`/`deleteYarn`/`removeYarnPhoto` będą łapane wyłącznie ręczną weryfikacją — akceptowalne przy obecnej skali, ale warto rozważyć harness do mockowania Supabase przy kolejnych zmianach w serwisie.

## Kryteria sukcesu (podsumowanie)

- User edytuje dowolne pole zapisanej włóczki (w tym zdjęcie — podmiana lub usunięcie) i widzi zmiany natychmiast po zapisie.
- User usuwa włóczkę po potwierdzeniu w dialogu; znika z biblioteki i ze Storage.
- Włóczka z ilością = 0 ma widoczne oznaczenie "Wyczerpana".
