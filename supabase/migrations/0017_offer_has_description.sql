-- Cheap to read in bulk (unlike the description itself): whether an offer can be judged on its text.
alter table public.offers add column if not exists has_description boolean generated always as (coalesce(length(description), 0) > 200) stored;
