-- Search engines only give an excerpt: Scout tries once to read the full posting behind the link.
alter table public.offers add column if not exists completed_at timestamptz;
