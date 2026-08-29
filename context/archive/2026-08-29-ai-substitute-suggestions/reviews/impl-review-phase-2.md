<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: AI substitute suggestions — Plan implementacji

- **Plan**: context/changes/ai-substitute-suggestions/plan.md
- **Zakres**: Faza 2 z 4
- **Data**: 2026-08-29
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 2 ostrzeżeń, 0 obserwacji

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Kryteria sukcesu | PASS |

## Ustalenia

### F1 — Brak guardu przeciw self-substitution w `recordSubstituteDecision`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość (Niezawodność)
- **Lokalizacja**: src/lib/services/substitutes.ts:60-73
- **Szczegóły**: Nic nie chroni przed wywołaniem `recordSubstituteDecision(supabase, userId, yarnId, yarnId, status)`. `getYarnById` zwróci ten sam wiersz dwukrotnie (weryfikacja własności przejdzie), a tablica przekazana do `upsert` będzie zawierać dwa identyczne wiersze o tym samym kluczu konfliktu (`user_id, yarn_id, substitute_yarn_id`). Postgres odrzuci to surowym błędem `"ON CONFLICT DO UPDATE command cannot affect row a second time"` zamiast czytelnego komunikatu walidacyjnego — mimo że tabela ma już `check (yarn_id <> substitute_yarn_id)` z Fazy 1, błąd trafia do usera nieczytelny.
- **Poprawka**: Dodać `if (yarnId === substituteYarnId) throw new Error("Włóczka nie może być swoim własnym zamiennikiem");` na początku `recordSubstituteDecision`, przed `Promise.all`.
- **Decyzja**: FIXED

### F2 — Sygnowane URL-e zdjęć liczone dla całej biblioteki przed filtrowaniem (N+1)

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość (Wydajność)
- **Lokalizacja**: src/lib/services/substitutes.ts:16-19, 41-57 (przez `listYarns` w src/lib/services/yarns.ts:30-46)
- **Szczegóły**: `listSubstituteSuggestions` i `getAcceptedSubstitutes` wywołują `listYarns`, który generuje osobne sygnowane URL (osobne wywołanie Supabase Storage) dla KAŻDEJ włóczki użytkownika, zanim nastąpi filtrowanie po score/statusie decyzji. Dodatkowo `targetYarn` (linia 16, przez `getYarnById`) i ta sama włóczka ponownie przez `listYarns` (linia 19, przed odfiltrowaniem) dostają zbędne, zduplikowane signed URL — mimo że wynik scoringu nigdy nie używa `photoUrl` włóczki docelowej. Przy bibliotece rzędu dziesiątek włóczek to dziesiątki zbędnych wywołań Storage per request SSR.
- **Poprawka A ⭐ Zalecana**: Zaakceptować na etapie MVP — plan jawnie zwalnia z budżetu wydajności ("Uwagi dotyczące wydajności": *"Brak realnego budżetu wydajności na etapie MVP — algorytm to O(n) porównań w pamięci dla biblioteki użytkownika (dziesiątki, nie tysiące włóczek), liczone raz na request SSR"*).
  - Siła: Zgodne z jawną decyzją planu o nieoptymalizowaniu na tym etapie; nie dodaje ryzyka regresji do współdzielonego `listYarns`.
  - Kompromis: Kilkadziesiąt zbędnych wywołań Supabase Storage per request pozostaje w kodzie.
  - Pewność: MED — nie zmierzono realnego opóźnienia ani rozmiaru bibliotek produkcyjnych.
  - Martwy punkt: Brak pomiaru rzeczywistego wpływu na czas odpowiedzi SSR.
- **Poprawka B**: Rozdzielić pobranie surowych `Yarn` (do scoringu/filtrowania) od resolvowania `photoUrl` — dodać wariant bez sygnowanych URL-i i resolvować je tylko dla finalnej, przefiltrowanej listy kandydatów/zaakceptowanych.
  - Siła: Eliminuje N zbędnych wywołań Storage, realna poprawa czasu odpowiedzi przy większych bibliotekach.
  - Kompromis: Wymaga nowej funkcji lub refaktoryzacji `yarns.ts`, dotyka wzorca współdzielonego z resztą repo (ryzyko efektu ubocznego dla innych wywołań `listYarns`).
  - Pewność: MED — nie sprawdzono innych miejsc wywołujących `listYarns`, które mogą polegać na obecnym kształcie zwrotki.
  - Martwy punkt: Nie zweryfikowano, czy inne strony korzystające z `listYarns` (np. dashboard) mają podobny problem i czy warto rozwiązywać go punktowo czy systemowo.
- **Decyzja**: ACCEPTED (Poprawka A) — świadomy kompromis MVP, zgodny z jawną decyzją planu o niewprowadzaniu budżetu wydajności na tym etapie.

## Uwagi dodatkowe (bez formalnych ustaleń)

- Formuła scoringu (`src/lib/services/substitute-matching.ts`) przeniesiona 1:1 z planu — wagi 40/40/20, renormalizacja, próg tolerancji rozmiaru 0.5mm z liniowym spadkiem do 2.5mm, wszystko potwierdzone.
- Testy jednostkowe pokrywają każdy przypadek brzegowy wymieniony w planie i nie są tautologiczne.
- `recordSubstituteDecision` poprawnie weryfikuje własność obu włóczek (obrona przed FK bypass RLS z krytycznych szczegółów planu) i podwójny `upsert` jest atomowy (jedno wywołanie `.upsert()` z tablicą wierszy → jedna instrukcja SQL).
- Drobny dodatek nieopisany w planie: nazwany eksport `SubstituteSuggestion` w `substitutes.ts` (plan opisywał tylko typ inline) — kosmetyczne, bez rozbieżności funkcjonalnej, pominięte jako nieistotne.

## Sortowanie — podsumowanie

- Naprawiono: F1 (guard self-substitution)
- Zaakceptowano: F2 (N+1 signed URLs — świadomy kompromis MVP)

Po naprawie F1: `npm run test` (10/10), `npm run lint` (0 błędów) potwierdzone ponownie.
