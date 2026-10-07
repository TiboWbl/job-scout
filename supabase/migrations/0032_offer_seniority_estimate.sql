-- When the posting gives no experience: the level its responsibilities describe (junior, confirmé,
-- senior), estimated by the model and shown as an estimate, never as a requirement.
alter table public.offers add column if not exists seniority_estimate text check (seniority_estimate in ('junior', 'confirme', 'senior'));
-- Skills found in the person's own CV (from Scout's list of skills asked by offers), to say "dans ton CV".
alter table public.profiles add column if not exists cv_skills jsonb;
-- Daily email of new crushes, off unless the person turns it on.
alter table public.profiles add column if not exists email_digest boolean not null default false;
alter table public.profiles add column if not exists digest_sent_at timestamptz;
