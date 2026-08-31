<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Zarządzanie zapisaną włóczką (S-03)

- **Plan**: context/changes/manage-saved-yarn-entry/plan.md
- **Zakres**: Faza 2 z 3
- **Data**: 2026-08-31
- **Werdykt**: ZAAKCEPTOWANY
- **Ustalenia**: 0 krytycznych, 0 ostrzeżeń, 1 obserwacja

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | PASS |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Kryteria sukcesu | PASS |

## Notatki weryfikacyjne

- Zakres git (commit `1d1cb55`) pokrywa się 1:1 z listą plików z Fazy 2: `YarnForm.tsx` (rename z `AddYarnForm.tsx`), `EditYarnDialog.tsx` (nowy), `[id].astro`, `new.astro`, plus `YarnCard.astro` — ta ostatnia zmiana nie była w formalnej liście "Wymagane zmiany", ale domyka kryterium sukcesu 2.7 ("badge na karcie w bibliotece") i sekcję "Pożądany stan końcowy" planu — potraktowana jako zamierzone domknięcie luki w planie, nie jako scope creep.
- Wszystkie zaplanowane elementy (props `YarnForm`, `remove_photo` hidden input, `EditYarnDialog`, banery error/warning na `[id].astro`, chip „Wyczerpana”) zweryfikowane 1:1 z kodem — MATCH.
- Bezpieczeństwo: `error`/`warning` z query stringu renderowane przez Astro JSX bez `set:html` → auto-escaping, brak XSS.
- Wzorzec `DialogTrigger asChild` + `Button` (bez `React.forwardRef`) sprawdzony jako bezpieczny na React 19 (`ref` jako zwykły prop funkcyjny).
- `npm run lint` — PASS (0 błędów, tylko istniejące ostrzeżenia `no-console` niezwiązane ze zmianą).
- `npm run build` — PASS.
- Kryteria ręczne 2.3–2.8 potwierdzone przez użytkownika na żywych danych Supabase.

## Ustalenia

### F1 — Ikona „Plus” na przycisku submit również w trybie edycji

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/yarn/YarnForm.tsx:442
- **Szczegóły**: `SubmitButton` zawsze renderuje ikonę `<Plus className="size-4" />`, niezależnie od `mode`. W trybie `edit` przycisk „Zapisz zmiany” pokazuje więc ikonę plusa, co sugeruje dodawanie, a nie zapisywanie zmian. Plan nie precyzował ikony per-mode, więc to nie odchylenie od planu — czysto kosmetyczne niedopatrzenie przy uogólnianiu `AddYarnForm` → `YarnForm`.
- **Poprawka**: Przekazać ikonę jako prop (np. `submitIcon`) analogicznie do `submitLabel`, albo warunkowo wybrać `Plus`/`Check` na podstawie `mode` wewnątrz `YarnForm`.
- **Decyzja**: FIXED — wybór ikony `Check`/`Plus` na podstawie `mode` bezpośrednio w `YarnForm.tsx` (bez dodatkowego propa).
