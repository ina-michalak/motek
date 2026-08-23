---
name: 10x-roadmap
description: >
  Generate context/foundation/roadmap.md from a PRD as an ordered set of
  vertical, end-to-end slices. Use AFTER /10x-prd (and after the tech-stack
  selection / bootstrap step, when applicable) to turn a holistic PRD into a
  sequence of user-visible milestones a programmer can pick off and hand to
  /10x-plan. Trigger phrases: "write the roadmap", "generate roadmap",
  "create the roadmap from PRD", "stwórz roadmapę", "turn PRD into a
  roadmap", "what should I build first". Do NOT use for per-change planning
  — that's /10x-plan's job.
argument-hint: "[path-to-prd]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---

# Mapa drogowa: Generowanie context/foundation/roadmap.md z PRD

Ta umiejętność stanowi pomost między **produktem** (PRD) a **planowaniem poszczególnych zmian** (`/10x-plan`). Jej jedyne zadanie: przeczytać PRD, automatycznie zbadać bazę kodu, **wywnioskować decydującą propozycję sekwencjonowania** (główny cel, kluczowy element, obszary inwestycji, główna blokada), ujawnić tylko prawdziwą niepewność, której PRD nie może rozwiązać, i wygenerować plik `context/foundation/roadmap.md`, który zawiera pionowe, widoczne dla użytkownika elementy w kolejności zależności — gotowe do przekazania do `/10x-plan <change-id>`.

**Postawa: opiniotwórczy rekomendator, oszczędny wywiad.** Umiejętność działa jak doświadczony lider techniczny, który przeczytał PRD, zbadał bazę kodu i przedstawił rekomendację — ale który nadal zadaje człowiekowi 2-3 kluczowe pytania przed podjęciem decyzji. Domyślny kształt Kroku 5 to **ograniczony wywiad**: maksymalnie trzy pytania kotwiczące (główny cel, kluczowy element, główna blokada), każde przedstawione jako jedna **silna Rekomendacja** oparta na cytowanej linii artefaktu, plus 1-2 alternatywy z jednowierszowym uzasadnieniem "dlaczego to również jest rozsądne". Użytkownik wybiera Rekomendację, wybiera alternatywę lub nadpisuje własnymi słowami. Obszary inwestycji są *wyprowadzane* z odpowiedzi, a nie zadawane. Dwa tryby awarii, których należy unikać: **(a) performatywne przesłuchanie** — zadawanie pytań, na które artefakty już odpowiadają, lub zadawanie więcej niż trzech pytań; **(b) fałszywa pewność** — ciche decydowanie o kluczowym ujęciu bez oferowania człowiekowi prawdziwego wyboru. Jedynym wyjątkiem są prawdziwie niestandardowe kształty MVP (nieznany wzorzec SaaS / CRUD / treści / opakowania AI) — tam agent pozwala na maksymalnie dwa pytania uzupełniające oprócz pytań kotwiczących, ponieważ intuicja projektowa wykonuje więcej pracy niż artefakty.

Jest to umiejętność **dekompozycji + sekwencjonowania**, a nie planowania niskopoziomowego. NIGDY nie wybiera frameworków, ścieżek plików, schematów, bibliotek ani szczegółów implementacji — te należą do `/10x-plan`. NIGDY nie przypisuje szacunków czasowych, rozmiarów koszulek, punktów ani dat kalendarzowych — wykonanie agentowe jest nieliniowe, a szacunki budżetowane czasowo byłyby kłamstwem. Co ONA ROBI: nazywa elementy, sekwencjonuje je według zależności i określonego celu, ujawnia, co blokuje, i kieruje otwarte pytania tam, gdzie można je rozwiązać.

Umiejętność jest **natywna dla AI** na cztery konkretne sposoby: (1) wyraża kolejność jako graf zależności, a nie kalendarz; (2) oznacza elementy, które mogą być wykonywane równolegle przez oddzielne uruchomienia agentów; (3) wypycha "blokujące niewiadome" tam, gdzie człowiek może je rozwiązać, zamiast pozwalać im cicho wślizgnąć się w implementację; (4) inwentaryzuje istniejącą bazę kodu za pomocą subagentów, zamiast pytać użytkownika, co już jest na miejscu.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: `context/foundation/prd.md` istnieje z nietrywialną zawartością (wypełnione FR i historie użytkowników, obecna logika biznesowa) ORAZ użytkownik chce wiedzieć, co zbudować najpierw / w jakiej kolejności. Typowe wyzwalacze: właśnie zakończono `/10x-prd`, właśnie zakończono bootstrap, lub powrót do projektu i pytanie "co dalej".

**Pomiń, gdy**: PRD jest puste (duże `## Open Questions`, `# TODO: domain rule`) — najpierw wskaż `/10x-prd` (lub nadrzędne `/10x-shape`); mapa drogowa z pustego PRD odziedziczy pustkę. Pomiń również, gdy użytkownik chce szczegółowo zaplanować *pojedynczą* zmianę — to zadanie `/10x-plan`. Mapa drogowa jest liczbą mnogą; plan jest liczbą pojedynczą.

## Związek z innymi umiejętnościami

- `/10x-shape` i `/10x-prd` — tworzą nadrzędne PRD, które ta umiejętność konsumuje. Jeśli `shape-notes.md` zawiera blok `## Forward: technical-roadmap` (gdzie kształt parkuje zawartość przeznaczoną dla mapy drogowej), ta umiejętność go podnosi.
- `10x-tech-stack-selector` — działa między `/10x-prd` a tą umiejętnością w łańcuchu bootstrap. Jeśli `context/foundation/tech-stack.md` istnieje, ta umiejętność odczytuje go jako dane wejściowe do wyprowadzenia `## Foundations` (szkielet uwierzytelniania, szkielet wdrożenia, obserwowalność — wszystko, co implikował krok wyboru stosu technologicznego) i do skrócenia badań bazowych dla już zadeklarowanych warstw.
- `/10x-plan` — konsument niższego poziomu. Użytkownik wybiera element mapy drogowej i wywołuje `/10x-plan <change-id>`; ta umiejętność tworzy folder zmiany, tworzy szczegółowy plan i zmienia `Status` dopasowanego elementu mapy drogowej na `planning`. Mapa drogowa NIE tworzy wstępnie folderów zmian; jeden element może wygenerować wiele zmian, gdy `/10x-plan` odkryje, że element jest nadal zbyt szeroki (tylko pierwszy zmienia status wspólnego elementu).
- `/10x-implement` (i jego autonomiczny odpowiednik `/10x-goal-implement`) — dalsze etapy. Gdy implementacja *rozpoczyna się* dla zmiany, której `Change ID` pasuje do elementu mapy drogowej, zmienia `Status` tego elementu na `in-progress` — odpowiednik otwartej pracy dla zmiany `done` w `/10x-archive`. Sama ta umiejętność nadal emituje tylko `proposed` / `ready` / `blocked` podczas generowania; pośrednie stany cyklu życia (`planning`, `in-progress`) są teraz zapisywane w dalszych etapach, gdy zmiana przechodzi przez plan → implementację. Każda zmiana w dalszych etapach jest dopasowywana przez `Change ID`, jest najlepszym wysiłkiem (brak dopasowania to ciche pominięcie) i jest tylko do przodu (nigdy nie cofa bardziej zaawansowanego statusu).
- `/10x-archive` — zamyka pętlę na końcu. Gdy zmiana, której `Change ID` pasuje do elementu mapy drogowej, zostanie zarchiwizowana, `/10x-archive` zmienia `Status` tego elementu na `done` (w `## At a glance` i w bloku treści elementu) i dodaje wpis do `## Done`. Ta umiejętność nigdy nie wypełnia wstępnie `## Done`; `/10x-archive` jest jej jedynym autorem.
- `/10x-frame`, `/10x-research` — ortogonalne. Działają na pojedynczej zmianie, a nie na mapie drogowej.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano argument ścieżki** (np. `/10x-roadmap @path/to/prd.md`), przechwyć go jako ścieżkę PRD. Przejdź do Kroku 1.
2. **Jeśli nie podano argumentu**, domyślnie ustaw ścieżkę PRD na `context/foundation/prd.md` i przejdź do Kroku 1. Nie pytaj jeszcze — Krok 1 obsługuje przypadek brakującego wejścia.

## Interaktywne monity — niezależne od hosta

Zawsze, gdy procedura mówi *"zapytaj użytkownika"*, użyj dowolnego narzędzia do pytań interaktywnych, które udostępnia agent hosta. Umiejętność jest niezależna od hosta; nie koduj na stałe nazwy jednego narzędzia do wykonania. Znane odpowiedniki (niepełna lista):

- Claude Code → `AskUserQuestion`
- Cursor → `ask_question`
- OpenAI Codex / Codex CLI → `request_user_input`
- Inne uprzęże → szukaj dowolnego narzędzia, którego opis wspomina o zadawaniu użytkownikowi ustrukturyzowanego pytania z opcjami.

**Zasada samodzielnego odkrywania.** Przed pierwszym krokiem interaktywnym przeskanuj dostępne narzędzia w poszukiwaniu takiego, które pasuje do powyższych wzorców (nazwy zawierające `ask`, `question`, `input`, `prompt_user` itp., z parametrem `question` lub `prompt` oraz polem `options`/`choices`). Użyj pierwszego dopasowania. Jeśli żadne nie jest dostępne, wróć do zwykłej wiadomości konwersacyjnej, prosząc użytkownika o odpowiedź jedną z oznaczonych opcji — nie blokuj procedury.

Podaj, które narzędzie zostało wybrane (lub że wrócono do zwykłego czatu) za pierwszym razem, gdy zadajesz pytanie, aby użytkownik mógł cię poprawić, jeśli istnieje lepsza opcja.

Narzędzie do pytań interaktywnych jest używane w Krokach 1, 3, 4, 5 i 9 (brakujące dane wejściowe, gotowość PRD, potwierdzenie bazowe, 2-3 kotwice ramowe, kolizja plików) — krótkie, ustrukturyzowane wybory. Krok 5 zadaje każde pytanie kotwiczące jako własne ustrukturyzowane pytanie; podsumowanie syntezy na końcu Kroku 5 jest zwykłym markdownem (bez dodatkowego pytania).

## Równoległe badania bazowe — niezależne od hosta

Zawsze, gdy procedura mówi o użyciu subagentów lub uruchomieniu równoległych sond, użyj dowolnego narzędzia do badań w tle / tworzenia zadań, które udostępnia host. Znane odpowiedniki (niepełna lista):

- Claude Code → `Agent` z typem subagenta Explore/ogólnego przeznaczenia
- Cursor → agenci w tle / delegowane zadania
- OpenAI Codex → narzędzia do delegowania zadań, jeśli są dostępne
- Inne uprzęże → szukaj dowolnego narzędzia, które uruchamia izolowanego agenta z własnym oknem kontekstu i zwraca podsumowanie.

**Zasada samodzielnego odkrywania.** Przed Krokiem 4 sprawdź, czy takie narzędzie istnieje. Jeśli tak, rozdziel sondy bazowe w jednym wywołaniu wsadowym. Jeśli nie, uruchom te same sondy sekwencyjnie w głównym kontekście. Obie ścieżki muszą zwrócić ten sam kształt podsumowania bazowego z dowodami plików.

## Proces

### Krok 1: Zlokalizuj i przeczytaj PRD

Rozwiąż ścieżkę wejściową:

- Jeśli argument został przekazany, użyj go dosłownie (usuń początkowe `@`, jeśli jest obecne).
- W przeciwnym razie domyślnie ustaw na `context/foundation/prd.md`.

```bash
test -f "<resolved-path>"
```

Jeśli plik istnieje, **przeczytaj go W CAŁOŚCI** (bez `limit`/`offset`).

Jeśli nie istnieje, zapytaj za pomocą wybranego narzędzia do pytań interaktywnych:

Pytanie interaktywne:
- question: "Nie znaleziono PRD pod adresem `<resolved-path>`. Jak chcesz postąpić?"
  header: "Dane wejściowe?"
  options:
  - label: "Najpierw uruchom /10x-prd (Zalecane)"
    description: "Zatrzymaj się tutaj. Uruchom /10x-prd, aby utworzyć prd.md, a następnie ponownie wywołaj /10x-roadmap."
  - label: "Podaj inną ścieżkę"
    description: "Poczekam, aż podasz mi ścieżkę."
  - label: "Anuluj"
    description: "Wyjdź bez zmian."
  multiSelect: false

W przypadku "Najpierw uruchom /10x-prd": wydrukuj wiadomość przekierowania i ZATRZYMAJ SIĘ.

### Krok 2: Przeczytaj dodatkowe dane wejściowe (najlepszy wysiłek)

Przeczytaj je, jeśli istnieją; w przeciwnym razie zanotuj ich brak i kontynuuj:

- `context/foundation/shape-notes.md` — poszukaj sekcji `## Forward: technical-roadmap`. Jeśli jest obecna, podnieś jej punkty dosłownie jako kandydatów na dane wejściowe mapy drogowej (użytkownik już je tam zaparkował podczas kształtowania).
- `context/foundation/tech-stack.md` — informuje sekcję `## Foundations` ORAZ skraca sondy bazowe (warstwa już zadeklarowana tutaj jest zgłaszana jako "zgodnie z tech-stack.md" bez ponownego sondowania).
- `context/foundation/roadmap.md` — jeśli już istnieje, zachowaj go dla Kroku 9 (obsługa kolizji). NIE modyfikuj go jeszcze.
- `context/foundation/lessons.md` — jeśli jest obecny, przeskanuj w poszukiwaniu wszelkich zasad dotyczących kolejności lub gotowości (np. "zawsze wysyłaj najbardziej ryzykowny element jako pierwszy"). Traktuj jako priorytet, a nie jako dogmat.

### Krok 3: Sprawdzenie gotowości PRD

Przed generowaniem oceń PRD na podstawie heurystyki gotowości 0–4. Każdy sygnał wnosi 1 punkt:

1. **Wizja i opis problemu są nietrywialne** — sekcja istnieje, zawiera ≥ 2 zdania, NIE zawiera `# TODO`.
2. **Co najmniej jedna wypełniona historia użytkownika** — istnieje nagłówek `### US-NN:` z blokiem Given/When/Then pod nim (nie `# TODO`).
3. **Co najmniej jeden `must-have` FR** — istnieje linia pasująca do `^- FR-\d{3}: .* (P|p)riority: must-have$`.
4. **Wypełniona logika biznesowa** — pierwsza niepusta linia sekcji `## Business Logic` to zdanie deklaratywne (nie `# TODO: domain rule`).

Jawnie udokumentuj heurystykę w rozmowie:

```
Sprawdzenie gotowości PRD (heurystyka, 4 sygnały, 1 punkt każdy):
  [✓|✗] Wizja i opis problemu nietrywialne
  [✓|✗] ≥ 1 wypełniona historia użytkownika
  [✓|✗] ≥ 1 must-have FR
  [✓|✗] Wypełniona logika biznesowa

  Wynik: <N>/4
  Otwarte pytania w PRD: <liczba>
```

**Wynik ≥ 3**: PRD jest gotowe do mapy drogowej; przejdź do Kroku 4.

**Wynik < 3**: jawnie ostrzeż. Nazwij, czego brakuje i dlaczego jest to ważne dla mapy drogowej (NIE ogólne "twoje PRD jest cienkie"):

```
To PRD uzyskało wynik <N>/4 w heurystyce gotowości mapy drogowej. Brakujące sygnały:

  - <nazwa sygnału>: <jednowierszowa konsekwencja dla mapy drogowej>
  - ...

Mapa drogowa wygenerowana z pustego PRD będzie miała wiele elementów oznaczonych jako Status:
zablokowane, z pierwszą niewiadomą będącą luką w PRD. Jest to prawidłowy stan pośredni
— mapa drogowa ujawnia, co blokuje — ale jeśli masz czas, aby najpierw ugruntować
PRD, wynikowa mapa drogowa będzie znacznie bardziej użyteczna.
```

Następnie zapytaj za pomocą wybranego narzędzia do pytań interaktywnych:

Pytanie interaktywne:
- question: "Jak chcesz postąpić?"
  header: "Cienkie PRD"
  options:
  - label: "Najpierw ugruntuj PRD (Zalecane)"
    description: "Zatrzymaj się tutaj. Rozwiąż otwarte pytania / TODO w PRD, a następnie ponownie wywołaj /10x-roadmap."
  - label: "Kontynuuj mimo to"
    description: "Generuj z tego, co jest. Puste obszary pojawią się jako zablokowane elementy z luką w PRD jako ich niewiadomą."
  - label: "Anuluj"
    description: "Wyjdź bez zmian."
  multiSelect: false

W przypadku "Najpierw ugruntuj PRD": wydrukuj przekierowanie i ZATRZYMAJ SIĘ. W przypadku "Kontynuuj mimo to": kontynuuj z zapisanym wynikiem, aby Krok 6 mógł oznaczyć cienkie obszary.

### Krok 4: Automatyczne badanie bazowe

Ocena "co już jest na miejscu" nie powinna spoczywać na użytkowniku — baza kodu jest źródłem prawdy. Użyj wybranego narzędzia do badań w tle / tworzenia zadań, jeśli jest dostępne, aby równolegle zinwentaryzować każdą warstwę. Jeśli takie narzędzie nie istnieje, uruchom te same sondy sekwencyjnie w głównym kontekście. Każda sonda zwraca jednoparograficzny werdykt: **obecny** (z dowodami plików), **nieobecny** lub **częściowy** (szkielet istnieje, ale nie jest podłączony). Następnie przedstaw inwentaryzację do potwierdzenia przez użytkownika, zanim zostanie ona przekazana do Foundations.

**Warstwy do sondowania** (pomiń warstwę, jeśli `tech-stack.md` już nazywa wybór tej warstwy — zgłoś "zgodnie z tech-stack.md: <wybór>" zamiast sondowania):

| Warstwa          | Czego szuka sonda                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Frontend       | Framework UI, narzędzia do budowania, routing, biblioteki komponentów — `package.json` deps, pliki konfiguracyjne frameworka           |
| Backend / API  | Framework serwera, trasy API, obsługi żądań — punkty wejścia, pliki tras, kontrolery                            |
| Data           | Sterownik DB, ORM/konstruktor zapytań, narzędzia do schematów/migracji, dane początkowe — pliki schematów, katalogi migracji         |
| Auth           | Integracja dostawcy uwierzytelniania, obsługa sesji/tokenów, middleware uwierzytelniania — konfiguracja uwierzytelniania, pliki middleware                |
| Deploy / infra | Cel hostingu, konfiguracja kontenera, przepływy pracy CI/CD, infrastruktura jako kod — `Dockerfile`, `.github/workflows`, YAML wdrożenia |
| Observability  | Biblioteka logowania, śledzenie błędów, metryki, pulpity nawigacyjne — importy sentry/datadog/otel, middleware logowania                |

**Uruchom wszystkie sondy w jednym delegowaniu wsadowym, gdy host to obsługuje.** Każdy monit jest krótki i samodzielny; delegowani agenci zwracają tylko jeden akapit każdy, więc główny kontekst pozostaje mały. Przykład dla Auth:

> Zinwentaryzuj warstwę uwierzytelniania/tożsamości tej bazy kodu. Zgłoś w mniej niż 100 słowach: (1) czy istnieje integracja dostawcy uwierzytelniania? Nazwij ją. (2) Czy istnieją ścieżki kodu do wydawania lub weryfikacji sesji/tokenów? Podaj plik:linię. (3) Czy istnieje middleware uwierzytelniania na poziomie trasy? Podaj. Jeśli warstwa jest nieobecna, powiedz "nieobecna" — nie spekuluj. Nie sugeruj zmian. Nie pisz ani nie edytuj plików.

Dostosuj ten sam szablon dla każdej warstwy. Zawsze wymagaj: werdyktu obecny/nieobecny/częściowy, ≤ 100 słów, dowodów plików, gdy są obecne, bez spekulacji, bez edycji.

Po powrocie wszystkich sond, przedstaw użytkownikowi jednowierszowe podsumowanie bazowe:

```
Baza kodu (automatycznie zbadana):

  Frontend:      <obecny | nieobecny | częściowy> — <jedna linia, ze wskaźnikiem pliku>
  Backend/API:   <…>
  Data:          <…>
  Auth:          <…>
  Deploy/infra:  <…>
  Observability: <…>
```

Następnie potwierdź:

Pytanie interaktywne:
- question: "Czy ta baza odpowiada Twojemu rozumieniu? Coś do poprawienia lub dodania, zanim zostanie wykorzystane w Foundations?"
  header: "Baza"
  options:
  - label: "Wygląda dobrze — kontynuuj"
    description: "Użyj tej bazy jako danych wejściowych dla Foundations i sekcji ## Baseline mapy drogowej."
  - label: "Popraw jedną lub więcej warstw — wyjaśnię"
    description: "Swobodna korekta. Ponownie zapiszę warstwę(y) przed kontynuowaniem."
  - label: "Dodaj coś, czego nie ma na liście"
    description: "Swobodna forma. Rzeczy, które sondy przeoczyły (zaplanowane, ale nie podłączone, szkielet z innego repozytorium itp.)."
  multiSelect: true

Zapisz potwierdzoną bazę. Bezpośrednio zasila Krok 6a (Foundations): warstwy **obecne** → Foundations je pomija; **nieobecne** lub **częściowe** → otwiera się slot Foundations. Zasila również sekcję `## Baseline` mapy drogowej dosłownie.

### Krok 5: Oszczędny wywiad — 2-3 pytania kotwiczące, każde z silną Rekomendacją

PRD zawiera **produkt**. Baza (Krok 4) zawiera **to, co już istnieje**. Ten krok tworzy ramy mapy drogowej — `main_goal`, `north_star`, obszary inwestycji, `top_blocker` — poprzez ograniczony wywiad: maksymalnie **trzy pytania kotwiczące**, każde zawierające jedną silną **Rekomendację** opartą na cytowanej linii artefaktu plus 1-2 alternatywy z jednowierszowym uzasadnieniem "dlaczego to również jest rozsądne". Użytkownik wybiera Rekomendację, wybiera alternatywę lub swobodnie nadpisuje. Umiejętność nigdy nie zadaje więcej niż 3 pytań kotwiczących; obszary inwestycji są *wyprowadzane* z odpowiedzi, a nie zadawane.

Jest to złoty środek między dwoma trybami awarii, przez które przeszła ta umiejętność: ciche automatyczne ramowanie (fałszywa pewność, brak ludzkiej bramki na kluczowe wywołania) i nieograniczone odkrywanie (performatywne przesłuchanie, zadawanie pytań, na które artefakty już odpowiadają). Mapa drogowa zbudowana na trzech prawdziwych wyborach dokonanych przez użytkownika z otwartymi oczami jest trwalsza niż ta zbudowana na którejkolwiek z tych skrajności.

Jeśli `shape-notes.md` zawierał blok `## Forward: technical-roadmap`, podnieś go jako silny priorytet — włącz go do Rekomendacji, nie wywołuj ponownie treści, które użytkownik już tam zaparkował.

**5a. Wywnioskuj rekomendacje i alternatywy, które są faktycznie rozsądne.**

Dla każdej kotwicy poniżej, wyprowadź *zarówno* Rekomendację, JAK I alternatywy — oparte na konkretnych cytatach z frontmattera PRD / `## Vision` / `## Success Criteria` / `## NFRs` / `## Open Questions` / baseline / `tech-stack.md`. Alternatywa jest "rozsądna" tylko wtedy, gdy prawdziwy sygnał w artefaktach ją wspiera LUB jest to powszechna, możliwa do obrony domyślna wartość dla kształtu produktu. **Nie wymieniaj słomianych kukieł.** Jeśli tylko jedna wartość jest wiarygodna (żadne prawdziwe wsparcie alternatywne nie jest możliwe z artefaktów), powiedz to — ta kotwica zostanie przedstawiona z jedną Rekomendacją i opcją awaryjną "nadpisz własnymi słowami".

- **`main_goal`** — wybierz z `market-feedback` | `quality` | `low-complexity` | `speed` | `learn` | `other`. Sygnały: `timeline_budget` (ciasny → speed lub low-complexity), `target_scale` (mały → low-complexity; masowy → quality), sformułowanie kryteriów sukcesu ("ucz się od prawdziwych użytkowników" → market-feedback; "zweryfikuj najbardziej ryzykowne założenie" → market-feedback; "brak incydentów przy uruchomieniu" → quality), ton wizji (eksploracyjne hobby → learn; twardy termin → speed). Alternatywy to *sąsiednie* wartości, które te same dowody mogłyby rozsądnie wspierać — np. `market-feedback` i `speed` często współistnieją, gdy PRD mówi "wysyłaj, aby szybko się uczyć".

- **`north_star`** — najmniejszy, kompleksowy, widoczny dla użytkownika przepływ, który, jeśli zostanie wysłany jako pierwszy, udowadnia podstawową hipotezę wizji PRD. Zazwyczaj odnosi się do US-NN o wysokim priorytecie ORAZ do głównego kryterium sukcesu. Rozsądne alternatywy to *inne* kandydatury, które również odnoszą się do głównego kryterium sukcesu lub do US-NN o wysokim priorytecie, z mniejszą liczbą wymagań wstępnych lub z różnymi konsekwencjami sekwencjonowania. Gdy istnieje więcej niż trzech kandydatów, przedstaw trzech najlepszych.

- **`top_blocker`** — wybierz z `skills` | `capacity` | `time` | `decisions` | `external` | `motivation` | `none`. Sygnały: ≥ 3 nierozwiązane `## Open Questions` w PRD → `decisions`; ambitny zakres vs. niedopasowanie `timeline_budget` → `time` lub `capacity`; zależność od dostawcy wymieniona w PRD, która nie została jeszcze zakontraktowana → `external`; stos technologiczny wymienia warstwę, której zespół nigdy nie wdrożył → `skills`; żadne nie pasuje → `none`. Rozsądne alternatywy to *sąsiednie* typy blokad, które wyzwalają się na podobnych sygnałach — np. `time` i `capacity` często wyzwalają się na napięciu między zakresem a terminem.

- **Obszary inwestycji** (NIE zadawane — wyprowadzane w 5d) — dla każdego z `frontend`, `backend`, `data`, `infra`: zdecyduj `invest deeply` vs `go simple`. Sygnały: NFR PRD, które blokują uruchomienie w warstwie (prywatność / opóźnienie / poprawność → inwestuj tam), luki w bazach, które odpowiadają must-have PRD (brak uwierzytelniania + must-have dla wielu użytkowników → inwestuj w uwierzytelnianie), koncentracja otwartych pytań w jednej warstwie (nierozwiązane decyzje tam → inwestuj) i wybrany `main_goal` (`quality` wzmacnia warstwy prywatności/obserwowalności; `learn` wzmacnia nieznaną warstwę; `speed` / `low-complexity` domyślnie utrzymuje wszystko proste). NIE promuj warstwy do "inwestuj" bez podania sygnału PRD/baseline/main_goal.

**5b. Pomiń kotwicę tylko wtedy, gdy artefakt jest jednoznaczny.**

Jeśli frontmatter PRD lub Kryteria Sukcesu *dosłownie stwierdzają* wartość (np. `timeline_budget: "1 week to ship"` plus Vision stwierdzające "musimy uruchomić przed X" → `main_goal: speed` jest jednoznaczne), pomiń to pytanie. Ogłoś pominięcie w rozmowie z wybraną wartością i cytatem, który ją blokuje. Nigdy nie pomijaj kotwicy, dla której istnieje jakakolwiek wiarygodna alternatywa; potwierdzenie użytkownika dotyczące prawdziwego wyboru jest cenniejsze niż zaoszczędzone sekundy.

Limit to **3 pytania kotwiczące**. W praktyce zazwyczaj zadajesz 2-3; możesz zadać mniej, jeśli wiele kotwic jest jednoznacznych z artefaktów, ale NIGDY nie możesz zadać więcej.

**5c. Przeprowadź wywiad — jedno ustrukturyzowane pytanie na kotwicę, w kolejności.**

Dla każdej niepominiętej kotwicy — `main_goal`, następnie `north_star`, następnie `top_blocker` — użyj wybranego narzędzia do pytań interaktywnych. Każde pytanie to osobne wywołanie (sekwencyjne, nie wsadowe). Format:

Pytanie interaktywne:
- question: "<pytanie kotwiczące w języku naturalnym, w języku użytkownika>"
  header: "<krótki nagłówek — np. Cel | Gwiazda | Główne ryzyko / Goal | North star | Blocker>"
  options:
  - label: "<Wartość rekomendacji> (Zalecane)"
    description: "<Jednowierszowe uzasadnienie, z cytatem/wskaźnikiem artefaktu, który uzasadnia rekomendację.>"
  - label: "<Wartość alternatywy A>"
    description: "Rozsądne, gdy <jednowierszowy warunek, który artefakty częściowo wspierają>; wybierzesz to, gdy <konsekwencja sekwencjonowania/zakresu>."
  - label: "<Wartość alternatywy B>"
    description: "Rozsądne, gdy <jednowierszowy warunek>; wybierzesz to, gdy <konsekwencja>."
  - label: "Coś innego — wyjaśnię"
    description: "Swobodna forma. Podaj wartość i powód; zapiszę oba i odpowiednio je uporządkuję."
  multiSelect: false

Zasady dla bloku opcji:
- **Rekomendacja jest zawsze opcją 1.** Nie ukrywaj jej. Sufiks "(Zalecane)" na etykiecie jest kluczowy.
- **Każda alternatywa zawiera własną klauzulę "dlaczego rozsądne".** Nie "alternatywa: jakość" — ale "alternatywa: jakość — rozsądne, gdy poprawność uruchomienia jest ważniejsza niż sygnał od pierwszego użytkownika; wybierzesz to, gdy koszt publicznego błędu przekracza koszt wolniejszego uruchomienia". Alternatywy bez klauzuli "dlaczego" są słomianymi kukłami i muszą zostać usunięte.
- **Maksymalnie 2 alternatywy.** Plus swobodna opcja awaryjna. Łącznie opcji: 2-4. Listy pięciu opcji męczą użytkownika bez dodawania sygnału.
- **Opcje gwiazdy północnej nazywają kandydatów na elementy, a nie abstrakcyjne wartości.** Etykieta każdej opcji to `<kandydat US-NN> — <jednowierszowy wynik>`. Opis zawiera, dlaczego ten element jest zalecanym/alternatywnym kamieniem milowym walidacji.
- **Jeśli tylko jedna wartość jest wiarygodna dla kotwicy** (5a mówi, że nie istnieją rozsądne alternatywy), przedstaw tylko dwie opcje: Rekomendację i "Coś innego — wyjaśnię". Ujawnij w tekście pytania: "artefakty wspierają tutaj tylko jedną interpretację; zgłoś, jeśli twoja interpretacja jest inna".

**5d. Wyprowadź obszary inwestycji (bez pytania).**

Po udzieleniu odpowiedzi na 2-3 pytania kotwiczące, wyprowadź obszary inwestycji z: (1) wybranego `main_goal`, (2) NFR PRD blokujących uruchomienie w warstwie, (3) luk w bazach danych mapowanych na must-have FR, (4) koncentracji otwartych pytań. Ogłoś wyprowadzoną inwestycję w podsumowaniu syntezy (5e). Użytkownik może nadpisać w jednej linii; nie jest proszony o wybór.

**5e. Podsumowanie syntezy — potwierdź bez pytania.**

Wyślij pojedynczą wiadomość w zwykłym markdownie, która blokuje ramowanie. Brak nowych pytań. Odzwierciedlaj język użytkownika od początku do końca (polskie PRD → polskie podsumowanie). Kształt:

```markdown
Blokowanie ramowania mapy drogowej:

- **Cel sekwencjonowania: `<main_goal>`.** <Jednowierszowe uzasadnienie, łączące się z odpowiedzią użytkownika na kotwicę i wskaźnikiem artefaktu.>
- **Gwiazda przewodnia: `<S-NN candidate> — <Outcome>`.** <Jednowierszowe powiązanie tego elementu z głównym kryterium sukcesu lub najbardziej ryzykownym założeniem.>
- **Główne ryzyko / blocker: `<top_blocker>`.** <Jednowierszowe z konkretnym sygnałem — liczba otwartych pytań, nazwany dostawca, niedopasowanie terminu itp.>
- **Inwestycje: w `<layer>` głęboko; reszta lekko.** <Jednowierszowe — wyprowadzone z main_goal + NFR + luki w bazach; nie zadawane.>

Powiedz "go" żeby ruszyć dalej, albo nadpisz dowolną linię ("inwestycja powinna być w data, nie infra"). Nie będę pytał ponownie o to, co już ustaliliśmy.
```

Gdy użytkownik powie "go" lub pozostanie cicho po następnym kroku, kontynuuj z zablokowanym ramowaniem. Nadpisania poszczególnych linii są akceptowane i ponownie zapisywane bez ponownego zadawania pytań o inne kotwice.

**5f. Wyjątek dla niestandardowego kształtu MVP.**

"Niestandardowy kształt MVP" to produkt, który nie pasuje do znanego wzorca: nie jest to pulpit nawigacyjny SaaS, nie jest to aplikacja CRUD, nie jest to platforma treści, nie jest to oczywisty wrapper AI, nie jest to strona marketingowa. Sygnały: `## Vision` w PRD opisuje nową interakcję lub domenę; `## User Stories` nie grupują się wokół znanej encji (tworzenie/czytanie/aktualizowanie/usuwanie `<rzeczy>`); `tech-stack.md` deklaruje nieoczywiste narzędzia (silniki gier, mosty sprzętowe, wyspecjalizowane środowiska uruchomieniowe, nowe kształty agentów); sformułowanie użytkownika podkreśla nową mechanikę, a nie znany wzorzec.

Gdy PRD wygląda na niestandardowo ukształtowane:

1. **Rozpocznij wywiad, ujawniając to** w wiadomości poprzedzającej pierwsze pytanie kotwiczące: *"To PRD nie pasuje do znanego wzorca MVP (brak pulpitu nawigacyjnego SaaS / CRUD / treści / kształtu wrappera AI). Moje rekomendacje dla kolejnych 2-3 pytań są słabsze niż zwykle — mocno sprzeciwiaj się, jeśli moja interpretacja jest błędna."*
2. **Złagodź rekomendację dotyczącą `north_star` i wszelkich wyprowadzonych obszarów inwestycji.** Sformułuj opis rekomendacji jako *"Moja najlepsza interpretacja to X, ale sygnał artefaktu jest słaby"* zamiast *"PRD §Vision mówi X"*.
3. **Zezwól na maksymalnie dwie dodatkowe wymiany** oprócz trzech pytań kotwiczących. Niestandardowe MVP nagradzają dialog; intuicja projektowa użytkownika wykonuje więcej pracy niż artefakty. Dodatkowe pytania to swobodny tekst, a nie nowe ustrukturyzowane pytania.

Jest to jedyna ścieżka, w której umiejętność skłania się ku dialogowi, a nie od niego. Całkowity limit w ramach tego wyjątku: 3 kotwice + 2 pytania uzupełniające = 5 wymian.

**5g. Wytyczne dotyczące sformułowań i języka (dotyczą każdego pytania kotwiczącego i podsumowania).**

- **Odzwierciedlaj język użytkownika od początku do końca.** Polskie PRD → polskie pytania, opcje i podsumowanie. Przetłumacz nazwy sekcji (`Open Questions` → `Otwarte pytania`, `Functional Requirements` → `Wymagania funkcjonalne`, `Non-Goals` → `Poza zakresem`, `Success Criteria` → `Kryteria sukcesu`). Brak angielskich fragmentów, takich jak "north star", "blocker", "must-have" w polskim pytaniu lub etykiecie opcji — sparafrazuj ("gwiazda przewodnia", "główne ryzyko", "konieczne").
- **Przetłumacz wewnętrzny żargon umiejętności na prosty język produktu.** *"Privacy posture"* → *"polityka prywatności dostawcy AI"*. *"North star"* → *"pierwsza historyjka, która udowadnia, że produkt działa"*. *"Blocking unknowns"* → *"pytania bez odpowiedzi, które blokują dalsze planowanie"*. Użytkownik nigdy nie powinien musieć otwierać dokumentacji tej umiejętności, aby zrozumieć pytanie.
- **Cytaty w opisach opcji zasługują na swoje miejsce.** Cytat taki jak *"tech-stack wskazuje Astro + Supabase + OpenRouter"* to tylko lista nazw, chyba że następna klauzula mówi, dlaczego jest to ważne dla *tej* kotwicy. Albo włącz implikację, albo usuń cytat.
- **Rekomendacja musi być możliwa do obrony, a nie agresywna.** Jednowierszowa rekomendacja jest oparta na linii artefaktu, a nie na pewnym tonie. Jeśli nie możesz wskazać cytatu, obniż rangę — przedstaw kotwicę z dwiema alternatywami o równej wadze (i swobodną opcją awaryjną) i pozwól użytkownikowi wybrać.

**5h. Twardy limit.**

Poza wyjątkiem niestandardowego MVP: **3 pytania kotwiczące, bez pytań uzupełniających, jedno podsumowanie syntezy.** W ramach wyjątku: 3 kotwice + do 2 wymian uzupełniających. Jeśli po osiągnięciu limitu kotwica jest nadal nierozstrzygnięta, **podejmij decyzję** za pomocą Rekomendacji, zapisz ją w frontmatterze z jednowierszowym uzasadnieniem i kontynuuj — użytkownik może w każdej chwili nadpisać, edytując plik lub mówiąc "właściwie, blokada powinna być pojemnością, a nie czasem". Umiejętność nie wkracza na terytorium `/10x-plan` i nie zatrzymuje się na przypadku brzegowym pod-kotwicy.

### Krok 6: Dekompozycja i sekwencjonowanie

Ten krok jest miejscem, w którym umiejętność zarabia na siebie. Zbuduj zawartość mapy drogowej **w pamięci** (jeszcze nie na dysku).

**6a. Zidentyfikuj fundamenty.** Fundament to przekrojowy warunek wstępny, który sam w sobie nie ma widocznego dla użytkownika wyniku, ale odblokowuje nazwane pionowe elementy, zmniejsza nazwaną blokującą niewiadomą lub tworzy infrastrukturę weryfikacyjną wymaganą przez nazwany element. Jest to umowa umożliwiająca, a nie pozwolenie na mapowanie poziome. Źródła:

- Decyzje `tech-stack.md`, które implikują prace szkieletowe (dostawca uwierzytelniania → szkielet uwierzytelniania; wybrany cel wdrożenia → szkielet wdrożenia; wybrane monitorowanie → baza obserwowalności).
- `## Non-Functional Requirements` w PRD, które wymagają infrastruktury (np. NFR "p95 < 800ms" implikuje podstawowe instrumentarium wydajności).
- `## Access Control` w PRD, jeśli jest to coś więcej niż "pojedynczy użytkownik, brak uwierzytelniania".
- **Baza z Kroku 4** — wszystko zgłoszone jako **nieobecne** lub **częściowe** jest kandydatem na fundament. Wszystko zgłoszone jako **obecne** jest pomijane (i odnotowane w `## Baseline`).
- **Krok 5 "Gdzie inwestować"** — wybory "invest deeply" promują fundament do własnego, jawnego elementu (np. "warstwa danych — invest deeply" + brak bazy → F-NN jawny fundament projektowania danych, a nie tylko niejawny krok migracji).

Nie wymyślaj fundamentów, których PRD nie implikuje (brak "ustaw Storybook", chyba że coś to wymusza). Nie twórz ogólnego fundamentu "warstwy danych", "warstwy API", "warstwy UI" lub "systemu uwierzytelniania", chyba że możesz nazwać element `S-NN` niższego poziomu, który odblokowuje, blokującą niewiadomą, którą zmniejsza, lub ścieżkę weryfikacji, którą umożliwia.

**Limit zakresu fundamentu.** Fundament musi być najmniejszym przekrojowym elementem umożliwiającym, który pozwala na kontynuowanie nazwanego pionowego elementu. Może ustanawiać minimalną umowę, szkielet, politykę lub ścieżkę weryfikacji; NIE może ukończyć całej warstwy architektonicznej przed pracami widocznymi dla użytkownika. Jeśli wynik fundamentu brzmi jak "warstwa danych/API/UI/uwierzytelniania jest kompletna", podziel go lub włącz minimalną potrzebną pracę do pierwszego elementu `S-NN`, który go konsumuje. Test: po wdrożeniu fundamentu, co najmniej jeden element `S-NN` niższego poziomu powinien nadal integrować i ćwiczyć tę warstwę poprzez rzeczywistą funkcjonalność użytkownika.

**Zasada progresywnego ujawniania.** Preferuj wprowadzanie elementów technicznych w momencie, gdy pierwszy element widoczny dla użytkownika ich potrzebuje. Fundament jest uzasadniony tylko wtedy, gdy jego odłożenie w czasie sprawiłoby, że pierwszy pionowy element byłby niemożliwy do zaplanowania, niebezpieczny lub niemożliwy do zweryfikowania. "Będziemy potrzebować tej warstwy w końcu" to za mało.

Identyfikatory fundamentów to `F-NN` (dwucyfrowe z wiodącym zerem, zaczynając od `F-01`).

**6b. Rozłóż powierzchnię widoczną dla użytkownika na elementy.** Przejdź przez `## User Stories` i `## Functional Requirements` w PRD. Pogrupuj je w pionowe, kompleksowe elementy, gdzie każdy element:

- Dostarcza **pojedynczą, widoczną dla użytkownika funkcjonalność** określoną jako "użytkownik może …".
- Dotyka każdej warstwy potrzebnej do urzeczywistnienia tej funkcjonalności (dane + logika + interfejs), od góry do dołu.
- Jest wystarczająco mały, aby jedno wywołanie `/10x-plan` wygenerowało wykonalny plan, ale wystarczająco duży, aby element był znaczący sam w sobie (element to zazwyczaj jeden US-NN, czasami dwa, gdy są ściśle powiązane — np. "tworzenie" i "listowanie" tej samej encji).

NIE dziel poziomo ("element bazy danych", "element API", "element UI"). Poziome elementy to antywzorzec, któremu ta umiejętność ma zapobiegać. Domyślna dekompozycja jest pionowa: każdy element widoczny dla użytkownika powinien tworzyć użyteczną funkcjonalność, którą agent może zaimplementować i zweryfikować od początku do końca. Praca pozioma jest dozwolona tylko jako nazwany fundament z wyraźnym powodem niższego poziomu.

Identyfikatory elementów to `S-NN` (dwucyfrowe z wiodącym zerem, zaczynając od `S-01`).

Każdy `F-NN` i `S-NN` otrzymuje również stabilny **Change ID** w formacie kebab-case. Change ID to pomost do `/10x-plan`, a później element backlogu w Jira/Linear. Preferuj zwięzłe, zorientowane na wyniki nazwy, takie jak `first-gated-generation`, `minimal-auth-for-generation` lub `srs-review-session`.

**Granularność i równowaga elementów.** Elementy mapy drogowej powinny być z grubsza porównywalne pod względem wysiłku planistycznego i wagi koncepcyjnej, mimo że nie zawierają szacunków. Unikaj jednego elementu, który pochłania większość PRD, podczas gdy późniejsze elementy są drobnymi poprawkami. Jeśli jeden element kandydujący odwołuje się do wielu must-have FR lub wielu niepowiązanych historii użytkowników, podziel go według widocznych dla użytkownika wyników, faz przepływu pracy, person lub granic ryzyka, aż każdy `S-NN` będzie czymś, co jeden `/10x-plan <change-id>` może spójnie rozważyć.

Użyj tych wyzwalaczy podziału:

- Element obejmuje więcej niż jedną główną akcję użytkownika (np. "importuj, edytuj, udostępniaj i raportuj").
- Element łączy konfigurację, podstawowy przepływ pracy i administrację w jednym elemencie.
- Element spełnia większość must-have FR, podczas gdy inne elementy mają tylko jedno drobne FR.
- Linia ryzyka elementu zawiera więcej niż jedno niezależne ryzyko.
- Element potrzebuje niepowiązanych niewiadomych, należących do różnych osób lub warstw.

NIE dziel według warstw, aby naprawić rozmiar. Dziel według węższych pionowych wyników. Na przykład, zastąp "kompletny system przepisów" przez "użytkownik może zapisać pierwszy przepis", "użytkownik może wyszukiwać zapisane przepisy" i "użytkownik może udostępniać przepis" — a nie "schemat przepisów", "API przepisów" i "UI przepisów".

**6c. Zbuduj graf zależności.** Dla każdego elementu i fundamentu zidentyfikuj wymagania wstępne:

- **Inne identyfikatory fundamentów**, których element potrzebuje (np. S-03 potrzebuje F-01 uwierzytelniania).
- **Inne identyfikatory elementów**, których dane lub funkcjonalności ten element konsumuje (np. S-04 "oceń przepis" zależy od S-03 "zobacz przepisy").
- **Stan zewnętrzny** (np. "zasiana tabela składników"). Konkretny, a nie ogólnikowy.

Dla każdego fundamentu zidentyfikuj również **Odblokowania**:

- jeden lub więcej pionowych elementów `S-NN` niższego poziomu, które fundament bezpośrednio umożliwia, LUB
- jedną lub więcej blokujących niewiadomych, które zmniejsza, LUB
- jedną lub więcej nazwanych ścieżek weryfikacji wymaganych przez element niższego poziomu.

Jeśli fundament nie ma jasnych Odblokowań, usuń go lub włącz pracę do pierwszego pionowego elementu, który go potrzebuje.

Następnie dla każdego elementu wyprowadź **Równolegle z** — elementy, których wymagania wstępne są podzbiorem lub rodzeństwem wymagań wstępnych tego elementu i które od niego nie zależą. Agenci AI mogą rozdzielać się na te elementy. Jeśli dwa elementy nie mają żadnych zależności i żaden nie blokuje drugiego, są równoległe. Gdy główna blokada (Krok 5) to **pojemność**, bądź szczególnie hojny w obliczaniu równoległości — to najbardziej użyteczna dźwignia dla użytkownika.

**6d. Sortowanie topologiczne, z uwzględnieniem głównego celu.** Najpierw fundamenty (w kolejności zależności między nimi), następnie elementy w kolejności zależności. Umieść element **gwiazdy północnej** tak wcześnie, jak pozwalają na to jego wymagania wstępne — nie odkładaj go na później dla symetrycznego porządku. Następnie rozstrzygnij remisy według głównego celu (Krok 5):

- **Market feedback** → remisy rozstrzygane na korzyść elementu, który ujawnia najbardziej ryzykowne założenie (często integracja lub logika domenowa). Wczesne ujawnienie ryzyka jest ważniejsze niż maksymalizacja wartości demo elementu 1.
- **Quality / craft** → fundamenty sekwencjonowane bardziej ochoczo; fundamenty obserwowalności i kontroli dostępu NIE są odkładane za elementy widoczne dla użytkownika.
- **Low complexity / quick win** → remisy rozstrzygane na korzyść najmniejszego wykonalnego elementu; agresywne parkowanie.
- **Speed to launch** → najpierw ścisła ścieżka must-have; elementy nieistotne są parkowane, a nie sekwencjonowane późno.
- **Learn the tech / explore** → remisy rozstrzygane na korzyść elementów, które najwcześniej ćwiczą nieznaną technologię; wartość uczenia się liczy się tutaj jako wartość dla użytkownika.

Jeśli `## Open Roadmap Questions` zawiera decyzję istotną dla sekwencjonowania (np. "czy najpierw wysyłamy na urządzenia mobilne?"), NIE wybieraj sekwencji, która przesądza o odpowiedzi — pozostaw dotknięte elementy jako `Status: blocked` do czasu rozwiązania pytania.

**6e. Zidentyfikuj blokujące niewiadome.** Dla każdego elementu wymień:

- **Blokady** (zewnętrzne, oczekujące) — zatwierdzenie dostawcy, zasób projektowy, decyzja interesariusza. Jeśli brak, napisz `—`. Odpowiedź na pytanie "Zewnętrzne" w Kroku 5 zasila te blokady.
- **Niewiadome** (pytania do zbadania) — rzeczy, na które mapa drogowa nie może odpowiedzieć, a `/10x-plan` również nie powinien próbować. Każda niewiadoma zawiera: pytanie, właściciela, status blokowania (tak/nie — czy planowanie jest zablokowane do czasu rozwiązania?). Odpowiedź na pytanie "Decyzje" w Kroku 5 zasila te niewiadome.

Element ze `Status: blocked` istnieje, gdy co najmniej jedna niewiadoma ma `Block: yes`. Zadaniem mapy drogowej jest ujawnienie ich, aby użytkownik mógł je rozwiązać, zanim `/10x-plan` zostanie zmarnowany na element, którego nie można zaplanować.

**6f. Wygeneruj `## Open Roadmap Questions`.** Dwa źródła:

- `## Open Questions` z PRD — skopiuj dosłownie, w razie potrzeby zmień numerację. Te są nadal otwarte.
- Nowe pytania, które pojawiły się w Kroku 5 i obejmują wiele elementów ("czy faktycznie powinniśmy wysyłać na urządzenia mobilne?").

Niewiadome dotyczące poszczególnych elementów pozostają w elemencie; przekrojowe niewiadome znajdują się tutaj.

**6g. Wygeneruj `## Parked`.** Podnieś `## Non-Goals` z PRD. Dodaj również wszystko, co Krok 5 ujawnił jako odłożone — szczególnie gdy głównym celem jest **szybkość uruchomienia** lub główną blokadą jest **czas/pojemność**, ta sekcja rośnie. Każdy wpis: jednowierszowy element, jednowierszowe uzasadnienie.

**6h. Wyprowadź `## Streams` (pomoc nawigacyjna).** Strumienie to *wyprowadzony widok* grafu zależności — NIE zastępują one porządku topologicznego w `## Foundations` + `## Slices` i NIE wprowadzają nowych identyfikatorów. Ich zadaniem jest przedstawienie czytelnikowi proponowanej kolejności czytania w równoległych ścieżkach na jednym ekranie, tak aby fundament taki jak F-02, który odblokowuje tylko odległy element, nie był odczytywany jako nonsens obok F-01.

Strumień to jeden spójny łańcuch wymagań wstępnych plus elementy, które dzielą jego początek. Domyślna zasada wyprowadzania strumieni:

1. **Jeden strumień na fundament, który kotwiczy odrębny łańcuch.** Przejdź przez fundamenty w kolejności; dla każdego `F-NN`, strumień to `F-NN → (elementy, które wymieniają F-NN w wymaganiach wstępnych, w kolejności zależności, rozgałęziając się w razie potrzeby)`.
2. **Elementy bez wymagań wstępnych stają się własnym strumieniem.** Element `ready`, który nie zależy od niczego (typowe: małe prace związane z zgodnością / utwardzaniem, takie jak `S-05`), jest własnym, jednoelementowym strumieniem. Nie wymyślaj ogólnego "kosza".
3. **Element, który zależy od początków wielu strumieni, dołącza do najbardziej wyprowadzonego** (łańcucha, którego początek znajduje się najgłębiej w porządku topologicznym). Wspomnij o dołączeniu w jednowierszowym opisie tego strumienia ("dołącza do Strumienia A w S-01"). Nie duplikuj elementu w strumieniach.
4. **Jeden wiersz na strumień w tabeli markdown** z kolumnami `Stream | Theme | Chain | Note`. Kolumna `Chain` używa tych samych identyfikatorów mapy drogowej, co reszta dokumentu, połączonych `→` dla sekwencyjnych i `/` lub prozą "równolegle z" dla rozgałęzień. Kolumna `Note` to jedna krótka klauzula łącząca strumień z `main_goal` lub nazywająca punkt połączenia z innym strumieniem.
5. **Tematy są opisowe, a nie promocyjne.** Dobre: "Wedge & deck", "Review loop", "Account lifecycle", "Auth compliance". Złe: "Zabójcza funkcja", "Ścieżka krytyczna 1".
6. **Limit: 5 strumieni.** Więcej niż pięć zazwyczaj oznacza, że graf zależności jest nadmiernie segmentowany — włącz strumień jednoelementowy do strumienia sąsiedniego fundamentu, jeśli jego wymagania wstępne się pokrywają. Mniej niż dwa strumienie oznacza, że strumienie nie spełniają swojej roli (porządek topologiczny jest już czytelny); pomiń sekcję.

Strumienie NIE są kanoniczne: jeśli strumień koliduje z porządkiem topologicznym, porządek topologiczny wygrywa, a definicja strumienia jest błędna. Samokontrola zapewnia pokrycie strumieni (każdy F-NN i S-NN pojawia się w dokładnie jednym strumieniu), ale nie wymusza liczby strumieni ani sformułowania tematu.

### Krok 7: Wygeneruj zawartość mapy drogowej

Użyj tego dokładnego szablonu (nazwy sekcji są umową; narzędzia niższego poziomu i `/10x-plan` mogą ich szukać):

````markdown
---
project: <from PRD frontmatter>
version: 1
status: draft                    # draft | active | locked
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
prd_version: <int from PRD frontmatter>
main_goal: <market-feedback | quality | low-complexity | speed | learn | other>
top_blocker: <skills | capacity | time | decisions | external | motivation | none>
---

# Mapa drogowa: <Projekt>

> Wygenerowano z `context/foundation/prd.md` (v<N>) + automatycznie zbadana baza kodu.
> Edytuj na miejscu; archiwizuj po zastąpieniu.
> Elementy poniżej są wymienione w kolejności zależności. Tabela "W skrócie" jest indeksem.

## Podsumowanie wizji

<2-3 zdania zaczerpnięte z sekcji Vision & Problem Statement w PRD. NIE jest to
ponowne sformułowanie — wystarczy, aby czytelnik mógł się zorientować bez
otwierania prd.md.

Jeśli podsumowanie opiera się na terminie strategii produktu — najczęściej
"wedge", ale także "beachhead", "primary metric", "validation milestone",
"north star" — zdefiniuj go w tekście przy pierwszym użyciu, w jednym krótkim
zdaniu w prostym języku. Przykład:
"Klin produktu — jedyna cecha, która po usunięciu sprawia, że produkt
staje się nie do odróżnienia od ogólnego narzędzia AI — polega na tym, że karty
muszą być zarówno oparte na AI w tekście wklejonym przez uczącego się, jak i
zatwierdzone przez człowieka, zanim trafią do talii." Czytelnik, który nie
ukończył kursu strategii produktu, musi być w stanie przeczytać sekcję od
razu.>

## Gwiazda przewodnia

**<ID elementu>: <Wynik>** — <jedno zdanie o tym, dlaczego jest to kamień milowy walidacji, powiązane z main_goal>.

> Jednowierszowe wyjaśnienie dla czytelnika, co oznacza tutaj "gwiazda przewodnia":
> najmniejszy, kompleksowy element, którego pomyślne dostarczenie udowodniłoby
> podstawową hipotezę produktu — umieszczony tak wcześnie, jak pozwalają na to
> wymagania wstępne, ponieważ wszystko inne ma znaczenie tylko wtedy, gdy to działa.
> Dołącz to wyjaśnienie za PIERWSZYM razem, gdy "gwiazda przewodnia" pojawi się w
> treści dokumentu; nie powtarzaj go później.

## W skrócie

| ID    | Change ID              | Wynik (użytkownik może …)              | Wymagania wstępne    | Odwołania do PRD       | Status   |
| ----- | ---------------------- | --------------------------------- | ---------------- | -------------- | -------- |
| F-01  | <kebab-case-change-id> | (fundament) <wynik fundamentu> | —                | NFR-XX         | proposed |
| F-02  | <kebab-case-change-id> | (fundament) <wynik fundamentu> | F-01             | NFR-YY         | proposed |
| S-01  | <kebab-case-change-id> | <wynik użytkownika>                | F-01             | US-01, FR-001  | ready    |
| S-02  | <kebab-case-change-id> | <wynik użytkownika>                | S-01             | US-02, FR-003  | proposed |
| S-03  | <kebab-case-change-id> | <wynik użytkownika>                | S-01, F-02       | US-03, FR-005  | blocked  |

## Strumienie

Pomoc nawigacyjna — grupuje elementy, które dzielą łańcuch wymagań wstępnych. Kanoniczna kolejność nadal znajduje się w grafie zależności poniżej; ta tabela to proponowana kolejność czytania w równoległych ścieżkach.

| Strumień | Temat              | Łańcuch                          | Uwaga                                                      |
| ------ | ------------------ | ------------------------------ | --------------------------------------------------------- |
| A      | <Temat>            | `F-01` → `S-01` → `S-02`       | <Jednowierszowe uzasadnienie łączące strumień z main_goal.>       |
| B      | <Temat>            | `F-02` → `S-03`                | <Dołącza do Strumienia A w `S-NN`, jeśli ma zastosowanie, w przeciwnym razie samodzielny.> |
| C      | <Temat>            | `S-NN`                         | <Samodzielny element bez wymagań wstępnych.>       |

(2–5 strumieni; każdy `F-NN` i `S-NN` pojawia się w dokładnie jednym strumieniu. Pomiń tę sekcję całkowicie, jeśli graf zależności jest zbyt mały, aby strumienie dodawały wartość — patrz Krok 6h.)

## Baza

Co już jest na miejscu w bazie kodu na dzień `<YYYY-MM-DD>` (automatycznie zbadane + potwierdzone przez użytkownika).
Fundamenty poniżej zakładają, że te elementy są obecne i NIE tworzą ich ponownie.

- **Frontend:** <obecny | nieobecny | częściowy> — <jedna linia, wskaźnik pliku, jeśli obecny>
- **Backend / API:** <…>
- **Dane:** <…>
- **Auth:** <…>
- **Deploy / infra:** <…>
- **Observability:** <…>

## Fundamenty

### F-01: <Tytuł fundamentu>

- **Wynik:** (fundament) <jedno zdanie o tym, co jest teraz na miejscu — niewidoczne dla użytkownika>.
- **Change ID:** <kebab-case-change-id>
- **Odwołania do PRD:** <NFR-NN, sekcja Access Control itp. — bądź konkretny>
- **Odblokowuje:** <identyfikatory S-NN niższego poziomu, identyfikatory/pytania blokujących niewiadomych lub nazwane ścieżki weryfikacji>
- **Wymagania wstępne:** <identyfikatory elementów/fundamentów i stan zewnętrzny — lub `—`>
- **Równolegle z:** <identyfikatory, które mogą działać równolegle, lub `—`>
- **Blokady:** <zewnętrzne oczekujące, lub `—`>
- **Niewiadome:** <pytania, lub `—`>
- **Ryzyko:** <jedna linia: dlaczego sekwencjonowane tutaj, co może pójść nie tak>
- **Status:** proposed | ready | blocked

(Powtórz dla każdego F-NN.)

## Elementy

### S-01: <Tytuł elementu>

- **Wynik:** <użytkownik może …>
- **Change ID:** <kebab-case-change-id>
- **Odwołania do PRD:** <FR-NNN, US-NN, NFR-N — każde must-have FR, które ten element spełnia, każde US-NN, które rozwija>
- **Wymagania wstępne:** <identyfikatory elementów/fundamentów i stan zewnętrzny>
- **Równolegle z:** <identyfikatory, lub `—`>
- **Blokady:** <zewnętrzne oczekujące, lub `—`>
- **Niewiadome:**
  - <pytanie> — Właściciel: <użytkownik|zespół|TBD>. Blokuje: <tak|nie>.
  - (lub `—` jeśli brak)
- **Ryzyko:** <jedna linia>
- **Status:** proposed | ready | blocked

(Powtórz dla każdego S-NN, w kolejności zależności.)

## Przekazanie do backlogu

| ID mapy drogowej | Change ID              | Sugerowany tytuł zadania         | Gotowe do `/10x-plan` | Uwagi |
| ---------- | ---------------------- | ----------------------------- | --------------------- | ----- |
| F-01       | <kebab-case-change-id> | <tytuł zadania dla Jira/Linear> | no                    | <dlaczego lub `—`> |
| S-01       | <kebab-case-change-id> | <tytuł zadania dla Jira/Linear> | yes                   | Uruchom `/10x-plan <change-id>` |

Ta tabela to czyste przekazanie do Jira/Linear lub dowolnego backlogu opartego na MCP. Dołącz jeden wiersz dla każdego `F-NN` i `S-NN`. Powinna być wystarczająco kompaktowa, aby skopiować ją do zadań, ale nie może duplikować szczegółowej treści mapy drogowej.

## Otwarte pytania dotyczące mapy drogowej

1. **<Pytanie>** — Właściciel: <kto>. Blokuje: <które identyfikatory elementów to blokuje, lub `roadmap-wide`>.
2. ...

(Każdy wpis odzwierciedla kształt `## Open Questions` z PRD. Niewiadome dotyczące poszczególnych elementów pozostają w elemencie.)

## Zaparkowane

- **<Element>** — Dlaczego zaparkowane: <odwołanie do PRD §Non-Goals, lub uzasadnienie z wywiadu>.
- ...

## Zrobione

(Puste przy pierwszym generowaniu. `/10x-archive` dodaje tutaj wpis — i zmienia `Status` tego elementu na `done` — gdy zmiana, której `Change ID` pasuje do elementu mapy drogowej, zostanie zarchiwizowana. NIE wypełniaj wstępnie. Format:)

- **<ID elementu>: <Wynik>** — Zarchiwizowane <YYYY-MM-DD> → `context/archive/<YYYY-MM-DD-change-id>/`. Lekcja: <wskaźnik do lessons.md, jeśli istnieje, lub `—`>.
````

**Semantyka pól, szczegółowo:**

- **Wynik** jest prowadzony przez czasownik. Elementy: *"użytkownik może się zalogować i zobaczyć pustą lodówkę"*. Fundamenty: *"(fundament) szkielet uwierzytelniania wdrożony; tokeny wydane za pośrednictwem skonfigurowanego dostawcy"*. Nigdy fraza rzeczownikowa ("system uwierzytelniania"); zawsze deklaratywny stan świata.
- **Change ID** jest w formacie kebab-case, stabilny i odpowiedni dla `context/changes/<change-id>/`. Nie używaj `F-01` / `S-01` jako identyfikatora zmiany; są to identyfikatory kolejności lokalne dla mapy drogowej.
- **Odblokowuje** pojawia się tylko w Fundamentach. Nazywa powód niższego poziomu, dla którego ten Fundament istnieje: konkretne elementy `S-NN`, blokujące niewiadome lub ścieżki weryfikacji. Fundament bez Odblokowań to poziomy dryf.
- **Odwołania do PRD** używają dosłownych identyfikatorów z PRD (`FR-001`, `US-01`, `NFR-02`). Nie parafrazuj. Każde must-have FR w PRD musi pojawić się w co najmniej jednym elemencie `PRD refs` po samokontroli w Kroku 8.
- **Wymagania wstępne** mieszają identyfikatory elementów (`S-01`, `F-02`) i stan zewnętrzny, oddzielone przecinkami. Stan zewnętrzny to prosty angielski ("zasiana tabela składników", "opublikowane tokeny projektowe"). Jedno pole, niepodzielone.
- **Równolegle z** jest informacyjne. Obliczone z grafu zależności: każdy element X, gdzie moje wymagania wstępne i wymagania wstępne X nie mają między sobą ścieżki. Puste = `—`.
- **Blokady** to *tylko zewnętrzne oczekujące* (dostawca, projekt, decyzja interesariusza). Rzeczy, których zespół nie może jednostronnie rozwiązać. Jeśli zespół MOŻE to rozwiązać, jest to niewiadoma, a nie blokada.
- **Niewiadome** to pytania do zbadania. Każde zawiera właściciela i flagę blokowania. Block=yes podnosi status elementu do `blocked`.
- **Ryzyko** to jedna linia: dlaczego sekwencjonowane tutaj, co może pójść nie tak, dlaczego jest to bezpieczniejsza kolejność niż alternatywy. Nie jest to analiza pośmiertna. Nie jest to katastrofizowanie. Po prostu kluczowy powód, dla którego przyszły czytelnik musi zrozumieć sekwencję.
- **Status** cykl życia: `proposed` (domyślny przy pierwszym generowaniu) | `ready` (wszystkie wymagania wstępne spełnione, brak blokujących niewiadomych — `/10x-plan` może działać) | `planning` | `in-progress` | `done` | `blocked` (jedna lub więcej niewiadomych z `Block: yes`). Ta umiejętność emituje tylko `proposed`, `ready` i `blocked` podczas generowania. Reszta jest zapisywana w dalszych etapach, gdy zmiana postępuje, każda dopasowana przez `Change ID`: `/10x-plan` → `planning`, `/10x-implement` (i `/10x-goal-implement`) → `in-progress`, `/10x-archive` → `done`. Zmiany w dalszych etapach są najlepszym wysiłkiem (mapa drogowa jest opcjonalna; brak dopasowania to ciche pominięcie) i tylko do przodu (element nigdy nie jest cofany do wcześniejszego stanu).
- **Frontmatter `main_goal` / `top_blocker`** zapisuje odpowiedzi z Kroku 5, aby przyszły ponowny odczyt (lub recenzent) mógł zobaczyć stronniczość sekwencjonowania na pierwszy rzut oka bez otwierania historii rozmów.

**Twarda zasada — nigdy nie wymyślaj elementów.** Każdy element musi odnosić się do US-NN lub FR-NNN w PRD. Jeśli wywiad ujawnił coś, czego nie ma w PRD ("och, a potrzebujemy też trybu offline"), NIE staje się to elementem. Staje się to albo otwartym pytaniem dotyczącym mapy drogowej (jeśli jest to prawdziwa luka), albo wpisem zaparkowanym (jeśli użytkownik wyraźnie zdecydował się to odłożyć). Zadaniem mapy drogowej jest sekwencjonowanie tego, co deklaruje PRD, a nie rozwijanie PRD.

**Brak jednostek czasu. Brak szacunków. Brak ocen złożoności.** Brak "Dzień 1", brak "Tydzień 2", brak "mały/średni/duży", brak punktów historii. Kolejność jest zakodowana w wymaganiach wstępnych; tempo jest zakodowane w blokadach i niewiadomych. Jeśli masz ochotę napisać "to powinno zająć kilka godzin" — zatrzymaj się. To terytorium `/10x-plan` niższego poziomu, a nawet tam chodzi o jasność zakresu, a nie przewidywanie kalendarza.

### Krok 8: Samokontrola

Przed zapisem na dysk, zweryfikuj mapę drogową w pamięci:

1. **Frontmatter** — wszystkie 8 kluczy obecnych (`project`, `version`, `status`, `created`, `updated`, `prd_version`, `main_goal`, `top_blocker`).
2. **Wymagane sekcje** — te nagłówki `##` istnieją, w tej kolejności: `Vision recap`, `North star`, `At a glance`, `Streams` (opcjonalne — obecne tylko wtedy, gdy Krok 6h zdecydował, że strumienie dodają wartość), `Baseline`, `Foundations`, `Slices`, `Backlog Handoff`, `Open Roadmap Questions`, `Parked`, `Done`. Ze `Streams` liczba wynosi 11; bez nich 10.
3. **Schemat dla każdego wpisu** — każdy S-NN ma 9 obowiązkowych pól (`Outcome`, `Change ID`, `PRD refs`, `Prerequisites`, `Parallel with`, `Blockers`, `Unknowns`, `Risk`, `Status`). Każdy F-NN ma te pola plus `Unlocks`.
4. **Pokrycie PRD** — każde `must-have` FR z PRD (grep `^- FR-\d{3}: .* must-have$`) pojawia się w co najmniej jednym elemencie `PRD refs`. To samo dotyczy każdego `### US-NN:`. Jeśli must-have nie jest pokryte, samokontrola NIE POWODZI SIĘ.
5. **Integralność grafu zależności** — brak cykli. Każdy ID wymieniony w `Prerequisites` istnieje gdzieś w dokumencie. Kolejność w `## Foundations` i `## Slices` jest sortowaniem topologicznym: żaden element nie zależy od czegoś, co pojawia się po nim.
6. **Spójność tabeli "W skrócie"** — wiersze tabeli odpowiadają treści sekcji. `Change ID`, `Prerequisites`, `PRD refs`, `Status` każdego wiersza odpowiadają dosłownie polom treści.
7. **Spójność statusu** — każdy `blocked` element ma co najmniej jedną niewiadomą z `Block: yes`. Każdy `ready` element ma wszystkie wymagania wstępne już w stanie `done` (dzisiaj oznacza to: brak wymagań wstępnych LUB wszystkie wymagania wstępne to fundamenty, które baza zgłasza jako `present`).
8. **Brak wymyślonych elementów** — `PRD refs` każdego elementu zawiera co najmniej jeden prawdziwy ID PRD (`FR-\d{3}` lub `US-\d{2}`).
9. **Spójność bazy ↔ fundamentów** — żaden fundament nie tworzy ponownie warstwy, którą sekcja `## Baseline` zgłasza jako `present`. Jeśli baza mówi, że uwierzytelnianie jest obecne, a nadal istnieje `F-NN` dla szkieletu uwierzytelniania, jest to błąd samokontroli (albo baza jest błędna, albo fundament jest zbędny).
10. **Umowa umożliwiająca fundamentu** — każdy fundament ma `Unlocks` wypełnione co najmniej jednym elementem `S-NN` niższego poziomu, nazwaną blokującą niewiadomą lub nazwaną ścieżką weryfikacji. Ogólny fundament, taki jak "warstwa bazy danych" bez powodu niższego poziomu, jest błędem samokontroli.
11. **Integralność Change ID** — każdy F-NN i S-NN ma unikalny `Change ID` w formacie kebab-case; każdy F-NN i S-NN pojawia się dokładnie raz w `## Backlog Handoff`; każdy wiersz przekazania odwołuje się do istniejącego ID mapy drogowej i powtarza ten sam Change ID. Brak spacji, dat, etykiet statusu lub ID mapy drogowej jako identyfikatorów zmian.
12. **Równowaga granularności elementów** — żaden `S-NN` nie może pochłonąć większości nietrywialnego PRD, podczas gdy elementy rodzeństwa są drobnymi resztkami. Jeśli jeden element odwołuje się do większości must-have FR, więcej niż dwóch niepowiązanych wpisów US-NN, wielu głównych akcji użytkownika lub niepowiązanych ryzyk/niewiadomych, samokontrola NIE POWODZI SIĘ, chyba że PRD naprawdę ma tylko jeden widoczny dla użytkownika przepływ pracy. Napraw to, dzieląc na węższe pionowe wyniki, a nie tworząc elementy warstw.
13. **Limit zakresu fundamentu** — żaden fundament nie może ukończyć całej warstwy z wyprzedzeniem. Wynik i ryzyko muszą pokazywać minimalną umowę umożliwiającą, a `Unlocks` muszą nazywać pionowe elementy, które nadal będą integrować tę warstwę poprzez zachowanie widoczne dla użytkownika. Jeśli fundament brzmi jak "zbuduj warstwę danych/API/UI/uwierzytelniania", samokontrola NIE POWODZI SIĘ. Podziel go, zawęź lub włącz minimalną potrzebną pracę do pierwszego konsumującego `S-NN`.
14. **Progresywne ujawnianie elementów technicznych** — każdy przekrojowy element techniczny pojawia się albo w pierwszym pionowym elemencie, który go potrzebuje, albo w fundamencie, który jest wymagany, zanim ten element będzie mógł być zaplanowany, zweryfikowany lub bezpieczny. Jeśli element techniczny jest wprowadzany tylko dlatego, że będzie przydatny później, samokontrola NIE POWODZI SIĘ, a ta praca przenosi się do pierwszego elementu, który faktycznie go używa.
15. **Pokrycie strumieni** (tylko jeśli sekcja `## Streams` została wygenerowana) — każdy `F-NN` i każdy `S-NN` wymieniony w `## At a glance` pojawia się w dokładnie jednej komórce `Chain` strumienia. Duplikaty i pominięcia powodują błąd. Komórki Chain odwołują się tylko do istniejących identyfikatorów mapy drogowej (brak wymyślonych identyfikatorów). Liczba strumieni wynosi 2–5. Jeśli dokument ma < 2 strumienie kandydujące, sekcja powinna zostać pominięta (limit Kroku 6h).
16. **Terminy strategiczne są definiowane w tekście** — przeskanuj wygenerowany dokument w poszukiwaniu żargonu strategii produktu: `wedge`, `beachhead`, `north star`, `validation milestone`, `primary metric`, `must-have path`, `product-market fit`, `thin end of the wedge`, `riskiest assumption`, `core hypothesis`. Dla każdego terminu, który pojawia się w treści (podsumowanie wizji, gwiazda północna, linie ryzyka, tytuły elementów), sprawdź, czy istnieje jednowierszowa definicja w tekście przy jego **pierwszym** wystąpieniu w dokumencie. Jeśli termin jest używany bez definicji przy pierwszym użyciu, samokontrola NIE POWODZI SIĘ. Dopuszczalne formy definicji: w nawiasie ("klin — jedyna cecha, która po usunięciu sprawia, że produkt jest ogólny — to …"), z myślnikiem lub krótkie zdanie uzupełniające. Identyfikatory (`FR-001`, `US-03`, `F-01`, `S-02`) i nazwy własne narzędzi/usług są zwolnione. Jeśli terminu nie można zdefiniować w jednym zdaniu, zastąp go prostym językiem i wygeneruj ponownie.

Jeśli którykolwiek z testów zakończy się niepowodzeniem, **przerwij zapis** i zgłoś konkretną awarię:

```
Samokontrola mapy drogowej NIE POWIODŁA SIĘ:

  - <konkretna awaria, np. "FR-007 (must-have) nie jest pokryte przez żaden element"
     lub "Element S-04 wymienia S-06 w wymaganiach wstępnych, ale S-06 pojawia się później w dokumencie"
     lub "F-02 (szkielet uwierzytelniania) jest zbędny — baza zgłasza uwierzytelnianie jako obecne">
  - ...

Mapa drogowa NIE została zapisana. Napraw błąd i wygeneruj ponownie, lub — jeśli test jest
błędny — zgłoś błąd umiejętności. Przerwania samokontroli chronią narzędzia niższego poziomu przed
dryfem.
```

Następnie ZATRZYMAJ SIĘ.

### Krok 9: Sprawdzenie kolizji

```bash
test -f context/foundation/roadmap.md
```

Jeśli plik nie istnieje, zapisz do `context/foundation/roadmap.md` i przejdź do Kroku 10.

Jeśli plik istnieje, konwencja dokumentacji fundamentów to **edycja na miejscu** dla przyrostowego udoskonalania, **archiwizacja, a następnie zastąpienie** dla pełnej regeneracji. Ta umiejętność tworzy *pełną* mapę drogową z PRD; chirurgiczne udoskonalanie jest poza zakresem. Domyślnie więc archiwizuj, a następnie zastąp, ale zapytaj za pomocą wybranego narzędzia do pytań interaktywnych:

Pytanie interaktywne:
- question: "context/foundation/roadmap.md już istnieje. Jak chcesz postąpić?"
  header: "Kolizja"
  options:
  - label: "Archiwizuj i zastąp (Zalecane)"
    description: "Przenieś istniejący plik do context/foundation/archive/<dzisiaj>-roadmap.md, a następnie zapisz nową mapę drogową. Historia zachowana zgodnie z konwencją README fundamentu."
  - label: "Nadpisz bez archiwizacji"
    description: "Zastąp na miejscu. Istniejąca zawartość zostanie utracona (chyba że ją zatwierdziłeś). Użyj tylko, jeśli istniejąca mapa drogowa jest pusta lub tymczasowa."
  - label: "Anuluj"
    description: "Wyjdź bez zapisów. Brak rozwiązania kolizji."
  multiSelect: false

W przypadku "Archiwizuj i zastąp": utwórz `context/foundation/archive/`, jeśli brakuje, przenieś istniejący plik do `context/foundation/archive/<dzisiaj>-roadmap.md` (użyj dzisiejszej daty w formacie `YYYY-MM-DD`), a następnie zapisz nową zawartość. Jeśli plik już istnieje pod tą ścieżką archiwum (ponownie wygenerowany dwa razy w ciągu jednego dnia), dodaj `-2`, `-3` itd.

W przypadku "Nadpisz bez archiwizacji": zapisz nową zawartość, nadpisując na miejscu.

W przypadku "Anuluj": ZATRZYMAJ SIĘ.

### Krok 10: Przekazanie

Po zapisie, podsumuj:

```
═══════════════════════════════════════════════════════════
  MAPA DROGOWA WYGENEROWANA
═══════════════════════════════════════════════════════════

  Projekt:           <projekt>
  Ścieżka:              context/foundation/roadmap.md
  Główny cel:         <main_goal>            (stronniczość sekwencjonowania)
  #1 blokada:        <top_blocker>          (co planować wokół)
  Baza obecna:  <warstwy zgłoszone jako obecne, oddzielone przecinkami>
  Fundamenty:       <liczba>
  Elementy:            <liczba>
  Podział statusu:  ready: N  |  proposed: M  |  blocked: K
  Pokrycie PRD:      <pokryte must-have FR> / <wszystkie must-have FR>
  Otwarte pytania dot. mapy drogowej:    <liczba>
  Zaparkowane elementy:      <liczba>

  Gwiazda przewodnia:  <ID elementu> — <Wynik>

═══════════════════════════════════════════════════════════
```

Następnie **zarekomenduj jeden następny ruch** — nie oddawaj "gotowej" listy i nie proś użytkownika o wybór. Wybierz jeden element mapy drogowej do zaplanowania jako pierwszy i uzasadnij to w jednej linii. Użytkownik może nadpisać, ale domyślna powierzchnia to rekomendacja, a nie menu.

**Zasada wyboru zalecanego następnego ruchu** (stosuj w kolejności, pierwsze dopasowanie wygrywa):

1. Jeśli gwiazda północna jest `ready`, zarekomenduj ją. Gwiazda północna to kamień milowy walidacji; odkładanie jej w czasie powoduje utratę sygnału.
2. W przeciwnym razie, jeśli fundament, od którego gwiazda północna bezpośrednio zależy, jest `ready`, zarekomenduj ten fundament i wyraźnie powiedz "to odblokowuje gwiazdę północną <S-NN>".
3. W przeciwnym razie, jeśli żaden element nie jest `ready`, zarekomenduj rozwiązanie najbardziej wpływowego otwartego pytania lub blokady (tego, które odblokowuje najwięcej elementów niższego poziomu). Do tego czasu nie ma dostępnego ruchu planistycznego.
4. W przeciwnym razie zarekomenduj element `ready`, który odblokowuje najwięcej elementów niższego poziomu (najwyższy fan-out w grafie zależności). Rozstrzygnij remisy według głównego celu (Krok 6d).

Format:

```
► **Twój następny ruch:** `/10x-plan <change-id>` na **<ID mapy drogowej>: <Wynik>**.

  Dlaczego ten pierwszy: <jedno zdanie — kluczowy powód: to JEST gwiazda
  północna / odblokowuje gwiazdę północną / ma najwyższy fan-out / to
  najmniejsza kompleksowa walidacja, którą możemy teraz wysłać>.

  Następnie, w kolejności: <następny gotowy ID>: <Wynik> → <następny>: <Wynik>.
  (Pełna lista w `## Backlog Handoff`.)

  Zablokowane — pozostają zaparkowane do czasu rozwiązania ich niewiadomych:
    - <ID elementu>: <Niewiadoma> (Właściciel: <kto>)
    - ...
  (Rozwiązanie któregokolwiek z nich podnosi status elementu do `ready` i zmienia moją
  rekomendację; wróć, a ponownie zarekomenduję.)
```

Jeśli żaden element nie jest `ready` i żaden fundament również nie jest `ready` (przypadek 3), zastąp rekomendację:

```
► **Brak dostępnego ruchu planistycznego.** Każdy element jest zablokowany.
  Najbardziej wpływowa niewiadoma do rozwiązania w następnej kolejności:

    <Pytanie> — Właściciel: <kto>. Odblokowuje: <S-NN, S-MM, ...>.

  Rozwiązanie tego odblokowuje <liczba> elementów i jest jedyną zmianą, która
  najbardziej otwiera mapę drogową. Rozwiąż to, a następnie ponownie wywołaj `/10x-roadmap`, aby
  ponownie zarekomendować.
```

ZATRZYMAJ SIĘ. Nie łącz automatycznie z inną umiejętnością — użytkownik wybiera, kiedy planować. Ale NIE obniżaj rekomendacji do listy wielokrotnego wyboru; jeśli użytkownik chce innego elementu, mówi o tym.

## Krytyczne zabezpieczenia

1. **PRD jest źródłem.** Każdy element odnosi się do identyfikatorów PRD. Ramowanie z Kroku 5 ujawnia kontekst celu/gwiazdy północnej/inwestycji/blokady wywnioskowany z PRD; baza ujawnia to, co już istnieje; żadne z nich nie rozszerza PRD. Elementy mapy drogowej bez odniesienia do PRD są błędem samokontroli.

2. **Najpierw pionowe elementy.** Element dostarcza widoczną dla użytkownika funkcjonalność od początku do końca. Poziome elementy ("warstwa API", "schemat") to antywzorzec, któremu ta umiejętność ma zapobiegać. Fundamenty są *jedynym* wyjątkiem — są to jawnie przekrojowe elementy umożliwiające, znajdują się w osobnej sekcji, zawierają `Unlocks` i są oznaczone `(fundament)`, aby żaden czytelnik nie pomylił ich z pracą widoczną dla użytkownika.

3. **Zrównoważona granularność bez szacunków.** Elementy nie otrzymują etykiet rozmiaru, ale ich zakres musi być porównywalny. Mapa drogowa, w której `S-01` zawiera prawie całe PRD, a `S-02`/`S-03` to drobne resztki, jest złą mapą drogową. Podziel zbyt duże elementy według węższych widocznych dla użytkownika wyników, faz przepływu pracy, person lub granic ryzyka — nigdy według warstwy technicznej.

4. **Fundamenty to minimalne odblokowania, a nie projekty ukończenia warstw.** Fundament może stworzyć najmniejszy warunek wstępny potrzebny, zanim praca pionowa będzie mogła być kontynuowana. Nie może wstępnie zbudować całej warstwy bazy danych/API/UI/uwierzytelniania. Jeśli element techniczny może być wprowadzony w ramach pierwszego elementu widocznego dla użytkownika, który go potrzebuje, umieść go tam; to utrzymuje integrację pionową i stopniowo ujawnia tylko potrzebne elementy.

5. **Brak szacunków, brak jednostek czasu.** Brak "Dzień 1", brak "2 tygodnie", brak "mały/średni/duży", brak punktów. Wykonanie agenta AI jest nieliniowe, a szacunki budżetowane czasowo kłamią. Kolejność jest zakodowana w wymaganiach wstępnych; tempo jest ujawniane poprzez blokady i niewiadome. Mapa drogowa opisuje kształt, a nie harmonogram.

6. **Brak niskopoziomowych szczegółów technicznych.** Brak nazw frameworków (te znajdują się w `tech-stack.md`), brak ścieżek plików, brak definicji schematów, brak kodu, brak wyborów bibliotek. Jeśli piszesz takie rzeczy, przekroczyłeś terytorium `/10x-plan` — zatrzymaj się i pozwól `/10x-plan` wykonać swoją pracę w dalszych etapach.

7. **Ujawnij niewiadome, nie ukrywaj ich.** Niewiadome dotyczące poszczególnych elementów z `Block: yes` podnoszą `Status: blocked`. Przekrojowe niewiadome trafiają do `## Open Roadmap Questions`. Jeśli PRD ma TODO, mapa drogowa dziedziczy je jako niewiadome zablokowanych elementów. Wartość mapy drogowej polega częściowo na pokazywaniu użytkownikowi, co JESZCZE nie jest możliwe do zaplanowania.

8. **Baza jest automatycznie badana, a nie pytana.** Nie pytaj użytkownika "co już jest na miejscu?" — uruchom równoległe subagenty Explore (Krok 4) i pozwól bazie kodu odpowiedzieć. Następnie poproś użytkownika tylko o potwierdzenie lub poprawienie. To jest umowa, która sprawia, że fundamenty są uczciwe: fundament istnieje tylko wtedy, gdy baza mówi, że warstwa jest nieobecna lub częściowa.

9. **Samokontrola przerywa w przypadku dryfu.** Brak wymaganych sekcji, uszkodzony graf zależności, niepokryte must-have FR, wymyślone elementy, zbyt duże elementy, ukończenie warstwy fundamentu, sprzeczności między bazą a fundamentami — wszystko to przerywa zapis z konkretnym błędem. Brak cichego łatania.

10. **Konwencja dokumentacji fundamentów.** `roadmap.md` to dokument fundamentu zgodnie z `context/foundation/README.md`. Domyślna obsługa kolizji to archiwizacja, a następnie zastąpienie (historia trafia do `foundation/archive/<dzisiaj>-roadmap.md`); chirurgiczne udoskonalanie jest poza zakresem tej umiejętności (edytuj ręcznie, jeśli tego potrzebujesz).

11. **Tylko język uniwersalny.** Brak odniesień do 10xDevs / kohorty / certyfikacji w jakimkolwiek wyjściu widocznym dla użytkownika lub w jakimkolwiek artefakcie zapisanym na dysku. Umiejętność jest ogólnym generatorem map drogowych.

12. **Nigdy nie łącz automatycznie.** Krok 10 to ogłoszenie, a nie wywołanie. Użytkownik wybiera, kiedy (i który) element przekazać do `/10x-plan`. Automatyczne łączenie pominęłoby przegląd wygenerowanej mapy drogowej przez człowieka.

13. **Definiuj terminy strategiczne w tekście przy pierwszym użyciu.** Słownictwo strategii produktu — `wedge`, `beachhead`, `north star`, `validation milestone`, `primary metric`, `must-have path`, `product-market fit`, `thin end of the wedge`, `riskiest assumption`, `core hypothesis` — to wewnętrzny skrót umiejętności i PRD, a nie wiedza powszechna. Mapa drogowa musi być czytelna od razu dla członka zespołu (lub przyszłego siebie), który nie ukończył kursu strategii produktu. Przy PIERWSZYM wystąpieniu dowolnego takiego terminu w treści dokumentu, dołącz jednowierszową definicję w tekście (w nawiasie, z myślnikiem lub krótkim zdaniem uzupełniającym). Nie powtarzaj definicji przy późniejszych użyciach. Jeśli koncepcji nie można zdefiniować w jednym zdaniu, zastąp ją prostym językiem ("najmniejszy kompleksowy przepływ, który udowadnia, że produkt działa" jest lepsze niż "klin", jeśli nie możesz skompresować wyróżniającej cechy klina w jedną klauzulę). To zabezpieczenie dotyczy prozy widocznej dla użytkownika w wygenerowanym dokumencie — nie pytań wywiadu (Krok 5 już je obsługuje) i nie semantyki pól w tym pliku umiejętności. Test samokontroli #16 w Kroku 8 wymusza to; obejście jest błędem samokontroli, a nie preferencją stylistyczną.

14. **Oszczędny wywiad z silnymi rekomendacjami — nie ciche automatyczne ramowanie, nie nieograniczone odkrywanie.** Krok 5 zadaje **maksymalnie 3 pytania kotwiczące** (`main_goal`, `north_star`, `top_blocker`); obszary inwestycji są *wyprowadzane* z odpowiedzi. Każde pytanie kotwiczące zawiera jedną silną **Rekomendację** opartą na cytowanej linii artefaktu, plus 1-2 alternatywy, gdzie każda alternatywa ma własne jednowierszowe uzasadnienie "dlaczego to również jest rozsądne" powiązane z sygnałem artefaktu. Słomiane alternatywy (opcja wymieniona tylko po to, aby rekomendacja wyglądała dobrze) są zabronione — jeśli artefakty wspierają tylko jedną wartość, przedstaw kotwicę z jedną rekomendacją i swobodnym nadpisaniem, i powiedz to. Kotwica może zostać **pominięta tylko wtedy, gdy PRD lub kryteria sukcesu dosłownie stwierdzają wartość** (np. `timeline_budget: "1 week"` plus "musi zostać uruchomione przed X" → `main_goal: speed` jest jednoznaczne); nigdy nie pomijaj, gdy istnieje jakakolwiek wiarygodna alternatywa. Dwa tryby awarii, których należy unikać: **(a) performatywne przesłuchanie** — zadawanie pytań, na które artefakty już odpowiadają, lub zadawanie więcej niż 3 pytań; **(b) fałszywa pewność** — ciche decydowanie o kluczowym ramowaniu bez oferowania użytkownikowi prawdziwego wyboru. Wyjątek dla niestandardowego kształtu MVP (Krok 5f) to jedyna ścieżka, która pozwala na pytania uzupełniające (do 2, oprócz 3 kotwic). Zalecany następny ruch w Kroku 10 to ta sama zasada zastosowana do przekazania: jedna rekomendacja z jednowierszowym powodem, a nie lista "gotowych do planowania", którą użytkownik musi sortować.

## Uwagi

- Ta umiejętność to **generator dokumentów**. Wynikiem jest `context/foundation/roadmap.md`, kropka. Planowanie poszczególnych zmian odbywa się w dalszych etapach w `/10x-plan`.
- Wywiad jest celowo oszczędny — maksymalnie 3 pytania kotwiczące (`main_goal`, `north_star`, `top_blocker`), każde zawierające jedną silną Rekomendację plus 1-2 alternatywy z własnym uzasadnieniem "dlaczego to jest rozsądne". Obszary inwestycji są wyprowadzane z odpowiedzi, a nie zadawane. PRD już wykonało ciężką pracę diagnostyczną; Krok 5 przechwytuje tylko kluczowe wywołania, których artefakty nie mogą samodzielnie zablokować. Wyjątek dla niestandardowego kształtu MVP pozwala na maksymalnie 2 dodatkowe wymiany oprócz 3 kotwic; żadna inna ścieżka nie dodaje pytań uzupełniających.
- Sonda bazowa (Krok 4) zastępuje to, co kiedyś było pytaniem "co już jest na miejscu?". Subagenci są tańsi niż uwaga użytkownika, a baza kodu jest bardziej niezawodna niż pamięć.
- Sekcja `## Done` jest pusta przy pierwszym generowaniu. Istnieje po to, aby `/10x-archive` miało stabilne miejsce do zapisywania zamkniętych elementów — gdy zmiana, której `Change ID` pasuje do elementu mapy drogowej, zostanie zarchiwizowana, `/10x-archive` zmienia status tego elementu na `Status: done` i dodaje wpis do `## Done`. NIE wypełniaj jej wstępnie.
- Gdy umiejętność regeneruje istniejącą mapę drogową, poprzedni plik przenosi się do `foundation/archive/<dzisiaj>-roadmap.md`. Odczytanie różnicy między zarchiwizowaną wersją a nową jest najczystszym sposobem na zobaczenie, co zmieniło się w rozumieniu projektu — to jest udogodnienie, dla którego zaprojektowano konwencję dokumentacji fundamentów.
- Przepływ statusu cyklu życia: ta umiejętność emituje `proposed` / `ready` / `blocked` podczas generowania; umiejętności niższego poziomu zmieniają dopasowany element za pomocą `Change ID` — `/10x-plan` → `planning`, `/10x-implement` / `/10x-goal-implement` → `in-progress`, `/10x-archive` → `done`. Każda zmiana w dalszych etapach jest najlepszym wysiłkiem (mapa drogowa jest opcjonalna; brak dopasowania to ciche pominięcie) i tylko do przodu (nigdy nie cofa bardziej zaawansowanego statusu).