-- RLS policies alone do not grant table access in Postgres — the `authenticated`
-- role also needs explicit table-level privileges, which the previous migration omitted.
grant select, insert, update, delete on yarns to authenticated;
