-- A CV check kept in full so it can be read again (grid, fixes, suggested rewrites, comparison).
-- The CV text itself is still never stored: only the lines a suggestion rewrites.
alter table public.cv_analyses add column if not exists result jsonb;
alter table public.cv_analyses add column if not exists suggestions jsonb not null default '[]';
alter table public.cv_analyses add column if not exists comparison jsonb;
-- The keywords of the roles sought, fixed once per set of roles: the same CV always gets the same score.
alter table public.profiles add column if not exists cv_keywords jsonb;
