-- The application kit of an offer (a short message to send, the questions the interview will likely
-- ask), prepared on demand and kept with the person's score so it opens instantly the next time.
alter table public.offer_scores add column if not exists kit jsonb;
