-- Yarn library foundation: yarns table + RLS (F-01 / yarn-data-foundation)

create table yarns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- Required fields (PRD FR-002)
  name text not null,
  manufacturer text not null,
  quantity_skeins numeric(10, 2),
  quantity_grams numeric(10, 2),

  -- Optional fields (PRD FR-002)
  color text,
  dye_lot text,
  composition jsonb,
  needle_size_mm numeric(4, 2),
  hook_size_mm numeric(4, 2),
  gauge_note text,
  rating smallint,
  note text,
  photo_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint yarns_quantity_present check (quantity_skeins is not null or quantity_grams is not null),
  constraint yarns_quantity_skeins_non_negative check (quantity_skeins is null or quantity_skeins >= 0),
  constraint yarns_quantity_grams_non_negative check (quantity_grams is null or quantity_grams >= 0),
  constraint yarns_needle_size_positive check (needle_size_mm is null or needle_size_mm > 0),
  constraint yarns_hook_size_positive check (hook_size_mm is null or hook_size_mm > 0),
  constraint yarns_rating_range check (rating is null or rating between 1 and 5)
);

create index yarns_user_id_idx on yarns (user_id);

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger yarns_set_updated_at
  before update on yarns
  for each row
  execute function set_updated_at();

alter table yarns enable row level security;

create policy "Users can view their own yarns"
  on yarns for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own yarns"
  on yarns for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own yarns"
  on yarns for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own yarns"
  on yarns for delete
  to authenticated
  using (auth.uid() = user_id);
