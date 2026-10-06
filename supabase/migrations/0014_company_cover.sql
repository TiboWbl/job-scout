-- The company's own share image (og:image), referenced by URL only, never copied. Kept only if it
-- passes the checks (real photo-like image, not a logo on a flat background).
alter table public.companies add column if not exists cover_url text;
alter table public.companies add column if not exists cover_checked_at timestamptz;
