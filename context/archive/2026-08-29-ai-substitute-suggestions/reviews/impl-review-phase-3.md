<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: AI substitute suggestions — Plan implementacji

- **Plan**: context/changes/ai-substitute-suggestions/plan.md
- **Zakres**: Faza 3 z 4
- **Data**: 2026-08-29
- **Werdykt**: ZAAKCEPTOWANY
- **Ustalenia**: 0 krytycznych, 1 ostrzeżenie, 3 obserwacje

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

### F1 — Brak obsługi błędu parsowania JSON w ciele żądania

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość (Niezawodność)
- **Lokalizacja**: src/pages/api/yarns/[id]/substitutes.ts:32
- **Szczegóły**: `await context.request.json()` nie jest owinięte w try/catch — obejmuje go tylko blok try niżej wokół `recordSubstituteDecision`. Żądanie z niepoprawnym JSON w body rzuci nieprzechwyconym `SyntaxError`, co poskutkuje generyczną odpowiedzią błędu Astro (prawdopodobnie 500 HTML) zamiast spójnej odpowiedzi `{ error }` 400, którą zwraca reszta endpointu. To pierwszy JSON API route w repo, więc warto ustalić poprawny wzorzec teraz, zanim powieli go Faza 4 lub przyszłe endpointy.
- **Poprawka**: Owinąć `context.request.json()` w try/catch i przy błędzie parsowania zwrócić `Response.json({ error: "Nieprawidłowy JSON" }, { status: 400 })`.
- **Decyzja**: FIXED

### F2 — Nieudokumentowany w planie krok tworzenia klienta Supabase

- **Ważność**: ℹ️ OBSERWACJA
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/pages/api/yarns/[id]/substitutes.ts:27-30
- **Szczegóły**: Między walidacją `id` a parsowaniem JSON wstawiono `createClient(...)` + guard `if (!supabase) return Response.json({ error: "Supabase is not configured" }, { status: 400 })`. Sekcja "Umowa" planu nie wymienia tego kroku. Jest on jednak niezbędny — `recordSubstituteDecision` wymaga klienta Supabase — i konsekwentnie zwraca JSON (zamiast redirectu jak w `yarns.ts`), zgodnie z resztą endpointu. Nieszkodliwe uzupełnienie luki specyfikacji, nie realny drift.
- **Decyzja**: SKIPPED (akceptowalne jako niezbędny szczegół implementacyjny)

### F3 — `toErrorMessage` skopiowany zamiast wydzielony do wspólnego helpera

- **Ważność**: ℹ️ OBSERWACJA
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/pages/api/yarns/[id]/substitutes.ts:9-14 (identyczny z src/pages/api/yarns.ts:8-13)
- **Szczegóły**: Funkcja jest bajt-w-bajt duplikatem istniejącej w `yarns.ts`. To powiela już istniejący w repo wzorzec (funkcja nie była wcześniej wydzielona do `src/lib/`), więc nie jest to nowa regresja — ale przy trzecim takim JSON endpointzie (Faza 4 może nie potrzebować, ale przyszłe endpointy mogą) warto rozważyć wydzielenie do współdzielonego helpera.
- **Decyzja**: SKIPPED (za wcześnie na abstrakcję przy dwóch użyciach)

### F4 — Surowe komunikaty błędów Supabase/Postgres przekazywane wprost do klienta

- **Ważność**: ℹ️ OBSERWACJA
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/yarns/[id]/substitutes.ts:49
- **Szczegóły**: `toErrorMessage` może przekazać do klienta surowy `error.message` z wyjątku Supabase/Postgres (np. nazwy tabel/ograniczeń). Dokładnie ten sam wzorzec istnieje już w `yarns.ts:59` — spójne z konwencją repo, nie nowa regresja tej fazy.
- **Decyzja**: SKIPPED (istniejąca konwencja repo, sanityzacja to osobne zadanie obejmujące oba endpointy)

## Kryteria sukcesu

**Automatyczne** (uruchomione ponownie podczas przeglądu):
- `npx astro check` — ✅ 0 błędów, 0 ostrzeżeń, 5 hintów
- `npm run lint` — ✅ 0 błędów (4 pre-istniejące ostrzeżenia `no-console`, zgodne z konwencją `yarns.ts`)

**Ręczne**:
- 3.3 (401 bez sesji) — ✅ potwierdzone: curl bez cookies zwrócił `401 {"error":"Unauthorized"}`
- 3.4 (poprawne żądanie zapisuje wiersz, zwraca 200) — ✅ potwierdzone przez użytkownika: konsola przeglądarki zwróciła `200`, w Supabase Studio widoczne dwa symetryczne wiersze `accepted` w `yarn_substitute_decisions`
- 3.5 (cudzy `substituteYarnId` odrzucany) — ⏸ świadomie pominięte na decyzję użytkownika (logika weryfikacji własności w `recordSubstituteDecision` jest niezmieniona względem Fazy 2, gdzie nie była w zakresie tego review'u)

## Uwaga dot. zakresu przeglądu

`src/lib/services/substitutes.ts` (zawiera `recordSubstituteDecision`, którą wywołuje nowy endpoint) nie był częścią diffu tej fazy — powstał w Fazie 2 i został już wtedy zweryfikowany. Ten przegląd ocenił tylko, czy endpoint poprawnie się na nim opiera (poprawnie — deleguje weryfikację własności obu włóczek do serwisu, nie duplikuje ani nie pomija tej logiki).
