-- Additive storage precedes enforcement so the application can be staged safely.
alter table public.qr_codes add column status_revision bigint not null default 0;

create table public.qr_pause_challenges (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  qr_code_id uuid not null references public.qr_codes(id) on delete cascade,
  owner_email text not null,
  status_revision bigint not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  attempts integer not null default 0,
  state text not null default 'sending' check (state in ('sending', 'ready', 'revoked', 'superseded', 'used')),
  used_at timestamptz
);
create index qr_pause_owner_recent on public.qr_pause_challenges(owner_user_id, created_at desc);
create index qr_pause_email_recent on public.qr_pause_challenges(owner_email, created_at desc);
create table public.qr_pause_attempts (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index qr_pause_attempts_recent on public.qr_pause_attempts(owner_user_id, created_at desc);

create table public.qr_status_email_outbox (
  id uuid primary key default gen_random_uuid(),
  transition_id uuid not null,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  qr_code_id uuid not null references public.qr_codes(id) on delete cascade,
  recipient text not null,
  venue_name text not null,
  is_active boolean not null,
  scans_available boolean not null,
  changed_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  failure_code text,
  unique (transition_id, recipient)
);
create index qr_status_email_due on public.qr_status_email_outbox(next_attempt_at)
  where status in ('queued', 'sending');

alter table public.qr_pause_challenges enable row level security;
alter table public.qr_pause_challenges force row level security;
alter table public.qr_pause_attempts enable row level security;
alter table public.qr_pause_attempts force row level security;
alter table public.qr_status_email_outbox enable row level security;
alter table public.qr_status_email_outbox force row level security;
revoke all on public.qr_pause_challenges, public.qr_pause_attempts, public.qr_status_email_outbox from public, anon, authenticated;
grant all on public.qr_pause_challenges, public.qr_pause_attempts, public.qr_status_email_outbox to service_role;
revoke all on sequence public.qr_pause_attempts_id_seq from public, anon, authenticated;
grant usage, select on sequence public.qr_pause_attempts_id_seq to service_role;

-- SECURITY INVOKER is intentional: a direct authenticated UPDATE must not
-- impersonate one of the tightly scoped SECURITY DEFINER mutation functions.
create function public.guard_qr_status_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and
    (new.is_active is distinct from old.is_active or new.status_revision is distinct from old.status_revision) then
    raise insufficient_privilege using message = 'Use the authorised QR status action';
  end if;
  new.status_revision := old.status_revision + case when new.is_active is distinct from old.is_active then 1 else 0 end;
  return new;
end;
$$;
-- Installed in the enforcement migration, not during the additive phase.
revoke all on function public.guard_qr_status_update() from public, anon, authenticated, service_role;
