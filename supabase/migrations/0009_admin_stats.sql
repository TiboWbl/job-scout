-- Dashboard aggregates computed in the database instead of shipping thousands of rows to the app.
-- Service role only: these figures are for the admin page.

create or replace function public.admin_offer_sources()
returns table (source text, n bigint) language sql stable as $$
  select split_part(sources[1], ':', 1) as source, count(*) from public.offers
  where archived_at is null group by 1 order by 2 desc;
$$;

create or replace function public.admin_offers_per_day(days int)
returns table (day date, n bigint) language sql stable as $$
  select (first_seen_at at time zone 'Europe/Paris')::date as day, count(*) from public.offers
  where first_seen_at >= now() - make_interval(days => days) group by 1 order by 1;
$$;

create or replace function public.admin_directory_origins()
returns table (origin text, n bigint) language sql stable as $$
  select coalesce(discovered_via, 'crawl'), count(*) from public.companies
  where ats is not null group by 1 order by 2 desc;
$$;

create or replace function public.admin_ai_levels()
returns table (level text, n bigint) language sql stable as $$
  select level, count(*) from public.offer_scores where scored_by = 'llm' group by 1 order by 2 desc;
$$;

revoke execute on function public.admin_offer_sources() from public, anon, authenticated;
revoke execute on function public.admin_offers_per_day(int) from public, anon, authenticated;
revoke execute on function public.admin_directory_origins() from public, anon, authenticated;
revoke execute on function public.admin_ai_levels() from public, anon, authenticated;
grant execute on function public.admin_offer_sources() to service_role;
grant execute on function public.admin_offers_per_day(int) to service_role;
grant execute on function public.admin_directory_origins() to service_role;
grant execute on function public.admin_ai_levels() to service_role;
