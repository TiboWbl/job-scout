-- The salary as written in the posting, read by fixed rules (never estimated). Shown before the model's reading.
alter table public.offers add column if not exists salary_text text;
