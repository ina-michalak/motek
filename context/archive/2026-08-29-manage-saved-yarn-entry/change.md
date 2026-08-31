---
change_id: manage-saved-yarn-entry
title: Manage saved yarn entry
status: archived
created: 2026-08-29
updated: 2026-08-31
archived_at: 2026-08-31T19:29:24Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Faza 1, krok 1.7 (izolacja między userami dla edycji/usuwania): mimo zewnętrznej blokady po stronie Supabase (globalny incydent + wyczerpany rate limit na wysyłkę maili potwierdzających/resetujących hasło), udało się przygotować drugie potwierdzone konto testowe przez bezpośredni `update auth.users set email_confirmed_at = now() ...` w SQL Editorze (z pominięciem zablokowanej wysyłki maili). Live test wykonany: konto `wp.pl` próbowało `DELETE /api/yarns/<id>` na włóczce należącej do konta `gmail.com` — odpowiedź `400 Bad Request`, `{"error":"Delete matched no yarn row"}`. Potwierdza to, że `deleteYarn`/`updateYarn` w `src/lib/services/yarns.ts` poprawnie izolują dane między userami (ten sam mechanizm `.eq("id", id).eq("user_id", userId)` co już sprawdzone w produkcji `getYarnById`/`attachYarnPhoto` z S-01).
