-- Workday career sites, read through their public jobs endpoint.
alter table public.companies drop constraint if exists companies_ats_check;
alter table public.companies add constraint companies_ats_check
  check (ats in ('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'recruitee', 'teamtailor', 'personio', 'digitalrecruiters', 'welcomekit', 'site', 'workday'));
