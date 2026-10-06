-- When a person changed their search and asked for a fresh collection (run on GitHub Actions).
alter table public.profiles add column if not exists collect_requested_at timestamptz;
