-- What the posting says about experience in words, when it gives no number of years:
-- 'junior' ("profil junior", "première expérience") or 'experienced' ("expérience significative").
alter table public.offers add column if not exists experience_level text
  check (experience_level in ('junior', 'experienced'));
