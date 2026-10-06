-- When a website was looked for from the company's name (checked against its postings), so it runs once.
alter table public.companies add column if not exists domain_guessed_at timestamptz;
