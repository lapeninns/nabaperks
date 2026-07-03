-- Issued rewards, phase 4: pending reward invites (merchant-sent to non-members).
--
-- A merchant can send a reward to a contact who is not yet on Nabaperks. The
-- contact is stored ONLY as an HMAC (never raw); when a person with a matching
-- verified phone/email joins (or follows a claim link), the invite attaches as a
-- normal merchant_direct reward and its hashes are scrubbed. PECR mitigations:
-- one-time send, permanent suppression list, hashed-at-rest, 90-day expiry, a
-- 365-day hard delete. **Legal review is recommended before launch.**
--
-- The merchant_direct insert + side-effects are extracted into
-- internal_issue_merchant_direct_reward so the direct RPC and the attach RPC
-- share one source of truth; the public issue_merchant_direct_reward is
-- reproduced as a thin gate wrapper (behaviour unchanged).

-- 1. Shared core -------------------------------------------------------------

create or replace function public.internal_issue_merchant_direct_reward(
  p_merchant_id uuid,
  p_membership_id uuid,
  p_customer_id uuid,
  p_loyalty_card_id uuid,
  p_reward_name text,
  p_reward_terms text,
  p_expires_in_days integer,
  p_reason text,
  p_issuer_user_id text,
  p_business_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_now timestamptz := now();
  v_business_date date := public.uk_business_date(now());
  v_expires_at timestamptz := now() + make_interval(days => p_expires_in_days);
  v_reward_id uuid;
begin
  insert into public.reward_events (
    merchant_id, customer_id, membership_id, loyalty_card_id,
    status, source, reward_name, reward_terms,
    redeemable_from, expires_at, cycle_number, metadata, created_at, updated_at
  )
  values (
    p_merchant_id, p_customer_id, p_membership_id, p_loyalty_card_id,
    'unlocked', 'merchant_direct', p_reward_name, p_reward_terms,
    v_business_date, v_expires_at, null,
    jsonb_build_object(
      'issued_by', 'merchant_direct',
      'issuer_user_id', coalesce(p_issuer_user_id, 'service_role'),
      'reason', nullif(btrim(coalesce(p_reason, '')), '')
    ),
    v_now, v_now
  )
  returning id into v_reward_id;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'reward_sent', p_merchant_id, p_customer_id, p_membership_id, 'merchant',
    coalesce(p_issuer_user_id, p_merchant_id::text),
    jsonb_build_object('reward_id', v_reward_id, 'reward_name', p_reward_name, 'source', 'merchant_direct')
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'merchant', coalesce(p_issuer_user_id, p_merchant_id::text), p_merchant_id, p_customer_id,
    'reward_events', v_reward_id, 'direct_reward_issued',
    jsonb_build_object('reward_name', p_reward_name, 'expires_in_days', p_expires_in_days)
  );

  perform public.enqueue_notification_event(
    'merchant_reward_received', p_customer_id, p_merchant_id, p_membership_id, v_reward_id,
    null, v_business_date, v_now, 'merchant_reward_received:' || v_reward_id::text,
    jsonb_build_object(
      'title', 'A reward for you',
      'body', p_reward_name || ' at ' || coalesce(p_business_name, 'your venue'),
      'url', '/home/rewards', 'rewardEventId', v_reward_id
    ),
    jsonb_build_object('source', 'merchant_direct')
  );

  return v_reward_id;
end;
$$;

revoke all on function public.internal_issue_merchant_direct_reward(uuid, uuid, uuid, uuid, text, text, integer, text, text, text) from public;
grant execute on function public.internal_issue_merchant_direct_reward(uuid, uuid, uuid, uuid, text, text, integer, text, text, text) to service_role;

-- 2. Public direct RPC as a gate wrapper over the core (behaviour unchanged) --

create or replace function public.issue_merchant_direct_reward(
  p_merchant_id uuid,
  p_membership_id uuid,
  p_reward_name text,
  p_reward_terms text,
  p_expires_in_days integer default 30,
  p_reason text default null
)
returns table (
  reward_event_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_merchant record;
  v_membership record;
  v_card_id uuid;
  v_billing_status text;
  v_name text := btrim(coalesce(p_reward_name, ''));
  v_terms text := btrim(coalesce(p_reward_terms, ''));
  v_expires_in integer := coalesce(p_expires_in_days, 30);
  v_business_date date := public.uk_business_date(now());
  v_membership_today integer;
  v_merchant_today integer;
  v_reward_id uuid;
begin
  select merchants.id, merchants.status, merchants.owner_user_id, merchants.requires_billing, merchants.business_name
  into v_merchant from public.merchants where merchants.id = p_merchant_id for update;
  if v_merchant.id is null then raise insufficient_privilege using message = 'Merchant not found'; end if;
  if not public.is_service_role_request() then
    if current_user_id is null or v_merchant.owner_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Merchant owner access required';
    end if;
  end if;

  select customer_memberships.id, customer_memberships.customer_id into v_membership
  from public.customer_memberships
  where customer_memberships.id = p_membership_id and customer_memberships.merchant_id = p_merchant_id
  for update;
  if v_membership.id is null then raise exception 'Membership not found for merchant'; end if;

  if v_name = '' or char_length(v_name) > 100 then raise exception 'Reward name must be 1 to 100 characters'; end if;
  if char_length(v_terms) not between 12 and 500 then raise exception 'Reward terms must be between 12 and 500 characters'; end if;
  if v_expires_in not between 1 and 365 then raise exception 'Reward expiry must be between 1 and 365 days'; end if;

  if v_merchant.status not in ('trial', 'active') then raise exception 'This merchant loyalty programme is not active'; end if;
  select billing_customers.status into v_billing_status from public.billing_customers where billing_customers.merchant_id = p_merchant_id;
  if coalesce(v_merchant.requires_billing, true) and v_billing_status is null then raise exception 'This merchant loyalty programme is not active yet'; end if;
  if v_billing_status in ('cancelled', 'suspended') then raise exception 'This merchant loyalty programme is unavailable'; end if;

  select loyalty_cards.id into v_card_id from public.loyalty_cards
  where loyalty_cards.merchant_id = p_merchant_id and loyalty_cards.is_active
  order by loyalty_cards.created_at asc limit 1;
  if v_card_id is null then raise exception 'This loyalty card is not active'; end if;

  select count(*) into v_membership_today from public.reward_events
  where reward_events.membership_id = p_membership_id and reward_events.source = 'merchant_direct'
    and public.uk_business_date(reward_events.created_at) = v_business_date;
  if v_membership_today >= 1 then raise exception 'A reward has already been sent to this member today'; end if;

  select count(*) into v_merchant_today from public.reward_events
  where reward_events.merchant_id = p_merchant_id and reward_events.source = 'merchant_direct'
    and public.uk_business_date(reward_events.created_at) = v_business_date;
  if v_merchant_today >= 100 then raise exception 'Daily sent-reward limit reached for this merchant'; end if;

  v_reward_id := public.internal_issue_merchant_direct_reward(
    p_merchant_id, p_membership_id, v_membership.customer_id, v_card_id,
    v_name, v_terms, v_expires_in, p_reason,
    coalesce(current_user_id::text, p_merchant_id::text), v_merchant.business_name
  );

  reward_event_id := v_reward_id;
  expires_at := now() + make_interval(days => v_expires_in);
  return next;
end;
$$;

revoke all on function public.issue_merchant_direct_reward(uuid, uuid, text, text, integer, text) from public;
grant execute on function public.issue_merchant_direct_reward(uuid, uuid, text, text, integer, text) to authenticated, service_role;

-- 3. Tables ------------------------------------------------------------------

create table if not exists public.pending_reward_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  created_by_user_id uuid,
  email_hmac text,
  phone_hmac text,
  email_masked text,
  phone_last4 text,
  reward_name text not null,
  reward_terms text not null,
  personal_message text,
  reward_expires_after_days integer not null default 30
    check (reward_expires_after_days between 1 and 365),
  claim_token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'matched', 'attached', 'expired', 'cancelled')),
  matched_customer_id uuid references public.customers(id) on delete set null,
  attached_customer_id uuid references public.customers(id) on delete set null,
  attached_membership_id uuid references public.customer_memberships(id) on delete set null,
  attached_reward_event_id uuid references public.reward_events(id) on delete set null,
  attached_at timestamptz,
  email_send_status text not null default 'pending'
    check (email_send_status in ('pending', 'sent', 'suppressed', 'failed', 'skipped')),
  invite_expires_at timestamptz not null default now() + interval '90 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pending_reward_invites_contact_present
    check (
      status in ('attached', 'expired', 'cancelled')
      or email_hmac is not null
      or phone_hmac is not null
    ),
  constraint pending_reward_invites_email_masked_coherent
    check ((email_hmac is null) = (email_masked is null)),
  constraint pending_reward_invites_phone_masked_coherent
    check ((phone_hmac is null) = (phone_last4 is null)),
  constraint pending_reward_invites_attached_shape
    check (
      status <> 'attached'
      or (attached_customer_id is not null and attached_membership_id is not null and attached_reward_event_id is not null)
    )
);

create table if not exists public.reward_invite_email_suppressions (
  email_hmac text primary key,
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained')),
  created_at timestamptz not null default now()
);

-- One ACTIVE invite per (merchant, contact) — dedupe + anti-spam.
create unique index if not exists pending_reward_invites_active_email_idx
  on public.pending_reward_invites (merchant_id, email_hmac)
  where status in ('pending', 'matched') and email_hmac is not null;
create unique index if not exists pending_reward_invites_active_phone_idx
  on public.pending_reward_invites (merchant_id, phone_hmac)
  where status in ('pending', 'matched') and phone_hmac is not null;
create index if not exists pending_reward_invites_email_match_idx
  on public.pending_reward_invites (email_hmac)
  where status in ('pending', 'matched') and email_hmac is not null;
create index if not exists pending_reward_invites_phone_match_idx
  on public.pending_reward_invites (phone_hmac)
  where status in ('pending', 'matched') and phone_hmac is not null;
create index if not exists pending_reward_invites_matched_customer_idx
  on public.pending_reward_invites (matched_customer_id)
  where matched_customer_id is not null;
create index if not exists pending_reward_invites_merchant_created_idx
  on public.pending_reward_invites (merchant_id, created_at desc);
create index if not exists pending_reward_invites_expiry_idx
  on public.pending_reward_invites (invite_expires_at)
  where status in ('pending', 'matched');
create index if not exists customers_email_lower_verified_idx
  on public.customers (lower(email))
  where email_verified_at is not null;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'pending_reward_invites_set_updated_at'
  ) then
    create trigger pending_reward_invites_set_updated_at
      before update on public.pending_reward_invites
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.pending_reward_invites enable row level security;
alter table public.pending_reward_invites force row level security;
alter table public.reward_invite_email_suppressions enable row level security;
alter table public.reward_invite_email_suppressions force row level security;

drop policy if exists pending_reward_invites_admin_read on public.pending_reward_invites;
create policy pending_reward_invites_admin_read on public.pending_reward_invites
  for select to authenticated using (public.is_internal_admin());
drop policy if exists pending_reward_invites_service on public.pending_reward_invites;
create policy pending_reward_invites_service on public.pending_reward_invites
  for all to service_role using (true) with check (true);

drop policy if exists reward_invite_suppressions_admin_read on public.reward_invite_email_suppressions;
create policy reward_invite_suppressions_admin_read on public.reward_invite_email_suppressions
  for select to authenticated using (public.is_internal_admin());
drop policy if exists reward_invite_suppressions_service on public.reward_invite_email_suppressions;
create policy reward_invite_suppressions_service on public.reward_invite_email_suppressions
  for all to service_role using (true) with check (true);

revoke all on table public.pending_reward_invites from anon, authenticated;
revoke all on table public.reward_invite_email_suppressions from anon, authenticated;
grant select on table public.pending_reward_invites to authenticated;
grant select on table public.reward_invite_email_suppressions to authenticated;
grant select, insert, update, delete on table public.pending_reward_invites to service_role;
grant select, insert, update, delete on table public.reward_invite_email_suppressions to service_role;

-- 4. create_merchant_reward_invite -------------------------------------------

create or replace function public.create_merchant_reward_invite(
  p_merchant_id uuid,
  p_email_hmac text,
  p_phone_hmac text,
  p_email_masked text,
  p_phone_last4 text,
  p_reward_name text,
  p_reward_terms text,
  p_personal_message text,
  p_reward_expires_after_days integer,
  p_claim_token_hash text
)
returns table (invite_id uuid, deduped boolean)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_merchant record;
  v_name text := btrim(coalesce(p_reward_name, ''));
  v_terms text := btrim(coalesce(p_reward_terms, ''));
  v_message text := nullif(btrim(coalesce(p_personal_message, '')), '');
  v_days integer := coalesce(p_reward_expires_after_days, 30);
  v_id uuid;
begin
  select merchants.id, merchants.status, merchants.owner_user_id
  into v_merchant from public.merchants where merchants.id = p_merchant_id for update;
  if v_merchant.id is null then raise insufficient_privilege using message = 'Merchant not found'; end if;
  if not public.is_service_role_request() then
    if current_user_id is null or v_merchant.owner_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Merchant owner access required';
    end if;
  end if;

  if p_email_hmac is null and p_phone_hmac is null then raise exception 'A contact is required for an invite'; end if;
  if v_name = '' or char_length(v_name) > 100 then raise exception 'Reward name must be 1 to 100 characters'; end if;
  if char_length(v_terms) not between 12 and 500 then raise exception 'Reward terms must be between 12 and 500 characters'; end if;
  if v_message is not null and char_length(v_message) > 240 then raise exception 'Message must be 240 characters or fewer'; end if;
  if v_days not between 1 and 365 then raise exception 'Reward expiry must be between 1 and 365 days'; end if;
  if p_claim_token_hash is null or btrim(p_claim_token_hash) = '' then raise exception 'A claim token is required'; end if;

  if v_merchant.status not in ('trial', 'active') then raise exception 'This merchant loyalty programme is not active'; end if;
  if not exists (select 1 from public.loyalty_cards where merchant_id = p_merchant_id and is_active) then
    raise exception 'This loyalty card is not active';
  end if;

  -- Dedupe: an existing ACTIVE invite for the same contact is returned; the
  -- caller then sends no second email.
  select id into v_id from public.pending_reward_invites
  where merchant_id = p_merchant_id and status in ('pending', 'matched')
    and (
      (p_email_hmac is not null and email_hmac = p_email_hmac)
      or (p_phone_hmac is not null and phone_hmac = p_phone_hmac)
    )
  order by created_at desc limit 1;
  if v_id is not null then
    invite_id := v_id; deduped := true; return next; return;
  end if;

  insert into public.pending_reward_invites (
    merchant_id, created_by_user_id, email_hmac, phone_hmac, email_masked, phone_last4,
    reward_name, reward_terms, personal_message, reward_expires_after_days, claim_token_hash
  )
  values (
    p_merchant_id, current_user_id, p_email_hmac, p_phone_hmac, p_email_masked, p_phone_last4,
    v_name, v_terms, v_message, v_days, p_claim_token_hash
  )
  returning id into v_id;

  insert into public.product_events (event_name, merchant_id, actor_type, actor_id, metadata)
  values ('reward_invite_sent', p_merchant_id, 'merchant', coalesce(current_user_id::text, p_merchant_id::text),
    jsonb_build_object('invite_id', v_id, 'reward_name', v_name));

  insert into public.audit_logs (actor_type, actor_id, merchant_id, target_table, target_id, action, metadata)
  values ('merchant', coalesce(current_user_id::text, p_merchant_id::text), p_merchant_id,
    'pending_reward_invites', v_id, 'reward_invite_created',
    jsonb_build_object('reward_name', v_name, 'has_email', p_email_hmac is not null, 'has_phone', p_phone_hmac is not null));

  invite_id := v_id; deduped := false; return next;
end;
$$;

revoke all on function public.create_merchant_reward_invite(uuid, text, text, text, text, text, text, text, integer, text) from public;
grant execute on function public.create_merchant_reward_invite(uuid, text, text, text, text, text, text, text, integer, text) to authenticated, service_role;

-- 5. attach_matched_reward_invites -------------------------------------------

create or replace function public.attach_matched_reward_invites(
  p_customer_id uuid,
  p_phone_hmac text default null,
  p_email_hmac text default null,
  p_claim_token_hash text default null
)
returns table (
  attached_reward_event_id uuid,
  merchant_id uuid,
  membership_id uuid,
  reward_name text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_invite record;
  v_now timestamptz := now();
  v_membership record;
  v_merchant record;
  v_card_id uuid;
  v_reward_id uuid;
begin
  if p_customer_id is null then return; end if;

  for v_invite in
    select * from public.pending_reward_invites
    where status in ('pending', 'matched')
      and (
        (p_phone_hmac is not null and phone_hmac = p_phone_hmac)
        or (p_email_hmac is not null and email_hmac = p_email_hmac)
        or (p_claim_token_hash is not null and claim_token_hash = p_claim_token_hash)
        or matched_customer_id = p_customer_id
      )
    for update
  loop
    -- Expiry guard: scrub a lapsed invite and skip.
    if v_invite.invite_expires_at <= v_now then
      update public.pending_reward_invites
      set status = 'expired', email_hmac = null, phone_hmac = null, email_masked = null,
          phone_last4 = null, claim_token_hash = 'scrubbed:' || v_invite.id::text, updated_at = v_now
      where id = v_invite.id;
      continue;
    end if;

    -- Sticky match: the first verified match wins; a later identity (or a
    -- forwarded token) never re-targets an invite already matched to someone else.
    if v_invite.matched_customer_id is not null and v_invite.matched_customer_id <> p_customer_id then
      continue;
    end if;

    if v_invite.status = 'pending' then
      update public.pending_reward_invites
      set status = 'matched', matched_customer_id = p_customer_id, updated_at = v_now
      where id = v_invite.id;
    end if;

    -- Attach only when this customer is a member of the invite's merchant and
    -- the programme is available; otherwise it stays matched for a later join.
    select cm.id into v_membership
    from public.customer_memberships cm
    where cm.customer_id = p_customer_id and cm.merchant_id = v_invite.merchant_id
    limit 1;
    if v_membership.id is null then continue; end if;

    select m.id, m.status, m.requires_billing, m.business_name into v_merchant
    from public.merchants m where m.id = v_invite.merchant_id;
    if public.loyalty_availability_reason(
         v_merchant.status, true,
         (select status from public.billing_customers where billing_customers.merchant_id = v_invite.merchant_id),
         v_merchant.requires_billing) is not null then
      continue;
    end if;

    select loyalty_cards.id into v_card_id from public.loyalty_cards
    where loyalty_cards.merchant_id = v_invite.merchant_id and loyalty_cards.is_active
    order by loyalty_cards.created_at asc limit 1;
    if v_card_id is null then continue; end if;

    v_reward_id := public.internal_issue_merchant_direct_reward(
      v_invite.merchant_id, v_membership.id, p_customer_id, v_card_id,
      v_invite.reward_name, v_invite.reward_terms, v_invite.reward_expires_after_days,
      v_invite.personal_message, coalesce(v_invite.created_by_user_id::text, 'invite'),
      v_merchant.business_name
    );

    update public.pending_reward_invites
    set status = 'attached', attached_customer_id = p_customer_id, attached_membership_id = v_membership.id,
        attached_reward_event_id = v_reward_id, attached_at = v_now,
        email_hmac = null, phone_hmac = null, email_masked = null, phone_last4 = null,
        claim_token_hash = 'scrubbed:' || v_invite.id::text, matched_customer_id = p_customer_id, updated_at = v_now
    where id = v_invite.id;

    attached_reward_event_id := v_reward_id;
    merchant_id := v_invite.merchant_id;
    membership_id := v_membership.id;
    reward_name := v_invite.reward_name;
    return next;
  end loop;
end;
$$;

revoke all on function public.attach_matched_reward_invites(uuid, text, text, text) from public;
grant execute on function public.attach_matched_reward_invites(uuid, text, text, text) to service_role;

-- 6. get_reward_invite_claim_context (public claim landing) ------------------

create or replace function public.get_reward_invite_claim_context(
  p_claim_token_hash text
)
returns table (
  claim_status text,
  merchant_name text,
  reward_name text,
  masked_hint text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_invite record;
begin
  select i.status, i.reward_name, i.invite_expires_at, i.email_masked, i.phone_last4, m.business_name
  into v_invite
  from public.pending_reward_invites i
  join public.merchants m on m.id = i.merchant_id
  where i.claim_token_hash = p_claim_token_hash
    and i.status in ('pending', 'matched')
    and i.invite_expires_at > now();

  if v_invite.status is null then
    claim_status := 'not_found';
    return next;
    return;
  end if;

  claim_status := 'available';
  merchant_name := v_invite.business_name;
  reward_name := v_invite.reward_name;
  masked_hint := coalesce(v_invite.email_masked, case when v_invite.phone_last4 is not null then 'Phone ending ' || v_invite.phone_last4 else null end);
  return next;
end;
$$;

revoke all on function public.get_reward_invite_claim_context(text) from public;
grant execute on function public.get_reward_invite_claim_context(text) to service_role;

-- 7. cancel + suppress -------------------------------------------------------

create or replace function public.cancel_merchant_reward_invite(
  p_merchant_id uuid,
  p_invite_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_owner uuid;
  v_updated integer;
begin
  select owner_user_id into v_owner from public.merchants where id = p_merchant_id;
  if v_owner is null then raise insufficient_privilege using message = 'Merchant not found'; end if;
  if not public.is_service_role_request() then
    if current_user_id is null or v_owner <> current_user_id then
      raise insufficient_privilege using message = 'Merchant owner access required';
    end if;
  end if;

  update public.pending_reward_invites
  set status = 'cancelled', email_hmac = null, phone_hmac = null, email_masked = null,
      phone_last4 = null, claim_token_hash = 'scrubbed:' || id::text, updated_at = now()
  where id = p_invite_id and merchant_id = p_merchant_id and status in ('pending', 'matched');
  get diagnostics v_updated = row_count;

  return v_updated = 1;
end;
$$;

revoke all on function public.cancel_merchant_reward_invite(uuid, uuid) from public;
grant execute on function public.cancel_merchant_reward_invite(uuid, uuid) to authenticated, service_role;

create or replace function public.suppress_reward_invite_email(
  p_email_hmac text,
  p_reason text default 'unsubscribed'
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if p_email_hmac is null or btrim(p_email_hmac) = '' then return; end if;
  insert into public.reward_invite_email_suppressions (email_hmac, reason)
  values (p_email_hmac, case when p_reason in ('unsubscribed', 'bounced', 'complained') then p_reason else 'unsubscribed' end)
  on conflict (email_hmac) do nothing;
end;
$$;

revoke all on function public.suppress_reward_invite_email(text, text) from public;
grant execute on function public.suppress_reward_invite_email(text, text) to service_role;

-- 8. expire_and_purge_reward_invites (retention cron) ------------------------

create or replace function public.expire_and_purge_reward_invites(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_expired integer := 0;
begin
  -- Expire + scrub live invites past their window.
  with expired as (
    update public.pending_reward_invites
    set status = 'expired', email_hmac = null, phone_hmac = null, email_masked = null,
        phone_last4 = null, claim_token_hash = 'scrubbed:' || id::text, updated_at = p_now
    where status in ('pending', 'matched') and invite_expires_at <= p_now
    returning 1
  )
  select count(*) into v_expired from expired;

  -- Belt-and-braces: scrub any terminal invite older than 7 days that still
  -- carries a hash (should not happen; defence in depth).
  update public.pending_reward_invites
  set email_hmac = null, phone_hmac = null, email_masked = null, phone_last4 = null,
      claim_token_hash = 'scrubbed:' || id::text, updated_at = p_now
  where status in ('attached', 'expired', 'cancelled')
    and updated_at < p_now - interval '7 days'
    and (email_hmac is not null or phone_hmac is not null);

  -- Hard delete terminal invites older than 365 days.
  delete from public.pending_reward_invites
  where status in ('attached', 'expired', 'cancelled')
    and updated_at < p_now - interval '365 days';

  return v_expired;
end;
$$;

revoke all on function public.expire_and_purge_reward_invites(timestamptz) from public;
grant execute on function public.expire_and_purge_reward_invites(timestamptz) to service_role;

notify pgrst, 'reload schema';
