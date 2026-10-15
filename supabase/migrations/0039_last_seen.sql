-- The last visit to the app (a session lasts weeks: the last sign-in says little about who still comes).
alter table public.profiles add column if not exists last_seen_at timestamptz;
