-- What the company does, in its own words: the description its website publishes for link previews.
alter table public.companies add column if not exists about text;
alter table public.companies add column if not exists about_checked_at timestamptz;
