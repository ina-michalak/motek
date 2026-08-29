<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: AI substitute suggestions — Faza 1: Model danych

- **Plan**: context/changes/ai-substitute-suggestions/plan.md
- **Zakres**: Faza 1 z 4
- **Data**: 2026-08-29
- **Werdykt**: ZAAKCEPTOWANY
- **Ustalenia**: 0 krytycznych, 0 ostrzeżeń, 1 obserwacja

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | PASS |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | PASS |

## Ustalenia

### F1 — Anonimowy check constraint na kolumnie `status`

- **Ważność**: OBSERWACJA
- **Wpływ**: NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: supabase/migrations/20260829150000_create_yarn_substitute_decisions_table.sql:8
- **Szczegóły**: `check (status in ('accepted', 'rejected'))` to nienazwany constraint kolumnowy. Wzorzec `yarns` (20260823120000_create_yarns_table.sql) nazywa wszystkie swoje check-constrainty jawnie (`yarns_rating_range`, `yarns_quantity_present` itd.), a w tym samym nowym pliku sąsiednie constrainty (`yarn_substitute_decisions_not_self`, `yarn_substitute_decisions_unique_pair`) już są nazwane — więc `status` wyłamuje się z konwencji zastosowanej dwie linie niżej.
- **Poprawka**: Nazwij constraint jawnie: `constraint yarn_substitute_decisions_status_valid check (status in ('accepted', 'rejected'))`.
- **Decyzja**: FIXED

## Dodatkowe uwagi (bez akcji)

- FK na `yarn_id`/`substitute_yarn_id` weryfikuje tylko istnienie wiersza w `yarns`, nie własność (FK omija RLS) — to znane i już zaadresowane w planie: serwis `recordSubstituteDecision` (Faza 3) ma jawnie weryfikować własność obu włóczek przez `getYarnById`. Przypomnienie na Fazę 3, nie luka Fazy 1.
- Reguła `search_path` z `context/foundation/lessons.md` zachowana — migracja nie redefiniuje `set_updated_at()`, tylko reużywa istniejącą funkcję, zgodnie z planem.
- Unique constraint `(user_id, yarn_id, substitute_yarn_id)` dokładnie odpowiada `onConflict` opisanemu w planie dla przyszłego `upsert`.
- Grant trafnie umieszczony w tej samej migracji (inline), zgodnie z wnioskiem z historii projektu (poprzedni podział na dwa pliki dla `yarns` był naprawą przeoczenia, nie wzorcem).

## Kryteria sukcesu

Automatyczne (zweryfikowane w tej sesji):
- `npx supabase db reset` — PASS (migracja aplikuje się czysto)
- `npx astro check` — PASS (0 błędów)
- `npm run lint` — PASS (0 błędów; tylko 3 wcześniej istniejące ostrzeżenia `no-console` niezwiązane ze zmianą)

Ręczne (zweryfikowane przez użytkownika z dowodami w tej sesji):
- Tabela `yarn_substitute_decisions` widoczna w Supabase Studio z 4 politykami RLS i grantami — potwierdzone zrzutem ekranu Table Editora
- RLS odrzuca insert z `user_id` innym niż `auth.uid()` — potwierdzone błędem `42501: new row violates row-level security policy for table "yarn_substitute_decisions"` po próbie insertu z podszywaniem się pod innego użytkownika (via `set request.jwt.claims`)
