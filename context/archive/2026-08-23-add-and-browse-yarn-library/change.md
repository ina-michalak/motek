---
change_id: add-and-browse-yarn-library
title: Add and browse yarn library
status: archived
created: 2026-08-23
updated: 2026-08-29
archived_at: 2026-08-29T12:39:30Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Aneks — poprawki UX po epilogu (2026-08-29)

Po zamknięciu planu (wszystkie fazy scommitowane) użytkowniczka zgłosiła 6 dodatkowych poprawek UX w `AddYarnForm`/`CompositionRows`, poza formalnym zakresem `plan.md`, zweryfikowanych podczas pełnego przeglądu implementacji (`reviews/impl-review.md`):

1. Zamiana kolejności pól: Producent przed Nazwą.
2. Blokada liter/znaków `-+eE` w polach numerycznych (ilość, druty, szydełko, procent składu) — `src/lib/numeric-input.ts`.
3. Domyślnie 1 pusty wiersz składu włókien widoczny od razu (zamiast czekać na klik "Dodaj włókno").
4. Blokada wpisywania wartości ujemnych w polach numerycznych (ten sam mechanizm co pkt 2).
5. Zamiana `<input type="file">` na drag&drop — `src/components/yarn/PhotoDropzone.tsx`.
6. Naprawa: pola `needle_size_mm`/`hook_size_mm` nie wyświetlały komunikatu błędu ani `aria-invalid`; dodano oba, poprawiono `min` na `0.25` (schemat wymaga wartości >0).
