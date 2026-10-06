-- The brand or group that actually recruits (a subsidiary's group, a public body's institution),
-- used for the logo and shown next to the name. Set by enrichment, verified against the logo CDN.
alter table public.companies add column if not exists brand text;
alter table public.companies add column if not exists enriched_at timestamptz;
