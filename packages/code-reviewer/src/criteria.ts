export interface Criterion {
  id: string;
  label: string;
  definition: string;
}

export const CRITERIA: Criterion[] = [
  {
    id: "correctness",
    label: "Poprawność implementacji",
    definition:
      "Poprawność implementacji — czy kod faktycznie robi to, co deklaruje, obsługując ścieżkę główną, przypadki brzegowe i błędy, bez wprowadzania regresji? Skala 1-10: 1 = logika jest zepsuta, pomija oczywiste przypadki brzegowe/błędów lub po cichu psuje istniejące zachowanie. 10 = zachowuje się poprawnie na ścieżce głównej, w przypadkach brzegowych i trybach awarii, bez regresji.",
  },
  {
    id: "idiomaticity",
    label: "Idiomatyczność",
    definition:
      "Idiomatyczność — czy kod jest zgodny z twardymi regułami i konwencjami tego repo (Astro SSR, React 19, Tailwind 4, shadcn/ui), których oczekiwałby doświadczony współautor? Skala 1-10: 1 = łamie twarde reguły repo (np. brakujące prerender = false na endpoincie API, ręczne łączenie klas zamiast cn(), komponent React tam gdzie wystarczyłby statyczny Astro) lub czyta się jak obcy kod. 10 = nie do odróżnienia od dobrze napisanego otaczającego kodu, naturalnie stosuje idiomy Astro/React/shadcn i konwencje z CLAUDE.md.",
  },
  {
    id: "complexity",
    label: "Złożoność",
    definition:
      "Złożoność — czy rozwiązanie jest tak proste, jak pozwala na to problem, bez zbędnej abstrakcji? Skala 1-10: 1 = nadmiernie zaprojektowane lub splątane — przedwczesne abstrakcje, trudne do prześledzenia intencje. 10 = minimalistyczne i przejrzyste, najprostszy projekt w pełni rozwiązujący problem.",
  },
  {
    id: "testCoverage",
    label: "Pokrycie testami / ryzykiem",
    definition:
      "Pokrycie testami / ryzykiem — czy istotne zachowania i ryzykowne ścieżki są testowane proporcjonalnie do ryzyka, zgodnie z runnerami tego repo (vitest dla logiki/serwisów, Playwright dla E2E)? Skala 1-10: 1 = ryzykowna logika (np. serwis, walidacja, endpoint API) dostarczona bez testów; testy nieobecne, trywialne lub niczego realnie nie potwierdzają. 10 = pokrycie ważone ryzykiem — części najbardziej podatne na błędy są testowane celowo i dobrze, E2E tam gdzie faktycznie potrzebna jest przeglądarka.",
  },
  {
    id: "documentation",
    label: "Dokumentacja",
    definition:
      'Dokumentacja — czy nieoczywiste decyzje, publiczne interfejsy i trudne fragmenty są wyjaśnione tam, gdzie czytelnik by tego potrzebował? Skala 1-10: 1 = nieprzejrzyste — brak komentarzy/dokumentacji tam, gdzie są potrzebne, intencje trzeba odtwarzać z kodu. 10 = wystarczająca dokumentacja/komentarze, żeby wyjaśnić "dlaczego" bez powtarzania oczywistości; zmiana zrozumiała bez czytania całej historii PR-a.',
  },
  {
    id: "typeSafety",
    label: "Integralność typów",
    definition:
      "Integralność typów — czy dane wejściowe są walidowane na granicach systemu (zod), a typy spójne od API po UI (src/types.ts)? Skala 1-10: 1 = brak walidacji na granicy (np. endpoint API bez zod), typy any/rozjeżdżające się między warstwami, DTO niespójne z bazą. 10 = każda granica (API, formularz) waliduje zod-em, typy end-to-end spójne, współdzielone typy w src/types.ts.",
  },
  {
    id: "security",
    label: "Bezpieczeństwo",
    definition:
      "Bezpieczeństwo — czy zmiana unika wprowadzania luk, wycieku sekretów i niebezpiecznego przetwarzania niezaufanych danych, zgodnie ze specyfiką stosu (Supabase + Astro)? Skala 1-10: 1 = wprowadza możliwą do wykorzystania lukę, wycieka sekrety, ufa niezaufanym danym wejściowym, brakuje RLS na nowej tabeli Supabase, sekret czytany poza astro:env/server. 10 = dane wejściowe walidowane, sekrety obsługiwane wyłącznie przez astro:env/server, RLS z granularnymi politykami na każdej nowej tabeli, autoryzacja sprawdzana tam, gdzie potrzebna (middleware, właściciel danych).",
  },
];
