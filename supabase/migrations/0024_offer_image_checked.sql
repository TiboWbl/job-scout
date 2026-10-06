-- When the offer's own page was checked for a photo (og:image), so it is fetched once.
alter table public.offers add column if not exists image_checked_at timestamptz;
