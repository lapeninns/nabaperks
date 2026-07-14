create or replace function public.loyalty_availability_reason(
  p_merchant_status text,
  p_card_active boolean,
  p_billing_status text
)
returns text
language sql
immutable
as $$
  select case
    when p_merchant_status not in ('trial', 'active') then 'merchant_inactive'
    when not coalesce(p_card_active, false) then 'card_inactive'
    when p_billing_status in ('cancelled', 'suspended') then 'billing_blocked'
    else null
  end;
$$;

create table if not exists public.reward_scan_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  reward_event_id uuid not null references public.reward_events(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  membership_id uuid not null references public.customer_memberships(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  consumed_by_merchant_id uuid references public.merchants(id) on delete set null,
  constraint reward_scan_tokens_membership_matches_context
    foreign key (merchant_id, customer_id, membership_id)
    references public.customer_memberships(merchant_id, customer_id, id)
    on delete cascade
    deferrable initially immediate
);

create index if not exists reward_scan_tokens_reward_event_id_idx
  on public.reward_scan_tokens (reward_event_id);
create index if not exists reward_scan_tokens_merchant_expires_idx
  on public.reward_scan_tokens (merchant_id, expires_at desc);
create index if not exists reward_scan_tokens_customer_created_idx
  on public.reward_scan_tokens (customer_id, created_at desc);

alter table public.reward_scan_tokens enable row level security;
alter table public.reward_scan_tokens force row level security;

drop policy if exists reward_scan_tokens_service_role_all on public.reward_scan_tokens;
create policy reward_scan_tokens_service_role_all
  on public.reward_scan_tokens
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.reward_scan_tokens from anon, authenticated;
grant select, insert, update, delete on table public.reward_scan_tokens to service_role;

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  livemode boolean not null default false,
  stripe_created_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  failed_at timestamptz,
  last_error text
);

create index if not exists stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at desc);
create index if not exists stripe_webhook_events_failed_at_idx
  on public.stripe_webhook_events (failed_at desc)
  where failed_at is not null;

alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;

drop policy if exists stripe_webhook_events_service_role_all on public.stripe_webhook_events;
create policy stripe_webhook_events_service_role_all
  on public.stripe_webhook_events
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.stripe_webhook_events from anon, authenticated;
grant select, insert, update, delete on table public.stripe_webhook_events to service_role;

create table if not exists public.customer_sessions (
  id uuid primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists customer_sessions_customer_active_idx
  on public.customer_sessions (customer_id, expires_at desc)
  where revoked_at is null;
create index if not exists customer_sessions_expiry_idx
  on public.customer_sessions (expires_at);

alter table public.customer_sessions enable row level security;
alter table public.customer_sessions force row level security;

drop policy if exists customer_sessions_service_role_all on public.customer_sessions;
create policy customer_sessions_service_role_all
  on public.customer_sessions
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.customer_sessions from anon, authenticated;
grant select, insert, update, delete on table public.customer_sessions to service_role;

create or replace function public.create_reward_scan_token(
  p_reward_event_id uuid,
  p_customer_id uuid
)
returns table (
  scan_token uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  reward_record record;
  availability_reason text;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  select
    reward_events.id,
    reward_events.status,
    reward_events.merchant_id,
    reward_events.customer_id,
    reward_events.membership_id,
    reward_events.reward_name,
    reward_events.redeemable_from,
    customer_memberships.current_stamp_count,
    customers.full_name as customer_full_name,
    customers.date_of_birth as customer_date_of_birth,
    customers.email as customer_email,
    customers.email_verified_at as customer_email_verified_at,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    merchants.status as merchant_status,
    billing_customers.status as billing_status
  into reward_record
  from public.reward_events
  join public.customer_memberships
    on customer_memberships.id = reward_events.membership_id
  join public.customers
    on customers.id = reward_events.customer_id
  join public.loyalty_cards
    on loyalty_cards.id = reward_events.loyalty_card_id
  join public.merchants
    on merchants.id = reward_events.merchant_id
  left join public.billing_customers
    on billing_customers.merchant_id = reward_events.merchant_id
  where reward_events.id = p_reward_event_id
  for update of reward_events;

  if reward_record.id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;

  if reward_record.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  if reward_record.status = 'redeemed' then
    raise exception 'Reward already redeemed';
  end if;

  if reward_record.status <> 'unlocked' then
    raise exception 'Reward is not ready to collect';
  end if;

  if reward_record.redeemable_from is not null
    and reward_record.redeemable_from > public.uk_business_date(now()) then
    raise exception 'Reward is not redeemable until the next UK business day';
  end if;

  availability_reason := public.loyalty_availability_reason(
    reward_record.merchant_status,
    reward_record.card_is_active,
    reward_record.billing_status
  );

  if availability_reason is not null then
    raise exception 'This loyalty programme is unavailable right now';
  end if;

  if reward_record.current_stamp_count < reward_record.stamps_required then
    raise exception 'Reward is not ready to redeem';
  end if;

  if reward_record.customer_full_name is null
    or btrim(reward_record.customer_full_name) = ''
    or reward_record.customer_date_of_birth is null
    or (reward_record.customer_email is not null
        and reward_record.customer_email_verified_at is null) then
    raise exception 'Complete your profile before redeeming';
  end if;

  insert into public.reward_scan_tokens (
    reward_event_id,
    merchant_id,
    customer_id,
    membership_id
  )
  values (
    reward_record.id,
    reward_record.merchant_id,
    reward_record.customer_id,
    reward_record.membership_id
  )
  returning id, reward_scan_tokens.expires_at
  into scan_token, expires_at;

  return next;
end;
$$;

-- Replay guard (db dead field cleanup): the final chain shape drops
-- min_spend_pence, so replays must drop before recreating this older shape.
drop function if exists public.get_reward_scan_context(uuid, uuid);
create or replace function public.get_reward_scan_context(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table (
  scan_status text,
  reward_event_id uuid,
  reward_name text,
  reward_terms text,
  min_spend_pence integer,
  membership_id uuid,
  current_stamp_count integer,
  customer_email text,
  customer_phone text,
  customer_phone_last4 text,
  blocked_reason text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  scan_record record;
  availability_reason text;
begin
  select
    reward_scan_tokens.id as token_id,
    reward_scan_tokens.merchant_id as token_merchant_id,
    reward_scan_tokens.expires_at,
    reward_scan_tokens.consumed_at,
    reward_events.id as event_id,
    reward_events.status as event_status,
    reward_events.reward_name as assigned_reward_name,
    reward_events.reward_terms as assigned_reward_terms,
    reward_events.min_spend_pence as assigned_min_spend_pence,
    reward_events.redeemable_from,
    customer_memberships.id as card_membership_id,
    customer_memberships.current_stamp_count as card_stamp_count,
    customers.email as safe_customer_email,
    customers.phone as safe_customer_phone,
    customers.phone_last4 as safe_customer_phone_last4,
    customers.full_name as customer_full_name,
    customers.date_of_birth as customer_date_of_birth,
    customers.email_verified_at as customer_email_verified_at,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    merchants.status as merchant_status,
    billing_customers.status as billing_status
  into scan_record
  from public.reward_scan_tokens
  join public.reward_events
    on reward_events.id = reward_scan_tokens.reward_event_id
  join public.customer_memberships
    on customer_memberships.id = reward_scan_tokens.membership_id
  join public.customers
    on customers.id = reward_scan_tokens.customer_id
  join public.loyalty_cards
    on loyalty_cards.id = reward_events.loyalty_card_id
  join public.merchants
    on merchants.id = reward_scan_tokens.merchant_id
  left join public.billing_customers
    on billing_customers.merchant_id = reward_scan_tokens.merchant_id
  where reward_scan_tokens.id = p_scan_token;

  if scan_record.token_id is null then
    scan_status := 'not_found';
    return next;
    return;
  end if;

  if scan_record.token_merchant_id <> p_merchant_id then
    scan_status := 'unauthorized';
    return next;
    return;
  end if;

  reward_event_id := scan_record.event_id;
  reward_name := scan_record.assigned_reward_name;
  reward_terms := scan_record.assigned_reward_terms;
  min_spend_pence := scan_record.assigned_min_spend_pence;
  membership_id := scan_record.card_membership_id;
  current_stamp_count := scan_record.card_stamp_count;
  customer_email := scan_record.safe_customer_email;
  customer_phone := scan_record.safe_customer_phone;
  customer_phone_last4 := scan_record.safe_customer_phone_last4;

  if scan_record.consumed_at is not null or scan_record.event_status = 'redeemed' then
    scan_status := 'redeemed';
    return next;
    return;
  end if;

  if scan_record.expires_at <= now() then
    scan_status := 'not_found';
    return next;
    return;
  end if;

  if scan_record.event_status <> 'unlocked' then
    scan_status := 'blocked';
    blocked_reason := 'This reward is not ready to collect.';
    return next;
    return;
  end if;

  if scan_record.redeemable_from is not null
    and scan_record.redeemable_from > public.uk_business_date(now()) then
    scan_status := 'blocked';
    blocked_reason := 'This reward cannot be collected until the next opening day.';
    return next;
    return;
  end if;

  availability_reason := public.loyalty_availability_reason(
    scan_record.merchant_status,
    scan_record.card_is_active,
    scan_record.billing_status
  );

  if availability_reason is not null then
    scan_status := 'blocked';
    blocked_reason := 'This loyalty programme is unavailable right now.';
    return next;
    return;
  end if;

  if scan_record.card_stamp_count < scan_record.stamps_required then
    scan_status := 'blocked';
    blocked_reason := 'This customer has not collected enough stamps yet.';
    return next;
    return;
  end if;

  if scan_record.customer_full_name is null
    or btrim(scan_record.customer_full_name) = ''
    or scan_record.customer_date_of_birth is null
    or (scan_record.safe_customer_email is not null
        and scan_record.customer_email_verified_at is null) then
    scan_status := 'blocked';
    blocked_reason := 'Ask the customer to finish their profile before this reward can be collected.';
    return next;
    return;
  end if;

  scan_status := 'ready';
  return next;
end;
$$;

create or replace function public.collect_reward_scan_token(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table (
  reward_event_id uuid,
  reward_name text,
  membership_id uuid,
  new_stamp_count integer
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  token_record record;
  redeem_record record;
begin
  select *
  into token_record
  from public.reward_scan_tokens
  where id = p_scan_token
  for update;

  if token_record.id is null then
    raise insufficient_privilege using message = 'Reward scan token not found';
  end if;

  if token_record.merchant_id <> p_merchant_id then
    raise insufficient_privilege using message = 'Reward scan token belongs to a different merchant';
  end if;

  if token_record.expires_at <= now() then
    raise exception 'Reward scan token expired';
  end if;

  if token_record.consumed_at is not null then
    raise exception 'Reward scan token already used';
  end if;

  select
    redeemed.reward_event_id,
    redeemed.reward_name,
    redeemed.membership_id,
    redeemed.new_stamp_count
  into redeem_record
  from public.redeem_self_service_reward(
    token_record.reward_event_id,
    token_record.customer_id,
    null,
    null
  ) redeemed;

  update public.reward_scan_tokens
  set
    consumed_at = now(),
    consumed_by_merchant_id = p_merchant_id
  where id = p_scan_token
    and consumed_at is null;

  reward_event_id := redeem_record.reward_event_id;
  reward_name := redeem_record.reward_name;
  membership_id := redeem_record.membership_id;
  new_stamp_count := redeem_record.new_stamp_count;
  return next;
end;
$$;

create or replace function public.register_customer_session(
  p_customer_id uuid,
  p_session_id uuid,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  registered_session_id uuid;
begin
  if p_customer_id is null or p_session_id is null or p_expires_at <= now() then
    raise exception 'Invalid customer session';
  end if;

  insert into public.customer_sessions (
    id,
    customer_id,
    expires_at,
    last_seen_at,
    revoked_at
  )
  values (
    p_session_id,
    p_customer_id,
    p_expires_at,
    now(),
    null
  )
  on conflict (id) do update
  set
    customer_id = excluded.customer_id,
    expires_at = excluded.expires_at,
    last_seen_at = now(),
    revoked_at = null
  returning id into registered_session_id;

  return registered_session_id;
end;
$$;

create or replace function public.touch_customer_session(
  p_customer_id uuid,
  p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  update public.customer_sessions
  set last_seen_at = now()
  where id = p_session_id
    and customer_id = p_customer_id
    and revoked_at is null
    and expires_at > now();

  return found;
end;
$$;

create or replace function public.revoke_customer_session(
  p_customer_id uuid,
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  update public.customer_sessions
  set revoked_at = coalesce(revoked_at, now())
  where id = p_session_id
    and customer_id = p_customer_id;
end;
$$;

revoke all on function public.create_reward_scan_token(uuid, uuid) from public;
revoke all on function public.get_reward_scan_context(uuid, uuid) from public;
revoke all on function public.collect_reward_scan_token(uuid, uuid) from public;
revoke all on function public.register_customer_session(uuid, uuid, timestamptz) from public;
revoke all on function public.touch_customer_session(uuid, uuid) from public;
revoke all on function public.revoke_customer_session(uuid, uuid) from public;

grant execute on function public.create_reward_scan_token(uuid, uuid) to service_role;
grant execute on function public.get_reward_scan_context(uuid, uuid) to service_role;
grant execute on function public.collect_reward_scan_token(uuid, uuid) to service_role;
grant execute on function public.register_customer_session(uuid, uuid, timestamptz) to service_role;
grant execute on function public.touch_customer_session(uuid, uuid) to service_role;
grant execute on function public.revoke_customer_session(uuid, uuid) to service_role;
