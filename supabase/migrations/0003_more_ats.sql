-- More public career-page APIs, and bookkeeping to collect thousands of companies in rotation.
alter table public.companies drop constraint if exists companies_ats_check;
alter table public.companies add constraint companies_ats_check
  check (ats in ('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'recruitee', 'teamtailor', 'personio'));

-- When the company's board was last read, so each run starts with the least recently collected.
alter table public.companies add column if not exists last_collected_at timestamptz;
-- How the career page was found: seed, crawl (Common Crawl index), name (guessed from an offer), user.
alter table public.companies add column if not exists discovered_via text;
-- Last time discovery checked this company for a career page, found or not.
alter table public.companies add column if not exists ats_checked_at timestamptz;

create index if not exists companies_collect_order on public.companies (last_collected_at nulls first) where ats is not null;
