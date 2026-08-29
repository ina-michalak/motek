# Wyciągnięte wnioski

> Rejestr powtarzających się reguł i wzorców, tylko do dodawania. Ponownie odczytywany na początku przez /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Funkcje Postgres muszą mieć jawnie ustawiony `search_path`

- **Context**: supabase/migrations/20260823120000_create_yarns_table.sql:37-45 (funkcja triggera `set_updated_at()`)
- **Problem**: Funkcja nie miała jawnie ustawionego `search_path` — to standardowe ostrzeżenie Supabase Security Advisor ("Function Search Path Mutable"). Bez jawnego `search_path` rozwiązywanie niekwalifikowanych nazw obiektów w funkcji zależy od zmiennej sesji, którą teoretycznie może manipulować rola z uprawnieniem `CREATE` w schemacie.
- **Rule**: Każda nowa funkcja Postgres (trigger, RPC, itp.) w migracjach Supabase musi mieć jawnie ustawiony `search_path` w definicji (np. `set search_path = pg_catalog, public`), niezależnie od tego, czy jest `SECURITY DEFINER`.
- **Applies to**: Wszystkie pliki w `supabase/migrations/*.sql` definiujące funkcje (`create function` / `create or replace function`).

## `return` na najwyższym poziomie frontmatteru `.astro` zawiesza ESLint

- **Context**: src/pages/yarns/[id].astro (Faza 5 add-and-browse-yarn-library) — próba `if (!yarn) { return Astro.redirect("/dashboard"); }` w frontmatterze.
- **Problem**: Każdy `return` będący bezpośrednim dzieckiem programu frontmatteru (bez względu na to, czy jest zagnieżdżony w `if`, czy bezwarunkowy, i niezależnie od zwracanej wartości — potwierdzone też dla `return null`) powoduje twardy crash ESLint: `Non-null Assertion Failed: Expected node to have a parent` w regule `@typescript-eslint/no-misused-promises` (`checkReturnStatement`), wynikający z niekompatybilności `astro-eslint-parser` z tą regułą. `npm run lint` przestaje działać w całym projekcie, nie tylko dla tego pliku. `return` wewnątrz zwykłej funkcji zadeklarowanej w frontmatterze (nie na najwyższym poziomie) **nie** crashuje.
- **Rule**: Nie używać `return Astro.redirect(...)` (ani żadnego innego `return`) na najwyższym poziomie frontmatteru stron `.astro`. Do przekierowania używać `Astro.response.status = 3xx; Astro.response.headers.set("Location", url)` i owinąć resztę template'u w warunek (np. `{cond && (...)}`), żeby nic się nie renderowało po stronie HTML — to daje prawdziwe przekierowanie HTTP bez crashowania lintera.
- **Applies to**: Wszystkie pliki `src/pages/**/*.astro` z warunkowym przekierowaniem we frontmatterze (np. ochrona dostępu do zasobu, redirect po braku danych).
