-- After each career page, Scout archives that page's offers no longer listed: a search by source.
-- Without an index, each of the hundreds of pages read per collection scanned the whole table,
-- slowing every page of the site during collections (and timing out on large boards).
create index if not exists offers_active_sources_idx on public.offers using gin (sources) where archived_at is null;
