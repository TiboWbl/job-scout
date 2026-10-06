-- What a card shows at a glance, read by the model in the same pass as its judgement.
alter table public.offer_scores add column if not exists missions jsonb not null default '[]'::jsonb;
-- Salary exactly as the posting states it; never estimated.
alter table public.offer_scores add column if not exists salary text;
-- Experience asked, as read in "profil recherché" or equivalent (e.g. "3 ans et plus").
alter table public.offer_scores add column if not exists experience_asked text;
