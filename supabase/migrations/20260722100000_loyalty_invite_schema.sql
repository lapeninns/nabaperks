-- Bulk Two-Stamp Loyalty Invitations — schema, RLS and per-merchant allowlist.
--
-- A merchant imports up to 2,000 email addresses; eligible recipients are queued
-- durably, emailed a fixed invitation, and — after phone OTP + loyalty terms —
-- awarded exactly two welcome stamps. Recipient email is stored as AES-GCM
-- ciphertext (for delivery), an HMAC (for matching / dedupe / suppression) and a
-- masked value (for merchant readback). Raw addresses and raw tokens are never
-- stored. All mutation happens through service-role SECURITY DEFINER RPCs
-- (see 20260722100100 / 20260722100200 / 20260722100300).
--
-- Companion to the reward-invite feature (20260704095000); this ledger awards
-- STAMPS, not reward_events, and is independent of it.
--
-- Forward-only and idempotent: additive DDL is guarded with IF NOT EXISTS;
-- policies are dropped/replaced before create.

-- 1. Per-merchant allowlist ("selected merchants") ----------------------------
-- The global default-disabled feature flag (bulk_loyalty_invitations) gates the
-- feature; this column selects which pilot venues may use it. Both must be true
-- (see lib/loyalty-invites/access.ts).
alter table public.merchants
  add column if not exists loyalty_invites_enabled boolean not null default false;

-- 2. Campaign -----------------------------------------------------------------
create table if not exists public.loyalty_invite_campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  created_by_user_id uuid,
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'completed', 'cancelled')),
  legal_basis text
    check (legal_basis in ('venue_email_consent', 'existing_customer_soft_opt_in')),
  link_expires_at timestamptz,
  eligible_count integer not null default 0 check (eligible_count >= 0),
  invalid_count integer not null default 0 check (invalid_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  not_eligible_count integer not null default 0 check (not_eligible_count >= 0),
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A confirmed (sending/completed) campaign must carry its audited legal basis
  -- and a link expiry; a draft need not.
  constraint loyalty_invite_campaign_confirmed_shape check (
    status in ('draft', 'cancelled')
    or (legal_basis is not null and link_expires_at is not null)
  )
);

-- At most one active (draft or sending) campaign per merchant.
create unique index if not exists loyalty_invite_campaigns_one_active_idx
  on public.loyalty_invite_campaigns (merchant_id)
  where status in ('draft', 'sending');

create index if not exists loyalty_invite_campaigns_merchant_idx
  on public.loyalty_invite_campaigns (merchant_id, created_at desc);

-- 3. Recipient ----------------------------------------------------------------
create table if not exists public.loyalty_invite_recipients (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null
    references public.loyalty_invite_campaigns(id) on delete cascade,
  -- Denormalised for tenant isolation, lifetime-once dedupe and suppression.
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  email_hmac text not null,
  email_ciphertext text,
  email_masked text,
  claim_token_hash text unique,
  unsubscribe_token_hash text unique,
  status text not null default 'queued' check (status in (
    'queued', 'sending', 'sent', 'delivered', 'opened',
    'joined', 'failed', 'unsubscribed', 'expired', 'cancelled'
  )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  provider_message_id text,
  failure_reason text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  joined_at timestamptz,
  failed_at timestamptz,
  unsubscribed_at timestamptz,
  expired_at timestamptz,
  claimed_customer_id uuid references public.customers(id) on delete set null,
  claimed_membership_id uuid
    references public.customer_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Ciphertext and masked value are coherent, and both are scrubbed together.
  constraint loyalty_invite_recipient_mask_coherent
    check ((email_ciphertext is null) = (email_masked is null))
);

-- Lifetime-once: one non-cancelled invitation per (venue, email). A cancelled
-- campaign frees the address for a future genuine campaign.
create unique index if not exists loyalty_invite_recipients_once_idx
  on public.loyalty_invite_recipients (merchant_id, email_hmac)
  where status <> 'cancelled';

-- Drain lease: due recipients of a sending campaign, oldest first.
create index if not exists loyalty_invite_recipients_due_idx
  on public.loyalty_invite_recipients (next_attempt_at)
  where status in ('queued', 'sending');

create index if not exists loyalty_invite_recipients_campaign_idx
  on public.loyalty_invite_recipients (campaign_id, status);

create index if not exists loyalty_invite_recipients_email_hmac_idx
  on public.loyalty_invite_recipients (email_hmac);

-- 4. Suppression (global bounce/complaint + per-venue unsubscribe) ------------
create table if not exists public.loyalty_invite_email_suppressions (
  id uuid primary key default extensions.gen_random_uuid(),
  -- NULL merchant_id = global suppression (bounce/complaint); a set merchant_id
  -- = a venue-scoped unsubscribe.
  merchant_id uuid references public.merchants(id) on delete cascade,
  email_hmac text not null,
  reason text not null
    check (reason in ('unsubscribed', 'bounced', 'complained')),
  created_at timestamptz not null default now()
);

create unique index if not exists loyalty_invite_suppress_global_idx
  on public.loyalty_invite_email_suppressions (email_hmac)
  where merchant_id is null;

create unique index if not exists loyalty_invite_suppress_venue_idx
  on public.loyalty_invite_email_suppressions (merchant_id, email_hmac)
  where merchant_id is not null;

-- 5. updated_at triggers ------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'loyalty_invite_campaigns_set_updated_at'
  ) then
    create trigger loyalty_invite_campaigns_set_updated_at
      before update on public.loyalty_invite_campaigns
      for each row execute function public.set_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'loyalty_invite_recipients_set_updated_at'
  ) then
    create trigger loyalty_invite_recipients_set_updated_at
      before update on public.loyalty_invite_recipients
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- 6. RLS: admin read + service-role all; no anon/authenticated mutation -------
alter table public.loyalty_invite_campaigns enable row level security;
alter table public.loyalty_invite_campaigns force row level security;
alter table public.loyalty_invite_recipients enable row level security;
alter table public.loyalty_invite_recipients force row level security;
alter table public.loyalty_invite_email_suppressions enable row level security;
alter table public.loyalty_invite_email_suppressions force row level security;

drop policy if exists loyalty_invite_campaigns_admin_read on public.loyalty_invite_campaigns;
create policy loyalty_invite_campaigns_admin_read on public.loyalty_invite_campaigns
  for select to authenticated using (public.is_internal_admin());
drop policy if exists loyalty_invite_campaigns_service on public.loyalty_invite_campaigns;
create policy loyalty_invite_campaigns_service on public.loyalty_invite_campaigns
  for all to service_role using (true) with check (true);

drop policy if exists loyalty_invite_recipients_admin_read on public.loyalty_invite_recipients;
create policy loyalty_invite_recipients_admin_read on public.loyalty_invite_recipients
  for select to authenticated using (public.is_internal_admin());
drop policy if exists loyalty_invite_recipients_service on public.loyalty_invite_recipients;
create policy loyalty_invite_recipients_service on public.loyalty_invite_recipients
  for all to service_role using (true) with check (true);

drop policy if exists loyalty_invite_suppress_admin_read on public.loyalty_invite_email_suppressions;
create policy loyalty_invite_suppress_admin_read on public.loyalty_invite_email_suppressions
  for select to authenticated using (public.is_internal_admin());
drop policy if exists loyalty_invite_suppress_service on public.loyalty_invite_email_suppressions;
create policy loyalty_invite_suppress_service on public.loyalty_invite_email_suppressions
  for all to service_role using (true) with check (true);

revoke all on table public.loyalty_invite_campaigns from public, anon, authenticated;
grant select on table public.loyalty_invite_campaigns to authenticated;
grant select, insert, update, delete on table public.loyalty_invite_campaigns to service_role;

revoke all on table public.loyalty_invite_recipients from public, anon, authenticated;
grant select on table public.loyalty_invite_recipients to authenticated;
grant select, insert, update, delete on table public.loyalty_invite_recipients to service_role;

revoke all on table public.loyalty_invite_email_suppressions from public, anon, authenticated;
grant select on table public.loyalty_invite_email_suppressions to authenticated;
grant select, insert, update, delete on table public.loyalty_invite_email_suppressions to service_role;

-- 7. Admin allowlist toggle ---------------------------------------------------
create or replace function public.admin_set_merchant_loyalty_invites(
  p_merchant_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_updated boolean;
begin
  if not public.is_internal_admin() then
    raise insufficient_privilege using message = 'Admin privilege required';
  end if;

  update public.merchants
  set loyalty_invites_enabled = coalesce(p_enabled, false)
  where id = p_merchant_id
  returning true into v_updated;

  if v_updated then
    insert into public.audit_logs (
      actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
    ) values (
      'admin', (select auth.uid())::text, p_merchant_id,
      'merchants', p_merchant_id, 'loyalty_invites_allowlist_set',
      jsonb_build_object('enabled', coalesce(p_enabled, false))
    );
  end if;

  return coalesce(v_updated, false);
end;
$$;

revoke all on function public.admin_set_merchant_loyalty_invites(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_set_merchant_loyalty_invites(uuid, boolean)
  to authenticated, service_role;

notify pgrst, 'reload schema';
