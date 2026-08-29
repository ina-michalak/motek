<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Add and browse yarn library

- **Plan**: context/changes/add-and-browse-yarn-library/plan.md
- **Zakres**: Faza 4 z 5
- **Data**: 2026-08-28
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 2 ostrzeżeń, 4 obserwacji

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | WARNING |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | PASS |

## Ustalenia

### F1 — Brak walidacji zdjęcia po stronie serwera

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/yarns.ts:55-62, src/lib/services/yarns.ts:101-103
- **Szczegóły**: Pole `photo` nie przechodzi przez `createYarnSchema` (zod). `attachYarnPhoto` wgrywa plik do Storage używając `contentType: file.type` — wartości dostarczonej przez klienta, bez żadnej weryfikacji po stronie serwera. Walidacja w `AddYarnForm.tsx` (`ACCEPTED_PHOTO_TYPES`, `MAX_PHOTO_SIZE_BYTES`) to jedyna linia obrony — trywialnie omijalna przez bezpośrednie żądanie POST (curl, zmodyfikowany request) z pominięciem przeglądarki. Blast radius jest ograniczony (RLS trzyma plik w folderze własnym użytkownika, brak wycieku cudzych danych), ale umożliwia nadużycie limitu rozmiaru/typu pliku w prywatnym buckecie.
- **Poprawka**: Przenieś `ACCEPTED_PHOTO_TYPES`/`MAX_PHOTO_SIZE_BYTES` do `src/lib/validation/yarn.ts` (współdzielone ze stałymi) i sprawdź `photo.type`/`photo.size` w `POST` handlerze `api/yarns.ts` przed wywołaniem `attachYarnPhoto`, zwracając ten sam wzorzec redirectu z `?error=`.
  - Siła: Kontynuuje już ustalony w tej fazie wzorzec "jedno źródło prawdy" (ten sam `createYarnSchema` używany po obu stronach) — po prostu rozszerzony na zdjęcie.
  - Kompromis: Brak istotnego — kilka linii w istniejącym handlerze.
  - Pewność: HIGH — identyczny wzorzec walidacji już działa dla pozostałych pól w tym samym pliku.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: FIXED — dodano `validateYarnPhoto`/`ACCEPTED_PHOTO_TYPES`/`MAX_PHOTO_SIZE_BYTES` w `src/lib/validation/yarn.ts`, wywoływane teraz zarówno w `AddYarnForm.tsx` (klient), jak i `api/yarns.ts` (serwer, przed `attachYarnPhoto`).

### F2 — `key={index}` w usuwalnej liście składu

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/yarn/CompositionRows.tsx:31
- **Szczegóły**: Klucz React oparty na indeksie w liście, z której można usuwać wiersze (`removeRow`). Usunięcie środkowego wiersza powoduje, że React re-używa węzły DOM dla przesuniętych wierszy — typowy efekt to przeskok fokusu po kliknięciu przycisku usuwania.
- **Poprawka**: Generuj stabilny `id` przy `addRow()` (np. `crypto.randomUUID()`) i używaj go jako klucza zamiast indeksu.
- **Decyzja**: FIXED — `CompositionRow` ma teraz `id: crypto.randomUUID()`, klucz listy i operacje update/remove adresują po `id`; `id` jest odrzucane przy serializacji do wysyłki (`serializeComposition`).

### F3 — Pole procentowe czyści się do 0 zamiast pustego stanu

- **Ważność**: 👁️ OBSERWACJA
- **Wymiar**: Niezawodność
- **Lokalizacja**: src/components/yarn/CompositionRows.tsx:49
- **Szczegóły**: `Number(e.target.value)` — wyczyszczenie pola daje `Number("") = 0`, więc pole nie może chwilowo pozostać puste podczas wpisywania nowej wartości, w przeciwieństwie do pozostałych pól liczbowych w `AddYarnForm`, trzymanych jako string. Drobna niedogodność UX, nie błąd danych (walidacja i zapis działają poprawnie).
- **Decyzja**: FIXED — `CompositionRow.percent` jest teraz typu `string`, konwersja na liczbę dzieje się dopiero w `createYarnSchema` (`z.coerce.number()`), spójnie z resztą pól formularza.

### F4 — Nieużywany komponent `Card`

- **Ważność**: 👁️ OBSERWACJA
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/ui/card.tsx
- **Szczegóły**: Zainstalowany, ale nigdzie niezaimportowany w Fazie 4 — `new.astro` odtwarza wygląd karty ręcznie przez `div` + klasy Tailwind. Zgodne z planem (Card jest zarezerwowany też pod Fazę 5), więc nie jest to odchylenie — tylko do świadomości przy Fazie 5.
- **Decyzja**: SKIPPED — zgodne z planem, nic do naprawienia teraz.

### F5 — Duplikacja markupu pola formularza w `AddYarnForm`

- **Ważność**: 👁️ OBSERWACJA
- **Wymiar**: Architektura / Spójność wzorców
- **Lokalizacja**: src/components/yarn/AddYarnForm.tsx
- **Szczegóły**: W przeciwieństwie do `FormField.tsx` (jedno miejsce definiujące label+input+błąd dla formularzy auth), `AddYarnForm.tsx` powtarza ręcznie blok `Label`/`Input`/`FieldError` + `fieldClass`/`labelClass` dla ~10 pól. Działa poprawnie, ale zwiększa ryzyko rozjazdu stylów przy przyszłych zmianach.
- **Decyzja**: SKIPPED — działa poprawnie; wydzielenie wrappera to większa refaktoryzacja nie wymagana przez ten plan.

### F6 — `.claude/launch.json` zmieniony poza zakresem planu

- **Ważność**: 👁️ OBSERWACJA
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: .claude/launch.json
- **Szczegóły**: Dodano `"autoPort": true` — zmiana narzędziowa do uruchomienia lokalnego serwera dev na innym porcie (konflikt portu 4321 z inną sesją podczas weryfikacji ręcznej tej fazy). Niezwiązana z planem Fazy 4, ale nieszkodliwa — nie wpływa na build produkcyjny ani zachowanie aplikacji.
- **Decyzja**: SKIPPED — nieszkodliwa zmiana narzędziowa, już zacommitowana w fazie 4, nie wymaga cofania.

## Podsumowanie sortowania

- Naprawiono: F1, F2, F3 (3)
- Pominięto: F4, F5, F6 (3)

## Bez zastrzeżeń (potwierdzone przez podagentów)

- `src/pages/yarns/new.astro`, `AddYarnForm.tsx`, `CompositionRows.tsx`, `StarRatingInput.tsx`, prymitywy shadcn — wszystkie zgodne z umową planu 1:1.
- `<img src={photoPreview}>` używa wyłącznie lokalnego `blob:` URL z `URL.createObjectURL` — brak ryzyka XSS.
- `URL.revokeObjectURL` poprawnie powiązany z `useEffect`/zależnością `photoPreview` — brak wycieku pamięci.
- `CompositionRows`/`StarRatingInput` w pełni kontrolowane, bez własnego stanu — zgodnie z umową.
- Reużycie `createYarnSchema.safeParse` po stronie klienta i serwera — jedno źródło prawdy, brak rozjazdu komunikatów błędów.
- Autoryzacja w `api/yarns.ts` zgodna z konwencją middleware.
- `npx astro check` — 0 błędów; `npm run lint` na plikach Fazy 4 — 0 błędów (repo ma przedistniejący, niezwiązany problem CRLF/prettier na ~40 innych plikach, potwierdzony jako obecny przed tą fazą).
