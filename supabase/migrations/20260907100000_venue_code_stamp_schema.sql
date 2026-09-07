-- Venue code — the location-check fallback (schema only; nothing reachable yet).
--
-- Self-service stamping refuses a stamp on positive evidence of absence (NBS10)
-- or once the unverified-location grace is spent (NBS11). Until now the only
-- recovery was "try again". This adds the fallback: a six-digit code that
-- changes every day, shown only on the owner's dashboard, which a customer
-- standing at the counter can be told and type on their own phone. The right
-- code issues the stamp through the NORMAL pipeline, bypassing ONLY location.
--
-- This file is the dormant half: the seed the code is derived from, the receipt
-- that records a code-confirmed visit, and the attempt-lockout ledger. The RPCs
-- that read the code and issue the stamp arrive with the release migration; the
-- shared private stamp primitive that honours a receipt is 20260907100100.
--
-- DESIGN NOTES
-- * Nothing per-day is stored. The code is HMAC(seed, merchant_id || day),
--   reduced to six digits, so there is no rotation job and no table of codes.
--   "Reset today's code" is a new seed. The day rolls at 05:00 Europe/London,
--   not midnight, because pubs are open at midnight.
-- * The seed lives in `private` with no role privileges, the same posture as
--   private.merchant_id_verification_receipts (20260905141000).
-- * The receipt carries `transaction_id = pg_current_xact_id()`. The stamp
--   primitive only honours presence evidence whose receipt was written in the
--   SAME transaction, so no client-supplied value can switch the location gate
--   off (the xid8 pattern from private.has_current_owner_id_check).
-- * No PII is stored on either table; customer erasure cascades through
--   customer_memberships. Receipts are ledger and are retained.
--
-- Forward-only and re-runnable.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

-- 1. The per-venue seed and the code derived from it ---------------------------

create table if not exists private.venue_code_seeds (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  seed bytea not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  rotated_by_user_id uuid
);

alter table private.venue_code_seeds enable row level security;
alter table private.venue_code_seeds force row level security;
revoke all on table private.venue_code_seeds
  from public, anon, authenticated, service_role;

comment on table private.venue_code_seeds is
  'Random per-venue seed the daily venue code is derived from. Never readable by an API role; replaced outright to reset the code.';

-- The "day" a venue code belongs to. Rolls at 05:00 Europe/London so a code
-- read out at 23:50 is still the one the customer types at 00:10.
create or replace function private.venue_code_day(
  p_at timestamptz default now()
)
returns date
language sql
stable
set search_path = public, pg_temp
as $function$
  select ((p_at at time zone 'Europe/London') - interval '5 hours')::date;
$function$;

revoke all on function private.venue_code_day(timestamptz)
  from public, anon, authenticated, service_role;

-- Six digits, zero-padded, from the first 48 bits of the HMAC. Creates the seed
-- on first use so a venue never has to "set up" a code. Returns null for an
-- unknown merchant rather than raising, so callers can fail closed quietly.
create or replace function private.venue_code_for(
  p_merchant_id uuid,
  p_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_seed bytea;
  v_day date := private.venue_code_day(p_at);
  v_digest text;
begin
  if p_merchant_id is null
    or not exists (select 1 from public.merchants where merchants.id = p_merchant_id)
  then
    return null;
  end if;

  select seeds.seed into v_seed
  from private.venue_code_seeds seeds
  where seeds.merchant_id = p_merchant_id;

  if v_seed is null then
    insert into private.venue_code_seeds (merchant_id, seed)
    values (p_merchant_id, extensions.gen_random_bytes(32))
    on conflict (merchant_id) do nothing;

    select seeds.seed into v_seed
    from private.venue_code_seeds seeds
    where seeds.merchant_id = p_merchant_id;
  end if;

  v_digest := encode(
    extensions.hmac(
      convert_to(p_merchant_id::text || ':' || v_day::text, 'UTF8'),
      v_seed,
      'sha256'
    ),
    'hex'
  );

  return lpad(
    (((('x' || left(v_digest, 12))::bit(48))::bigint) % 1000000)::text,
    6,
    '0'
  );
end;
$function$;

revoke all on function private.venue_code_for(uuid, timestamptz)
  from public, anon, authenticated, service_role;

comment on function private.venue_code_for(uuid, timestamptz) is
  'The six-digit venue code for a merchant on the venue-code day containing p_at. Derived, never stored; internal only.';

-- 2. Evidence that a visit was confirmed with the venue code -------------------
-- One row per code-confirmed stamp. `stamp_event_id` is null only for the
-- instant between the receipt insert and the stamp insert inside one
-- transaction; a refused stamp rolls the receipt back with it.

create table if not exists public.venue_code_stamp_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  location_id uuid references public.merchant_locations(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  membership_id uuid not null references public.customer_memberships(id) on delete cascade,
  loyalty_card_id uuid not null references public.loyalty_cards(id) on delete restrict,
  refusal_flag_id uuid references public.fraud_flags(id) on delete set null,
  original_failure_reason text not null,
  code_day date not null,
  device_hash text,
  stamp_event_id uuid references public.stamp_events(id) on delete cascade,
  transaction_id xid8 not null default pg_current_xact_id(),
  created_at timestamptz not null default now(),
  constraint venue_code_stamp_receipts_membership_matches_context
    foreign key (merchant_id, customer_id, membership_id)
    references public.customer_memberships(merchant_id, customer_id, id)
    on delete cascade deferrable initially immediate
);

alter table public.venue_code_stamp_receipts
  drop constraint if exists venue_code_stamp_receipts_failure_reason_check,
  drop constraint if exists venue_code_stamp_receipts_device_hash_check;
alter table public.venue_code_stamp_receipts
  add constraint venue_code_stamp_receipts_failure_reason_check
    check (original_failure_reason in ('location_out_of_range', 'location_required'))
    not valid,
  add constraint venue_code_stamp_receipts_device_hash_check
    check (device_hash is null or device_hash ~ '^[0-9a-f]{64}$')
    not valid;
alter table public.venue_code_stamp_receipts
  validate constraint venue_code_stamp_receipts_failure_reason_check;
alter table public.venue_code_stamp_receipts
  validate constraint venue_code_stamp_receipts_device_hash_check;

create unique index if not exists venue_code_stamp_receipts_stamp_event_id_key
  on public.venue_code_stamp_receipts (stamp_event_id);
create index if not exists venue_code_stamp_receipts_merchant_id_idx
  on public.venue_code_stamp_receipts (merchant_id);
create index if not exists venue_code_stamp_receipts_location_id_idx
  on public.venue_code_stamp_receipts (location_id);
create index if not exists venue_code_stamp_receipts_customer_id_idx
  on public.venue_code_stamp_receipts (customer_id);
create index if not exists venue_code_stamp_receipts_membership_id_idx
  on public.venue_code_stamp_receipts (membership_id);
create index if not exists venue_code_stamp_receipts_loyalty_card_id_idx
  on public.venue_code_stamp_receipts (loyalty_card_id);
create index if not exists venue_code_stamp_receipts_refusal_flag_id_idx
  on public.venue_code_stamp_receipts (refusal_flag_id);
-- The in-transaction evidence lookup the stamp primitive performs.
create index if not exists venue_code_stamp_receipts_pending_idx
  on public.venue_code_stamp_receipts (membership_id)
  where stamp_event_id is null;

alter table public.venue_code_stamp_receipts enable row level security;
alter table public.venue_code_stamp_receipts force row level security;

revoke all on table public.venue_code_stamp_receipts
  from public, anon, authenticated, service_role;
grant select on table public.venue_code_stamp_receipts to authenticated;
grant select, insert, update, delete on table public.venue_code_stamp_receipts
  to service_role;

drop policy if exists venue_code_stamp_receipts_service_role_all
  on public.venue_code_stamp_receipts;
create policy venue_code_stamp_receipts_service_role_all
  on public.venue_code_stamp_receipts for all to service_role
  using (true) with check (true);

-- The owner's activity view may see that a stamp was code-confirmed. The row
-- carries no name, contact detail, coordinates or code.
drop policy if exists venue_code_stamp_receipts_select_owner_admin
  on public.venue_code_stamp_receipts;
create policy venue_code_stamp_receipts_select_owner_admin
  on public.venue_code_stamp_receipts for select to authenticated
  using (
    (select public.is_merchant_owner(venue_code_stamp_receipts.merchant_id))
    or (select public.is_internal_admin())
  );

comment on table public.venue_code_stamp_receipts is
  'Durable evidence that a visit stamp was confirmed with the daily venue code after a recorded location refusal. Written only inside the stamp transaction.';

-- 3. Attempt lockout ledger ------------------------------------------------------
-- Five wrong codes in fifteen minutes lock a membership for fifteen minutes.
-- Kept as a row rather than a rate-limit bucket so the count survives the
-- rolled-back verify transaction (the lesson of 20260902123000) and so the
-- customer can be told how many tries remain.

create table if not exists public.venue_code_attempt_lockouts (
  membership_id uuid primary key references public.customer_memberships(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  failed_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  last_failed_at timestamptz,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.venue_code_attempt_lockouts
  drop constraint if exists venue_code_attempt_lockouts_failed_count_check;
alter table public.venue_code_attempt_lockouts
  add constraint venue_code_attempt_lockouts_failed_count_check
    check (failed_count >= 0)
    not valid;
alter table public.venue_code_attempt_lockouts
  validate constraint venue_code_attempt_lockouts_failed_count_check;

create index if not exists venue_code_attempt_lockouts_merchant_id_idx
  on public.venue_code_attempt_lockouts (merchant_id);

alter table public.venue_code_attempt_lockouts enable row level security;
alter table public.venue_code_attempt_lockouts force row level security;

revoke all on table public.venue_code_attempt_lockouts
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.venue_code_attempt_lockouts
  to service_role;

drop policy if exists venue_code_attempt_lockouts_service_role_all
  on public.venue_code_attempt_lockouts;
create policy venue_code_attempt_lockouts_service_role_all
  on public.venue_code_attempt_lockouts for all to service_role
  using (true) with check (true);

comment on table public.venue_code_attempt_lockouts is
  'Per-membership wrong-code counter and lockout for the daily venue code. Service-role only; purged a day after it goes quiet.';

-- Lockout rows are only meaningful while a window or lock is live. A day after
-- the last activity they are noise; the privacy-retention cron sweeps them.
create or replace function public.purge_stale_venue_code_lockouts(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_count integer;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  delete from public.venue_code_attempt_lockouts lockouts
  where coalesce(lockouts.locked_until, lockouts.last_failed_at, lockouts.window_started_at)
    < p_now - interval '1 day';

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.purge_stale_venue_code_lockouts(timestamptz)
  from public, anon, authenticated;
grant execute on function public.purge_stale_venue_code_lockouts(timestamptz)
  to service_role;

notify pgrst, 'reload schema';
