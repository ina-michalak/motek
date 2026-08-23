# Dodawanie i przeglądanie biblioteki włóczek — Krótki plan

> Pełny plan: `context/changes/add-and-browse-yarn-library/plan.md`

## Co i dlaczego

Budujemy S-01: formularz dodawania włóczki do biblioteki i widok listy własnych włóczek. To pierwszy fragment, który faktycznie zapisuje i pokazuje dane w schemacie z F-01 — bez niego żaden kolejny fragment (sugestie AI, edycja, filtrowanie) nie ma na czym pracować.

## Punkt wyjścia

Tabela `yarns` z RLS już istnieje (F-01), ale jest pusta i nic w aplikacji do niej nie pisze ani nie czyta. `/dashboard` jest dziś pustym ekranem powitalnym. Wzorce formularza i API route są ustalone w warstwie auth (`SignUpForm.tsx`, `signup.ts`) — ta zmiana je rozszerza, nie wymyśla od nowa.

## Pożądany stan końcowy

Zalogowany user ląduje na `/dashboard`, widzi kafelkową siatkę swoich włóczek (albo stan pusty z CTA), może dodać nową włóczkę przez `/yarns/new` (wszystkie pola z FR-002, w tym opcjonalne zdjęcie i strukturalny skład włókien) i otworzyć szczegóły dowolnej włóczki pod `/yarns/[id]`.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
| --- | --- | --- | --- |
| Zdjęcie w zakresie | Tak, upload teraz, pole opcjonalne z placeholderem | User: lepiej zrobić raz niż wracać do tego samego ekranu później | Plan |
| Strona szczegółów | Tak, `/yarns/[id]` już w S-01 | S-02 i S-03 i tak jej potrzebują — taniej zrobić szkielet trasy teraz | Plan |
| Lokalizacja biblioteki | `/dashboard` = biblioteka (bez osobnej `/library`) | User: to naturalnie pierwszy ekran po zalogowaniu | Plan |
| Układ listy | Kafelki (grid) | User: pasuje do zamysłu z jej wcześniejszego projektu w Figmie | Plan |
| Producent / rozmiar drutów | `<datalist>` — podpowiedzi + swobodny wpis | User: dropdown z sugestiami, ale bez blokowania własnej wartości | Plan |
| Skład włókien | Dynamiczna lista wierszy (włókno + %) | Dane strukturalne od razu gotowe pod dopasowanie zamienników w S-02 | Plan |
| Suma % składu | Wymuszona = 100% (gdy lista niepusta) | Czyste dane wejściowe dla gwiazdy przewodniej S-02 | Plan |
| Ilość | Dwa niezależne pola (motki + gramy), oba widoczne | User: ta sama gramatura różnych włóczek to różny metraż | Plan |
| Ocena | Klikalny widget gwiazdek 1-5 | Czytelne na pierwszy rzut oka na kafelku listy | Plan |
| Błąd zapisu | Redirect z komunikatem w query string | Spójne z jedynym istniejącym wzorcem API (`signup.ts`) | Plan |
| Bucket zdjęć | Prywatny + RLS + signed URL | Zgodne z guardrail PRD o pełnej prywatności danych biblioteki | Plan |

## Zakres

**W zakresie:** formularz dodawania włóczki (wszystkie pola FR-002), upload zdjęcia do prywatnego Storage bucketu, widok listy (kafelki) na `/dashboard`, strona szczegółów `/yarns/[id]`, walidacja zod (nowa zależność), RLS na Storage.

**Poza zakresem:** edycja/usuwanie włóczki (S-03), filtrowanie/sortowanie (S-04), sekcja sugestii AI zamienników (S-02) — `/yarns/[id]` ma na nią miejsce, ale jej nie renderuje.

## Architektura / Podejście

Ten sam wzorzec co auth: natywny `<form>` POST → API route (`POST /api/yarns`) → zod walidacja → zapis przez serwis (`src/lib/services/yarns.ts`) → redirect. Odczyt (`/dashboard`, `/yarns/[id]`) to zwykłe SSR w Astro, RLS filtruje dane automatycznie po sesji. Skład włókien (dynamiczna lista w React) leci jako JSON w ukrytym polu formularza, żeby nie trzeba było przechodzić na fetch/JSON submit.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Fundament backendu | zod, Storage bucket + RLS, schemat walidacji | Błędna polityka RLS na Storage ujawniłaby zdjęcia między kontami |
| 2. Warstwa dostępu do danych | Serwis `yarns.ts` (list/get/create/photo) | Rozjazd między service a rzeczywistymi kolumnami, jeśli coś pominięto |
| 3. API endpoint | `POST /api/yarns` | Kolejność insert → upload → update musi być zachowana (zdjęcie zależy od `yarn.id`) |
| 4. Formularz dodawania | `/yarns/new`, dynamiczny skład, gwiazdki, datalisty | Formularz z ~10 polami — łatwo o rozjazd walidacji klient/serwer |
| 5. Lista i szczegóły | `/dashboard` jako biblioteka, `/yarns/[id]`, middleware | Musi odrzucić dostęp do cudzej włóczki mimo poprawnego ID w URL |

**Wymagania wstępne:** F-01 (gotowe), lokalne środowisko Supabase (`npx supabase start`) do weryfikacji ręcznej.
**Szacowany wysiłek:** ~2-3 sesje, 5 faz.

## Otwarte ryzyka i założenia

- Signed URL dla zdjęć generowany przy każdym odczycie listy — przy większej skali warto rozważyć cache, ale przy docelowych wolumenach (30+ włóczek/user, mało userów) to pomijalne.
- Listy podpowiedzi (producenci, rozmiary, włókna) to statyczne stałe dobrane przeze mnie — mogą wymagać korekty po pierwszym realnym użyciu.

## Kryteria sukcesu (podsumowanie)

- User dodaje włóczkę ze wszystkimi polami (w tym zdjęciem i składem) i widzi ją natychmiast na `/dashboard`.
- Dane jednej osoby (w tym zdjęcia) są całkowicie niedostępne dla innej, potwierdzone ręcznie na dwóch kontach testowych.
- Pusta biblioteka pokazuje zachęcający stan pusty, nie błąd.
