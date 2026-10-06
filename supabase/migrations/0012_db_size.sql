-- Database size for the admin dashboard: the free plan allows 500 MB.
create or replace function public.admin_db_size()
returns bigint language sql stable as $$ select pg_database_size(current_database()); $$;
revoke execute on function public.admin_db_size() from public, anon, authenticated;
grant execute on function public.admin_db_size() to service_role;
