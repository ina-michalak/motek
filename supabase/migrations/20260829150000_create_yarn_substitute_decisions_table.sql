-- Substitute suggestion decisions: user accept/reject calls on yarn pairs (S-02 / ai-substitute-suggestions)

create table yarn_substitute_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  yarn_id uuid not null references yarns (id) on delete cascade,
  substitute_yarn_id uuid not null references yarns (id) on delete cascade,
  status text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint yarn_substitute_decisions_not_self check (yarn_id <> substitute_yarn_id),
  constraint yarn_substitute_decisions_unique_pair unique (user_id, yarn_id, substitute_yarn_id),
  constraint yarn_substitute_decisions_status_valid check (status in ('accepted', 'rejected'))
);

create index yarn_substitute_decisions_user_yarn_idx on yarn_substitute_decisions (user_id, yarn_id);

create trigger yarn_substitute_decisions_set_updated_at
  before update on yarn_substitute_decisions
  for each row
  execute function set_updated_at();

alter table yarn_substitute_decisions enable row level security;

create policy "Users can view their own substitute decisions"
  on yarn_substitute_decisions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own substitute decisions"
  on yarn_substitute_decisions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own substitute decisions"
  on yarn_substitute_decisions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own substitute decisions"
  on yarn_substitute_decisions for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on yarn_substitute_decisions to authenticated;
