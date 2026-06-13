-- Counter handshake (MS-06, MS-07, MS-08, MS-09)
--
-- the customer shows a short-lived single-use code, and a paired counter
-- station with a named staff session approves the stamp or redemption.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.stations (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  location_id uuid references public.merchant_locations(id) on delete cascade,
  station_name text not null,
  status text not null default 'unpaired'
    check (status in ('unpaired', 'active', 'revoked')),
  pairing_code text,
  pairing_expires_at timestamptz,
  device_credential_hash text,
  paired_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, id),
  constraint stations_location_matches_merchant
    foreign key (merchant_id, location_id)
    references public.merchant_locations(merchant_id, id)
    on delete cascade
    deferrable initially immediate
);

create unique index if not exists stations_active_pairing_code_idx
  on public.stations (pairing_code)
  where pairing_code is not null and status = 'unpaired';
create index if not exists stations_merchant_id_idx on public.stations (merchant_id);

drop trigger if exists stations_set_updated_at on public.stations;
create trigger stations_set_updated_at
  before update on public.stations
  for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staff_users_merchant_id_id_key'
      and conrelid = 'public.staff_users'::regclass
  ) then
    alter table public.staff_users
      add constraint staff_users_merchant_id_id_key unique (merchant_id, id);
  end if;
end $$;

create table if not exists public.staff_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete cascade,
  staff_user_id uuid not null references public.staff_users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint staff_sessions_station_matches_merchant
    foreign key (merchant_id, station_id)
    references public.stations(merchant_id, id)
    on delete cascade
    deferrable initially immediate,
  constraint staff_sessions_staff_matches_merchant
    foreign key (merchant_id, staff_user_id)
    references public.staff_users(merchant_id, id)
    on delete cascade
    deferrable initially immediate
);

create index if not exists staff_sessions_station_open_idx
  on public.staff_sessions (station_id)
  where ended_at is null;
create index if not exists staff_sessions_merchant_id_idx on public.staff_sessions (merchant_id);

create table if not exists public.station_pin_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete cascade,
  staff_user_id uuid references public.staff_users(id) on delete set null,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists station_pin_attempts_station_recent_idx
  on public.station_pin_attempts (station_id, created_at desc);

create table if not exists public.verification_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  membership_id uuid not null references public.customer_memberships(id) on delete cascade,
  kind text not null check (kind in ('stamp', 'redeem')),
  reward_event_id uuid references public.reward_events(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_station_id uuid references public.stations(id) on delete set null,
  consumed_by_session_id uuid references public.staff_sessions(id) on delete set null,
  cancelled_at timestamptz,
  result_stamp_event_id uuid,
  result_new_stamp_count integer,
  result_reward_unlocked boolean,
  result_reward_event_id uuid references public.reward_events(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint verification_tokens_membership_matches_context
    foreign key (merchant_id, customer_id, membership_id)
    references public.customer_memberships(merchant_id, customer_id, id)
    on delete cascade
    deferrable initially immediate,
  constraint verification_tokens_redeem_requires_reward
    check (kind <> 'redeem' or reward_event_id is not null)
);

create unique index if not exists verification_tokens_active_code_idx
  on public.verification_tokens (merchant_id, code)
  where consumed_at is null and cancelled_at is null;
create index if not exists verification_tokens_membership_idx
  on public.verification_tokens (membership_id, created_at desc);
create index if not exists verification_tokens_merchant_code_idx
  on public.verification_tokens (merchant_id, code, created_at desc);

-- Station/session attribution and the idempotency key on the ledger itself.
alter table public.stamp_events
  add column if not exists station_id uuid references public.stations(id) on delete set null,
  add column if not exists staff_session_id uuid references public.staff_sessions(id) on delete set null,
  add column if not exists verification_token_id uuid references public.verification_tokens(id) on delete set null,
  add column if not exists reverses_stamp_event_id uuid references public.stamp_events(id) on delete set null;

create unique index if not exists stamp_events_verification_token_idx
  on public.stamp_events (verification_token_id)
  where verification_token_id is not null and event_type = 'earned';
create unique index if not exists stamp_events_reversal_once_idx
  on public.stamp_events (reverses_stamp_event_id)
  where reverses_stamp_event_id is not null;

alter table public.reward_events
  add column if not exists redeemed_by_station_id uuid references public.stations(id) on delete set null,
  add column if not exists redeemed_verification_token_id uuid references public.verification_tokens(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.generate_verification_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  -- No 0/O/1/I/L/B/8 so codes survive being read out over a till.
  alphabet constant text := '23456789ACDEFGHJKMNPQRSTUVWXYZ';
  result text := '';
  i integer;
begin
  for i in 1..4 loop
    result := result || substr(
      alphabet,
      1 + floor(random() * length(alphabet))::integer,
      1
    );
  end loop;

  return result;
end;
$$;

create or replace function public.station_authenticate(
  p_station_id uuid,
  p_station_secret text
)
returns public.stations
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  station_record public.stations;
begin
  select *
  into station_record
  from public.stations
  where stations.id = p_station_id
    and stations.status = 'active'
    and stations.device_credential_hash is not null
    and stations.device_credential_hash
      = extensions.crypt(p_station_secret, stations.device_credential_hash);

  if station_record.id is null then
    raise insufficient_privilege using message = 'Station credential was not accepted';
  end if;

  update public.stations
  set last_seen_at = now()
  where stations.id = station_record.id;

  return station_record;
end;
$$;

create or replace function public.station_active_session(
  p_station_id uuid,
  p_session_id uuid,
  out session_id uuid,
  out staff_user_id uuid,
  out staff_display_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  select
    staff_sessions.id,
    staff_sessions.staff_user_id,
    staff_users.display_name
  into session_id, staff_user_id, staff_display_name
  from public.staff_sessions
  join public.staff_users on staff_users.id = staff_sessions.staff_user_id
  where staff_sessions.id = p_session_id
    and staff_sessions.station_id = p_station_id
    and staff_sessions.ended_at is null
    and staff_users.is_active;

  if session_id is null then
    raise insufficient_privilege using message = 'Active staff session required';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Merchant console: stations and named staff
-- ---------------------------------------------------------------------------

create or replace function public.create_station_pairing(
  p_station_name text
)
returns table (
  station_id uuid,
  station_name text,
  pairing_code text,
  pairing_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  merchant_record record;
  v_code text;
  attempt integer := 0;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select merchants.id, merchant_locations.id as location_id
  into merchant_record
  from public.merchants
  left join public.merchant_locations
    on merchant_locations.merchant_id = merchants.id
    and merchant_locations.is_primary
  where merchants.owner_user_id = (select auth.uid())
  limit 1;

  if merchant_record.id is null then
    raise insufficient_privilege using message = 'Merchant account required';
  end if;

  if coalesce(trim(p_station_name), '') = '' then
    raise exception 'Station name is required';
  end if;

  loop
    attempt := attempt + 1;
    v_code := public.generate_verification_code() || public.generate_verification_code();

    begin
      insert into public.stations (
        merchant_id,
        location_id,
        station_name,
        status,
        pairing_code,
        pairing_expires_at
      )
      values (
        merchant_record.id,
        merchant_record.location_id,
        trim(p_station_name),
        'unpaired',
        v_code,
        now() + interval '15 minutes'
      )
      returning stations.id, stations.station_name, stations.pairing_code, stations.pairing_expires_at
      into station_id, station_name, pairing_code, pairing_expires_at;

      exit;
    exception
      when unique_violation then
        if attempt >= 5 then
          raise exception 'Unable to generate a pairing code';
        end if;
    end;
  end loop;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    merchant_record.id,
    'stations',
    station_id,
    'station_pairing_created',
    jsonb_build_object('station_name', station_name)
  );

  return next;
end;
$$;

create or replace function public.revoke_station(
  p_station_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  station_record record;
begin
  select stations.id, stations.merchant_id
  into station_record
  from public.stations
  where stations.id = p_station_id
    and (select public.is_merchant_owner(stations.merchant_id));

  if station_record.id is null then
    raise insufficient_privilege using message = 'Station not found';
  end if;

  update public.stations
  set
    status = 'revoked',
    device_credential_hash = null,
    pairing_code = null,
    pairing_expires_at = null
  where stations.id = station_record.id;

  update public.staff_sessions
  set ended_at = now()
  where staff_sessions.station_id = station_record.id
    and staff_sessions.ended_at is null;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    station_record.merchant_id,
    'stations',
    station_record.id,
    'station_revoked',
    '{}'::jsonb
  );
end;
$$;

create or replace function public.add_staff_member(
  p_display_name text,
  p_pin text
)
returns table (staff_id uuid)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  merchant_record record;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select merchants.id, merchant_locations.id as location_id
  into merchant_record
  from public.merchants
  left join public.merchant_locations
    on merchant_locations.merchant_id = merchants.id
    and merchant_locations.is_primary
  where merchants.owner_user_id = (select auth.uid())
  limit 1;

  if merchant_record.id is null then
    raise insufficient_privilege using message = 'Merchant account required';
  end if;

  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Staff display name is required';
  end if;

  if p_pin !~ '^\d{4,6}$' then
    raise exception 'Staff PIN must be 4 to 6 digits';
  end if;

  insert into public.staff_users (
    merchant_id,
    location_id,
    display_name,
    role,
    pin_hash,
    is_active
  )
  values (
    merchant_record.id,
    merchant_record.location_id,
    trim(p_display_name),
    'staff',
    extensions.crypt(p_pin, extensions.gen_salt('bf')),
    true
  )
  returning staff_users.id into staff_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    merchant_record.id,
    'staff_users',
    staff_id,
    'staff_member_added',
    jsonb_build_object('display_name', trim(p_display_name))
  );

  return next;
end;
$$;

create or replace function public.set_staff_member_active(
  p_staff_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  staff_record record;
begin
  select staff_users.id, staff_users.merchant_id
  into staff_record
  from public.staff_users
  where staff_users.id = p_staff_id
    and (select public.is_merchant_owner(staff_users.merchant_id));

  if staff_record.id is null then
    raise insufficient_privilege using message = 'Staff member not found';
  end if;

  update public.staff_users
  set is_active = p_active
  where staff_users.id = staff_record.id;

  if not p_active then
    update public.staff_sessions
    set ended_at = now()
    where staff_sessions.staff_user_id = staff_record.id
      and staff_sessions.ended_at is null;
  end if;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    staff_record.merchant_id,
    'staff_users',
    staff_record.id,
    case when p_active then 'staff_member_activated' else 'staff_member_deactivated' end,
    '{}'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Station pairing and staff sessions
-- ---------------------------------------------------------------------------

create or replace function public.pair_station(
  p_pairing_code text
)
returns table (
  station_id uuid,
  station_secret text,
  station_name text,
  merchant_name text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text := encode(extensions.gen_random_bytes(24), 'hex');
  v_merchant_id uuid;
begin
  update public.stations
  set
    status = 'active',
    paired_at = now(),
    pairing_code = null,
    pairing_expires_at = null,
    device_credential_hash = extensions.crypt(v_secret, extensions.gen_salt('bf'))
  where stations.pairing_code = upper(trim(p_pairing_code))
    and stations.status = 'unpaired'
    and stations.pairing_expires_at > now()
  returning stations.id, stations.station_name, stations.merchant_id
  into station_id, station_name, v_merchant_id;

  if station_id is null then
    raise insufficient_privilege using message = 'Pairing code was not accepted';
  end if;

  select merchants.business_name
  into merchant_name
  from public.merchants
  where merchants.id = v_merchant_id;

  station_secret := v_secret;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  )
  values (
    'staff',
    null,
    v_merchant_id,
    'stations',
    station_id,
    'station_paired',
    jsonb_build_object('station_name', station_name)
  );

  return next;
end;
$$;

create or replace function public.start_staff_session(
  p_station_id uuid,
  p_station_secret text,
  p_staff_user_id uuid,
  p_pin text
)
returns table (
  session_id uuid,
  staff_display_name text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  station_record public.stations;
  staff_record record;
  failed_attempt_count integer;
begin
  station_record := public.station_authenticate(p_station_id, p_station_secret);

  select count(*)
  into failed_attempt_count
  from public.station_pin_attempts
  where station_pin_attempts.station_id = station_record.id
    and not station_pin_attempts.success
    and station_pin_attempts.created_at > now() - interval '10 minutes';

  if failed_attempt_count >= 3 then
    raise exception 'PIN pad locked. Try again later';
  end if;

  select staff_users.id, staff_users.display_name
  into staff_record
  from public.staff_users
  where staff_users.id = p_staff_user_id
    and staff_users.merchant_id = station_record.merchant_id
    and staff_users.is_active
    and staff_users.pin_hash = extensions.crypt(p_pin, staff_users.pin_hash);

  if staff_record.id is null then
    insert into public.station_pin_attempts (
      merchant_id, station_id, staff_user_id, success
    )
    values (station_record.merchant_id, station_record.id, p_staff_user_id, false);

    raise insufficient_privilege using message = 'Staff PIN was not accepted';
  end if;

  insert into public.station_pin_attempts (
    merchant_id, station_id, staff_user_id, success
  )
  values (station_record.merchant_id, station_record.id, staff_record.id, true);

  update public.staff_sessions
  set ended_at = now()
  where staff_sessions.station_id = station_record.id
    and staff_sessions.ended_at is null;

  insert into public.staff_sessions (merchant_id, station_id, staff_user_id)
  values (station_record.merchant_id, station_record.id, staff_record.id)
  returning staff_sessions.id into session_id;

  staff_display_name := staff_record.display_name;

  insert into public.product_events (
    event_name, merchant_id, actor_type, actor_id, metadata
  )
  values (
    'staff_session_started',
    station_record.merchant_id,
    'staff',
    staff_record.id::text,
    jsonb_build_object('station_id', station_record.id)
  );

  return next;
end;
$$;

create or replace function public.end_staff_session(
  p_station_id uuid,
  p_station_secret text,
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  station_record public.stations;
begin
  station_record := public.station_authenticate(p_station_id, p_station_secret);

  update public.staff_sessions
  set ended_at = now()
  where staff_sessions.id = p_session_id
    and staff_sessions.station_id = station_record.id
    and staff_sessions.ended_at is null;
end;
$$;

create or replace function public.get_station_state(
  p_station_id uuid,
  p_station_secret text
)
returns table (
  station_name text,
  merchant_name text,
  session_id uuid,
  session_staff_name text,
  session_started_at timestamptz,
  staff_members jsonb,
  stamps_today integer,
  redemptions_today integer,
  last_action_summary text,
  last_action_at timestamptz,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  station_record public.stations;
  v_business_date date := public.uk_business_date(now());
  failed_attempt_count integer;
  last_stamp record;
  last_redeem record;
begin
  station_record := public.station_authenticate(p_station_id, p_station_secret);

  station_name := station_record.station_name;

  select merchants.business_name
  into merchant_name
  from public.merchants
  where merchants.id = station_record.merchant_id;

  select
    staff_sessions.id,
    staff_users.display_name,
    staff_sessions.started_at
  into session_id, session_staff_name, session_started_at
  from public.staff_sessions
  join public.staff_users on staff_users.id = staff_sessions.staff_user_id
  where staff_sessions.station_id = station_record.id
    and staff_sessions.ended_at is null
  order by staff_sessions.started_at desc
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', staff_users.id, 'display_name', staff_users.display_name)
      order by staff_users.display_name
    ),
    '[]'::jsonb
  )
  into staff_members
  from public.staff_users
  where staff_users.merchant_id = station_record.merchant_id
    and staff_users.is_active;

  select count(*)::integer
  into stamps_today
  from public.stamp_events
  where stamp_events.merchant_id = station_record.merchant_id
    and stamp_events.event_type = 'earned'
    and stamp_events.earned_business_date = v_business_date;

  select count(*)::integer
  into redemptions_today
  from public.reward_events
  where reward_events.merchant_id = station_record.merchant_id
    and reward_events.status = 'redeemed'
    and reward_events.redeemed_at is not null
    and public.uk_business_date(reward_events.redeemed_at) = v_business_date;

  select
    'Stamp ' || stamp_events.stamps_delta::text as summary,
    stamp_events.created_at
  into last_stamp
  from public.stamp_events
  where stamp_events.merchant_id = station_record.merchant_id
    and stamp_events.event_type = 'earned'
  order by stamp_events.created_at desc
  limit 1;

  select
    'Reward redeemed' as summary,
    reward_events.redeemed_at as created_at
  into last_redeem
  from public.reward_events
  where reward_events.merchant_id = station_record.merchant_id
    and reward_events.redeemed_at is not null
  order by reward_events.redeemed_at desc
  limit 1;

  if last_redeem.created_at is not null
    and (last_stamp.created_at is null or last_redeem.created_at > last_stamp.created_at) then
    last_action_summary := last_redeem.summary;
    last_action_at := last_redeem.created_at;
  else
    last_action_summary := last_stamp.summary;
    last_action_at := last_stamp.created_at;
  end if;

  select count(*)
  into failed_attempt_count
  from public.station_pin_attempts
  where station_pin_attempts.station_id = station_record.id
    and not station_pin_attempts.success
    and station_pin_attempts.created_at > now() - interval '10 minutes';

  if failed_attempt_count >= 3 then
    select max(station_pin_attempts.created_at) + interval '10 minutes'
    into locked_until
    from public.station_pin_attempts
    where station_pin_attempts.station_id = station_record.id
      and not station_pin_attempts.success
      and station_pin_attempts.created_at > now() - interval '10 minutes';
  end if;

  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer-side verification tokens
-- ---------------------------------------------------------------------------

create or replace function public.create_verification_token(
  p_membership_id uuid,
  p_kind text,
  p_reward_event_id uuid default null
)
returns table (
  token_id uuid,
  code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  membership_record record;
  card_record record;
  reward_record record;
  billing_status text;
  v_business_date date := public.uk_business_date(now());
  v_code text;
  attempt integer := 0;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if p_kind not in ('stamp', 'redeem') then
    raise exception 'Unknown verification kind';
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

  if p_kind = 'stamp' then
    if membership_record.current_stamp_count >= card_record.stamps_required then
      raise exception 'A reward is already ready to redeem';
    end if;

    if exists (
      select 1
      from public.stamp_events
      where stamp_events.membership_id = p_membership_id
        and stamp_events.location_id = card_record.location_id
        and stamp_events.event_type = 'earned'
        and stamp_events.earned_business_date = v_business_date
        and not exists (
          select 1
          from public.stamp_events reversals
          where reversals.reverses_stamp_event_id = stamp_events.id
        )
    ) then
      raise exception 'Stamp already issued for this UK business day';
    end if;
  else
    select
      reward_events.id,
      reward_events.status,
      reward_events.membership_id,
      reward_events.redeemable_from
    into reward_record
    from public.reward_events
    where reward_events.id = p_reward_event_id;

    if reward_record.id is null
      or reward_record.membership_id <> p_membership_id then
      raise insufficient_privilege using message = 'Reward not found';
    end if;

    if reward_record.status = 'redeemed' then
      raise exception 'Reward already redeemed';
    end if;

    if reward_record.status <> 'unlocked' then
      raise exception 'Reward is not redeemable';
    end if;

    if reward_record.redeemable_from is not null
      and reward_record.redeemable_from > v_business_date then
      raise exception 'Reward is not redeemable until the next UK business day';
    end if;
  end if;

  -- One live code per card and purpose: replace, never accumulate.
  update public.verification_tokens
  set cancelled_at = now()
  where verification_tokens.membership_id = p_membership_id
    and verification_tokens.kind = p_kind
    and verification_tokens.consumed_at is null
    and verification_tokens.cancelled_at is null;

  loop
    attempt := attempt + 1;
    v_code := public.generate_verification_code();

    begin
      insert into public.verification_tokens (
        merchant_id,
        customer_id,
        membership_id,
        kind,
        reward_event_id,
        code,
        expires_at
      )
      values (
        membership_record.merchant_id,
        membership_record.customer_id,
        p_membership_id,
        p_kind,
        p_reward_event_id,
        v_code,
        now() + interval '120 seconds'
      )
      returning verification_tokens.id, verification_tokens.code, verification_tokens.expires_at
      into token_id, code, expires_at;

      exit;
    exception
      when unique_violation then
        if attempt >= 5 then
          raise exception 'Unable to generate a verification code';
        end if;
    end;
  end loop;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'verification_code_created',
    membership_record.merchant_id,
    membership_record.customer_id,
    p_membership_id,
    'customer',
    (select auth.uid())::text,
    jsonb_build_object('kind', p_kind)
  );

  return next;
end;
$$;

create or replace function public.get_verification_token_status(
  p_token_id uuid
)
returns table (
  status text,
  kind text,
  expires_at timestamptz,
  new_stamp_count integer,
  reward_unlocked boolean,
  reward_event_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  token_record record;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select
    verification_tokens.*,
    customers.auth_user_id
  into token_record
  from public.verification_tokens
  join public.customers on customers.id = verification_tokens.customer_id
  where verification_tokens.id = p_token_id;

  if token_record.id is null then
    raise insufficient_privilege using message = 'Code not found';
  end if;

  if token_record.auth_user_id <> (select auth.uid()) then
    raise insufficient_privilege using message = 'Code ownership required';
  end if;

  kind := token_record.kind;
  expires_at := token_record.expires_at;
  new_stamp_count := token_record.result_new_stamp_count;
  reward_unlocked := coalesce(token_record.result_reward_unlocked, false);
  reward_event_id := coalesce(
    token_record.result_reward_event_id,
    token_record.reward_event_id
  );

  if token_record.consumed_at is not null then
    status := 'approved';
  elsif token_record.cancelled_at is not null then
    status := 'cancelled';
  elsif token_record.expires_at <= now() then
    status := 'expired';
  else
    status := 'pending';
    reward_event_id := null;
  end if;

  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Station-side lookup, approval, redemption, undo
-- ---------------------------------------------------------------------------

create or replace function public.lookup_verification_code(
  p_station_id uuid,
  p_station_secret text,
  p_code text
)
returns table (
  status text,
  kind text,
  token_id uuid,
  customer_label text,
  stamp_count integer,
  stamps_required integer,
  duplicate_warning text,
  consumed_at timestamptz,
  reward_name text,
  reward_terms text,
  min_spend_pence integer,
  redeemable_from date
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  station_record public.stations;
  token_record record;
  card_record record;
  v_business_date date := public.uk_business_date(now());
begin
  station_record := public.station_authenticate(p_station_id, p_station_secret);

  select verification_tokens.*
  into token_record
  from public.verification_tokens
  where verification_tokens.merchant_id = station_record.merchant_id
    and verification_tokens.code = upper(trim(p_code))
  order by verification_tokens.created_at desc
  limit 1;

  if token_record.id is null then
    status := 'not_found';
    return next;
    return;
  end if;

  kind := token_record.kind;
  token_id := token_record.id;

  if token_record.consumed_at is not null then
    status := 'already_used';
    consumed_at := token_record.consumed_at;
    return next;
    return;
  end if;

  if token_record.cancelled_at is not null or token_record.expires_at <= now() then
    status := 'expired';
    return next;
    return;
  end if;

  status := 'ready';

  select
    memberships.current_stamp_count,
    loyalty_cards.stamps_required as required,
    loyalty_cards.location_id
  into card_record
  from public.customer_memberships memberships
  join public.loyalty_cards
    on loyalty_cards.merchant_id = memberships.merchant_id
    and loyalty_cards.is_active
  where memberships.id = token_record.membership_id
  order by loyalty_cards.created_at asc
  limit 1;

  customer_label := 'Card ' || upper(substr(replace(token_record.membership_id::text, '-', ''), 1, 6));
  stamp_count := card_record.current_stamp_count;
  stamps_required := card_record.required;

  if token_record.kind = 'stamp' and exists (
    select 1
    from public.stamp_events
    where stamp_events.membership_id = token_record.membership_id
      and stamp_events.location_id = card_record.location_id
      and stamp_events.event_type = 'earned'
      and stamp_events.earned_business_date = v_business_date
      and not exists (
        select 1
        from public.stamp_events reversals
        where reversals.reverses_stamp_event_id = stamp_events.id
      )
  ) then
    duplicate_warning := 'Already stamped today';
  end if;

  if token_record.kind = 'redeem' then
    select
      reward_events.reward_name,
      reward_events.reward_terms,
      reward_events.min_spend_pence,
      reward_events.redeemable_from
    into reward_name, reward_terms, min_spend_pence, redeemable_from
    from public.reward_events
    where reward_events.id = token_record.reward_event_id;
  end if;

  return next;
end;
$$;

create or replace function public.approve_stamp_token(
  p_station_id uuid,
  p_station_secret text,
  p_session_id uuid,
  p_token_id uuid
)
returns table (
  stamp_event_id uuid,
  new_stamp_count integer,
  reward_unlocked boolean,
  replayed boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  station_record public.stations;
  session_record record;
  token_record record;
  membership_record record;
  card_record record;
  reward_pool_record record;
  billing_status text;
  recent_stamp_count integer;
  v_business_date date := public.uk_business_date(now());
  v_total_weight integer;
  v_weight_threshold integer;
  v_reward_event_id uuid;
begin
  station_record := public.station_authenticate(p_station_id, p_station_secret);
  session_record := public.station_active_session(station_record.id, p_session_id);

  -- The token id is the idempotency key: a retry from the same session
  -- returns the recorded result instead of stamping twice (MS-18).
  select verification_tokens.*
  into token_record
  from public.verification_tokens
  where verification_tokens.id = p_token_id
    and verification_tokens.merchant_id = station_record.merchant_id;

  if token_record.id is null or token_record.kind <> 'stamp' then
    raise insufficient_privilege using message = 'Code was not accepted';
  end if;

  if token_record.consumed_at is not null then
    if token_record.consumed_by_session_id = session_record.session_id
      and token_record.result_stamp_event_id is not null then
      stamp_event_id := token_record.result_stamp_event_id;
      new_stamp_count := token_record.result_new_stamp_count;
      reward_unlocked := coalesce(token_record.result_reward_unlocked, false);
      replayed := true;
      return next;
      return;
    end if;

    raise exception 'Code already used';
  end if;

  update public.verification_tokens
  set
    consumed_at = now(),
    consumed_by_station_id = station_record.id,
    consumed_by_session_id = session_record.session_id
  where verification_tokens.id = p_token_id
    and verification_tokens.consumed_at is null
    and verification_tokens.cancelled_at is null
    and verification_tokens.expires_at > now();

  if not found then
    raise exception 'Code expired';
  end if;

  select
    memberships.id,
    memberships.merchant_id,
    memberships.customer_id,
    memberships.current_stamp_count,
    merchants.status as merchant_status
  into membership_record
  from public.customer_memberships memberships
  join public.merchants merchants on merchants.id = memberships.merchant_id
  where memberships.id = token_record.membership_id
  for update of memberships;

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
    where stamp_events.membership_id = token_record.membership_id
      and stamp_events.location_id = card_record.location_id
      and stamp_events.event_type = 'earned'
      and stamp_events.earned_business_date = v_business_date
      and not exists (
        select 1
        from public.stamp_events reversals
        where reversals.reverses_stamp_event_id = stamp_events.id
      )
  ) then
    raise exception 'Stamp already issued for this UK business day';
  end if;

  if membership_record.current_stamp_count + 1 >= card_record.stamps_required then
    select coalesce(sum(reward_pool_items.weight), 0)
    into v_total_weight
    from public.reward_pool_items
    where reward_pool_items.merchant_id = membership_record.merchant_id
      and reward_pool_items.location_id = card_record.location_id
      and reward_pool_items.loyalty_card_id = card_record.id
      and reward_pool_items.is_active;

    if v_total_weight <= 0 then
      raise exception 'At least one active reward pool item is required before unlocking a reward';
    end if;
  end if;

  insert into public.stamp_events (
    merchant_id,
    customer_id,
    membership_id,
    loyalty_card_id,
    location_id,
    event_type,
    stamps_delta,
    approved_by_staff_id,
    earned_business_date,
    station_id,
    staff_session_id,
    verification_token_id
  )
  values (
    membership_record.merchant_id,
    membership_record.customer_id,
    token_record.membership_id,
    card_record.id,
    card_record.location_id,
    'earned',
    1,
    session_record.staff_user_id,
    v_business_date,
    station_record.id,
    session_record.session_id,
    token_record.id
  )
  returning stamp_events.id into stamp_event_id;

  update public.customer_memberships
  set
    current_stamp_count = current_stamp_count + 1,
    total_stamps_earned = total_stamps_earned + 1,
    last_visit_at = now()
  where customer_memberships.id = token_record.membership_id
  returning current_stamp_count into new_stamp_count;

  reward_unlocked := new_stamp_count >= card_record.stamps_required;
  replayed := false;

  if reward_unlocked then
    v_weight_threshold := floor(random() * v_total_weight)::integer + 1;

    select *
    into reward_pool_record
    from (
      select
        reward_pool_items.*,
        sum(reward_pool_items.weight) over (
          order by reward_pool_items.display_order asc,
            reward_pool_items.created_at asc,
            reward_pool_items.id asc
        ) as running_weight
      from public.reward_pool_items
      where reward_pool_items.merchant_id = membership_record.merchant_id
        and reward_pool_items.location_id = card_record.location_id
        and reward_pool_items.loyalty_card_id = card_record.id
        and reward_pool_items.is_active
    ) weighted_items
    where weighted_items.running_weight >= v_weight_threshold
    order by weighted_items.running_weight asc
    limit 1;

    insert into public.reward_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      reward_pool_item_id,
      reward_name,
      reward_terms,
      min_spend_pence,
      redeemable_from,
      status
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      token_record.membership_id,
      card_record.id,
      reward_pool_record.id,
      reward_pool_record.reward_name,
      reward_pool_record.reward_terms,
      reward_pool_record.min_spend_pence,
      public.next_uk_business_date(now()),
      'unlocked'
    )
    returning reward_events.id into v_reward_event_id;

    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
    )
    values (
      'reward_unlocked',
      membership_record.merchant_id,
      membership_record.customer_id,
      token_record.membership_id,
      'system',
      null,
      jsonb_build_object(
        'loyalty_card_id', card_record.id,
        'reward_pool_item_id', reward_pool_record.id
      )
    );
  end if;

  update public.verification_tokens
  set
    result_stamp_event_id = stamp_event_id,
    result_new_stamp_count = new_stamp_count,
    result_reward_unlocked = reward_unlocked,
    result_reward_event_id = v_reward_event_id
  where verification_tokens.id = token_record.id;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'stamp_issued',
    membership_record.merchant_id,
    membership_record.customer_id,
    token_record.membership_id,
    'staff',
    session_record.staff_user_id::text,
    jsonb_build_object(
      'new_stamp_count', new_stamp_count,
      'business_date', v_business_date,
      'station_id', station_record.id,
      'verification_token_id', token_record.id
    )
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'staff',
    session_record.staff_user_id::text,
    membership_record.merchant_id,
    membership_record.customer_id,
    'customer_memberships',
    token_record.membership_id,
    'stamp_issued',
    jsonb_build_object(
      'new_stamp_count', new_stamp_count,
      'business_date', v_business_date,
      'station_id', station_record.id
    )
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
      merchant_id, customer_id, membership_id, signal, severity, metadata
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      token_record.membership_id,
      'high_stamp_velocity',
      'medium',
      jsonb_build_object(
        'threshold', 20,
        'window_minutes', 15,
        'observed_stamp_count', recent_stamp_count
      )
    );
  end if;

  return next;
end;
$$;

create or replace function public.redeem_reward_token(
  p_station_id uuid,
  p_station_secret text,
  p_session_id uuid,
  p_token_id uuid
)
returns table (
  reward_event_id uuid,
  reward_name text,
  membership_id uuid,
  new_stamp_count integer,
  replayed boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  station_record public.stations;
  session_record record;
  token_record record;
  reward_record record;
  billing_status text;
begin
  station_record := public.station_authenticate(p_station_id, p_station_secret);
  session_record := public.station_active_session(station_record.id, p_session_id);

  select verification_tokens.*
  into token_record
  from public.verification_tokens
  where verification_tokens.id = p_token_id
    and verification_tokens.merchant_id = station_record.merchant_id;

  if token_record.id is null or token_record.kind <> 'redeem' then
    raise insufficient_privilege using message = 'Code was not accepted';
  end if;

  if token_record.consumed_at is not null then
    if token_record.consumed_by_session_id = session_record.session_id
      and token_record.result_reward_event_id is not null then
      reward_event_id := token_record.result_reward_event_id;
      membership_id := token_record.membership_id;
      new_stamp_count := token_record.result_new_stamp_count;
      replayed := true;

      select reward_events.reward_name
      into reward_name
      from public.reward_events
      where reward_events.id = reward_event_id;

      return next;
      return;
    end if;

    raise exception 'Reward already redeemed at %', token_record.consumed_at;
  end if;

  update public.verification_tokens
  set
    consumed_at = now(),
    consumed_by_station_id = station_record.id,
    consumed_by_session_id = session_record.session_id
  where verification_tokens.id = p_token_id
    and verification_tokens.consumed_at is null
    and verification_tokens.cancelled_at is null
    and verification_tokens.expires_at > now();

  if not found then
    raise exception 'Code expired';
  end if;

  select
    reward_events.id,
    reward_events.status,
    reward_events.merchant_id,
    reward_events.customer_id,
    reward_events.membership_id as reward_membership_id,
    reward_events.reward_name as name,
    reward_events.redeemable_from,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    customer_memberships.current_stamp_count,
    merchants.status as merchant_status
  into reward_record
  from public.reward_events
  join public.customer_memberships
    on customer_memberships.id = reward_events.membership_id
  join public.merchants on merchants.id = reward_events.merchant_id
  join public.loyalty_cards on loyalty_cards.id = reward_events.loyalty_card_id
  where reward_events.id = token_record.reward_event_id
  for update of reward_events;

  if reward_record.id is null then
    raise exception 'Reward is not redeemable';
  end if;

  if reward_record.status = 'redeemed' then
    raise exception 'Reward already redeemed';
  end if;

  if reward_record.status <> 'unlocked' then
    raise exception 'Reward is not redeemable';
  end if;

  if reward_record.redeemable_from is not null
    and reward_record.redeemable_from > public.uk_business_date(now()) then
    raise exception 'Reward is not redeemable until the next UK business day';
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

  update public.reward_events
  set
    status = 'redeemed',
    redeemed_by_staff_id = session_record.staff_user_id,
    redeemed_by_station_id = station_record.id,
    redeemed_verification_token_id = token_record.id,
    redeemed_at = now(),
    metadata = reward_events.metadata || jsonb_build_object('redeemed_by', 'counter_station')
  where reward_events.id = reward_record.id
    and reward_events.status = 'unlocked';

  if not found then
    raise exception 'Reward already redeemed';
  end if;

  update public.customer_memberships
  set
    current_stamp_count = greatest(current_stamp_count - reward_record.stamps_required, 0),
    total_rewards_redeemed = total_rewards_redeemed + 1
  where customer_memberships.id = reward_record.reward_membership_id
  returning current_stamp_count into new_stamp_count;

  reward_event_id := reward_record.id;
  reward_name := reward_record.name;
  membership_id := reward_record.reward_membership_id;
  replayed := false;

  update public.verification_tokens
  set
    result_new_stamp_count = new_stamp_count,
    result_reward_event_id = reward_record.id
  where verification_tokens.id = token_record.id;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'reward_redeemed',
    reward_record.merchant_id,
    reward_record.customer_id,
    reward_record.reward_membership_id,
    'staff',
    session_record.staff_user_id::text,
    jsonb_build_object(
      'reward_id', reward_record.id,
      'reward_name', reward_record.name,
      'new_stamp_count', new_stamp_count,
      'station_id', station_record.id
    )
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'staff',
    session_record.staff_user_id::text,
    reward_record.merchant_id,
    reward_record.customer_id,
    'reward_events',
    reward_record.id,
    'reward_redeemed',
    jsonb_build_object('new_stamp_count', new_stamp_count, 'station_id', station_record.id)
  );

  return next;
end;
$$;

create or replace function public.undo_recent_stamp(
  p_station_id uuid,
  p_station_secret text,
  p_session_id uuid,
  p_stamp_event_id uuid
)
returns table (new_stamp_count integer)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  station_record public.stations;
  session_record record;
  stamp_record record;
  v_reward_event_id uuid;
begin
  station_record := public.station_authenticate(p_station_id, p_station_secret);
  session_record := public.station_active_session(station_record.id, p_session_id);

  select stamp_events.*
  into stamp_record
  from public.stamp_events
  where stamp_events.id = p_stamp_event_id
    and stamp_events.merchant_id = station_record.merchant_id
    and stamp_events.event_type = 'earned';

  if stamp_record.id is null then
    raise insufficient_privilege using message = 'Stamp not found';
  end if;

  if stamp_record.station_id is distinct from station_record.id then
    raise exception 'Undo is only available from the station that stamped';
  end if;

  if stamp_record.created_at <= now() - interval '5 minutes' then
    raise exception 'Undo window has closed';
  end if;

  if exists (
    select 1
    from public.stamp_events reversals
    where reversals.reverses_stamp_event_id = stamp_record.id
  ) then
    raise exception 'Stamp already undone';
  end if;

  -- A reward unsealed by this stamp goes back with it, as long as it is unspent.
  select verification_tokens.result_reward_event_id
  into v_reward_event_id
  from public.verification_tokens
  where verification_tokens.result_stamp_event_id = stamp_record.id;

  if v_reward_event_id is not null then
    update public.reward_events
    set
      status = 'cancelled',
      metadata = reward_events.metadata || jsonb_build_object('cancelled_by', 'stamp_undo')
    where reward_events.id = v_reward_event_id
      and reward_events.status = 'unlocked';

    if not found then
      raise exception 'Reward already redeemed';
    end if;
  end if;

  insert into public.stamp_events (
    merchant_id,
    customer_id,
    membership_id,
    loyalty_card_id,
    location_id,
    event_type,
    stamps_delta,
    approved_by_staff_id,
    station_id,
    staff_session_id,
    reverses_stamp_event_id
  )
  values (
    stamp_record.merchant_id,
    stamp_record.customer_id,
    stamp_record.membership_id,
    stamp_record.loyalty_card_id,
    stamp_record.location_id,
    'reversed',
    -1,
    session_record.staff_user_id,
    station_record.id,
    session_record.session_id,
    stamp_record.id
  );

  update public.customer_memberships
  set
    current_stamp_count = greatest(current_stamp_count - 1, 0),
    total_stamps_earned = greatest(total_stamps_earned - 1, 0)
  where customer_memberships.id = stamp_record.membership_id
  returning current_stamp_count into new_stamp_count;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'stamp_reversed',
    stamp_record.merchant_id,
    stamp_record.customer_id,
    stamp_record.membership_id,
    'staff',
    session_record.staff_user_id::text,
    jsonb_build_object('stamp_event_id', stamp_record.id, 'station_id', station_record.id)
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'staff',
    session_record.staff_user_id::text,
    stamp_record.merchant_id,
    stamp_record.customer_id,
    'stamp_events',
    stamp_record.id,
    'stamp_reversed',
    jsonb_build_object('new_stamp_count', new_stamp_count, 'station_id', station_record.id)
  );

  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------

alter table public.stations enable row level security;
alter table public.stations force row level security;
alter table public.staff_sessions enable row level security;
alter table public.staff_sessions force row level security;
alter table public.station_pin_attempts enable row level security;
alter table public.station_pin_attempts force row level security;
alter table public.verification_tokens enable row level security;
alter table public.verification_tokens force row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'stations'
      and policyname = 'stations_select_owner_or_admin'
  ) then
    create policy stations_select_owner_or_admin
      on public.stations for select to authenticated
      using (
        (select public.is_merchant_owner(merchant_id))
        or (select public.is_internal_admin())
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'staff_sessions'
      and policyname = 'staff_sessions_select_owner_or_admin'
  ) then
    create policy staff_sessions_select_owner_or_admin
      on public.staff_sessions for select to authenticated
      using (
        (select public.is_merchant_owner(merchant_id))
        or (select public.is_internal_admin())
      );
  end if;
end $$;

-- station_pin_attempts and verification_tokens stay service-role only:
-- no authenticated policies on purpose.

grant select on public.stations to authenticated;
grant select on public.staff_sessions to authenticated;
grant select, insert, update, delete on public.stations to service_role;
grant select, insert, update, delete on public.staff_sessions to service_role;
grant select, insert, update, delete on public.station_pin_attempts to service_role;
grant select, insert, update, delete on public.verification_tokens to service_role;

grant execute on function public.generate_verification_code() to service_role;
grant execute on function public.create_station_pairing(text) to authenticated, service_role;
grant execute on function public.revoke_station(uuid) to authenticated, service_role;
grant execute on function public.add_staff_member(text, text) to authenticated, service_role;
grant execute on function public.set_staff_member_active(uuid, boolean) to authenticated, service_role;
grant execute on function public.create_verification_token(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.get_verification_token_status(uuid) to authenticated, service_role;

-- Station functions authenticate with the device credential, not Supabase
-- auth, and are reachable through the service-role client only.
grant execute on function public.station_authenticate(uuid, text) to service_role;
grant execute on function public.station_active_session(uuid, uuid) to service_role;
grant execute on function public.pair_station(text) to service_role;
grant execute on function public.start_staff_session(uuid, text, uuid, text) to service_role;
grant execute on function public.end_staff_session(uuid, text, uuid) to service_role;
grant execute on function public.get_station_state(uuid, text) to service_role;
grant execute on function public.lookup_verification_code(uuid, text, text) to service_role;
grant execute on function public.approve_stamp_token(uuid, text, uuid, uuid) to service_role;
grant execute on function public.redeem_reward_token(uuid, text, uuid, uuid) to service_role;
grant execute on function public.undo_recent_stamp(uuid, text, uuid, uuid) to service_role;

revoke execute on function public.station_authenticate(uuid, text) from authenticated, anon;
revoke execute on function public.station_active_session(uuid, uuid) from authenticated, anon;
revoke execute on function public.pair_station(text) from authenticated, anon;
revoke execute on function public.start_staff_session(uuid, text, uuid, text) from authenticated, anon;
revoke execute on function public.end_staff_session(uuid, text, uuid) from authenticated, anon;
revoke execute on function public.get_station_state(uuid, text) from authenticated, anon;
revoke execute on function public.lookup_verification_code(uuid, text, text) from authenticated, anon;
revoke execute on function public.approve_stamp_token(uuid, text, uuid, uuid) from authenticated, anon;
revoke execute on function public.redeem_reward_token(uuid, text, uuid, uuid) from authenticated, anon;
revoke execute on function public.undo_recent_stamp(uuid, text, uuid, uuid) from authenticated, anon;

notify pgrst, 'reload schema';
