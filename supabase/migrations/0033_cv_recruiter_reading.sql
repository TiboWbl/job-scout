-- The recruiter's reading of a CV, for the role sought or one chosen offer: verdict, strengths quoted
-- from the CV, gaps, tailoring advice. Kept with the analysis; the CV itself never is.
alter table public.cv_analyses add column if not exists recruiter jsonb;
