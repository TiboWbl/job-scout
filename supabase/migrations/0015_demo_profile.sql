-- The public demo's fictional persona: a real profile scored like any other, never a real person.
alter table public.profiles add column if not exists is_demo boolean not null default false;
create unique index if not exists profiles_single_demo on public.profiles (is_demo) where is_demo;
