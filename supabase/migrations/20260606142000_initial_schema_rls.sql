create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.internal_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.merchants (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  business_name text not null,
  business_slug text not null unique,
  business_type text not null,
  email text not null,
  phone text,
  average_order_value_pence integer not null default 0
    check (average_order_value_pence >= 0),
  estimated_gross_margin_bps integer not null default 0
    check (estimated_gross_margin_bps between 0 and 10000),
  reward_cost_pence integer not null default 0
    check (reward_cost_pence >= 0),
  status text not null default 'trial'
    check (status in ('trial', 'active', 'paused', 'cancelled', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.merchant_locations (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  address text,
  timezone text not null default 'Europe/London',
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, id)
);

create table public.staff_users (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  location_id uuid references public.merchant_locations(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  role text not null default 'staff' check (role in ('staff', 'manager')),
  pin_hash text not null,
  pin_ciphertext text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_users_location_matches_merchant
    foreign key (merchant_id, location_id)
    references public.merchant_locations(merchant_id, id)
    on delete cascade
    deferrable initially immediate
);

create table public.loyalty_cards (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  location_id uuid not null references public.merchant_locations(id) on delete cascade,
  card_name text not null,
  stamps_required integer not null default 3
    check (stamps_required between 1 and 99),
  reward_name text not null,
  reward_terms text not null,
  min_spend_pence integer check (min_spend_pence is null or min_spend_pence >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, location_id, id),
  constraint loyalty_cards_location_matches_merchant
    foreign key (merchant_id, location_id)
    references public.merchant_locations(merchant_id, id)
    on delete cascade
    deferrable initially immediate
);

create table public.qr_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  qr_id text not null unique,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  location_id uuid not null references public.merchant_locations(id) on delete cascade,
  loyalty_card_id uuid not null references public.loyalty_cards(id) on delete cascade,
  destination_type text not null default 'join'
    check (destination_type in ('join', 'stamp', 'redeem', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_codes_location_matches_merchant
    foreign key (merchant_id, location_id)
    references public.merchant_locations(merchant_id, id)
    on delete cascade
    deferrable initially immediate,
  constraint qr_codes_card_matches_merchant_location
    foreign key (merchant_id, location_id, loyalty_card_id)
    references public.loyalty_cards(merchant_id, location_id, id)
    on delete cascade
    deferrable initially immediate
);

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_contact_present check (email is not null or phone is not null)
);

create table public.customer_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  current_stamp_count integer not null default 0 check (current_stamp_count >= 0),
  total_stamps_earned integer not null default 0 check (total_stamps_earned >= 0),
  total_rewards_redeemed integer not null default 0 check (total_rewards_redeemed >= 0),
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, customer_id),
  unique (merchant_id, customer_id, id)
);

create table public.stamp_events (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  membership_id uuid not null references public.customer_memberships(id) on delete cascade,
  loyalty_card_id uuid not null references public.loyalty_cards(id) on delete restrict,
  location_id uuid references public.merchant_locations(id) on delete set null,
  event_type text not null check (event_type in ('earned', 'reversed', 'manual_adjustment')),
  stamps_delta integer not null check (stamps_delta <> 0),
  approved_by_staff_id uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint stamp_events_membership_matches_context
    foreign key (merchant_id, customer_id, membership_id)
    references public.customer_memberships(merchant_id, customer_id, id)
    on delete cascade
    deferrable initially immediate
);

create table public.reward_events (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  membership_id uuid not null references public.customer_memberships(id) on delete cascade,
  loyalty_card_id uuid not null references public.loyalty_cards(id) on delete restrict,
  status text not null default 'unlocked'
    check (status in ('unlocked', 'redeemed', 'cancelled', 'expired')),
  redeemed_by_staff_id uuid references public.staff_users(id) on delete set null,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint reward_events_membership_matches_context
    foreign key (merchant_id, customer_id, membership_id)
    references public.customer_memberships(merchant_id, customer_id, id)
    on delete cascade
    deferrable initially immediate
);

create table public.staff_pin_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  membership_id uuid references public.customer_memberships(id) on delete cascade,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.fraud_flags (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  membership_id uuid references public.customer_memberships(id) on delete set null,
  signal text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rate_limit_buckets (
  bucket_key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.consent_records (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  consent_status text not null check (consent_status in ('opted_in', 'opted_out')),
  source text not null,
  policy_version text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.billing_customers (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null unique references public.merchants(id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  plan text not null default 'growth' check (plan = 'growth'),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'cancelled', 'suspended')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_type text not null check (actor_type in ('merchant', 'staff', 'admin', 'system')),
  actor_id text,
  merchant_id uuid references public.merchants(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  target_table text,
  target_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.product_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_name text not null,
  merchant_id uuid references public.merchants(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  membership_id uuid references public.customer_memberships(id) on delete set null,
  qr_code_id uuid references public.qr_codes(id) on delete set null,
  actor_type text not null default 'system'
    check (actor_type in ('merchant', 'staff', 'customer', 'admin', 'system')),
  actor_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index merchant_locations_one_primary_per_merchant_idx
  on public.merchant_locations (merchant_id)
  where is_primary;
create unique index loyalty_cards_one_active_per_location_idx
  on public.loyalty_cards (merchant_id, location_id)
  where is_active;

create index internal_admins_active_idx on public.internal_admins (user_id) where is_active;
create index merchants_owner_user_id_idx on public.merchants (owner_user_id);
create index merchant_locations_merchant_id_idx on public.merchant_locations (merchant_id);
create index staff_users_merchant_location_idx on public.staff_users (merchant_id, location_id) where is_active;
create index staff_users_auth_user_id_idx on public.staff_users (auth_user_id) where auth_user_id is not null;
create index loyalty_cards_merchant_location_idx on public.loyalty_cards (merchant_id, location_id);
create index qr_codes_merchant_location_idx on public.qr_codes (merchant_id, location_id);
create index qr_codes_loyalty_card_id_idx on public.qr_codes (loyalty_card_id);
create index customers_auth_user_id_idx on public.customers (auth_user_id);
create index customer_memberships_customer_id_idx on public.customer_memberships (customer_id);
create index customer_memberships_merchant_id_idx on public.customer_memberships (merchant_id);
create index stamp_events_merchant_created_at_idx on public.stamp_events (merchant_id, created_at desc);
create index stamp_events_customer_created_at_idx on public.stamp_events (customer_id, created_at desc);
create index stamp_events_membership_id_idx on public.stamp_events (membership_id);
create index stamp_events_loyalty_card_id_idx on public.stamp_events (loyalty_card_id);
create index stamp_events_location_id_idx on public.stamp_events (location_id);
create index stamp_events_approved_by_staff_id_idx on public.stamp_events (approved_by_staff_id);
create index reward_events_merchant_created_at_idx on public.reward_events (merchant_id, created_at desc);
create index reward_events_customer_created_at_idx on public.reward_events (customer_id, created_at desc);
create index reward_events_membership_id_idx on public.reward_events (membership_id);
create index reward_events_loyalty_card_id_idx on public.reward_events (loyalty_card_id);
create index reward_events_redeemed_by_staff_id_idx on public.reward_events (redeemed_by_staff_id);
create index staff_pin_attempts_failed_recent_idx
  on public.staff_pin_attempts (merchant_id, membership_id, created_at desc)
  where not success;
create index fraud_flags_merchant_status_created_at_idx
  on public.fraud_flags (merchant_id, status, created_at desc);
create index fraud_flags_signal_created_at_idx
  on public.fraud_flags (signal, created_at desc);
create index rate_limit_buckets_reset_at_idx on public.rate_limit_buckets (reset_at);
create index consent_records_customer_created_at_idx on public.consent_records (customer_id, created_at desc);
create index consent_records_merchant_created_at_idx on public.consent_records (merchant_id, created_at desc);
create index billing_customers_merchant_id_idx on public.billing_customers (merchant_id);
create index audit_logs_merchant_created_at_idx on public.audit_logs (merchant_id, created_at desc);
create index audit_logs_customer_created_at_idx on public.audit_logs (customer_id, created_at desc);
create index product_events_merchant_created_at_idx on public.product_events (merchant_id, created_at desc);
create index product_events_customer_created_at_idx on public.product_events (customer_id, created_at desc);
create index product_events_name_created_at_idx on public.product_events (event_name, created_at desc);
create index product_events_membership_id_idx on public.product_events (membership_id);
create index product_events_qr_code_id_idx on public.product_events (qr_code_id);

create trigger internal_admins_set_updated_at
  before update on public.internal_admins
  for each row execute function public.set_updated_at();
create trigger merchants_set_updated_at
  before update on public.merchants
  for each row execute function public.set_updated_at();
create trigger merchant_locations_set_updated_at
  before update on public.merchant_locations
  for each row execute function public.set_updated_at();
create trigger staff_users_set_updated_at
  before update on public.staff_users
  for each row execute function public.set_updated_at();
create trigger loyalty_cards_set_updated_at
  before update on public.loyalty_cards
  for each row execute function public.set_updated_at();
create trigger qr_codes_set_updated_at
  before update on public.qr_codes
  for each row execute function public.set_updated_at();
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();
create trigger customer_memberships_set_updated_at
  before update on public.customer_memberships
  for each row execute function public.set_updated_at();
create trigger reward_events_set_updated_at
  before update on public.reward_events
  for each row execute function public.set_updated_at();
create trigger billing_customers_set_updated_at
  before update on public.billing_customers
  for each row execute function public.set_updated_at();
create trigger fraud_flags_set_updated_at
  before update on public.fraud_flags
  for each row execute function public.set_updated_at();
create trigger rate_limit_buckets_set_updated_at
  before update on public.rate_limit_buckets
  for each row execute function public.set_updated_at();

create or replace function public.enforce_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_ms integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket_record record;
  current_time timestamptz := clock_timestamp();
  next_reset timestamptz := clock_timestamp() + ((p_window_ms::text || ' milliseconds')::interval);
begin
  if length(trim(coalesce(p_bucket_key, ''))) < 16 then
    raise exception 'Rate limit bucket key is required';
  end if;

  if p_limit < 1 or p_window_ms < 1000 then
    raise exception 'Invalid rate limit configuration';
  end if;

  select rate_limit_buckets.count, rate_limit_buckets.reset_at
  into bucket_record
  from public.rate_limit_buckets
  where rate_limit_buckets.bucket_key = p_bucket_key
  for update;

  if not found then
    insert into public.rate_limit_buckets (bucket_key, count, reset_at)
    values (p_bucket_key, 1, next_reset);
    return;
  end if;

  if bucket_record.reset_at <= current_time then
    update public.rate_limit_buckets
    set count = 1,
        reset_at = next_reset
    where bucket_key = p_bucket_key;
    return;
  end if;

  if bucket_record.count >= p_limit then
    raise exception 'Rate limit exceeded';
  end if;

  update public.rate_limit_buckets
  set count = count + 1
  where bucket_key = p_bucket_key;
end;
$$;

create or replace function public.is_internal_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.internal_admins
    where user_id = (select auth.uid())
      and is_active
  );
$$;

create or replace function public.is_merchant_owner(target_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.merchants
    where id = target_merchant_id
      and owner_user_id = (select auth.uid())
  );
$$;

create or replace function public.is_customer_owner(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.customers
    where id = target_customer_id
      and auth_user_id = (select auth.uid())
  );
$$;

create or replace function public.is_staff_for_merchant(
  target_merchant_id uuid,
  target_location_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.staff_users
    where merchant_id = target_merchant_id
      and (target_location_id is null or location_id = target_location_id)
      and auth_user_id = (select auth.uid())
      and is_active
  );
$$;

create or replace function public.customer_has_membership(target_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.customer_memberships memberships
    join public.customers customers on customers.id = memberships.customer_id
    where memberships.merchant_id = target_merchant_id
      and customers.auth_user_id = (select auth.uid())
  );
$$;

create or replace function public.merchant_can_access_customer(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.customer_memberships memberships
    join public.merchants merchants on merchants.id = memberships.merchant_id
    where memberships.customer_id = target_customer_id
      and merchants.owner_user_id = (select auth.uid())
  );
$$;

create or replace function public.create_merchant_onboarding(
  p_owner_user_id uuid,
  p_email text,
  p_business_name text,
  p_business_slug text,
  p_business_type text,
  p_phone text,
  p_location_name text
)
returns table (merchant_id uuid, location_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  existing_merchant_id uuid;
  existing_location_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if p_owner_user_id <> (select auth.uid()) then
    raise insufficient_privilege using message = 'Owner user mismatch';
  end if;

  select merchants.id
  into existing_merchant_id
  from public.merchants
  where merchants.owner_user_id = p_owner_user_id
  limit 1;

  if existing_merchant_id is not null then
    select merchant_locations.id
    into existing_location_id
    from public.merchant_locations
    where merchant_locations.merchant_id = existing_merchant_id
    order by merchant_locations.created_at asc
    limit 1;

    if existing_location_id is null then
      insert into public.merchant_locations (
        merchant_id,
        name,
        timezone,
        is_primary
      )
      values (
        existing_merchant_id,
        p_location_name,
        'Europe/London',
        true
      )
      returning id into existing_location_id;
    end if;

    merchant_id := existing_merchant_id;
    location_id := existing_location_id;
    return next;
    return;
  end if;

  insert into public.merchants (
    owner_user_id,
    business_name,
    business_slug,
    business_type,
    email,
    phone,
    status
  )
  values (
    p_owner_user_id,
    p_business_name,
    p_business_slug,
    p_business_type,
    p_email,
    nullif(p_phone, ''),
    'trial'
  )
  returning id into merchant_id;

  insert into public.merchant_locations (
    merchant_id,
    name,
    timezone,
    is_primary
  )
  values (
    merchant_id,
    p_location_name,
    'Europe/London',
    true
  )
  returning id into location_id;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'merchant_signed_up',
    merchant_id,
    'merchant',
    p_owner_user_id::text,
    jsonb_build_object('source', 'onboarding')
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    p_owner_user_id::text,
    merchant_id,
    'merchants',
    merchant_id,
    'merchant_onboarded',
    jsonb_build_object('location_id', location_id)
  );

  return next;
end;
$$;

create or replace function public.save_loyalty_card(
  p_merchant_id uuid,
  p_card_id uuid,
  p_card_name text,
  p_stamps_required integer,
  p_reward_name text,
  p_reward_terms text,
  p_min_spend_pence integer,
  p_is_active boolean
)
returns table (loyalty_card_id uuid, saved_action text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
  existing_card_id uuid;
  existing_active_card_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.merchants
    where merchants.id = p_merchant_id
      and merchants.owner_user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select merchant_locations.id
  into v_location_id
  from public.merchant_locations
  where merchant_locations.merchant_id = p_merchant_id
  order by merchant_locations.is_primary desc, merchant_locations.created_at asc
  limit 1;

  if v_location_id is null then
    raise exception 'Merchant location is required before creating a loyalty card';
  end if;

  if p_card_id is not null then
    select loyalty_cards.id
    into existing_card_id
    from public.loyalty_cards
    where loyalty_cards.id = p_card_id
      and loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id;

    if existing_card_id is null then
      raise insufficient_privilege using message = 'Loyalty card not found for merchant';
    end if;
  else
    select loyalty_cards.id
    into existing_card_id
    from public.loyalty_cards
    where loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id
    order by loyalty_cards.is_active desc, loyalty_cards.created_at asc
    limit 1;
  end if;

  if p_is_active then
    select loyalty_cards.id
    into existing_active_card_id
    from public.loyalty_cards
    where loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id
      and loyalty_cards.is_active
      and (existing_card_id is null or loyalty_cards.id <> existing_card_id)
    limit 1;

    if existing_active_card_id is not null then
      raise exception 'Only one active loyalty card is allowed for this location';
    end if;
  end if;

  if existing_card_id is null then
    insert into public.loyalty_cards (
      merchant_id,
      location_id,
      card_name,
      stamps_required,
      reward_name,
      reward_terms,
      min_spend_pence,
      is_active
    )
    values (
      p_merchant_id,
      v_location_id,
      p_card_name,
      p_stamps_required,
      p_reward_name,
      p_reward_terms,
      p_min_spend_pence,
      p_is_active
    )
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_created';
  else
    update public.loyalty_cards
    set
      card_name = p_card_name,
      stamps_required = p_stamps_required,
      reward_name = p_reward_name,
      reward_terms = p_reward_terms,
      min_spend_pence = p_min_spend_pence,
      is_active = p_is_active
    where loyalty_cards.id = existing_card_id
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_updated';
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    saved_action,
    p_merchant_id,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object('loyalty_card_id', loyalty_card_id, 'is_active', p_is_active)
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'loyalty_cards',
    loyalty_card_id,
    saved_action,
    jsonb_build_object('stamps_required', p_stamps_required)
  );

  return next;
end;
$$;

create or replace function public.get_merchant_staff_pin_status(
  p_merchant_id uuid
)
returns table (
  configured boolean,
  display_name text,
  updated_at timestamptz,
  reveal_available boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
  v_staff_record record;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select merchant_locations.id
  into v_location_id
  from public.merchant_locations
  where merchant_locations.merchant_id = p_merchant_id
  order by merchant_locations.is_primary desc, merchant_locations.created_at asc
  limit 1;

  if v_location_id is null then
    configured := false;
    display_name := null;
    updated_at := null;
    reveal_available := false;
    return next;
    return;
  end if;

  select staff_users.display_name, staff_users.updated_at, staff_users.pin_ciphertext
  into v_staff_record
  from public.staff_users
  where staff_users.merchant_id = p_merchant_id
    and staff_users.location_id = v_location_id
    and staff_users.is_active
  order by staff_users.updated_at desc
  limit 1;

  configured := v_staff_record.display_name is not null;
  display_name := v_staff_record.display_name;
  updated_at := v_staff_record.updated_at;
  reveal_available := v_staff_record.pin_ciphertext is not null;
  return next;
end;
$$;

create or replace function public.get_merchant_staff_pin_ciphertext(
  p_merchant_id uuid
)
returns table (
  configured boolean,
  staff_user_id uuid,
  location_id uuid,
  pin_ciphertext text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
  v_staff_record record;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select merchant_locations.id
  into v_location_id
  from public.merchant_locations
  where merchant_locations.merchant_id = p_merchant_id
  order by merchant_locations.is_primary desc, merchant_locations.created_at asc
  limit 1;

  if v_location_id is null then
    configured := false;
    staff_user_id := null;
    location_id := null;
    pin_ciphertext := null;
    return next;
    return;
  end if;

  select staff_users.id, staff_users.pin_ciphertext
  into v_staff_record
  from public.staff_users
  where staff_users.merchant_id = p_merchant_id
    and staff_users.location_id = v_location_id
    and staff_users.is_active
  order by staff_users.updated_at desc
  limit 1;

  configured := v_staff_record.id is not null;
  staff_user_id := v_staff_record.id;
  location_id := v_location_id;
  pin_ciphertext := v_staff_record.pin_ciphertext;
  return next;
end;
$$;

create or replace function public.upsert_merchant_staff_pin(
  p_merchant_id uuid,
  p_pin text,
  p_display_name text default 'Counter staff',
  p_pin_ciphertext text default null
)
returns table (configured boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_location_id uuid;
  v_staff_id uuid;
  v_action text;
  v_display_name text := coalesce(nullif(trim(p_display_name), ''), 'Counter staff');
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  if p_pin is null or p_pin !~ '^\d{4,12}$' then
    raise exception 'PIN must be 4 to 12 digits';
  end if;

  select merchant_locations.id
  into v_location_id
  from public.merchant_locations
  where merchant_locations.merchant_id = p_merchant_id
  order by merchant_locations.is_primary desc, merchant_locations.created_at asc
  limit 1;

  if v_location_id is null then
    raise exception 'Merchant location is required before setting a staff PIN';
  end if;

  select staff_users.id
  into v_staff_id
  from public.staff_users
  where staff_users.merchant_id = p_merchant_id
    and staff_users.location_id = v_location_id
    and staff_users.is_active
  order by staff_users.updated_at desc
  limit 1;

  if v_staff_id is null then
    insert into public.staff_users (
      merchant_id,
      location_id,
      auth_user_id,
      display_name,
      role,
      pin_hash,
      pin_ciphertext,
      is_active
    )
    values (
      p_merchant_id,
      v_location_id,
      null,
      v_display_name,
      'staff',
      extensions.crypt(p_pin, extensions.gen_salt('bf')),
      p_pin_ciphertext,
      true
    )
    returning id, staff_users.updated_at into v_staff_id, updated_at;

    v_action := 'staff_pin_set';
  else
    update public.staff_users
    set
      display_name = v_display_name,
      pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
      pin_ciphertext = p_pin_ciphertext,
      is_active = true
    where staff_users.id = v_staff_id
    returning staff_users.updated_at into updated_at;

    v_action := 'staff_pin_changed';
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    v_action,
    p_merchant_id,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object('staff_user_id', v_staff_id, 'location_id', v_location_id)
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'staff_users',
    v_staff_id,
    v_action,
    jsonb_build_object('location_id', v_location_id)
  );

  configured := true;
  return next;
end;
$$;

create or replace function public.create_or_get_join_qr(
  p_merchant_id uuid,
  p_loyalty_card_id uuid
)
returns table (qr_code_uuid uuid, qr_public_id text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_location_id uuid;
  generated_qr_id text;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select loyalty_cards.location_id
  into v_location_id
  from public.loyalty_cards
  join public.merchants on merchants.id = loyalty_cards.merchant_id
  where loyalty_cards.id = p_loyalty_card_id
    and loyalty_cards.merchant_id = p_merchant_id
    and loyalty_cards.is_active
    and merchants.owner_user_id = (select auth.uid());

  if v_location_id is null then
    raise insufficient_privilege using message = 'An active loyalty card owned by this merchant is required';
  end if;

  select qr_codes.id, qr_codes.qr_id
  into qr_code_uuid, qr_public_id
  from public.qr_codes
  where qr_codes.merchant_id = p_merchant_id
    and qr_codes.location_id = v_location_id
    and qr_codes.loyalty_card_id = p_loyalty_card_id
    and qr_codes.destination_type = 'join'
  order by qr_codes.is_active desc, qr_codes.created_at asc
  limit 1;

  if qr_code_uuid is not null then
    return next;
    return;
  end if;

  loop
    generated_qr_id := lower(
      replace(
        replace(
          rtrim(encode(extensions.gen_random_bytes(9), 'base64'), '='),
          '+',
          '-'
        ),
        '/',
        '_'
      )
    );

    begin
      insert into public.qr_codes (
        qr_id,
        merchant_id,
        location_id,
        loyalty_card_id,
        destination_type,
        is_active
      )
      values (
        generated_qr_id,
        p_merchant_id,
        v_location_id,
        p_loyalty_card_id,
        'join',
        true
      )
      returning id, qr_id into qr_code_uuid, qr_public_id;

      exit;
    exception
      when unique_violation then
        qr_code_uuid := null;
        qr_public_id := null;
    end;
  end loop;

  insert into public.product_events (
    event_name,
    merchant_id,
    qr_code_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'qr_created',
    p_merchant_id,
    qr_code_uuid,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object('destination_type', 'join')
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'qr_codes',
    qr_code_uuid,
    'qr_created',
    jsonb_build_object('qr_id', qr_public_id)
  );

  return next;
end;
$$;

create or replace function public.set_qr_active(
  p_merchant_id uuid,
  p_qr_code_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  update public.qr_codes
  set is_active = p_is_active
  where qr_codes.id = p_qr_code_id
    and qr_codes.merchant_id = p_merchant_id
    and exists (
      select 1
      from public.merchants
      where merchants.id = p_merchant_id
        and merchants.owner_user_id = (select auth.uid())
    );

  if not found then
    raise insufficient_privilege using message = 'QR code not found for merchant';
  end if;

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'qr_codes',
    p_qr_code_id,
    case when p_is_active then 'qr_enabled' else 'qr_disabled' end,
    jsonb_build_object('is_active', p_is_active)
  );
end;
$$;

create or replace function public.record_qr_download(
  p_merchant_id uuid,
  p_qr_code_id uuid,
  p_asset_type text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if p_asset_type not in ('poster_pdf', 'till_card_png', 'sticker_png') then
    raise exception 'Unsupported QR asset type';
  end if;

  if not exists (
    select 1
    from public.qr_codes
    join public.merchants on merchants.id = qr_codes.merchant_id
    where qr_codes.id = p_qr_code_id
      and qr_codes.merchant_id = p_merchant_id
      and merchants.owner_user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'QR code not found for merchant';
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    qr_code_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'qr_downloaded',
    p_merchant_id,
    p_qr_code_id,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object('asset_type', p_asset_type)
  );
end;
$$;

create or replace function public.join_customer_membership(
  p_merchant_slug text,
  p_qr_id text,
  p_marketing_opt_in boolean,
  p_policy_version text
)
returns table (membership_id uuid, created_membership boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_customer_id uuid;
  v_merchant_id uuid;
  v_loyalty_card_id uuid;
  v_qr_code_uuid uuid;
  customer_email text := nullif((select auth.jwt() ->> 'email'), '');
  customer_phone text := nullif((select auth.jwt() ->> 'phone'), '');
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if p_qr_id is not null and p_qr_id <> '' then
    select
      qr_codes.id,
      qr_codes.merchant_id,
      qr_codes.loyalty_card_id
    into
      v_qr_code_uuid,
      v_merchant_id,
      v_loyalty_card_id
    from public.qr_codes
    join public.merchants on merchants.id = qr_codes.merchant_id
    join public.loyalty_cards on loyalty_cards.id = qr_codes.loyalty_card_id
    where qr_codes.qr_id = p_qr_id
      and qr_codes.destination_type = 'join'
      and qr_codes.is_active
      and loyalty_cards.is_active
      and merchants.business_slug = p_merchant_slug;
  else
    select merchants.id, loyalty_cards.id
    into v_merchant_id, v_loyalty_card_id
    from public.merchants
    join public.loyalty_cards on loyalty_cards.merchant_id = merchants.id
    where merchants.business_slug = p_merchant_slug
      and loyalty_cards.is_active
    order by loyalty_cards.created_at asc
    limit 1;
  end if;

  if v_merchant_id is null or v_loyalty_card_id is null then
    raise exception 'This loyalty card is unavailable';
  end if;

  insert into public.customers (
    auth_user_id,
    email,
    phone
  )
  values (
    current_user_id,
    customer_email,
    customer_phone
  )
  on conflict (auth_user_id) do update
  set
    email = coalesce(excluded.email, customers.email),
    phone = coalesce(excluded.phone, customers.phone)
  returning id into v_customer_id;

  insert into public.customer_memberships (
    merchant_id,
    customer_id
  )
  values (
    v_merchant_id,
    v_customer_id
  )
  on conflict (merchant_id, customer_id) do nothing
  returning id into membership_id;

  created_membership := membership_id is not null;

  if membership_id is null then
    select customer_memberships.id
    into membership_id
    from public.customer_memberships
    where customer_memberships.merchant_id = v_merchant_id
      and customer_memberships.customer_id = v_customer_id;
  end if;

  if p_marketing_opt_in then
    insert into public.consent_records (
      merchant_id,
      customer_id,
      channel,
      consent_status,
      source,
      policy_version,
      metadata
    )
    values (
      v_merchant_id,
      v_customer_id,
      case when customer_email is not null then 'email' else 'sms' end,
      'opted_in',
      'customer_join',
      p_policy_version,
      jsonb_build_object('qr_code_id', v_qr_code_uuid)
    );
  end if;

  if created_membership then
    insert into public.product_events (
      event_name,
      merchant_id,
      customer_id,
      membership_id,
      qr_code_id,
      actor_type,
      actor_id,
      metadata
    )
    values (
      'customer_joined',
      v_merchant_id,
      v_customer_id,
      membership_id,
      v_qr_code_uuid,
      'customer',
      current_user_id::text,
      jsonb_build_object('marketing_opt_in', p_marketing_opt_in)
    );
  end if;

  return next;
end;
$$;

create or replace function public.issue_stamp_with_staff_pin(
  p_membership_id uuid,
  p_pin text
)
returns table (new_stamp_count integer, reward_unlocked boolean)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  membership_record record;
  card_record record;
  staff_record record;
  billing_status text;
  failed_attempt_count integer;
  recent_stamp_count integer;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select
    memberships.id,
    memberships.merchant_id,
    memberships.customer_id,
    memberships.current_stamp_count,
    customers.auth_user_id,
    merchants.status as merchant_status
  into membership_record
  from public.customer_memberships memberships
  join public.customers customers on customers.id = memberships.customer_id
  join public.merchants merchants on merchants.id = memberships.merchant_id
  where memberships.id = p_membership_id;

  if membership_record.id is null then
    raise insufficient_privilege using message = 'Membership not found';
  end if;

  if membership_record.auth_user_id <> (select auth.uid()) then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  if membership_record.merchant_status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = membership_record.merchant_id;

  if billing_status in ('cancelled', 'suspended') then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  select
    loyalty_cards.id,
    loyalty_cards.location_id,
    loyalty_cards.stamps_required
  into card_record
  from public.loyalty_cards
  where loyalty_cards.merchant_id = membership_record.merchant_id
    and loyalty_cards.is_active
  order by loyalty_cards.created_at asc
  limit 1;

  if card_record.id is null then
    raise exception 'This loyalty card is not active';
  end if;

  if membership_record.current_stamp_count >= card_record.stamps_required then
    raise exception 'A reward is already ready to redeem';
  end if;

  if exists (
    select 1
    from public.stamp_events
    where stamp_events.membership_id = p_membership_id
      and stamp_events.event_type = 'earned'
      and stamp_events.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Please wait before claiming another stamp';
  end if;

  select count(*)
  into failed_attempt_count
  from public.staff_pin_attempts
  where staff_pin_attempts.merchant_id = membership_record.merchant_id
    and staff_pin_attempts.membership_id = p_membership_id
    and not staff_pin_attempts.success
    and staff_pin_attempts.created_at > now() - interval '10 minutes';

  if failed_attempt_count >= 3 then
    raise exception 'Too many incorrect PIN attempts. Try again later';
  end if;

  select staff_users.id
  into staff_record
  from public.staff_users
  where staff_users.merchant_id = membership_record.merchant_id
    and staff_users.is_active
    and staff_users.pin_hash = extensions.crypt(p_pin, staff_users.pin_hash)
  limit 1;

  if staff_record.id is null then
    insert into public.staff_pin_attempts (
      merchant_id,
      membership_id,
      success
    )
    values (
      membership_record.merchant_id,
      p_membership_id,
      false
    );

    raise insufficient_privilege using message = 'Staff PIN was not accepted';
  end if;

  insert into public.staff_pin_attempts (
    merchant_id,
    membership_id,
    success
  )
  values (
    membership_record.merchant_id,
    p_membership_id,
    true
  );

  insert into public.stamp_events (
    merchant_id,
    customer_id,
    membership_id,
    loyalty_card_id,
    location_id,
    event_type,
    stamps_delta,
    approved_by_staff_id
  )
  values (
    membership_record.merchant_id,
    membership_record.customer_id,
    p_membership_id,
    card_record.id,
    card_record.location_id,
    'earned',
    1,
    staff_record.id
  );

  update public.customer_memberships
  set
    current_stamp_count = current_stamp_count + 1,
    total_stamps_earned = total_stamps_earned + 1,
    last_visit_at = now()
  where customer_memberships.id = p_membership_id
  returning current_stamp_count into new_stamp_count;

  reward_unlocked := new_stamp_count >= card_record.stamps_required;

  if reward_unlocked and not exists (
    select 1
    from public.reward_events
    where reward_events.membership_id = p_membership_id
      and reward_events.loyalty_card_id = card_record.id
      and reward_events.status = 'unlocked'
  ) then
    insert into public.reward_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      status
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      card_record.id,
      'unlocked'
    );

    insert into public.product_events (
      event_name,
      merchant_id,
      customer_id,
      membership_id,
      actor_type,
      actor_id,
      metadata
    )
    values (
      'reward_unlocked',
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      'system',
      null,
      jsonb_build_object('loyalty_card_id', card_record.id)
    );
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    customer_id,
    membership_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'stamp_issued',
    membership_record.merchant_id,
    membership_record.customer_id,
    p_membership_id,
    'staff',
    staff_record.id::text,
    jsonb_build_object('new_stamp_count', new_stamp_count)
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'staff',
    staff_record.id::text,
    membership_record.merchant_id,
    membership_record.customer_id,
    'customer_memberships',
    p_membership_id,
    'stamp_issued',
    jsonb_build_object('new_stamp_count', new_stamp_count)
  );

  select count(*)
  into recent_stamp_count
  from public.stamp_events
  where stamp_events.merchant_id = membership_record.merchant_id
    and stamp_events.event_type = 'earned'
    and stamp_events.created_at > now() - interval '15 minutes';

  if recent_stamp_count >= 20 and not exists (
    select 1
    from public.fraud_flags
    where fraud_flags.merchant_id = membership_record.merchant_id
      and fraud_flags.signal = 'high_stamp_velocity'
      and fraud_flags.status = 'open'
      and fraud_flags.created_at > now() - interval '15 minutes'
  ) then
    insert into public.fraud_flags (
      merchant_id,
      customer_id,
      membership_id,
      signal,
      severity,
      metadata
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      'high_stamp_velocity',
      'medium',
      jsonb_build_object(
        'threshold', 20,
        'window_minutes', 15,
        'observed_stamp_count', recent_stamp_count
      )
    );

    insert into public.audit_logs (
      actor_type,
      actor_id,
      merchant_id,
      customer_id,
      target_table,
      target_id,
      action,
      metadata
    )
    values (
      'system',
      null,
      membership_record.merchant_id,
      membership_record.customer_id,
      'fraud_flags',
      p_membership_id,
      'fraud_flag_created',
      jsonb_build_object(
        'signal', 'high_stamp_velocity',
        'observed_stamp_count', recent_stamp_count
      )
    );
  end if;

  return next;
end;
$$;

create or replace function public.redeem_reward_with_staff_pin(
  p_reward_id uuid,
  p_pin text
)
returns table (membership_id uuid, new_stamp_count integer)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  reward_record record;
  staff_record record;
  billing_status text;
  failed_attempt_count integer;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select
    reward_events.id,
    reward_events.status,
    reward_events.merchant_id,
    reward_events.customer_id,
    reward_events.membership_id,
    reward_events.loyalty_card_id,
    customers.auth_user_id,
    merchants.status as merchant_status,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    customer_memberships.current_stamp_count
  into reward_record
  from public.reward_events
  join public.customer_memberships customer_memberships
    on customer_memberships.id = reward_events.membership_id
  join public.customers customers on customers.id = reward_events.customer_id
  join public.merchants merchants on merchants.id = reward_events.merchant_id
  join public.loyalty_cards loyalty_cards on loyalty_cards.id = reward_events.loyalty_card_id
  where reward_events.id = p_reward_id;

  if reward_record.id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;

  membership_id := reward_record.membership_id;

  if reward_record.auth_user_id <> (select auth.uid()) then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  if reward_record.status = 'redeemed' then
    raise exception 'Reward already redeemed';
  end if;

  if reward_record.status <> 'unlocked' then
    raise exception 'Reward is not redeemable';
  end if;

  if not reward_record.card_is_active then
    raise exception 'This loyalty card is not active';
  end if;

  if reward_record.current_stamp_count < reward_record.stamps_required then
    raise exception 'Reward is not ready to redeem';
  end if;

  if reward_record.merchant_status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = reward_record.merchant_id;

  if billing_status = 'suspended' then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  select count(*)
  into failed_attempt_count
  from public.staff_pin_attempts
  where staff_pin_attempts.merchant_id = reward_record.merchant_id
    and staff_pin_attempts.membership_id = reward_record.membership_id
    and not staff_pin_attempts.success
    and staff_pin_attempts.created_at > now() - interval '10 minutes';

  if failed_attempt_count >= 3 then
    insert into public.product_events (
      event_name,
      merchant_id,
      customer_id,
      membership_id,
      actor_type,
      actor_id,
      metadata
    )
    values (
      'reward_redemption_failed',
      reward_record.merchant_id,
      reward_record.customer_id,
      reward_record.membership_id,
      'customer',
      (select auth.uid())::text,
      jsonb_build_object('reward_id', p_reward_id, 'reason', 'pin_rate_limited')
    );

    insert into public.audit_logs (
      actor_type,
      actor_id,
      merchant_id,
      customer_id,
      target_table,
      target_id,
      action,
      metadata
    )
    values (
      'customer',
      (select auth.uid())::text,
      reward_record.merchant_id,
      reward_record.customer_id,
      'reward_events',
      p_reward_id,
      'reward_redemption_failed',
      jsonb_build_object('reason', 'pin_rate_limited')
    );

    raise exception 'Too many incorrect PIN attempts. Try again later';
  end if;

  select staff_users.id
  into staff_record
  from public.staff_users
  where staff_users.merchant_id = reward_record.merchant_id
    and staff_users.is_active
    and staff_users.pin_hash = extensions.crypt(p_pin, staff_users.pin_hash)
  limit 1;

  if staff_record.id is null then
    insert into public.staff_pin_attempts (
      merchant_id,
      membership_id,
      success
    )
    values (
      reward_record.merchant_id,
      reward_record.membership_id,
      false
    );

    insert into public.product_events (
      event_name,
      merchant_id,
      customer_id,
      membership_id,
      actor_type,
      actor_id,
      metadata
    )
    values (
      'reward_redemption_failed',
      reward_record.merchant_id,
      reward_record.customer_id,
      reward_record.membership_id,
      'customer',
      (select auth.uid())::text,
      jsonb_build_object('reward_id', p_reward_id, 'reason', 'invalid_pin')
    );

    insert into public.audit_logs (
      actor_type,
      actor_id,
      merchant_id,
      customer_id,
      target_table,
      target_id,
      action,
      metadata
    )
    values (
      'customer',
      (select auth.uid())::text,
      reward_record.merchant_id,
      reward_record.customer_id,
      'reward_events',
      p_reward_id,
      'reward_redemption_failed',
      jsonb_build_object('reason', 'invalid_pin')
    );

    raise insufficient_privilege using message = 'Staff PIN was not accepted';
  end if;

  insert into public.staff_pin_attempts (
    merchant_id,
    membership_id,
    success
  )
  values (
    reward_record.merchant_id,
    reward_record.membership_id,
    true
  );

  update public.reward_events
  set
    status = 'redeemed',
    redeemed_by_staff_id = staff_record.id,
    redeemed_at = now(),
    metadata = reward_events.metadata || jsonb_build_object('redeemed_by', 'staff_pin')
  where reward_events.id = p_reward_id
    and reward_events.status = 'unlocked';

  if not found then
    raise exception 'Reward already redeemed';
  end if;

  update public.customer_memberships
  set
    current_stamp_count = greatest(current_stamp_count - reward_record.stamps_required, 0),
    total_rewards_redeemed = total_rewards_redeemed + 1
  where customer_memberships.id = reward_record.membership_id
  returning current_stamp_count into new_stamp_count;

  insert into public.product_events (
    event_name,
    merchant_id,
    customer_id,
    membership_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'reward_redeemed',
    reward_record.merchant_id,
    reward_record.customer_id,
    reward_record.membership_id,
    'staff',
    staff_record.id::text,
    jsonb_build_object('reward_id', p_reward_id, 'new_stamp_count', new_stamp_count)
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'staff',
    staff_record.id::text,
    reward_record.merchant_id,
    reward_record.customer_id,
    'reward_events',
    p_reward_id,
    'reward_redeemed',
    jsonb_build_object('new_stamp_count', new_stamp_count)
  );

  return next;
end;
$$;

create or replace function public.admin_adjust_membership_stamps(
  p_membership_id uuid,
  p_delta integer,
  p_reason text
)
returns table (new_stamp_count integer)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  membership_record record;
  card_record record;
  admin_user_id uuid;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_delta = 0 then
    raise exception 'Adjustment delta cannot be zero';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'Adjustment reason is required';
  end if;

  select
    customer_memberships.id,
    customer_memberships.merchant_id,
    customer_memberships.customer_id
  into membership_record
  from public.customer_memberships
  where customer_memberships.id = p_membership_id;

  if membership_record.id is null then
    raise exception 'Membership not found';
  end if;

  select
    loyalty_cards.id,
    loyalty_cards.location_id
  into card_record
  from public.loyalty_cards
  where loyalty_cards.merchant_id = membership_record.merchant_id
  order by loyalty_cards.is_active desc, loyalty_cards.created_at asc
  limit 1;

  if card_record.id is null then
    raise exception 'No loyalty card exists for membership merchant';
  end if;

  insert into public.stamp_events (
    merchant_id,
    customer_id,
    membership_id,
    loyalty_card_id,
    location_id,
    event_type,
    stamps_delta,
    metadata
  )
  values (
    membership_record.merchant_id,
    membership_record.customer_id,
    p_membership_id,
    card_record.id,
    card_record.location_id,
    'manual_adjustment',
    p_delta,
    jsonb_build_object('reason', trim(p_reason), 'admin_user_id', admin_user_id)
  );

  update public.customer_memberships
  set
    current_stamp_count = greatest(current_stamp_count + p_delta, 0),
    total_stamps_earned = greatest(total_stamps_earned + p_delta, 0)
  where customer_memberships.id = p_membership_id
  returning current_stamp_count into new_stamp_count;

  insert into public.product_events (
    event_name,
    merchant_id,
    customer_id,
    membership_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'stamp_adjusted',
    membership_record.merchant_id,
    membership_record.customer_id,
    p_membership_id,
    'admin',
    admin_user_id::text,
    jsonb_build_object('delta', p_delta, 'new_stamp_count', new_stamp_count)
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'admin',
    admin_user_id::text,
    membership_record.merchant_id,
    membership_record.customer_id,
    'customer_memberships',
    p_membership_id,
    'stamp_adjusted',
    jsonb_build_object('delta', p_delta, 'reason', trim(p_reason))
  );

  return next;
end;
$$;

create or replace function public.admin_cancel_reward(
  p_reward_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  reward_record record;
  admin_user_id uuid;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'Cancellation reason is required';
  end if;

  select
    reward_events.id,
    reward_events.merchant_id,
    reward_events.customer_id,
    reward_events.membership_id,
    reward_events.status
  into reward_record
  from public.reward_events
  where reward_events.id = p_reward_id;

  if reward_record.id is null then
    raise exception 'Reward not found';
  end if;

  if reward_record.status = 'redeemed' then
    raise exception 'Redeemed rewards cannot be cancelled';
  end if;

  update public.reward_events
  set
    status = 'cancelled',
    cancelled_reason = trim(p_reason)
  where reward_events.id = p_reward_id
    and reward_events.status <> 'redeemed';

  insert into public.product_events (
    event_name,
    merchant_id,
    customer_id,
    membership_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'reward_cancelled',
    reward_record.merchant_id,
    reward_record.customer_id,
    reward_record.membership_id,
    'admin',
    admin_user_id::text,
    jsonb_build_object('reward_id', p_reward_id)
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'admin',
    admin_user_id::text,
    reward_record.merchant_id,
    reward_record.customer_id,
    'reward_events',
    p_reward_id,
    'reward_cancelled',
    jsonb_build_object('reason', trim(p_reason))
  );
end;
$$;

create or replace function public.admin_set_qr_active(
  p_qr_code_id uuid,
  p_is_active boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  qr_record record;
  admin_user_id uuid;
  action_name text;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'QR change reason is required';
  end if;

  select
    qr_codes.id,
    qr_codes.merchant_id
  into qr_record
  from public.qr_codes
  where qr_codes.id = p_qr_code_id;

  if qr_record.id is null then
    raise exception 'QR code not found';
  end if;

  update public.qr_codes
  set is_active = p_is_active
  where qr_codes.id = p_qr_code_id;

  action_name := case when p_is_active then 'qr_enabled' else 'qr_disabled' end;

  insert into public.product_events (
    event_name,
    merchant_id,
    qr_code_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    action_name,
    qr_record.merchant_id,
    p_qr_code_id,
    'admin',
    admin_user_id::text,
    jsonb_build_object('reason', trim(p_reason))
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'admin',
    admin_user_id::text,
    qr_record.merchant_id,
    'qr_codes',
    p_qr_code_id,
    action_name,
    jsonb_build_object('reason', trim(p_reason))
  );
end;
$$;

create or replace function public.admin_regenerate_qr_code(
  p_qr_code_id uuid,
  p_reason text
)
returns table (qr_code_id uuid, qr_id text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  qr_record record;
  admin_user_id uuid;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'QR regeneration reason is required';
  end if;

  select
    qr_codes.id,
    qr_codes.merchant_id,
    qr_codes.location_id,
    qr_codes.loyalty_card_id,
    qr_codes.destination_type
  into qr_record
  from public.qr_codes
  where qr_codes.id = p_qr_code_id;

  if qr_record.id is null then
    raise exception 'QR code not found';
  end if;

  update public.qr_codes
  set is_active = false
  where qr_codes.id = p_qr_code_id;

  insert into public.qr_codes (
    qr_id,
    merchant_id,
    location_id,
    loyalty_card_id,
    destination_type,
    is_active
  )
  values (
    lower(encode(extensions.gen_random_bytes(9), 'hex')),
    qr_record.merchant_id,
    qr_record.location_id,
    qr_record.loyalty_card_id,
    qr_record.destination_type,
    true
  )
  returning id, qr_codes.qr_id into qr_code_id, qr_id;

  insert into public.product_events (
    event_name,
    merchant_id,
    qr_code_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'qr_regenerated',
    qr_record.merchant_id,
    qr_code_id,
    'admin',
    admin_user_id::text,
    jsonb_build_object('old_qr_code_id', p_qr_code_id)
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'admin',
    admin_user_id::text,
    qr_record.merchant_id,
    'qr_codes',
    qr_code_id,
    'qr_regenerated',
    jsonb_build_object('old_qr_code_id', p_qr_code_id, 'reason', trim(p_reason))
  );

  return next;
end;
$$;

create or replace function public.admin_record_consent_opt_out(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_channel text,
  p_source text,
  p_policy_version text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_channel not in ('email', 'sms', 'whatsapp') then
    raise exception 'Unsupported consent channel';
  end if;

  if length(trim(coalesce(p_source, ''))) < 3 then
    raise exception 'Consent source is required';
  end if;

  if length(trim(coalesce(p_policy_version, ''))) < 4 then
    raise exception 'Policy version is required';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'Opt-out reason is required';
  end if;

  if not exists (
    select 1
    from public.customer_memberships
    where customer_memberships.customer_id = p_customer_id
      and customer_memberships.merchant_id = p_merchant_id
  ) then
    raise exception 'Customer membership context not found';
  end if;

  insert into public.consent_records (
    merchant_id,
    customer_id,
    channel,
    consent_status,
    source,
    policy_version,
    metadata
  )
  values (
    p_merchant_id,
    p_customer_id,
    p_channel,
    'opted_out',
    trim(p_source),
    trim(p_policy_version),
    jsonb_build_object('reason', trim(p_reason), 'admin_user_id', admin_user_id)
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'admin',
    admin_user_id::text,
    p_merchant_id,
    p_customer_id,
    'consent_records',
    p_customer_id,
    'consent_opt_out_recorded',
    jsonb_build_object(
      'channel', p_channel,
      'source', trim(p_source),
      'policy_version', trim(p_policy_version),
      'reason', trim(p_reason)
    )
  );
end;
$$;

create or replace function public.admin_log_data_request(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_request_type text,
  p_channel text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_request_type not in ('access', 'export', 'deletion', 'rectification', 'consent') then
    raise exception 'Unsupported data request type';
  end if;

  if p_channel not in ('email', 'phone', 'in_person', 'other') then
    raise exception 'Unsupported request channel';
  end if;

  if length(trim(coalesce(p_notes, ''))) < 4 then
    raise exception 'Data request notes are required';
  end if;

  if not exists (
    select 1
    from public.customer_memberships
    where customer_memberships.customer_id = p_customer_id
      and customer_memberships.merchant_id = p_merchant_id
  ) then
    raise exception 'Customer membership context not found';
  end if;

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'admin',
    admin_user_id::text,
    p_merchant_id,
    p_customer_id,
    'customers',
    p_customer_id,
    'data_request_logged',
    jsonb_build_object(
      'request_type', p_request_type,
      'channel', p_channel,
      'notes', trim(p_notes),
      'confirmation', 'manual_email_required'
    )
  );
end;
$$;

create or replace function public.admin_log_pilot_note(
  p_merchant_id uuid,
  p_note_type text,
  p_notes text,
  p_training_minutes integer default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
  audit_action text;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_note_type not in ('interview', 'cancellation_reason', 'support', 'payment_objection', 'staff_training_timed') then
    raise exception 'Unsupported pilot note type';
  end if;

  if length(trim(coalesce(p_notes, ''))) < 4 then
    raise exception 'Pilot note is required';
  end if;

  if p_note_type = 'staff_training_timed' and (
    p_training_minutes is null or p_training_minutes < 1 or p_training_minutes > 3
  ) then
    raise exception 'Staff training proof must be between 1 and 3 minutes';
  end if;

  if not exists (
    select 1
    from public.merchants
    where merchants.id = p_merchant_id
  ) then
    raise exception 'Merchant not found';
  end if;

  audit_action := case
    when p_note_type = 'cancellation_reason' then 'merchant_cancel_reason_recorded'
    when p_note_type = 'staff_training_timed' then 'staff_training_timed'
    else 'pilot_note_logged'
  end;

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'admin',
    admin_user_id::text,
    p_merchant_id,
    'merchants',
    p_merchant_id,
    audit_action,
    jsonb_build_object(
      'note_type', p_note_type,
      'notes', trim(p_notes),
      'training_minutes', p_training_minutes
    )
  );
end;
$$;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant execute on function public.enforce_rate_limit(text, integer, integer) to service_role;
grant execute on function public.is_internal_admin() to authenticated, service_role;
grant execute on function public.is_merchant_owner(uuid) to authenticated, service_role;
grant execute on function public.is_customer_owner(uuid) to authenticated, service_role;
grant execute on function public.is_staff_for_merchant(uuid, uuid) to authenticated, service_role;
grant execute on function public.customer_has_membership(uuid) to authenticated, service_role;
grant execute on function public.merchant_can_access_customer(uuid) to authenticated, service_role;
grant execute on function public.create_merchant_onboarding(uuid, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.save_loyalty_card(uuid, uuid, text, integer, text, text, integer, boolean) to authenticated, service_role;
grant execute on function public.get_merchant_staff_pin_status(uuid) to authenticated, service_role;
grant execute on function public.get_merchant_staff_pin_ciphertext(uuid) to authenticated, service_role;
grant execute on function public.upsert_merchant_staff_pin(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.create_or_get_join_qr(uuid, uuid) to authenticated, service_role;
grant execute on function public.set_qr_active(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.record_qr_download(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.join_customer_membership(text, text, boolean, text) to authenticated, service_role;
grant execute on function public.issue_stamp_with_staff_pin(uuid, text) to authenticated, service_role;
grant execute on function public.redeem_reward_with_staff_pin(uuid, text) to authenticated, service_role;
grant execute on function public.admin_adjust_membership_stamps(uuid, integer, text) to authenticated, service_role;
grant execute on function public.admin_cancel_reward(uuid, text) to authenticated, service_role;
grant execute on function public.admin_set_qr_active(uuid, boolean, text) to authenticated, service_role;
grant execute on function public.admin_regenerate_qr_code(uuid, text) to authenticated, service_role;
grant execute on function public.admin_record_consent_opt_out(uuid, uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.admin_log_data_request(uuid, uuid, text, text, text) to authenticated, service_role;
grant execute on function public.admin_log_pilot_note(uuid, text, text, integer) to authenticated, service_role;

alter table public.internal_admins enable row level security;
alter table public.merchants enable row level security;
alter table public.merchant_locations enable row level security;
alter table public.staff_users enable row level security;
alter table public.loyalty_cards enable row level security;
alter table public.qr_codes enable row level security;
alter table public.customers enable row level security;
alter table public.customer_memberships enable row level security;
alter table public.stamp_events enable row level security;
alter table public.reward_events enable row level security;
alter table public.staff_pin_attempts enable row level security;
alter table public.fraud_flags enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.consent_records enable row level security;
alter table public.billing_customers enable row level security;
alter table public.audit_logs enable row level security;
alter table public.product_events enable row level security;

alter table public.internal_admins force row level security;
alter table public.merchants force row level security;
alter table public.merchant_locations force row level security;
alter table public.staff_users force row level security;
alter table public.loyalty_cards force row level security;
alter table public.qr_codes force row level security;
alter table public.customers force row level security;
alter table public.customer_memberships force row level security;
alter table public.stamp_events force row level security;
alter table public.reward_events force row level security;
alter table public.staff_pin_attempts force row level security;
alter table public.fraud_flags force row level security;
alter table public.rate_limit_buckets force row level security;
alter table public.consent_records force row level security;
alter table public.billing_customers force row level security;
alter table public.audit_logs force row level security;
alter table public.product_events force row level security;

create policy internal_admins_select_self_or_admin
  on public.internal_admins for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_internal_admin()));

create policy merchants_select_owned_or_admin
  on public.merchants for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (select public.is_staff_for_merchant(id))
    or (select public.customer_has_membership(id))
    or (select public.is_internal_admin())
  );
create policy merchants_insert_owned_or_admin
  on public.merchants for insert to authenticated
  with check (owner_user_id = (select auth.uid()) or (select public.is_internal_admin()));
create policy merchants_update_owned_or_admin
  on public.merchants for update to authenticated
  using (owner_user_id = (select auth.uid()) or (select public.is_internal_admin()))
  with check (owner_user_id = (select auth.uid()) or (select public.is_internal_admin()));

create policy merchant_locations_select_scoped
  on public.merchant_locations for select to authenticated
  using (
    (select public.is_merchant_owner(merchant_id))
    or (select public.is_staff_for_merchant(merchant_id, id))
    or (select public.customer_has_membership(merchant_id))
    or (select public.is_internal_admin())
  );
create policy merchant_locations_insert_owner_or_admin
  on public.merchant_locations for insert to authenticated
  with check ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));
create policy merchant_locations_update_owner_or_admin
  on public.merchant_locations for update to authenticated
  using ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()))
  with check ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));

create policy staff_users_select_self_or_admin
  on public.staff_users for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select public.is_internal_admin()));
create policy staff_users_insert_owner_or_admin
  on public.staff_users for insert to authenticated
  with check ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));
create policy staff_users_update_owner_or_admin
  on public.staff_users for update to authenticated
  using ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()))
  with check ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));

create policy loyalty_cards_select_scoped
  on public.loyalty_cards for select to authenticated
  using (
    (select public.is_merchant_owner(merchant_id))
    or (select public.is_staff_for_merchant(merchant_id, location_id))
    or (select public.customer_has_membership(merchant_id))
    or (select public.is_internal_admin())
  );
create policy loyalty_cards_insert_owner_or_admin
  on public.loyalty_cards for insert to authenticated
  with check ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));
create policy loyalty_cards_update_owner_or_admin
  on public.loyalty_cards for update to authenticated
  using ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()))
  with check ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));

create policy qr_codes_select_owner_staff_admin
  on public.qr_codes for select to authenticated
  using (
    (select public.is_merchant_owner(merchant_id))
    or (select public.is_staff_for_merchant(merchant_id, location_id))
    or (select public.is_internal_admin())
  );
create policy qr_codes_insert_owner_or_admin
  on public.qr_codes for insert to authenticated
  with check ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));
create policy qr_codes_update_owner_or_admin
  on public.qr_codes for update to authenticated
  using ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()))
  with check ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));

create policy customers_select_scoped
  on public.customers for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or (select public.merchant_can_access_customer(id))
    or (select public.is_internal_admin())
  );
create policy customers_insert_self_or_admin
  on public.customers for insert to authenticated
  with check (auth_user_id = (select auth.uid()) or (select public.is_internal_admin()));
create policy customers_update_self_or_admin
  on public.customers for update to authenticated
  using (auth_user_id = (select auth.uid()) or (select public.is_internal_admin()))
  with check (auth_user_id = (select auth.uid()) or (select public.is_internal_admin()));

create policy customer_memberships_select_scoped
  on public.customer_memberships for select to authenticated
  using (
    (select public.is_customer_owner(customer_id))
    or (select public.is_merchant_owner(merchant_id))
    or (select public.is_staff_for_merchant(merchant_id))
    or (select public.is_internal_admin())
  );
create policy customer_memberships_insert_customer_or_admin
  on public.customer_memberships for insert to authenticated
  with check ((select public.is_customer_owner(customer_id)) or (select public.is_internal_admin()));
create policy customer_memberships_update_merchant_or_admin
  on public.customer_memberships for update to authenticated
  using ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()))
  with check ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));

create policy stamp_events_select_scoped
  on public.stamp_events for select to authenticated
  using (
    (select public.is_customer_owner(customer_id))
    or (select public.is_merchant_owner(merchant_id))
    or (select public.is_staff_for_merchant(merchant_id, location_id))
    or (select public.is_internal_admin())
  );
create policy stamp_events_insert_admin_only
  on public.stamp_events for insert to authenticated
  with check ((select public.is_internal_admin()));

create policy reward_events_select_scoped
  on public.reward_events for select to authenticated
  using (
    (select public.is_customer_owner(customer_id))
    or (select public.is_merchant_owner(merchant_id))
    or (select public.is_staff_for_merchant(merchant_id))
    or (select public.is_internal_admin())
  );
create policy reward_events_insert_admin_only
  on public.reward_events for insert to authenticated
  with check ((select public.is_internal_admin()));
create policy reward_events_update_admin_only
  on public.reward_events for update to authenticated
  using ((select public.is_internal_admin()))
  with check ((select public.is_internal_admin()));

create policy staff_pin_attempts_select_admin_only
  on public.staff_pin_attempts for select to authenticated
  using ((select public.is_internal_admin()));
create policy staff_pin_attempts_insert_admin_only
  on public.staff_pin_attempts for insert to authenticated
  with check ((select public.is_internal_admin()));

create policy fraud_flags_select_admin_only
  on public.fraud_flags for select to authenticated
  using ((select public.is_internal_admin()));
create policy fraud_flags_insert_admin_only
  on public.fraud_flags for insert to authenticated
  with check ((select public.is_internal_admin()));
create policy fraud_flags_update_admin_only
  on public.fraud_flags for update to authenticated
  using ((select public.is_internal_admin()))
  with check ((select public.is_internal_admin()));

create policy rate_limit_buckets_select_admin_only
  on public.rate_limit_buckets for select to authenticated
  using ((select public.is_internal_admin()));

create policy consent_records_select_scoped
  on public.consent_records for select to authenticated
  using (
    (select public.is_customer_owner(customer_id))
    or (select public.is_merchant_owner(merchant_id))
    or (select public.is_internal_admin())
  );
create policy consent_records_insert_customer_or_admin
  on public.consent_records for insert to authenticated
  with check ((select public.is_customer_owner(customer_id)) or (select public.is_internal_admin()));

create policy billing_customers_select_owner_or_admin
  on public.billing_customers for select to authenticated
  using ((select public.is_merchant_owner(merchant_id)) or (select public.is_internal_admin()));
create policy billing_customers_insert_admin_only
  on public.billing_customers for insert to authenticated
  with check ((select public.is_internal_admin()));
create policy billing_customers_update_admin_only
  on public.billing_customers for update to authenticated
  using ((select public.is_internal_admin()))
  with check ((select public.is_internal_admin()));

create policy audit_logs_select_scoped
  on public.audit_logs for select to authenticated
  using (
    (merchant_id is not null and (select public.is_merchant_owner(merchant_id)))
    or (merchant_id is not null and (select public.is_staff_for_merchant(merchant_id)))
    or (select public.is_internal_admin())
  );
create policy audit_logs_insert_admin_only
  on public.audit_logs for insert to authenticated
  with check ((select public.is_internal_admin()));

create policy product_events_select_scoped
  on public.product_events for select to authenticated
  using (
    (merchant_id is not null and (select public.is_merchant_owner(merchant_id)))
    or (customer_id is not null and (select public.is_customer_owner(customer_id)))
    or (select public.is_internal_admin())
  );
create policy product_events_insert_admin_only
  on public.product_events for insert to authenticated
  with check ((select public.is_internal_admin()));

notify pgrst, 'reload schema';
