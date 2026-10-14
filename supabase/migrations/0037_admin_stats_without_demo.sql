-- Admin figures are about real people only: the demo persona's sorted offers are left out, and only
-- the current version of each person's search counts (older versions are kept for reuse).
create or replace function public.admin_ai_levels()
returns table (level text, n bigint) language sql stable as $$
  select s.level, count(*)
  from public.offer_scores s
  join public.profiles p on p.id = s.user_id and s.criteria_version = p.criteria_version
  where s.scored_by = 'llm' and not p.is_demo
  group by 1 order by 2 desc;
$$;
revoke execute on function public.admin_ai_levels() from public, anon, authenticated;
grant execute on function public.admin_ai_levels() to service_role;
