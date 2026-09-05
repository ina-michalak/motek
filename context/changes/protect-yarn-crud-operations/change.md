---
change_id: protect-yarn-crud-operations
title: Ochrona podstawowych operacji CRUD na włóczkach
status: impl_reviewed
created: 2026-09-05
updated: 2026-09-05
archived_at: null
---

## Notes

Faza 1 z test-plan.md §3: ochrona podstawowych operacji na włóczkach (dodawanie, edycja, usuwanie). Ryzyka objęte: #1 (dodanie włóczki nie zapisuje się), #2 (włóczka znika / usunięcie kasuje inne dane), #3 (edycja zapisuje tylko część pól). Zaczynamy od Ryzyka #1 jako priorytetu.
