-- Which CV was read, and when: the file itself is never kept, only what was extracted from it.
alter table public.profiles add column if not exists cv_filename text;
alter table public.profiles add column if not exists cv_updated_at timestamptz;
