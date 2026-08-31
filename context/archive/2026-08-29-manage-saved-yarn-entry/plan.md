# Zarządzanie zapisaną włóczką (S-03) — Plan implementacji

## Przegląd

Implementujemy S-03 z roadmapy: użytkownik może edytować zapisaną włóczkę (wszystkie pola z formularza dodawania, w tym ustawienie ilości na 0, by zasygnalizować wyczerpanie zapasu, oraz jawne usunięcie zdjęcia) albo usunąć ją całkowicie ze swojej biblioteki. Realizuje FR-005 i FR-006 z PRD.

## Analiza stanu obecnego

Tabela `yarns` (z F-01) ma już pełne RLS (`select`/`insert`/`update`/`delete`, wszystkie `auth.uid() = user_id`) i granty dla `authenticated` — migracja `20260823120000_create_yarns_table.sql` i `20260823120100_grant_yarns_privileges.sql`. Bucket `yarn-photos` ma analogicznie kompletne RLS storage (w tym `delete`) — `20260823130000_create_yarn_photos_bucket.sql`. Żadna nowa migracja nie jest potrzebna.

Warstwa serwisu (`src/lib/services/yarns.ts:1-134`) ma dziś tylko `listYarns`, `getYarnById`, `createYarn`, `attachYarnPhoto` — brak `updateYarn`/`deleteYarn`/usuwania zdjęcia bez zastąpienia.

API (`src/pages/api/yarns.ts`) obsługuje wyłącznie `POST` tworzenia nowej włóczki, wzorzec: natywny form-POST → zod (`createYarnSchema`) → redirect z błędem w query string. Nie istnieje żaden route pod `/api/yarns/[id]` poza zagnieżdżonym `substitutes.ts` (S-02), który jest z kolei JSON API (fetch, `Response.json`, kody statusu) — te dwa wzorce współistnieją w repo dla różnych typów akcji.

Strona szczegółów (`src/pages/yarns/[id].astro:1-126`) jest dziś czysto prezentacyjna — brak jakiegokolwiek przycisku edycji/usuwania. `AddYarnForm.tsx` (411 linii) jest zahardkodowany pod tworzenie: stały `action="/api/yarns"`, brak `initialValues`, brak trybu. Komponenty pomocnicze (`CompositionRows.tsx`, `PhotoDropzone.tsx`, `StarRatingInput.tsx`) są już w pełni kontrolowane i reużywalne bez zmian.

W repo nie ma dziś żadnego komponentu modala/dialogu (`src/components/ui/` zawiera tylko `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`, `LibBadge.astro`) ani wzorca potwierdzenia akcji destrukcyjnej — `button.tsx` ma już zdefiniowany wariant `destructive`, ale nic go dotąd nie używa. Pakiet `radix-ui` (v1.6.7) jest już zależnością, a `components.json` jest skonfigurowany („new-york”), więc `npx shadcn@latest add dialog alert-dialog` zadziała bez dodatkowej konfiguracji.

Middleware (`src/middleware.ts:4`) chroni `/yarns*` i `/dashboard` jako strony, ale **nie** `/api/yarns*` (ścieżka `/api/...` nie zaczyna się od `/yarns`) — obie istniejące API routes niezależnie sprawdzają `context.locals.user`; nowy route musi robić to samo.

### Kluczowe odkrycia:

- RLS/granty na `update`/`delete` dla `yarns` i storage już istnieją — zero nowych migracji (`supabase/migrations/20260823120000_create_yarns_table.sql:53-74`, `20260823130000_create_yarn_photos_bucket.sql`).
- `yarn_substitute_decisions.yarn_id`/`substitute_yarn_id` mają `on delete cascade` (`supabase/migrations/20260829150000_create_yarn_substitute_decisions_table.sql:6-7`) — usunięcie włóczki automatycznie czyści powiązane decyzje o zamiennikach, zgodnie z celowym uproszczeniem z PRD (`context/foundation/prd.md:68`).
- `createYarnSchema` (`src/lib/validation/yarn.ts:63-92`) już akceptuje `quantity_skeins`/`quantity_grams` równe `0` (walidacja `nonnegative()`, nie `positive()`) — żadna zmiana schematu nie jest potrzebna, by wesprzeć "0 = wyczerpana" z FR-005.
- Lesson z `context/foundation/lessons.md:12-17`: żaden `return` (w tym `Astro.redirect(...)`) na najwyższym poziomie frontmatteru `.astro` — `[id].astro` już poprawnie używa `Astro.response.status`/`headers.set("Location", ...)` + warunkowego renderowania; nowe zmiany na tej stronie nie dodają kolejnych przekierowań w frontmatterze, więc wzorzec zostaje nienaruszony.
- `attachYarnPhoto` (`src/lib/services/yarns.ts:95-133`) uploaduje z `upsert: false` pod ścieżkę `{userId}/{yarnId}-{sanitizedFileName}` i usuwa stary plik dopiero **po** udanym update DB, i tylko gdy ścieżki się różnią — ta funkcja jest reużywana bez zmian do podmiany zdjęcia przy edycji.

## Pożądany stan końcowy

Na stronie szczegółów włóczki (`/yarns/[id]`) użytkownik widzi przyciski „Edytuj” i „Usuń” obok istniejącego linku powrotu. „Edytuj” otwiera modal z tym samym zestawem pól co przy dodawaniu, wypełnionym aktualnymi danymi, z możliwością podmiany lub jawnego usunięcia zdjęcia; zapis odświeża stronę z nowymi danymi. „Usuń” otwiera dialog potwierdzenia; po potwierdzeniu włóczka znika natychmiast, a użytkownik trafia z powrotem na `/dashboard`. Gdy obie podane ilości (motki/gramy) wynoszą 0, na karcie w bibliotece i na stronie szczegółów widoczna jest etykieta „Wyczerpana”.

Weryfikacja: ręczne przejście całego flow na dwóch kontach testowych (edycja wszystkich pól w tym zdjęcia, usunięcie zdjęcia bez zastąpienia, ustawienie ilości na 0, usunięcie włóczki — w tym włóczki będącej czyimś zaakceptowanym zamiennikiem) + `npm run lint`, `npm run build`, `npm run test` przechodzą.

## Czego NIE robimy

- Cofanie/historia zmian (brak wersjonowania edycji).
- Dodatkowe ostrzeżenie przy usuwaniu o liczbie powiązanych zamienników — zgodnie z decyzją PRD (Socratic note, `prd.md:68`) usuwanie zostaje proste, kaskada w DB załatwia sprawę bez dodatkowego UI.
- Osobny endpoint/metoda HTTP `PATCH` wywoływana z natywnego formularza — przeglądarki nie wspierają `PATCH` z `<form>`, więc edycja idzie przez `POST`.
- Testy jednostkowe funkcji serwisowych opartych o łańcuch wywołań Supabase (`updateYarn`, `deleteYarn`, `removeYarnPhoto`) — w repo nie ma dziś żadnego mocka/harnessu dla `SupabaseClient` (nawet `createYarn`/`attachYarnPhoto` z S-01 nie mają testów), budowanie go teraz byłoby nieproporcjonalnym rozszerzeniem zakresu; te funkcje są weryfikowane ręcznie, tak jak cała reszta serwisu.
- Zmiany w modelu danych/migracjach — schemat już wspiera wszystko, czego potrzebuje S-03.

## Podejście do implementacji

Rozszerzamy istniejące wzorce zamiast wprowadzać nowe tam, gdzie się da: edycja idzie przez natywny `<form method="POST">` + redirect (jak tworzenie), bo cały formularz (10 pól + upload pliku) już ma tę mechanikę gotową i sprawdzoną — przeniesienie go na fetch/JSON wymagałoby przepisania obsługi multipart w locie bez korzyści dla usera (NFR „< 1s” jest już spełniane przez pełne przeładowanie). Usuwanie idzie przez JSON `DELETE` + fetch (jak akceptacja/odrzucenie zamiennika w S-02), bo to mała, izolowana akcja z natychmiastową reakcją UI i bez potrzeby przeładowania całej strony.

`AddYarnForm.tsx` zostaje uogólniony do `YarnForm.tsx` przyjmującego `mode`, `action`, `initialValues`, `existingPhotoUrl` — jeden komponent obsługuje oba przypadki, więc dodanie/zmiana pola w przyszłości to jedna edycja, nie dwie. Modal edycji i dialog usuwania to nowe, małe React islands (`client:load`) budowane na komponentach shadcn `dialog`/`alert-dialog`, instalowanych przez `npx shadcn@latest add` zgodnie z konwencją z `CLAUDE.md`.

## Krytyczne szczegóły implementacji

- **Kolejność w route edycji**: `updateYarn` (pola) musi wykonać się przed obsługą zdjęcia (podmiana/usunięcie), analogicznie do `createYarn` → `attachYarnPhoto` w istniejącym flow tworzenia — dzięki temu błąd samego zdjęcia jest niefatalny i nie cofa już zapisanych zmian pól (redirect z `?warning=`, nie `?error=`).
- **Kolejność w usuwaniu**: `deleteYarn` musi odczytać `photo_url` włóczki (do ewentualnego czyszczenia Storage) **przed** wykonaniem `delete` na wierszu — po usunięciu wiersza nie ma już skąd odczytać ścieżki pliku.
- **Znana, dziedziczona pułapka `attachYarnPhoto`**: jeśli nowy plik wgrywany przy edycji ma dokładnie taką samą nazwę (po sanitacji) jak obecnie zapisane zdjęcie, `upload(..., { upsert: false })` zwróci błąd konfliktu, bo stary obiekt pod tą samą ścieżką wciąż istnieje w momencie uploadu (usuwany jest dopiero po evencie update DB). To ograniczenie istnieje już w `attachYarnPhoto` od S-01 i nie jest wprowadzane przez ten plan — nie próbujemy go naprawiać w S-03, tylko odnotowujemy, żeby nie było mylone z regresją.

## Faza 1: Fundament backendu

### Przegląd

Nowe funkcje serwisu, nowy route API, instalacja komponentów UI modala/dialogu, oraz helper do wykrywania stanu „wyczerpana” wraz z testami jednostkowymi dla logiki, którą da się testować bez mocka Supabase.

### Wymagane zmiany:

#### 1. Serwis włóczek

**Plik**: `src/lib/services/yarns.ts`

**Cel**: Dodać trzy nowe eksportowane funkcje potrzebne do edycji i usuwania: `updateYarn` (nadpisuje pola nie-zdjęciowe), `removeYarnPhoto` (czyści zdjęcie bez zastępowania nowym), `deleteYarn` (usuwa cały wiersz, sprzątając powiązane zdjęcie w Storage).

**Umowa**:
- `updateYarn(supabase, userId: string, id: string, data: CreateYarnInput): Promise<Yarn>` — ten sam field-mapping co `createYarn` (linie 74-85), ale `.update({...}).eq("id", id).eq("user_id", userId).select().single()`; rzuca błąd Supabase albo `new Error("Update matched no yarn row")`, gdy `id`/`userId` się nie zgadzają (włóczka nie istnieje albo należy do kogoś innego) — to jest jedyny mechanizm autoryzacji na poziomie service, dokładnie jak w `getYarnById`.
- `removeYarnPhoto(supabase, userId: string, yarnId: string): Promise<void>` — najpierw `.select("photo_url").eq("id", yarnId).eq("user_id", userId).maybeSingle()`; jeśli `photo_url` jest `null`, zwróć od razu (no-op); w przeciwnym razie `.update({ photo_url: null }).eq("id", yarnId).eq("user_id", userId)` (DB jest źródłem prawdy first), a dopiero potem `storage.from(YARN_PHOTOS_BUCKET).remove([photo_url])` — błąd usunięcia z Storage tylko `console.warn`, nie rzuca (osierocony plik w prywatnym, per-user folderze nie jest wyciekiem danych, tylko marnotrawstwem miejsca).
- `deleteYarn(supabase, userId: string, id: string): Promise<void>` — najpierw odczytaj `photo_url` (jak wyżej, musi się to zdarzyć przed `delete`, inaczej nie ma już skąd odczytać ścieżki pliku); następnie `.from("yarns").delete().eq("id", id).eq("user_id", userId).select("id")` i sprawdź, że dokładnie jeden wiersz został dopasowany — jeśli 0, rzuć błąd (nie znaleziono / nie należy do usera); dopiero **po** potwierdzonym usunięciu wiersza, best-effort `storage.remove([photo_url])` (warn, nie throw) — ta kolejność (DB przed Storage) jest celowo bezpieczniejsza niż odwrotna: nie kasujemy pliku, dopóki nie mamy pewności, że wiersz naprawdę zniknął z bazy. Kaskada na `yarn_substitute_decisions` dzieje się automatycznie w DB.

#### 2. Helper „wyczerpana”

**Plik**: `src/lib/utils.ts`

**Cel**: Wspólna, czysta funkcja określająca, czy włóczka jest wyczerpana — używana zarówno na karcie w bibliotece, jak i na stronie szczegółów, żeby nie duplikować tej samej logiki w dwóch miejscach.

**Umowa**: `export function isYarnExhausted(yarn: Pick<Yarn, "quantity_skeins" | "quantity_grams">): boolean` — `true` tylko gdy przynajmniej jedno z pól jest zdefiniowane (nie `null`) i wszystkie zdefiniowane pola równają się `0` (włóczka bez żadnej podanej ilości, bo obie są `null`, nie jest wyczerpana — to stan "nigdy nie ustawiono", inny niż "zużyto do zera"; DB constraint i tak wymusza minimum jedno pole niepuste).

#### 3. Instalacja komponentów UI

**Cel**: Dodać shadcn `dialog` (modal edycji) i `alert-dialog` (potwierdzenie usunięcia) do `src/components/ui/`, zgodnie z konwencją projektu (`CLAUDE.md`: „Install new ones with npx shadcn@latest add [name]”).

**Umowa**: Uruchom `npx shadcn@latest add dialog alert-dialog` z katalogu głównego repo; commituje wygenerowane `src/components/ui/dialog.tsx` i `src/components/ui/alert-dialog.tsx` bez ręcznych modyfikacji.

#### 4. API route edycji i usuwania

**Plik**: `src/pages/api/yarns/[id].ts` (nowy plik)

**Cel**: Jeden plik route obsługujący dwie metody: `POST` dla zapisu edycji (wywoływany przez natywny `<form>`, wzorzec redirect jak `src/pages/api/yarns.ts`) i `DELETE` dla usunięcia (JSON, wzorzec jak `src/pages/api/yarns/[id]/substitutes.ts`).

**Umowa**:
- `export const prerender = false;`
- `export const POST: APIRoute`:
  1. `if (!context.locals.user) return context.redirect("/auth/signin");`
  2. Waliduj `context.params.id` przez `z.uuid()`; przy błędzie `context.redirect("/dashboard")`.
  3. `createClient(...)`; gdy `null`, redirect do `/yarns/${id}?error=${encodeURIComponent("Supabase is not configured")}&edit=1`.
  4. `context.request.formData()` → `createYarnSchema.safeParse({...})` (te same 12 pól co w `api/yarns.ts:26-39`); przy błędzie redirect do `/yarns/${id}?error=<pierwszy komunikat>&edit=1`.
  5. Jeśli jest plik `photo` (`size > 0`), `validateYarnPhoto` — przy błędzie redirect z `?error=&edit=1` jak wyżej.
  6. `updateYarn(supabase, userId, id, parsed.data)` w try/catch → przy błędzie redirect `?error=<komunikat>&edit=1`.
  7. Jeśli jest nowy plik `photo` → `attachYarnPhoto(...)` w try/catch → przy błędzie redirect `/dashboard?warning=...` (niefatalne, jak w `api/yarns.ts:63-71`) — **uwaga**: skoro pola już się zapisały, redirect na `/dashboard` (nie z powrotem na `/yarns/${id}`) jest niespójny z resztą flow; zamiast tego redirect do `/yarns/${id}?warning=...`, żeby user zobaczył zapisane zmiany na tej samej stronie.
  8. W przeciwnym razie, jeśli `form.get("remove_photo") === "true"` → `removeYarnPhoto(...)` w try/catch → przy błędzie redirect `/yarns/${id}?warning=...` (niefatalne, jak wyżej).
  9. Sukces: `context.redirect(`/yarns/${id}`)`.
- `export const DELETE: APIRoute`:
  1. `if (!context.locals.user) return Response.json({ error: "Unauthorized" }, { status: 401 });`
  2. Waliduj `:id` przez `z.uuid()` → 400 JSON przy błędzie.
  3. `createClient(...)`; `null` → 400 JSON.
  4. `deleteYarn(supabase, userId, id)` w try/catch → 400 JSON z `toErrorMessage` (skopiuj lokalny helper jak w obu istniejących routes) przy błędzie.
  5. Sukces: `Response.json({ ok: true }, { status: 200 })`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run lint` przechodzi
- `npm run test` przechodzi (nowe testy `isYarnExhausted` + regresja walidacji `quantity = 0`)
- `npm run build` przechodzi
- `src/components/ui/dialog.tsx` i `src/components/ui/alert-dialog.tsx` istnieją po instalacji

#### Weryfikacja ręczna:

- `POST /api/yarns/[id]` z poprawnymi danymi aktualizuje wiersz w Supabase Studio / `psql` i redirectuje na `/yarns/[id]`
- `DELETE /api/yarns/[id]` (np. przez `curl` z ciasteczkiem sesji) usuwa wiersz i zwraca `{ ok: true }`
- Próba edycji/usunięcia cudzej włóczki (inny `user_id`) zwraca błąd / nie znajduje wiersza mimo poprawnego UUID w URL

---

## Faza 2: Formularz edycji (UI)

### Przegląd

Uogólnienie formularza dodawania do wspólnego komponentu obsługującego też edycję, nowy modal na stronie szczegółów, oraz wizualne oznaczenie „Wyczerpana”.

### Wymagane zmiany:

#### 1. Uogólnienie formularza

**Plik**: `src/components/yarn/AddYarnForm.tsx` → zmień nazwę na `src/components/yarn/YarnForm.tsx`

**Cel**: Jeden komponent formularza dla tworzenia i edycji, sterowany propsami zamiast zahardkodowanego zachowania.

**Umowa**: Rozszerz `Props` o:
```
interface Props {
  mode: "create" | "edit";
  action: string;
  serverError?: string | null;
  initialValues?: Partial<TextValues>;
  initialComposition?: CompositionRow[];
  initialRating?: number | null;
  existingPhotoUrl?: string | null;
  submitLabel: string;
}
```
- `<form action={action}>` zamiast zahardkodowanego `"/api/yarns"`.
- Stan initial (`values`, `composition`, `rating`) inicjalizowany z `initialValues`/`initialComposition`/`initialRating` gdy podane, inaczej dotychczasowe puste wartości.
- Nowy stan `removePhoto: boolean` (domyślnie `false`), resetowany do `false` gdy user wybierze nowy plik. Gdy `mode === "edit"` i `existingPhotoUrl` jest ustawione i nie wybrano nowego pliku: pokaż istniejące zdjęcie jako podgląd w `PhotoDropzone` (przekaż `existingPhotoUrl` jako `preview` gdy `photoPreview` lokalny jest `null` i `!removePhoto`) oraz przycisk/link „Usuń zdjęcie” obok, który ustawia `removePhoto = true` i czyści podgląd. Dodaj `<input type="hidden" name="remove_photo" value={removePhoto ? "true" : "false"} />`.
- Przycisk submit używa `submitLabel` zamiast zahardkodowanego „Dodaj włóczkę”.
- Walidacja (`validate()`) nadal używa `createYarnSchema` bez zmian — pole `remove_photo` nie jest jego częścią (czytane bezpośrednio w API route jako flaga, nie przez zod), więc schemat zostaje nietknięty.

#### 2. Wywołania YarnForm w miejscu tworzenia

**Plik**: `src/pages/yarns/new.astro`

**Cel**: Zaktualizować import i użycie po zmianie nazwy komponentu.

**Umowa**: `import YarnForm from "@/components/yarn/YarnForm";` i `<YarnForm mode="create" action="/api/yarns" submitLabel="Dodaj włóczkę" serverError={error} client:load />`.

#### 3. Modal edycji

**Plik**: `src/components/yarn/EditYarnDialog.tsx` (nowy plik)

**Cel**: React island opakowujący shadcn `Dialog` — przycisk „Edytuj” + modal z `YarnForm mode="edit"` w środku, wypełnionym danymi bieżącej włóczki.

**Umowa**:
```
interface Props {
  yarn: YarnWithPhotoUrl;
  serverError?: string | null;
  defaultOpen?: boolean;
}
```
- Lokalny stan `open` (kontrolowany `Dialog open/onOpenChange`), zainicjalizowany z `defaultOpen ?? false`.
- `Dialog` zawiera `DialogTrigger` (przycisk „Edytuj”, ikona ołówka) i `DialogContent` z `YarnForm mode="edit" action={`/api/yarns/${yarn.id}`} submitLabel="Zapisz zmiany" initialValues={...z pól yarn...} initialComposition={...z yarn.composition...} initialRating={yarn.rating} existingPhotoUrl={yarn.photoUrl} serverError={serverError} />`.

#### 4. Wpięcie w stronę szczegółów

**Plik**: `src/pages/yarns/[id].astro`

**Cel**: Dodać przyciski akcji, banery błędu/ostrzeżenia czytane z query string, oraz badge „Wyczerpana”.

**Umowa**:
- Odczytaj `const error = Astro.url.searchParams.get("error");`, `const warning = Astro.url.searchParams.get("warning");`, `const editOpen = Astro.url.searchParams.get("edit") === "1";`.
- Dodaj banery (identyczna struktura jak w `dashboard.astro:20-27`, `TriangleAlert`/`CircleAlert` + klasy `border-warning-border bg-warning`/analogiczny destructive dla błędu) nad kartą szczegółów.
- W wierszu z linkiem „Wróć do biblioteki” dodaj `<EditYarnDialog yarn={yarn} serverError={error} defaultOpen={editOpen} client:load />` obok istniejącego linku.
- Dodaj `isYarnExhausted(yarn)` (import z `@/lib/utils`) i renderuj chip „Wyczerpana” obok istniejących chipów ilości (`bg-warning text-warning-foreground border-warning-border` zamiast domyślnego `bg-secondary`), gdy `true`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run lint` przechodzi
- `npm run build` przechodzi (żaden import `AddYarnForm` nie został osierocony)

#### Weryfikacja ręczna:

- Otwarcie `/yarns/[id]` i kliknięcie „Edytuj” pokazuje modal wypełniony aktualnymi danymi włóczki (w tym zdjęciem, składem, oceną)
- Zmiana dowolnego pola + zapis odświeża stronę z nowymi danymi
- Kliknięcie „Usuń zdjęcie” w modalu, zapis → zdjęcie znika (widoczny placeholder), plik usunięty z Storage
- Wgranie nowego zdjęcia przy edycji zastępuje stare (stary plik usunięty z bucketu)
- Ustawienie obu ilości na 0 i zapis pokazuje badge „Wyczerpana” na stronie szczegółów i na karcie w `/dashboard`
- Formularz dodawania (`/yarns/new`) działa bez regresji po zmianie nazwy komponentu

---

## Faza 3: Usuwanie (UI)

### Przegląd

Przycisk usuwania z potwierdzeniem w dialogu na stronie szczegółów, wywołanie JSON `DELETE`, redirect do biblioteki.

### Wymagane zmiany:

#### 1. Komponent usuwania

**Plik**: `src/components/yarn/DeleteYarnButton.tsx` (nowy plik)

**Cel**: React island z destrukcyjnym przyciskiem „Usuń” otwierającym `AlertDialog` potwierdzenia; po potwierdzeniu wysyła `DELETE` i przekierowuje do biblioteki.

**Umowa**:
```
interface Props {
  yarnId: string;
  yarnName: string;
}
```
- `Button variant="destructive"` (wzorzec już istnieje w `button.tsx:13-14`) jako `AlertDialogTrigger`.
- `AlertDialogContent` z tytułem/opisem wymieniającym `yarnName` i przyciskami „Anuluj”/„Usuń” (destructive).
- Na potwierdzenie: `fetch(`/api/yarns/${yarnId}`, { method: "DELETE" })`; sukces → `window.location.href = "/dashboard"`; błąd → wyświetl komunikat inline (reużyj `ServerError` z `@/components/auth/ServerError`) i zostaw dialog otwarty, przycisk „Usuń” disabled w trakcie żądania (lokalny stan `isDeleting`, wzorzec `pendingIds`/`disabled` z `SubstituteSuggestions.tsx:125,135`).

#### 2. Wpięcie w stronę szczegółów

**Plik**: `src/pages/yarns/[id].astro`

**Cel**: Dodać przycisk usuwania obok „Edytuj”.

**Umowa**: `<DeleteYarnButton yarnId={yarn.id} yarnName={yarn.name} client:load />` w tym samym wierszu co `EditYarnDialog`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run lint` przechodzi
- `npm run build` przechodzi

#### Weryfikacja ręczna:

- Kliknięcie „Usuń” otwiera dialog potwierdzenia z nazwą włóczki; „Anuluj” zamyka bez żadnej zmiany
- Potwierdzenie usuwa włóczkę i przekierowuje do `/dashboard`, gdzie już jej nie ma
- Zdjęcie usuniętej włóczki znika z Storage bucketu
- Usunięcie włóczki, która była zaakceptowanym zamiennikiem innej włóczki, nie powoduje błędu na stronie szczegółów tej drugiej włóczki (kaskada w DB wyczyściła powiązaną decyzję)
- Próba wywołania `DELETE /api/yarns/[id]` bez sesji (np. wylogowany) zwraca 401

---

## Strategia testowania

### Testy jednostkowe:

- `isYarnExhausted`: `{skeins: 0, grams: 0}` → `true`; `{skeins: 0, grams: null}` → `true`; `{skeins: null, grams: null}` → `false`; `{skeins: 5, grams: 0}` → `false`.
- Regresja `createYarnSchema`: `quantity_skeins: 0` (bez `quantity_grams`) przechodzi walidację; `quantity_skeins: -1` zostaje odrzucone.

### Testy integracyjne:

- Brak (repo nie ma dziś infrastruktury do testów integracyjnych/E2E; poza zakresem tego planu).

### Kroki testowania ręcznego:

1. Zaloguj się na konto testowe z co najmniej jedną włóczką (ze zdjęciem).
2. Otwórz szczegóły, kliknij „Edytuj”, zmień nazwę/producenta/ilość, zapisz — sprawdź, że strona pokazuje nowe dane.
3. Otwórz „Edytuj” ponownie, kliknij „Usuń zdjęcie”, zapisz — sprawdź, że zdjęcie zniknęło (placeholder) i plik usunięty z bucketu w Supabase Studio.
4. Otwórz „Edytuj”, wgraj nowe zdjęcie, zapisz — sprawdź podmianę i usunięcie starego pliku z bucketu.
5. Ustaw obie ilości na 0, zapisz — sprawdź badge „Wyczerpana” na `/yarns/[id]` i na karcie w `/dashboard`.
6. Zaakceptuj tę włóczkę jako zamiennik innej (flow z S-02), następnie usuń ją — sprawdź, że druga włóczka nie pokazuje błędu, a powiązanie zniknęło.
7. Usuń włóczkę bez zdjęcia — sprawdź redirect do `/dashboard` i brak błędu.
8. Na drugim koncie testowym spróbuj otworzyć `/api/yarns/[id]` (edycja/usunięcie) z ID włóczki należącej do pierwszego konta — sprawdź brak dostępu.

## Uwagi dotyczące wydajności

Brak nowych obciążeń — operacje pojedyncze, wolumeny zgodne z resztą PRD (małe, pojedynczy user na sesję).

## Uwagi dotyczące migracji

Brak — żadna zmiana schematu nie jest wymagana.

## Referencje

- Wzorzec formularza + redirect: `src/pages/api/yarns.ts`
- Wzorzec JSON API + fetch z React: `src/pages/api/yarns/[id]/substitutes.ts`, `src/components/yarn/SubstituteSuggestions.tsx`
- Lesson o `return` w `.astro` frontmatterze: `context/foundation/lessons.md:12-17`
- PRD: `context/foundation/prd.md:66-68` (FR-005, FR-006)

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Fundament backendu

#### Automatyczne

- [x] 1.1 npm run lint przechodzi — c999bf7
- [x] 1.2 npm run test przechodzi (isYarnExhausted + regresja walidacji quantity=0) — c999bf7
- [x] 1.3 npm run build przechodzi — c999bf7
- [x] 1.4 dialog.tsx i alert-dialog.tsx istnieją po instalacji — c999bf7

#### Ręczne

- [x] 1.5 POST /api/yarns/[id] aktualizuje wiersz i redirectuje na /yarns/[id] — c999bf7
- [x] 1.6 DELETE /api/yarns/[id] usuwa wiersz i zwraca { ok: true } — c999bf7
- [x] 1.7 Edycja/usunięcie cudzej włóczki nie powodzi się mimo poprawnego UUID — c999bf7

### Faza 2: Formularz edycji (UI)

#### Automatyczne

- [x] 2.1 npm run lint przechodzi — 1d1cb55
- [x] 2.2 npm run build przechodzi — 1d1cb55

#### Ręczne

- [x] 2.3 Modal edycji pokazuje wypełnione aktualne dane włóczki — 1d1cb55
- [x] 2.4 Zmiana pola + zapis odświeża stronę z nowymi danymi — 1d1cb55
- [x] 2.5 Usunięcie zdjęcia w modalu czyści zdjęcie i plik w Storage — 1d1cb55
- [x] 2.6 Wgranie nowego zdjęcia zastępuje stare (stary plik usunięty) — 1d1cb55
- [x] 2.7 Obie ilości = 0 pokazują badge "Wyczerpana" na szczegółach i karcie — 1d1cb55
- [x] 2.8 Formularz dodawania działa bez regresji po zmianie nazwy komponentu — 1d1cb55

### Faza 3: Usuwanie (UI)

#### Automatyczne

- [x] 3.1 npm run lint przechodzi — fa12f0f
- [x] 3.2 npm run build przechodzi — fa12f0f

#### Ręczne

- [x] 3.3 Dialog potwierdzenia pokazuje nazwę włóczki; Anuluj nie zmienia niczego — fa12f0f
- [x] 3.4 Potwierdzenie usuwa włóczkę i przekierowuje do /dashboard — fa12f0f
- [x] 3.5 Zdjęcie usuniętej włóczki znika ze Storage — fa12f0f
- [x] 3.6 Usunięcie zaakceptowanego zamiennika nie psuje strony drugiej włóczki — fa12f0f
- [x] 3.7 DELETE bez sesji zwraca 401 — fa12f0f
