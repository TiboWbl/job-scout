-- Scout initial schema.
-- Shared (readable by any signed-in user, written only by the service role): companies, offers.
-- Private (row-level security, owner only): profiles, offer_scores, user_offers, applications.
-- Admin only (service role): collection_runs.

create extension if not exists pgcrypto;

-- Companies ----------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,
  domain text,
  ats text check (ats in ('greenhouse', 'lever', 'ashby')),
  ats_token text,
  -- Only the extracted hex is stored, never a copy of the logo.
  accent_color text check (accent_color ~ '^#[0-9a-f]{6}$'),
  color_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index companies_ats_unique on public.companies (ats, ats_token) where ats is not null;

-- Offers -------------------------------------------------------------------

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  dedup_key text not null unique,
  title text not null,
  location_raw text,
  -- [{ "city": "Paris", "region": "IDF", "country": "FR" }], empty when unknown
  places jsonb not null default '[]',
  remote text not null default 'unknown' check (remote in ('onsite', 'hybrid', 'remote', 'unknown')),
  -- Countries a remote role is open to (ISO-2), or 'EU' / 'WORLD'. Empty when unknown.
  remote_scope text[] not null default '{}',
  contract text not null default 'unknown' check (contract in ('cdi', 'cdd', 'stage', 'alternance', 'freelance', 'unknown')),
  experience_min_years numeric,
  description text,
  apply_url text not null,
  urls jsonb not null default '[]',
  sources text[] not null default '{}',
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  archived_at timestamptz
);

create index offers_active_idx on public.offers (first_seen_at desc) where archived_at is null;
create index offers_company_idx on public.offers (company_id);

-- Profiles -----------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  onboarded_at timestamptz,
  search_text text,
  criteria jsonb not null default '{}',
  criteria_version int not null default 0,
  -- Structured CV extraction. Contains no name, email, phone or address.
  cv_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), ' ', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Per-user scoring ---------------------------------------------------------

create table public.offer_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_id uuid not null references public.offers (id) on delete cascade,
  criteria_version int not null,
  level text not null check (level in ('coeur', 'solide', 'tremplin', 'ecartee')),
  out_of_zone boolean not null default false,
  excluded_reason text,
  score_interet int check (score_interet between 0 and 100),
  score_chances int check (score_chances between 0 and 100),
  score_tremplin int check (score_tremplin between 0 and 100),
  why text,
  strengths jsonb not null default '[]',
  watch jsonb not null default '[]',
  cv_levers jsonb not null default '[]',
  scored_by text not null check (scored_by in ('prefilter', 'llm', 'mock')),
  created_at timestamptz not null default now(),
  primary key (user_id, offer_id, criteria_version)
);

create table public.user_offers (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  saved boolean not null default false,
  dismissed boolean not null default false,
  dismiss_reason text,
  updated_at timestamptz not null default now(),
  primary key (user_id, offer_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  offer_id uuid references public.offers (id) on delete set null,
  title text not null,
  company text not null,
  url text,
  stage text not null default 'a_postuler' check (stage in ('a_postuler', 'postule', 'entretien', 'offre', 'refuse', 'archive')),
  applied_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index applications_user_offer_unique on public.applications (user_id, offer_id) where offer_id is not null;

-- Source health (aggregated counts only, no personal data) -----------------

create table public.collection_runs (
  id bigserial primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  offers_seen int not null default 0,
  offers_new int not null default 0,
  offers_archived int not null default 0,
  errors int not null default 0,
  error_sample text
);

-- Row-level security -------------------------------------------------------

alter table public.companies enable row level security;
alter table public.offers enable row level security;
alter table public.profiles enable row level security;
alter table public.offer_scores enable row level security;
alter table public.user_offers enable row level security;
alter table public.applications enable row level security;
alter table public.collection_runs enable row level security;

create policy "signed-in users read companies" on public.companies for select to authenticated using (true);
create policy "signed-in users read offers" on public.offers for select to authenticated using (true);

create policy "own profile: read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile: update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "own scores" on public.offer_scores for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own offer actions" on public.user_offers for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own applications" on public.applications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- collection_runs: no policy, service role only.
