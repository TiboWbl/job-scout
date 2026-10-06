-- Where a company publishes its offers when Scout cannot read them (Welcome to the Jungle, Workday…),
-- so the person is told plainly instead of "not found".
alter table public.companies add column if not exists careers_url text;
alter table public.companies add column if not exists careers_platform text;
