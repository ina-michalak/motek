# Wyciągnięte wnioski

> Rejestr powtarzających się reguł i wzorców, tylko do dodawania. Ponownie odczytywany na początku przez /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Funkcje Postgres muszą mieć jawnie ustawiony `search_path`

- **Context**: supabase/migrations/20260823120000_create_yarns_table.sql:37-45 (funkcja triggera `set_updated_at()`)
- **Problem**: Funkcja nie miała jawnie ustawionego `search_path` — to standardowe ostrzeżenie Supabase Security Advisor ("Function Search Path Mutable"). Bez jawnego `search_path` rozwiązywanie niekwalifikowanych nazw obiektów w funkcji zależy od zmiennej sesji, którą teoretycznie może manipulować rola z uprawnieniem `CREATE` w schemacie.
- **Rule**: Każda nowa funkcja Postgres (trigger, RPC, itp.) w migracjach Supabase musi mieć jawnie ustawiony `search_path` w definicji (np. `set search_path = pg_catalog, public`), niezależnie od tego, czy jest `SECURITY DEFINER`.
- **Applies to**: Wszystkie pliki w `supabase/migrations/*.sql` definiujące funkcje (`create function` / `create or replace function`).
