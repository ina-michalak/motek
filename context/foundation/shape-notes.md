---
project: "Motek"
context_type: greenfield
created: 2026-08-12
updated: 2026-08-12
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "typ bólu"
      decision: "dane uwięzione poza systemem (data trapped) + paraliż decyzyjny przy wyborze/zamianie włóczki + potrzeba notatek jakościowych (drapanie, ocena, przelicznik oczek/cm) żeby nie polegać na pamięci"
    - topic: "insight / dlaczego nie rozwiązane"
      decision: "ogólne narzędzia (Excel, notatki) nie rozumieją dziedziny włóczkarskiej; platformy jak Ravelry skupiają się na wzorach, nie na zarządzaniu własnym zapasem i sugerowaniu zamienników z tego, co user faktycznie ma"
    - topic: "zasięg persony"
      decision: "hobbystyczna nisza — ogólnie rękodzielnicy/rękodzielniczki robiący na drutach/szydełku, nie pojedynczy nazwany user"
    - topic: "kontekst użycia"
      decision: "średni/duży stash (30+ motków), częste wracanie do aplikacji przy każdym nowym projekcie"
    - topic: "auth strategy"
      decision: "login email + hasło, model płaski (bez ról) — każdy user widzi i zarządza tylko swoją biblioteką"
    - topic: "MVP flow"
      decision: "rejestracja/login → dodanie włóczki → widok biblioteki → szczegóły włóczki z sekcją zamienników AI → akceptacja/odrzucenie sugestii; mieści się w ~3 tygodniach pracy po godzinach"
    - topic: "odrzucenie sugestii AI"
      decision: "trwałe — odrzucona sugestia nie wraca ponownie dla tej włóczki"
    - topic: "status \"wyczerpana włóczka\""
      decision: "brak osobnego statusu — ilość = 0 w polu edytowalnym (FR-005) wystarcza jako sygnał"
    - topic: "reguła dopasowania zamienników"
      decision: "dopasowanie po parametrach (skład, grubość/druty-szydełko, opcjonalnie kolor) wyłącznie w obrębie własnej biblioteki usera; bez uczenia się ogólnych preferencji"
    - topic: "skala i ramy produktu"
      decision: "web-app, mała skala (garstka userów na start), brak twardego deadline'u, praca po godzinach, mvp_weeks=3"
  frs_drafted: 9
  quality_check_status: accepted
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Rękodzielniczki i rękodzielnicy robiący na drutach lub szydełku, posiadający średni-duży zapas włóczki (30+ motków), nie mają wygodnego sposobu na przechowywanie i przeszukiwanie swojej kolekcji. Kiedy zaczynają nowy projekt lub szukają konkretnej włóczki, muszą przekopywać fizyczny zapas, co prowadzi do bałaganu, traconego czasu i niepewności co do dokładnej ilości pozostałej przędzy z poprzednich projektów — co skutkuje niepotrzebnymi zakupami duplikatów albo brakiem wystarczającej ilości do dokończenia projektu. Dodatkowo, bez zapisanych notatek trudno zapamiętać subiektywne cechy konkretnej włóczki (czy drapie, jak się sprawdziła, jaką próbkę/przelicznik oczek daje na cm), więc te informacje giną między projektami.

Ogólne narzędzia do zarządzania zapasami (arkusze kalkulacyjne, notatki) nie rozumieją specyfiki dziedziny włóczkarskiej — nie mają pól na farbowanie, skład, dobrane druty/szydełko czy subiektywną ocenę jakości. Platformy społecznościowe jak Ravelry skupiają się na wzorach, a nie na zarządzaniu własnym zapasem i podpowiadaniu zamienników na podstawie tego, co użytkownik faktycznie posiada.

## User & Persona

Osoba robiąca na drutach lub szydełku jako hobby, posiadająca średni-duży zapas włóczki (30+ motków) gromadzony przez dłuższy czas. Sięga po aplikację przy każdym nowym projekcie — żeby sprawdzić, co ma w zapasie, ile jej zostało z poprzednich projektów, oraz znaleźć odpowiedni zamiennik, gdy brakuje konkretnej włóczki potrzebnej do wzoru.

## Access Control

Logowanie: email + hasło. Model płaski — brak ról, każdy zalogowany użytkownik widzi i zarządza wyłącznie własną biblioteką włóczek. Brak współdzielenia danych między użytkownikami (zgodnie z wykluczeniem z zakresu MVP).

## Success Criteria

### Primary
- 75% sugerowanych przez AI zamienników włóczki jest akceptowanych przez usera (nie odrzucanych).

### Secondary
- Użytkownicy wracają do aplikacji przy kolejnych projektach (ponowne logowanie w ciągu miesiąca od pierwszego dodania włóczek) — sygnał, że aplikacja jest realnie używana.
- Średnio 10+ włóczek dodanych na aktywnego użytkownika w pierwszym miesiącu — sygnał, że user widzi wartość w budowaniu swojego katalogu (bez tego rekomendacje zamienników nie mają sensu).

### Guardrails
- Dane biblioteki włóczek widoczne wyłącznie dla właściciela konta — brak wycieku między kontami.
- Dodawanie włóczki do biblioteki pozostaje lekkie — tylko niezbędne minimum pól jest wymagane, reszta opcjonalna.

## Functional Requirements

### Konta i dostęp
- FR-001: User może się zarejestrować i zalogować przy użyciu email + hasła. Priority: must-have
  > Socratic: Kontrargument rozważony: "wymóg konta od razu odstraszy testujących użytkowników". Rozstrzygnięcie: zostaje jak jest — konto jest niezbędne, żeby biblioteka włóczek była widoczna wyłącznie dla właściciela (patrz Access Control).

### Biblioteka włóczek
- FR-002: User może dodać włóczkę do swojej biblioteki, podając wymagane pola (nazwa, producent, ilość w motkach/gramach) oraz opcjonalne pola (kolor, farbowanie, skład, druty/szydełko, próbka, ocena/notatka, zdjęcie). Priority: must-have
  > Socratic: Kontrargument rozważony: "tyle pól, nawet opcjonalnych, przytłoczy usera; zdjęcie zwiększa złożoność bez wpływu na trafność rekomendacji". Rozstrzygnięcie: zostaje jak jest — pola opcjonalne dają userowi kontrolę nad poziomem szczegółowości, a zdjęcie ułatwia wizualne skanowanie listy i buduje poczucie własności biblioteki.
- FR-003: User może przeglądać listę własnych włóczek. Priority: must-have
- FR-004: User może filtrować i sortować listę włóczek. Priority: must-have
  > Socratic: Kontrargument rozważony: "przy małej liczbie włóczek na start filtrowanie/sortowanie to nadmiarowa złożoność". Rozstrzygnięcie: zostaje jak jest — persona ma docelowo średni/duży stash (30+ motków), a filtrowanie zapobiega bałaganowi, który jest sednem problemu z Vision. Sortowanie może na start objąć nie wszystkie parametry.
- FR-005: User może edytować dane zapisanej włóczki, w tym ilość (motki/gramy) — ustawienie ilości na 0 sygnalizuje, że włóczka jest wyczerpana, bez konieczności jej usuwania. Priority: must-have
- FR-006: User może usunąć włóczkę ze swojej biblioteki. Priority: must-have
  > Socratic: Kontrargument rozważony: "usunięcie włóczki, która była zaakceptowana jako czyjś zamiennik, może po cichu zepsuć tę relację". Rozstrzygnięcie: usuwanie zostaje proste (FR-006 bez zmian); potrzeba oznaczania "wyczerpana zamiast usunięta" rozwiązana przez FR-005 (ilość = 0), bez dodatkowego statusu.

### Zamienniki (AI)
- FR-007: Aplikacja wyświetla sugerowane przez AI zamienniki dla danej włóczki, wygenerowane na podstawie własnego zbioru usera. Gdy biblioteka usera jest zbyt mała, żeby wygenerować sensowne sugestie, aplikacja pokazuje czytelny stan zachęcający do dodania kolejnych włóczek zamiast pustej/bezwartościowej listy. Priority: must-have
  > Socratic: Kontrargument rozważony: "nowy user z małą biblioteką dostanie puste albo bezwartościowe sugestie — wartość funkcji zależy od wielkości zbioru". Rozstrzygnięcie: ryzyko realne, ale zaakceptowane — obsłużone fallbackiem (empty state) zamiast blokowania FR; wspiera to też kryterium Secondary (10+ włóczek/miesiąc).
- FR-008: User może zaakceptować sugestię AI, dodając ją jako zamiennik do włóczki. Priority: must-have
  > Socratic: Kontrargument rozważony: "zapisywanie akceptacji jako osobnej relacji zwiększa złożoność modelu danych — można by tylko wyświetlać sugestie bez zapisu". Rozstrzygnięcie: zostaje jak jest — zapis jest potrzebny do pomiaru kryterium sukcesu (75% acceptance rate) i do FR-009 (trwałe odrzucenie).
- FR-009: User może odrzucić sugestię AI. Odrzucenie jest trwałe — ta sama sugestia nie pojawia się ponownie w przyszłych zestawach zamienników dla tej włóczki. Priority: must-have
  > Socratic: Kontrargument rozważony: "jawne 'odrzuć' niekonieczne — brak reakcji mógłby liczyć się jako odrzucenie". Rozstrzygnięcie: zostaje jak jest, z trwałością odrzucenia — bez tego słaba rekomendacja (np. włóczka, która "gryzie" mimo podobnych parametrów) wracałaby uporczywie i frustrowała usera.

## User Stories

### US-01: User dodaje włóczkę i widzi sugerowane zamienniki

- **Given** zalogowany user posiadający co najmniej jedną włóczkę w bibliotece
- **When** dodaje kolejną włóczkę i otwiera jej szczegóły
- **Then** widzi sekcję zamienników z sugestiami AI wygenerowanymi na podstawie jego własnego zbioru

#### Acceptance Criteria
- Sugestie pochodzą wyłącznie z własnej biblioteki usera, nie z zewnętrznej bazy
- Brak innych włóczek w bibliotece pokazuje odpowiedni stan pusty, nie błąd
- User może zaakceptować lub odrzucić każdą sugestię pojedynczo

## Business Logic

Aplikacja sugeruje jako zamiennik te włóczki z własnej biblioteki usera, których parametry (skład, grubość/dobrane druty lub szydełko, opcjonalnie kolor) są najbardziej zbliżone do włóczki, dla której szuka się zamiennika.

Reguła konsumuje jako wejście parametry techniczne włóczek zapisane przez samego usera w jego bibliotece — nie sięga do zewnętrznej bazy ani do włóczek innych użytkowników. Wyjściem jest uporządkowana lista sugerowanych zamienników, które user może zaakceptować (dodając jako zamiennik) albo trwale odrzucić dla tej konkretnej pary włóczek. User spotyka tę regułę w sekcji "zamienniki" w widoku szczegółów każdej włóczki.

## Non-Functional Requirements

- Dane biblioteki (w tym zdjęcia i notatki) jednego użytkownika nie są dostępne ani widoczne dla innych użytkowników.
- Zapis dodania, edycji lub usunięcia włóczki potwierdza się w interfejsie w czasie < 1s odczuwanym przez usera jako natychmiastowy.
- Otwarcie sekcji zamienników pokazuje widoczną odpowiedź (listę sugestii albo czytelny stan pusty) w czasie < 5s.
- Aplikacja pozostaje użytkowalna na dwóch najnowszych wersjach głównych przeglądarek desktopowych (produkt tylko webowy w MVP).

## Non-Goals

- Dodawanie projektów (swetry, czapki itp.) i rekomendacje projektów do włóczki — osobny temat, poza zakresem MVP skupionego na bibliotece włóczek.
- Rekomendacje zamienników spoza własnej biblioteki usera (np. z internetu, bazy producentów) — AI sugeruje wyłącznie z tego, co user sam dodał.
- Współdzielenie/interakcje między użytkownikami — brak funkcji społecznościowych, każda biblioteka jest prywatna i odizolowana.
- Masowe dodawanie włóczek na podstawie faktur/paragonów — włóczki dodaje się ręcznie, pojedynczo.
- Aplikacja mobilna — na start tylko web.
- Uczenie się ogólnych preferencji usera z historii decyzji (AI "uczące się gustu") — zamiast tego proste dopasowanie parametrów + trwałe odrzucenie danej pary (patrz Business Logic).

## Forward: przyszłe rozszerzenia (poza PRD)

- Sugestie zamienników na podstawie szerszej bazy danych o włóczkach z internetu (nie tylko własna biblioteka usera) — pomysł na przyszłość, świadomie odłożony poza MVP.
- Wyjaśnienie userowi "dlaczego to jest rekomendacja" (np. "podobny skład i kolor") — nie blokuje MVP, do rozważenia jako rozszerzenie.

## Open Questions

1. **Jak formularz dodawania włóczki powinien poprowadzić usera do rozdzielenia nazwy i producenta (np. "Drops Karisma"), skoro z przyzwyczajenia może wpisać oba w jedno pole?** — Owner: user/projektant UX. Do rozstrzygnięcia na etapie projektowania formularza (np. podpowiedzi, autouzupełnianie, parsowanie).
