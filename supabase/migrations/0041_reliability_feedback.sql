-- What people flag as wrong in an offer (a fact, the level, the role), and the admin's spot checks of
-- the sort: the two ways Scout's reliability is measured over time instead of assumed.
create table if not exists public.offer_reports (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  field text not null check (field in ('niveau', 'metier', 'experience', 'salaire', 'contrat', 'lieu', 'autre')),
  comment text check (char_length(comment) <= 500),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (offer_id, user_id, field)
);
alter table public.offer_reports enable row level security;
create policy "own reports: insert" on public.offer_reports for insert to authenticated with check (user_id = auth.uid());
create policy "own reports: read" on public.offer_reports for select to authenticated using (user_id = auth.uid());

create table if not exists public.sort_checks (
  offer_id uuid not null references public.offers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  level text not null,
  right_call boolean not null,
  checked_at timestamptz not null default now(),
  primary key (offer_id, user_id)
);
alter table public.sort_checks enable row level security;
