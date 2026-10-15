-- When the roles sought last changed: the market of a role is collected from then on, so its history
-- and its trends start there, never on days when Scout did not look for it yet.
alter table public.profiles add column if not exists roles_changed_at timestamptz;
update public.profiles set roles_changed_at = onboarded_at where roles_changed_at is null;
