-- What the model's judgement depended on (roles, sectors, deal-breakers, experience, CV, favourites).
-- A new version of the profile that leaves it unchanged (zone, openness…) reuses the judgement.
alter table public.offer_scores add column if not exists judge_key text;
create index if not exists offer_scores_user_offer on public.offer_scores (user_id, offer_id);
