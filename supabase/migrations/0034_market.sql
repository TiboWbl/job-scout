-- An offer that disappears then comes back is a repost: counted, with the date it came back.
alter table public.offers add column if not exists repost_count int not null default 0;
alter table public.offers add column if not exists reposted_at timestamptz;

-- The person's market, one picture a day: what the offers of the role ask for, the experience really
-- required, the salaries written, who hires. Aggregates only; kept to show how the market moves.
create table if not exists public.market_snapshots (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, day)
);
alter table public.market_snapshots enable row level security;
create policy "own market snapshots" on public.market_snapshots for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- A market card the person chose to share: a frozen copy without anything from the CV. Read by its
-- link only (through the server), never listed.
create table if not exists public.market_cards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.market_cards enable row level security;
create policy "own market cards" on public.market_cards for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
