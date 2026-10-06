-- DigitalRecruiters (career sites of many French companies, e.g. Decathlon).
alter table public.companies drop constraint if exists companies_ats_check;
alter table public.companies add constraint companies_ats_check
  check (ats in ('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'recruitee', 'teamtailor', 'personio', 'digitalrecruiters'));

-- A photo published with the offer itself (referenced by URL, never copied); preferred over the company's.
alter table public.offers add column if not exists image_url text;
-- Upper bound of the experience asked when the posting gives a range ("0 à 2 ans", "3-6 years").
alter table public.offers add column if not exists experience_max_years int;
