# Filtrowanie i sortowanie biblioteki włóczek — Krótki plan

> Pełny plan: `context/changes/filter-and-sort-yarn-library/plan.md`

## Co i dlaczego

Budujemy S-04 z roadmapy: użytkownik filtruje i sortuje swoją bibliotekę włóczek. Realizuje FR-004 z PRD — bez tego biblioteka staje się nieużyteczna wraz ze wzrostem (docelowa persona ma 30+ motków), bo nie da się szybko znaleźć włóczki pasującej do konkretnego projektu.

## Punkt wyjścia

`/dashboard` dziś renderuje pełną, niefiltrowaną listę zawsze posortowaną po dacie dodania (najnowsze pierwsze) — zero kontrolek filtrowania/sortowania. Skala biblioteki (~30-100 pozycji) pozwala filtrować/sortować w pamięci, bez zmian w bazie danych czy nowych zapytań.

## Pożądany stan końcowy

Nad listą pojawia się pasek z sortowaniem (zawsze widoczne) i przyciskiem "Filtry" (rozwija panel z 6 kontrolkami). Zmiana dowolnej kontrolki natychmiast przeładowuje listę przez URL. Zero wyników pasujących do filtrów pokazuje osobny komunikat z linkiem czyszczącym — odróżnialny od "biblioteka jest pusta".

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
| --- | --- | --- | --- |
| Zestaw filtrów | Producent, dostępność, kolor, skład, druty, szydełko, próg ilości (motki+gramy osobno) | Ustalone z userem przed planowaniem, patrz roadmap S-04 | Roadmap |
| Zestaw sortowania | Data, nazwa, ocena, motki, gramatura — każde z kierunkiem | Ustalone z userem przed planowaniem | Roadmap |
| Architektura | Filtrowanie/sortowanie w pamięci nad już pobraną listą, parametry w URL, natywny form GET | Skala biblioteki (~30-100) nie uzasadnia zapytań DB; spójne z istniejącym wzorcem SSR w projekcie | Plan (badanie kodu) |
| Dopasowanie składu | OR (wystarczy jedno zaznaczone włókno) | Odpowiada naturalnemu pytaniu "co mam z wełny LUB bawełny" | Plan (decyzja usera w sesji) |
| Domyślna dostępność | Pokaż wszystko (wyczerpane też) | Zero zaskoczenia — nie zmienia dzisiejszego zachowania bez akcji usera | Plan (decyzja usera w sesji) |
| UX progu ilości | Submit po Enter/blur | Naturalne dla pola liczbowego, bez migotania listy przy pisaniu | Plan (decyzja usera w sesji) |
| Sortowanie po ilości | Osobne opcje dla motków i gramatury | Nie da się uczciwie porównać dwóch różnych jednostek w jednym porządku | Plan (decyzja usera w sesji) |
| Layout kontrolek | Rozwijany panel (toggle) + zawsze widoczne sortowanie | Przy 6 filtrach nie zajeżdża ekranu, szczególnie na mobile | Plan (decyzja usera w sesji) |
| Kontrolka sortowania | Jeden dropdown łączący pole+kierunek | Jedna kontrolka, czytelne opisowe etykiety, mniej miejsca na mobile | Plan (decyzja usera w sesji) |
| Persystencja filtrów | Tylko URL, reset przy nowej wizycie | Zero dodatkowej złożoności (bez localStorage), spójne z SSR | Plan (decyzja usera w sesji) |
| Źródło list opcji | Wartości z biblioteki usera, nie ze statycznych stałych (`KNOWN_MANUFACTURERS` itp.) | Statyczne stałe zasilają inny mechanizm (podpowiedzi w formularzu) i pokazałyby opcje bez pokrycia w danych usera | Plan (badanie kodu) |

## Zakres

**W zakresie:** 6 filtrów (producent, dostępność, kolor, skład, druty, szydełko, próg motków/gramów) i 10 wariantów sortowania (5 pól × 2 kierunki) na `/dashboard`; nowy moduł czystej logiki `yarn-filters.ts` z testami jednostkowymi; nowy React island `YarnFilters.tsx`; puste stany rozróżniające "brak włóczek" od "brak wyników filtra"; przycisk "Wyczyść filtry".

**Poza zakresem:** filtrowanie/sortowanie na poziomie DB, zapamiętywanie filtrów między wizytami, wyszukiwanie tekstowe, konwersja jednostek ilości, multi-select dla filtrów innych niż skład, jakiekolwiek zmiany schematu bazy danych lub nowe endpointy API.

## Architektura / Podejście

`dashboard.astro` parsuje `Astro.url.searchParams` przez `parseYarnFilters()`, przepuszcza już pobraną (przez istniejące `listYarns()`) listę przez czystą funkcję `filterAndSortYarns()` i renderuje wynik. Kontrolki (`YarnFilters.tsx`) to jeden `<form method="GET" action="/dashboard">` z auto-submitem na `onChange` (pola liczbowe: Enter/blur) — pełne przeładowanie strony, zero client-side fetch, zgodnie z istniejącym wzorcem SSR w projekcie.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Fundament logiki | `yarn-filters.ts` (filtrowanie, sortowanie, parsowanie URL, opcje) + pełne testy jednostkowe | Błędna logika kolejkowania brakujących pól ilości przy sortowaniu popsułaby zaufanie do sortowania |
| 2. UI kontrolek | `YarnFilters.tsx`, wpięcie w `dashboard.astro`, działające filtrowanie/sortowanie | Pomylenie źródła list opcji (statyczne stałe zamiast danych usera) dałoby mylące/puste opcje |
| 3. UX polish | Puste stany, licznik "X z Y", "Wyczyść filtry", weryfikacja mobile | Regresja na dzisiejszym pustym stanie biblioteki (konto bez żadnej włóczki) |

**Wymagania wstępne:** S-01 (gotowe), konto testowe z co najmniej kilkunastoma zróżnicowanymi włóczkami do ręcznej weryfikacji.
**Szacowany wysiłek:** ~2-3 sesje, 3 fazy.

## Otwarte ryzyka i założenia

- Zakładamy, że skala biblioteki pozostanie rzędu dziesiątek-setek pozycji na użytkownika — przy znacznie większej skali filtrowanie w pamięci przestałoby się skalować i wymagałoby przeniesienia na zapytania DB.
- Brak testów integracyjnych/E2E w projekcie oznacza, że poprawność wpięcia UI (Faza 2/3) potwierdzają wyłącznie kroki ręczne, zgodnie z ustaloną konwencją z S-03.

## Kryteria sukcesu (podsumowanie)

- Użytkownik zawęża bibliotekę po dowolnej kombinacji 6 filtrów i widzi tylko pasujące włóczki.
- Użytkownik sortuje bibliotekę po dowolnym z 10 wariantów (5 pól × kierunek).
- Stan filtrów/sortowania jest w URL — działa wstecz/dalej i linki współdzielone; `/dashboard` bez parametrów pokazuje wszystko jak dziś.
