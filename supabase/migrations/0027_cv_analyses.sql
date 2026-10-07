-- History of CV checks: the score and its parts only. The CV text itself is never kept.
create table if not exists public.cv_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  filename text not null default '',
  total int not null check (total between 0 and 100),
  -- [{ key, score, max }]
  categories jsonb not null default '[]'
);
create index if not exists cv_analyses_user on public.cv_analyses (user_id, created_at desc);
alter table public.cv_analyses enable row level security;
create policy "own cv analyses" on public.cv_analyses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
