<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Fundament danych biblioteki włóczek — Plan implementacji

- **Plan**: context/changes/yarn-data-foundation/plan.md
- **Zakres**: Faza 1 i Faza 2 z 2 (pełny plan)
- **Data**: 2026-08-23
- **Werdykt**: ZAAKCEPTOWANO
- **Ustalenia**: 0 krytycznych, 1 ostrzeżenie, 0 obserwacji

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

### F1 — Funkcja triggera bez ustawionego `search_path`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: supabase/migrations/20260823120000_create_yarns_table.sql:37-45
- **Szczegóły**: Funkcja `set_updated_at()` nie ma jawnie ustawionego `search_path`. To standardowe ostrzeżenie linteraSupabase ("Function Search Path Mutable") — bez jawnego `search_path` rozwiązanie nazw niekwalifikowanych obiektów (tu: `now()`) zależy od zmiennej sesji, którą teoretycznie może manipulować rola z uprawnieniem `CREATE` w schemacie. Realne ryzyko w tym konkretnym przypadku jest niskie (funkcja odwołuje się tylko do wbudowanej `now()`), ale to utrwalony wzorzec dla wszystkich przyszłych funkcji/triggerów w projekcie, więc lepiej ustawić go poprawnie od pierwszej migracji.
- **Poprawka**: Dodaj `set search_path = pg_catalog, public` do definicji funkcji, np. `language plpgsql set search_path = pg_catalog, public as $$ ... $$`.
- **Decyzja**: FIXED + ACCEPTED-AS-RULE: Funkcje Postgres muszą mieć jawnie ustawiony `search_path` (zapisano w context/foundation/lessons.md)

## Weryfikacja kryteriów sukcesu

### Faza 1
- Automatyczna: `npx supabase db reset` — NIE URUCHOMIONO PONOWNIE w tej sesji (Docker niedostępny w środowisku); wg `## Progress` planu zweryfikowane wcześniej w commit `580f110`.
- Ręczne (izolacja RLS, ograniczenie ilości, `updated_at`) — oznaczone `[x]` z commit `580f110`, zgodne z opisanym w planie protokołem testowym przez REST API (nie Supabase Studio).

### Faza 2
- `npx astro check` — ✅ URUCHOMIONO PONOWNIE: 0 błędów, 0 ostrzeżeń, 4 podpowiedzi.
- `npx eslint src/types.ts` — ✅ URUCHOMIONO PONOWNIE: brak błędów.
- Ręczne porównanie pól `Yarn` z kolumnami tabeli — potwierdzone: wszystkie 16 kolumn ma odpowiadające pole w interfejsie `Yarn`, nazwy i nullability zgodne 1:1 z `CHECK`/`NOT NULL` w migracji.

## Podsumowanie zgodności z planem

- **Faza 1** (`supabase/migrations/20260823120000_create_yarns_table.sql`, `...20260823120100_grant_yarns_privileges.sql`): implementacja odpowiada kontraktowi planu 1:1 — kolumny, ograniczenia, indeks, trigger, cztery granularne polityki RLS. Druga migracja (GRANT) była już udokumentowana w planie jako "Uwaga z implementacji", więc nie jest niezgłoszonym dryfem. Polityki dodatkowo zawężone do roli `to authenticated` (plan nie precyzował roli) — to bezpieczne wzmocnienie, nie odchylenie.
- **Faza 2** (`src/types.ts`): `Yarn` i `YarnFiberComposition` odpowiadają dokładnie kontraktowi planu.
- Brak plików zmienionych poza tymi zaplanowanymi. Brak naruszeń listy "Czego NIE robimy" (brak zod, brak warstwy serwisowej, brak UI, brak tabeli dla zamienników, brak Supabase Storage).
