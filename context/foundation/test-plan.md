# Plan testów

> Fazowe wdrożenie testów dla tego projektu. Strategia jest zamrożona u góry
> (§1–§5); wzorce podręcznika (§6) uzupełniają się w miarę wdrażania faz.
> Przeczytaj przed napisaniem nowego testu.
>
> Odświeżenie: uruchom ponownie `/10x-test-plan --refresh`, gdy plan się
> zdezaktualizuje (patrz §8).
>
> Ostatnia aktualizacja: 2026-09-05

---

## 1. Strategia

Testy w tym projekcie kierują się trzema nienegocjowalnymi zasadami:

1. **Koszt × sygnał.** Wygrywa najtańszy test, który daje prawdziwy sygnał dla danego ryzyka. Nie promujemy do e2e tylko dlatego, że "czuje się bezpieczniej". Nie nakładamy modelu wizyjnego na deterministyczną różnicę, która już wykrywa regresję.
2. **Obawy użytkownika to pełnoprawny dowód.** Ryzyka zakotwiczone w "zespół obawia się X, a awaria ujawniłaby się gdzieś w obszarze Y" mają taką samą wagę jak linie PRD czy dane o hot-spotach.
3. **Ryzyka to scenariusze, a nie lokalizacje kodu.** Ten plan dokumentuje _co może zawieść_ i _dlaczego uważamy to za prawdopodobne_ — na podstawie dokumentów, wywiadu i sygnału z bazy kodu (częstotliwość zmian, struktura, stan bazy testowej). NIE twierdzi, że wie, która linia kodu odpowiada za awarię. Tę wiedzę dostarcza `/10x-research` podczas każdej fazy wdrożenia. Jeśli plan i badanie są w sprzeczności co do tego, gdzie leży awaria, badanie jest źródłem prawdy.

Zakres skanowania hot-spotów użyty do ważenia prawdopodobieństwa: `src/`, `supabase/migrations/` (potwierdzone z użytkownikiem, 35 commitów/30 dni — wystarczająca historia).

---

## 2. Mapa ryzyka

Główne scenariusze awarii, przed którymi ten projekt musi się bronić, uporządkowane według ryzyka = wpływ × prawdopodobieństwo. Ryzyka są scenariuszami awarii w języku użytkownika/biznesu, nie nazwami testów. Kolumna Źródło cytuje _dowód, który wywołał to ryzyko_ — nigdy konkretny plik jako "miejsce awarii" (to zadanie badania, patrz §1 zasada #3).

| #   | Ryzyko (scenariusz awarii)                                                                                                                    | Wpływ  | Prawdopodobieństwo | Źródło (dowód — nie kotwica)                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Dodanie nowej włóczki nie zapisuje się (formularz "wygląda" na udany, ale wiersz nie powstaje)                                                | Wysoki | Średni             | interview Q1 (obawa #1: "nie działałoby dodawanie włóczek"); hot-spot `src/components/yarn` (28 commitów/30d), `src/lib/services` (10 commitów/30d)                                                                                                                                       |
| 2   | Zapisana włóczka znika, albo usunięcie jednej włóczki psuje/kasuje inne dane usera                                                            | Wysoki | Średni             | interview Q1 (obawa #1: "włóczki by znikały"); PRD FR-005/FR-006 (edycja ilości vs usunięcie to dwa różne stany); hot-spot `src/lib/services/yarns.ts`-owy obszar (`src/lib/services`, 10 commitów/30d)                                                                                   |
| 3   | Edycja włóczki zapisuje tylko część zmienionych pól, albo miesza wartości między polami/wpisami                                               | Wysoki | Średni             | interview Q3 (najbardziej szczegółowa obawa użytkownika: "część danych się zapisze część nie, albo pomieszanie")                                                                                                                                                                          |
| 4   | Użytkownik widzi, edytuje lub usuwa włóczkę należącą do innego konta                                                                          | Wysoki | Niski              | PRD Guardrail ("dane biblioteki widoczne wyłącznie dla właściciela konta"); interview Q1 (obawa #1: "pojawiałyby się włóczki, których ja nie mam a ma je ktoś inny"); archiwum `manage-saved-yarn-entry` (izolacja RLS potwierdzona ręcznie jednorazowo, brak automatycznego sprawdzenia) |
| 5   | Zapis decyzji o zamienniku (akceptacja/odrzucenie) przechodzi mimo że jedna z włóczek należy do innego konta                                  | Wysoki | Niski              | archiwum `ai-substitute-suggestions` (świadome zabezpieczenie w kodzie opisane w planie, zweryfikowane ręcznie jednorazowo — soczewka nadużyć: autoryzacja/IDOR)                                                                                                                          |
| 6   | Nieudana akcja (zapis, edycja, usunięcie, akceptacja/odrzucenie zamiennika) nie pokazuje użytkownikowi żadnego wyraźnego komunikatu o błędzie | Średni | Średni             | interview Q2 (druga główna obawa użytkownika: "najgorzej jak nie ma odpowiednich komunikatów... muszę wyraźnie widzieć że się nie udało")                                                                                                                                                 |
| 7   | Filtrowanie lub sortowanie listy włóczek zwraca niepełny albo błędny wynik                                                                    | Średni | Średni             | archiwum `filter-and-sort-yarn-library` (dwa udokumentowane odejścia od pierwotnego planu wykryte dopiero przy ręcznym testowaniu); hot-spot `src/components/yarn/YarnFilters.tsx` (część z 28 commitów/30d w `src/components/yarn`)                                                      |

**Soczewka nadużyć/bezpieczeństwa**: projekt ma uwierzytelnianie i przyjmuje dane od użytkownika, więc ryzyko #5 (autoryzacja/IDOR na endpointzie zamienników) jest tu celowo uwzględnione — nie wypłynęłoby samo z wywiadu, bo ścieżka szczęśliwa z natury pomija atakującego.

### Wskazówki dotyczące reagowania na ryzyko

| Ryzyko | Co udowodniłoby ochronę                                                                                                                                                                                                                                                               | Musi kwestionować                                                                                                                                                                                                                                                                     | Kontekst do ugruntowania przez `/10x-research`                                                                                                       | Prawdopodobnie najtańsza warstwa                                                                          | Anty-wzorzec do uniknięcia                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1     | Zapis poprawnego formularza (wymagane pola: nazwa, producent, ilość) tworzy nowy, odczytywalny wiersz natychmiast po zapisie; formularz z brakującym wymaganym polem jest odrzucany z widocznym błędem                                                                                | "Przekierowanie po zapisie oznacza sukces zapisu" — przekierowanie to zdarzenie UI, nie dowód, że wiersz faktycznie powstał                                                                                                                                                           | Dokładne reguły walidacji, zachowanie endpointu przy błędzie, co dokładnie oznacza "utworzony" na poziomie bazy (polityka insert + wymagany grant)   | integration (uderzenie w endpoint z prawdziwą testową sesją)                                              | Sprawdzanie tylko kodu odpowiedzi (200) bez weryfikacji, że wiersz faktycznie się zapisał                                                                |
| #2     | Zapisana włóczka pozostaje niezmieniona przy wielokrotnym odczycie; usunięcie jednej włóczki nie usuwa ani nie zmienia innych włóczek tego samego usera                                                                                                                               | "Usunięcie usuwa tylko to, co zamierzone" — trzeba też sprawdzić, że powiązane dane (np. decyzje o zamiennikach) są sprzątane celowo (kaskadowo), a nie przypadkowo zabierają coś więcej                                                                                              | Dokładny warunek filtrowania w operacji usuwania/edycji, zachowanie kaskadowego usuwania na powiązanej tabeli decyzji                                | integration (utwórz kilka włóczek, usuń jedną, sprawdź resztę)                                            | Testowanie usuwania w izolacji (jedna włóczka w bazie) bez sprawdzenia, że sąsiednie dane przetrwały                                                     |
| #3     | Edycja zmieniająca kilka pól naraz zapisuje wszystkie zmienione pola razem, albo żadnego z widocznym błędem — nigdy stanu pośredniego; wartość z jednego pola nigdy nie trafia do innego pola lub innej włóczki                                                                       | "Zamknięcie okna edycji bez błędu oznacza, że wszystko się zapisało" — zamknięcie okienka to zdarzenie UI, nie dowód zapisu każdego pola                                                                                                                                              | Dokładny kształt danych wysyłanych przy edycji, czy aktualizacja zapisuje wszystkie pola w jednym żądaniu czy kilku                                  | integration (edytuj kilka pól naraz, odczytaj ponownie, porównaj każde pole)                              | Sprawdzenie tylko jednego zmienionego pola i założenie, że reszta poszła tą samą ścieżką                                                                 |
| #4     | Włóczka utworzona przez konto A nigdy nie jest zwracana, edytowalna ani usuwalna przy uwierzytelnieniu jako konto B — potwierdzone na poziomie API/danych z dwoma prawdziwymi, osobnymi kontami testowymi, nie przez połączenie z uprawnieniami administratora, które omija tę regułę | "Istnienie polityki RLS oznacza, że jest egzekwowana" — polityka może istnieć i mimo to nie chronić, jeśli brakuje towarzyszącego nadania uprawnień (dokładnie taka pułapka już raz wystąpiła w historii tego projektu), albo jeśli nowa ścieżka zapytania zapomni tego samego filtra | Aktualne polityki RLS i nadania uprawnień na tabelach `yarns` i `yarn_substitute_decisions`, każda ścieżka kodu odczytująca/zapisująca włóczkę po id | integration (dwa osobne konta testowe, sprawdzenie każdej operacji CRUD)                                  | Testowanie tylko braku sesji (401) i traktowanie tego jako równoważne z "zalogowany jako zła osoba" (to zupełnie inna, znacznie groźniejsza luka)        |
| #5     | Zapis decyzji o zamienniku jest odrzucany, gdy docelowa włóczka lub włóczka-zamiennik nie należy do uwierzytelnionego usera — żaden wiersz decyzji nie powstaje w takim wypadku                                                                                                       | "Istnienie klucza obcego oznacza, że dane są poprawne" — klucz obcy potwierdza tylko, że id włóczki gdzieś istnieje, nie że należy do wywołującego                                                                                                                                    | Aktualna weryfikacja własności wewnątrz funkcji zapisującej decyzję, czy jest wywoływana przed każdą ścieżką zapisu                                  | integration (próba zapisu decyzji z cudzym id włóczki, sprawdzenie odrzucenia i braku zapisanego wiersza) | Testowanie tylko udanej decyzji między dwiema włóczkami tego samego usera, bez próby międzykontowej                                                      |
| #6     | Każda inicjowana przez użytkownika akcja zapisu (dodanie, edycja, usunięcie, akceptacja/odrzucenie), która zawiedzie po stronie serwera, pokazuje widoczny, konkretny stan błędu w interfejsie — użytkownik nigdy nie zostaje z wrażeniem sukcesu tam, gdzie go nie było              | "Brak błędu w konsoli oznacza, że user zobaczył informację zwrotną" — złapany/wyciszony błąd albo nieudane żądanie fetch może zostawić interfejs w nieaktualnym stanie "wygląda dobrze" bez niczego pokazanego userowi                                                                | Obecny wzorzec obsługi błędów per komponent (np. reużywalny komponent błędu), które akcje dziś nie mają żadnej ścieżki obsługi błędu                 | component/integration (symulacja nieudanej odpowiedzi serwera dla każdej akcji zapisu)                    | Testowanie tylko ścieżki szczęśliwej każdej akcji, nigdy symulacji nieudanej odpowiedzi serwera                                                          |
| #7     | Zastosowanie filtra lub sortowania zwraca dokładnie zbiór włóczek spełniających kryteria (bez fałszywych włączeń/wykluczeń); łączenie kilku filtrów zawęża listę poprawnie (logika ORAZ), w tym próg minimalnej ilości działający jako próg, nie dopasowanie dokładne                 | "Istniejące testy jednostkowe funkcji filtrującej już to pokrywają" — mogą testować samą funkcję w izolacji, nie parsowanie parametrów URL/przepływ na stronie, które już dwa razy zaskoczyło dopiero przy ręcznym testowaniu                                                         | Jak parametry URL mapują się na stan filtrów na stronie, aktualne pokrycie istniejącego pliku testów filtrów                                         | unit (istniejący, tania warstwa) + integration (dla parsowania URL)                                       | Dokładanie kolejnych testów jednostkowych czystej funkcji, podczas gdy nieprzetestowany kod łączący ją z URL to dokładnie to, co już dwa razy zepsuło UX |

---

## 3. Fazowe wdrożenie

Każdy wiersz to osobna faza wdrożenia, która otworzy własny folder zmiany przez `/10x-new`. Status przesuwa się od lewej do prawej przez wartości poniżej; orkiestrator aktualizuje Status w miarę pojawiania się artefaktów na dysku.

| #   | Nazwa fazy                                 | Cel (jedna linia)                                                                                                 | Ryzyka objęte | Typy testów             | Status      | Folder zmiany |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------- | ----------- | ------------- |
| 1   | Ochrona podstawowych operacji na włóczkach | Zabezpieczyć dodawanie, zapisywanie/edycję i usuwanie włóczek przed regresją                                      | #1, #2, #3    | integration             | not started | —             |
| 2   | Izolacja danych między kontami             | Automatycznie potwierdzić, że dane i decyzje jednego konta nigdy nie są widoczne ani zapisywalne przez inne konto | #4, #5        | integration             | not started | —             |
| 3   | Widoczne komunikaty błędów                 | Zapewnić, że każda nieudana akcja zapisu pokazuje userowi jasny stan błędu                                        | #6            | component + integration | not started | —             |
| 4   | Poprawność filtrowania i sortowania        | Domknąć lukę między czystą logiką filtrów a faktycznym zachowaniem strony (parsowanie URL)                        | #7            | unit + integration      | not started | —             |
| 5   | Dopięcie bramek jakości                    | Uruchamiać `npm run test` automatycznie w CI przy każdym push/PR                                                  | cross-cutting | gates                   | not started | —             |

**Słownictwo statusu** (stałe — literały parsera): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

---

## 4. Stos

Klasyczna baza testowa dla tego projektu. Zalecenia w tej sekcji są ugruntowane w lokalnych manifestach/konfiguracjach oraz w narzędziach/MCP faktycznie dostępnych w bieżącej sesji.

| Warstwa                 | Narzędzie                                                          | Wersja  | Notatka                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit                    | Vitest                                                             | ^4.1.11 | Już skonfigurowany (`vitest.config.ts`); dziś używany tylko do czystych funkcji (`substitute-matching`, `utils`, `yarn` validation, `yarn-filters`)                                                             |
| integration             | brak jeszcze — patrz Faza 1, 2                                     | —       | Zalecane podejście: lokalny Supabase (`npx supabase start`) + realne testowe konta z prawdziwym JWT, tak jak już robiono ręcznie dla F-01/S-03 — nie połączenie z uprawnieniami administratora, które omija RLS |
| API mocking             | brak — niepotrzebny przy podejściu integration z lokalnym Supabase | —       | Mockowanie tylko na granicy sieciowej, jeśli kiedyś pojawi się zależność zewnętrzna (dziś brak)                                                                                                                 |
| e2e                     | brak zaplanowanej fazy                                             | —       | Ryzyka #1–#6 adresowane taniej testami integracyjnymi/komponentowymi; do ponownej oceny przy `--refresh`, jeśli pojawi się realna potrzeba                                                                      |
| accessibility           | brak skonfigurowanego                                              | —       | Poza zakresem tego wdrożenia (poprawki UI świadomie odłożone, patrz §7)                                                                                                                                         |
| (opcjonalnie) AI-native | Browser pane (Claude Browser tools) — checked: 2026-09-05          | n/a     | Dostępny w bieżącej sesji jako narzędzie sterowania przeglądarką; nieużywany w tym planie, bo tańsze testy integracyjne/komponentowe już dają wymagany sygnał dla ryzyk #1–#7                                   |

**Narzędzia ugruntowania stosu (bieżąca sesja):**

- Docs: not available in current session (Context7 niedostępny); checked: 2026-09-05
- Search: WebSearch/WebFetch dostępne jako ogólne narzędzia wyszukiwania — niewykorzystane w tym planie, lokalny dowód (manifesty, historia git, archiwum) był wystarczający; checked: 2026-09-05
- Runtime/browser: Browser pane (Claude Browser tools) dostępny w tej sesji — potencjalne wsparcie przyszłych kroków e2e/ręcznego smoke testu; checked: 2026-09-05
- Provider/platform: brak dedykowanego MCP dla Supabase/Vercel/GitHub w tej sesji; not used: 2026-09-05

---

## 5. Bramki jakości

Pełny zestaw bramek, które muszą przejść, zanim zmiana trafi na produkcję. "Wymagane dla Fazy §3 <N>" oznacza, że bramka jest egzekwowana, gdy ta faza wdrożenia wyląduje; wcześniej bramka jest `planned`.

| Bramka                        | Gdzie                    | Wymagana?                                                                                     | Co wykrywa                                                          |
| ----------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| lint + typecheck              | lokalnie + CI            | wymagana (już wdrożona: `npm run lint`, `npx astro check` w `.github/workflows/ci.yml`)       | dryf składniowy / typów                                             |
| unit                          | lokalnie + CI            | wymagana po Fazie §3 5 (dziś `npm run test` istnieje lokalnie, ale NIE jest uruchamiany w CI) | regresje logiki w czystych funkcjach                                |
| integration                   | lokalnie + CI            | wymagana po Fazie §3 1 i 2                                                                    | regresje w operacjach na włóczkach i izolacji danych między kontami |
| widoczność błędów (component) | lokalnie + CI            | wymagana po Fazie §3 3                                                                        | brak komunikatu błędu dla użytkownika przy nieudanej akcji          |
| pre-prod smoke                | między merge a produkcją | opcjonalna                                                                                    | awarie specyficzne dla środowiska produkcyjnego (Vercel)            |

---

## 6. Wzorce podręcznika

Jak dodawać nowe testy w tym projekcie. Każda podsekcja wypełnia się, gdy odpowiednia faza wdrożenia wyląduje; do tego czasu podsekcja brzmi "TBD — patrz §3 Faza <N>".

### 6.1 Dodawanie testu jednostkowego

- **Lokalizacja**: `src/lib/**/*.test.ts`, obok testowanego modułu.
- **Nazewnictwo**: `<moduł>.test.ts`.
- **Test referencyjny**: `src/lib/services/substitute-matching.test.ts`.
- **Uruchomienie lokalnie**: `npm run test`.

### 6.2 Dodawanie testu integracyjnego

- **Lokalizacja**: kolokowany z testowanym modułem, sufiks `.integration.test.ts` (np. `src/lib/services/yarns.integration.test.ts`), żeby odróżnić od testów jednostkowych przy tej samej konwencji nazewnictwa `<moduł>.test.ts`.
- **Sesja testowa**: `src/lib/testing/supabase-test-client.ts` eksportuje `createTestSupabaseSession()` — zwraca prawdziwego, uwierzytelnionego klienta Supabase (świeże konto tworzone przez `signUp` z losowym e-mailem) + `userId`. Wzorzec użycia: `const { supabase, userId } = await createTestSupabaseSession();` na początku testu/`beforeAll`. RLS jest aktywne przy każdym zapytaniu tym klientem — dokładnie jak dla prawdziwego zalogowanego użytkownika.
- **Wymóg uruchomienia**: `npx supabase start` musi działać przed `npm run test` — helper domyślnie wskazuje na lokalny URL/klucz (`http://127.0.0.1:54321`), z możliwością nadpisania przez `SUPABASE_TEST_URL`/`SUPABASE_TEST_ANON_KEY` (np. dla CI).
- **Sprzątanie danych**: jawne usunięcie utworzonych wierszy w `afterEach` (np. `supabase.from("<tabela>").delete().eq("user_id", userId)`) — konta testowe w `auth.users` nie są sprzątane (celowy kompromis, lokalna baza jest efemeryczna).
- **Bez mockowania Supabase** — zaślepka skłamałaby o RLS i constraintach bazy, które są właśnie tym, co te testy mają udowodnić.
- **Test referencyjny**: `src/lib/services/yarns.integration.test.ts` — dwa testy: poprawny zapis tworzy wiersz potwierdzony niezależnym odczytem (nie tym samym `.select().single()`, który wykonał insert); brak wymaganej ilości jest odrzucany przez constraint bazy `yarns_quantity_present`, bez powstania wiersza.

### 6.3 Dodawanie testu e2e

- TBD — żadna zaplanowana faza nie wprowadza pełnego e2e; ryzyka #1–#7 są adresowane taniej testami integracyjnymi/komponentowymi (patrz Fazy 1–4). Do ponownej oceny przy `--refresh`, jeśli pojawi się realna potrzeba.

### 6.4 Dodawanie testu dla nowego endpointu API

- TBD — patrz §3 Faza 1. Wzorzec do ustalenia: uderzenie w endpoint z prawdziwą testową sesją na lokalnym Supabase, asercja kształtu odpowiedzi ORAZ efektu ubocznego (wiersz w bazie), bez mockowania Supabase.

### 6.5 Dodawanie testu izolacji danych między kontami (RLS)

- TBD — patrz §3 Faza 2. Wzorzec do ustalenia: dwa osobne, prawdziwe testowe konta z realnymi tokenami JWT (nigdy połączenie z uprawnieniami administratora, które omija RLS) — analogicznie do ręcznego testu już wykonanego dla `manage-saved-yarn-entry`.

### 6.6 Notatki per-faza wdrożenia

(Puste — wypełni się po zakończeniu pierwszej fazy wdrożenia.)

---

## 7. Czego świadomie nie testujemy

Wykluczenia uzgodnione podczas wdrożenia (wywiad Fazy 2, pytanie 5). Przyszli współpracownicy powinni je respektować, chyba że leżące u ich podstaw założenie się zmieni.

- **Wygląd/UI i design system** — świadomie odłożone na koniec pracy nad MVP; użytkownik potwierdził, że poprawki UI zostawia na później, w jednym przejściu na koniec, a nie przyrostowo teraz. Ponowna ocena: gdy rozpocznie się właściwy etap polerowania UI po zakończeniu tego planu testów, lub gdy design system zostanie ustalony. (Źródło: wywiad Fazy 2, pytanie 5.)

---

## 8. Rejestr aktualności

- Strategia (§1–§5) ostatnio przejrzana: 2026-09-05
- Wersje stosu ostatnio zweryfikowane: 2026-09-05
- Odniesienia do narzędzi AI-native ostatnio zweryfikowane: 2026-09-05

Odśwież (`/10x-test-plan --refresh`), gdy:

- pojawi się nowe ryzyko w top-3 z mapy drogowej lub archiwum,
- data `checked:` zalecanego narzędzia jest starsza niż trzy miesiące,
- zmieni się stos technologiczny projektu (nowy framework, nowy test runner),
- negatywna przestrzeń z §7 przestanie odpowiadać temu, w co wierzy zespół.
