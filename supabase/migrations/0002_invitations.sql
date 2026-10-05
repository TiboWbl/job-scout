-- Invite-only access: the site and repo are public, the free LLM quota is not.
-- Managed from the admin page (service role); users never read this table.
create table public.invitations (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table public.invitations enable row level security;
