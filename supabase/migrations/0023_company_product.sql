-- What the company makes or sells, and for whom, in one factual sentence read from its postings.
alter table public.companies add column if not exists product text;
