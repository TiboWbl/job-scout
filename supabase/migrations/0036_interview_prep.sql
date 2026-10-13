-- Interview preparation of an application (the person's self-introduction and the likely questions),
-- prepared on demand once the interview is obtained, kept so it opens instantly.
alter table public.applications add column if not exists prep jsonb;
