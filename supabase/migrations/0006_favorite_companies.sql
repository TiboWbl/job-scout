-- Companies a person would love to work for. Never restricts the search: their career page is
-- watched at every collection and their offers carry a "Favorite" badge.
create table public.favorite_companies (
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  -- As the person typed it (name or URL), to show it back.
  input text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

alter table public.favorite_companies enable row level security;
create policy "own favorites" on public.favorite_companies for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
