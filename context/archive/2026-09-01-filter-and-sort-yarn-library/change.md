---
change_id: filter-and-sort-yarn-library
title: Filter and sort yarn library
status: archived
created: 2026-09-01
updated: 2026-09-05
archived_at: 2026-09-05T13:12:57Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Parametry filtrów i sortowania ustalone z userem przed planowaniem — patrz `context/foundation/roadmap.md`, sekcja S-04, pole "Niewiadome" (rozwiązane 2026-09-01).
- **Odejście od "Umowy" Fazy 2 w plan.md (2026-09-01, na podstawie ręcznego testowania)**: plan opisywał filtr składu jako `<select name="fiber" multiple>` i sortowanie jako pojedynczy `<select>` z 10 opcjami. Zamiast tego zaimplementowano listę checkboxów dla składu (natywny multi-select wymagał Ctrl+klik i nie dawał się łatwo odznaczyć — zły UX) oraz "dzielony input" sortowania (dropdown pola + osobny przycisk przełączający kierunek rosnąco/malejąco, zamiast długiej listy 10 etykiet). Intencja planu (filtrowanie/sortowanie przez URL, bez nowego stanu klienckiego poza UI) w pełni zachowana; zmieniła się tylko forma kontrolek, na wyraźną prośbę użytkownika. Przy okazji przeniesiono z Fazy 3 licznik wyników "Pokazano X z Y" i przycisk "Wyczyść filtry" oraz dodano nieplanowany parametr URL `filtersOpen` (utrwala stan otwarcia panelu filtrów między submitami formularza).
- **Dodatek poza "Umową" Fazy 3 w plan.md (2026-09-05, na podstawie ręcznego testowania mobilnego)**: plan nie przewidywał osobnego przycisku zamykającego panel filtrów — zamykanie miało się odbywać przez ponowne kliknięcie przycisku "Filtry". W testach mobilnych okazało się to mało odkrywalne i panel zasłaniał cały widok. Dodano przycisk "Pokaż wyniki" na dole panelu (`YarnFilters.tsx`), przyklejony do dołu ekranu (`sticky bottom-0`) na widoku mobilnym, żeby był widoczny bez przewijania niezależnie od wysokości panelu; na `sm:`+ wraca do zwykłego układu siatki. Czysto prezentacyjny dodatek — nie zmienia logiki filtrowania/URL.
