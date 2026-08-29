# AI substitute suggestions — Krótki plan

> Pełny plan: `context/changes/ai-substitute-suggestions/plan.md`
> Badania: `context/changes/ai-substitute-suggestions/research.md`

## Co i dlaczego

Budujemy sekcję "zamienniki" na stronie szczegółów włóczki (S-02 z roadmapy): deterministyczne dopasowanie parametrów (skład, grubość drutów/szydełka, opcjonalnie kolor) z własnej biblioteki użytkownika generuje uporządkowaną listę sugestii, które user akceptuje lub trwale odrzuca. To najbardziej ryzykowna hipoteza produktu — sekwencjonowana tak wcześnie, jak pozwala na to jej jedyne wymaganie wstępne (S-01).

## Punkt wyjścia

Tabela `yarns` istnieje i była świadomie zaprojektowana pod tę funkcję. Brak jakiejkolwiek tabeli substitute/decision — projektujemy model danych od zera. Repo nie ma dziś ani jednego JSON API route (wszystko to form-POST + redirect), ani skonfigurowanego test runnera, ani ustalonego wzorca fetch-based React komponentu — ta zmiana wprowadza wszystkie trzy po raz pierwszy.

## Pożądany stan końcowy

Na stronie szczegółów każdej włóczki widoczna jest lista już zaakceptowanych zamienników oraz nowe sugestie do oceny z przyciskami akceptuj/odrzuć działającymi natychmiast, bez przeładowania strony. Odrzucone pary nigdy nie wracają. Przy braku wystarczająco podobnych włóczek w bibliotece widoczny jest jeden spójny stan zachęcający do rozbudowy biblioteki.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
|---|---|---|---|
| `gauge_note` w dopasowaniu | Nie używamy | PRD Business Logic wymienia tylko skład/rozmiar/kolor — `gauge_note` to wolny tekst świadomie odłożony w F-01 | Badania + Plan |
| Kształt schematu decyzji | Jedna tabela ze statusem (`accepted`/`rejected`) | Wiersz tylko dla decyzji podjętych, brak wiersza = nieoceniona — prostsze niż dwie tabele | Plan |
| Symetria akceptacji/odrzucenia | Pełna, w obie strony | User: "najwyżej user usunie ten zamiennik" — zaakceptowanie A jako zamiennika B implikuje B jako zamiennik A | Plan (decyzja usera w sesji) |
| Tolerancja rozmiaru drutów/szydełka | ±0,5mm, potem liniowy spadek do 2,5mm | Krok w istniejącej tabeli rozmiarów w walidacji; ciągły spadek lepiej wspiera sortowanie niż twardy próg | Plan (decyzja usera w sesji) |
| Dopasowanie składu | Per-włókno z tolerancją, ciągły wynik | User: "będzie to miało więcej sensu" niż tylko włókno dominujące | Plan (decyzja usera w sesji) |
| Brakujący parametr | Neutralny — pomijany, wagi renormalizowane | Pola opcjonalne nie mogą karać usera za pozostawienie ich pustymi (guardrail PRD) | Plan (decyzja usera w sesji) |
| Próg pokazywania sugestii | Próg jakości dopasowania (score ≥ 50/100), nie liczba włóczek w bibliotece | User: "powinniśmy się skupiać na dopasowaniu, a nie na tym, żeby pokazywać cokolwiek" | Plan (decyzja usera w sesji) |
| Dopasowanie koloru | Fuzzy/substring, waga 20% | User wybrał to podejście zamiast dokładnego dopasowania tekstowego lub pominięcia | Plan (decyzja usera w sesji) |
| Testowanie algorytmu | Testy jednostkowe czystej funkcji scoringu (nowy Vitest) | Najbardziej ryzykowna logika biznesowa w zmianie, deterministyczna i łatwa do izolacji | Plan (decyzja usera w sesji) |
| API dla accept/reject | JSON route (pierwszy w repo) zamiast form-POST | Natychmiastowy feedback UI bez przeładowania strony | Badania |

## Zakres

**W zakresie:**
- Nowa tabela `yarn_substitute_decisions` (RLS + grant + trigger)
- Czysta funkcja scoringu + testy jednostkowe (nowy Vitest w repo)
- JSON API endpoint `POST /api/yarns/[id]/substitutes`
- React island z listą zaakceptowanych zamienników, listą sugestii i akcjami accept/reject
- Spójny stan pusty przy braku dobrych kandydatów

**Poza zakresem:**
- Cofanie/edycja już podjętej decyzji
- Jakiekolwiek wywołanie LLM/modelu AI
- Sugestie spoza własnej biblioteki użytkownika
- Restrukturyzacja `gauge_note`
- Konfigurowalne przez użytkownika progi/wagi algorytmu

## Architektura / Podejście

Sugestie liczone server-side (SSR w `yarns/[id].astro`) przy pomocy czystej funkcji scoringu — brak potrzeby API do samego wyliczania. Tylko akcje accept/reject idą przez nowy JSON endpoint do natychmiastowej reakcji UI. Symetria realizowana zapisem dwóch wierszy (oba kierunki) zamiast normalizacji pary.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Model danych | Tabela + RLS + grant + typ TS | Niekompletne RLS/grant (powtarzalny błąd z `yarns`) |
| 2. Algorytm dopasowania | Czysta funkcja scoringu + testy (nowy Vitest) | Formuła nietrafiona względem realnych danych — do dostrojenia po zebraniu acceptance rate |
| 3. API accept/reject | Pierwszy JSON route w repo | Brak weryfikacji własności obu włóczek przed zapisem decyzji |
| 4. Frontend | React island z sugestiami, akceptacjami, empty state | Pierwszy fetch-based komponent w repo — brak wzorca do skopiowania |

**Wymagania wstępne:** S-01 (`add-and-browse-yarn-library`) — ukończone, status `done`.
**Szacowany wysiłek:** ~4 sesje implementacyjne, po jednej na fazę.

## Otwarte ryzyka i założenia

- Konkretne wagi (40/40/20) i próg (50/100) są uzasadnionymi domyślnymi, nie zwalidowanymi danymi — Success Criteria Primary (75% acceptance rate) zweryfikuje je post-factum; mogą wymagać dostrojenia bez zmiany architektury.
- Fuzzy dopasowanie koloru (substring) jest heurystyką tekstową w reszcie w pełni liczbowym algorytmie — może dawać niezamierzone dopasowania przy specyficznych nazwach kolorów.

## Kryteria sukcesu (podsumowanie)

- User widzi posortowaną listę sugestii na stronie szczegółów włóczki, wygenerowaną wyłącznie z własnej biblioteki
- Akceptacja i odrzucenie działają natychmiast (bez przeładowania) i są trwałe po odświeżeniu
- Odrzucone pary nigdy nie wracają; zaakceptowane są widoczne symetrycznie z obu stron
