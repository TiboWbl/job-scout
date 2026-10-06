-- What a person tracks per application, and where the offer came from.
alter table public.applications add column if not exists contact text not null default '';
alter table public.applications add column if not exists interview_at timestamptz;
-- Last follow-up sent; a follow-up is suggested 7 days after applying, or after the last one.
alter table public.applications add column if not exists followed_up_at timestamptz;
-- 'scout' (from the feed) or 'added' (found elsewhere and added by URL or text).
alter table public.applications add column if not exists origin text not null default 'scout' check (origin in ('scout', 'added'));
