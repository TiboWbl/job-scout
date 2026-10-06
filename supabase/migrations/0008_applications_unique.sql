-- Upserts "on conflict (user_id, offer_id)" need a plain unique constraint, not a partial index.
-- Unique constraints treat NULLs as distinct: several applications without an offer stay allowed.
drop index if exists public.applications_user_offer_unique;
alter table public.applications add constraint applications_user_offer_unique unique (user_id, offer_id);
