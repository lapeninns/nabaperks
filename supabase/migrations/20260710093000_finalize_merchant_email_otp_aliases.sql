-- auth otp alias finalization
--
-- A merchant-facing six-digit alias must not be consumed before GoTrue has
-- accepted the encrypted provider token behind it. This migration replaces
-- the destructive one-shot consume path with a short leased reservation:
-- reserve -> provider verification -> finalize, or release on a retryable
-- provider failure. Terminal rows scrub the provider token immediately but
-- retain bounded metadata for one day so the UI can distinguish expiry,
-- reuse, supersession, and rejection without exposing secrets.

alter table public.merchant_email_otp_aliases
  add column if not exists purpose text;

alter table public.merchant_email_otp_aliases
  add column if not exists reservation_id uuid;

alter table public.merchant_email_otp_aliases
  add column if not exists reserved_until timestamptz;

alter table public.merchant_email_otp_aliases
  add column if not exists resolution text;

-- Drop the shape checks before compatibility backfills so a replay can rename
-- the legacy terminal marker without being blocked by the previous revision.
alter table public.merchant_email_otp_aliases
  drop constraint if exists merchant_email_otp_aliases_lifecycle_check;

alter table public.merchant_email_otp_aliases
  drop constraint if exists merchant_email_otp_aliases_resolution_check;

update public.merchant_email_otp_aliases
   set purpose = 'legacy'
 where purpose is null;

update public.merchant_email_otp_aliases
   set resolution = 'legacy_consumed',
       supabase_token = '',
       reservation_id = null,
       reserved_until = null
 where consumed_at is not null
   and resolution is null;

update public.merchant_email_otp_aliases
   set resolution = 'legacy_consumed'
 where resolution = 'legacy';

-- Previous revisions retained every submitted six-digit guess. Attempts only
-- need an email, outcome, and timestamp for the safety ceiling.
update public.merchant_email_otp_alias_attempts
   set alias_code = '[redacted]'
 where alias_code <> '[redacted]';

alter table public.merchant_email_otp_aliases
  alter column purpose set default 'legacy';

alter table public.merchant_email_otp_aliases
  alter column purpose set not null;

alter table public.merchant_email_otp_aliases
  drop constraint if exists merchant_email_otp_aliases_purpose_check;

alter table public.merchant_email_otp_aliases
  add constraint merchant_email_otp_aliases_purpose_check
  check (purpose in ('signup', 'recovery', 'legacy'));

alter table public.merchant_email_otp_aliases
  drop constraint if exists merchant_email_otp_aliases_resolution_check;

alter table public.merchant_email_otp_aliases
  add constraint merchant_email_otp_aliases_resolution_check
  check (
    resolution is null
    or resolution in (
      'verified',
      'expired',
      'rejected',
      'superseded',
      'delivery_failed',
      'legacy_consumed'
    )
  );

alter table public.merchant_email_otp_aliases
  drop constraint if exists merchant_email_otp_aliases_lifecycle_check;

alter table public.merchant_email_otp_aliases
  add constraint merchant_email_otp_aliases_lifecycle_check
  check (
    (
      resolution is null
      and consumed_at is null
      and supabase_token <> ''
      and (
        (reservation_id is null and reserved_until is null)
        or (reservation_id is not null and reserved_until is not null)
      )
    )
    or
    (
      resolution is not null
      and consumed_at is not null
      and supabase_token = ''
      and reservation_id is null
      and reserved_until is null
    )
  );

drop index if exists public.merchant_email_otp_aliases_active_code_idx;
create unique index merchant_email_otp_aliases_active_code_idx
  on public.merchant_email_otp_aliases (email, alias_code)
  where resolution is null and consumed_at is null;

create index if not exists merchant_email_otp_aliases_reserved_until_idx
  on public.merchant_email_otp_aliases (reserved_until)
  where reservation_id is not null;

create unique index if not exists merchant_email_otp_aliases_reservation_id_idx
  on public.merchant_email_otp_aliases (reservation_id)
  where reservation_id is not null;

alter table public.merchant_email_otp_aliases enable row level security;
alter table public.merchant_email_otp_aliases force row level security;
alter table public.merchant_email_otp_alias_attempts enable row level security;
alter table public.merchant_email_otp_alias_attempts force row level security;

revoke all on table public.merchant_email_otp_aliases from anon, authenticated;
revoke all on table public.merchant_email_otp_alias_attempts from anon, authenticated;
grant select, insert, update, delete on table public.merchant_email_otp_aliases to service_role;
grant select, insert, delete on table public.merchant_email_otp_alias_attempts to service_role;

create or replace function public.purge_merchant_email_otp_aliases(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer := 0;
  scrubbed_count integer := 0;
  alias_deleted_count integer := 0;
  attempts_deleted_count integer := 0;
begin
  -- Expiry is terminal, but keep the metadata tombstone briefly so a merchant
  -- entering the exact code can receive accurate recovery guidance.
  update public.merchant_email_otp_aliases aliases
     set resolution = coalesce(aliases.resolution, 'expired'),
         consumed_at = coalesce(aliases.consumed_at, p_now),
         supabase_token = '',
         reservation_id = null,
         reserved_until = null
   where aliases.expires_at <= p_now
     and (
       aliases.resolution is null
       or aliases.consumed_at is null
       or aliases.supabase_token <> ''
       or aliases.reservation_id is not null
       or aliases.reserved_until is not null
     );
  get diagnostics expired_count = row_count;

  -- Defense in depth for legacy terminal rows written before this migration.
  update public.merchant_email_otp_aliases aliases
     set resolution = coalesce(aliases.resolution, 'legacy_consumed'),
         consumed_at = coalesce(aliases.consumed_at, p_now),
         supabase_token = '',
         reservation_id = null,
         reserved_until = null
   where (aliases.resolution is not null or aliases.consumed_at is not null)
     and (
       aliases.resolution is null
       or aliases.consumed_at is null
       or aliases.supabase_token <> ''
       or aliases.reservation_id is not null
       or aliases.reserved_until is not null
     );
  get diagnostics scrubbed_count = row_count;

  delete from public.merchant_email_otp_aliases aliases
   where aliases.resolution is not null
     and coalesce(aliases.consumed_at, aliases.expires_at, aliases.created_at)
       <= p_now - interval '1 day';
  get diagnostics alias_deleted_count = row_count;

  delete from public.merchant_email_otp_alias_attempts attempts
   where attempts.attempted_at <= p_now - interval '1 day';
  get diagnostics attempts_deleted_count = row_count;

  return
    expired_count
    + scrubbed_count
    + alias_deleted_count
    + attempts_deleted_count;
end;
$$;

revoke all on function public.purge_merchant_email_otp_aliases(timestamptz)
  from public, anon, authenticated;
grant execute on function public.purge_merchant_email_otp_aliases(timestamptz)
  to service_role;

create or replace function public.create_merchant_email_otp_alias(
  p_email text,
  p_alias_code text,
  p_supabase_token text,
  p_expires_at timestamptz,
  p_purpose text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  normalized_purpose text := lower(trim(p_purpose));
  v_now timestamptz := clock_timestamp();
  v_alias_id uuid;
begin
  if coalesce(normalized_email, '') = '' or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise invalid_parameter_value using message = 'A normalized email is required';
  end if;
  if coalesce(p_alias_code, '') !~ '^[0-9]{6}$' then
    raise invalid_parameter_value using message = 'Alias code must be six digits';
  end if;
  if coalesce(p_supabase_token, '') = '' then
    raise invalid_parameter_value using message = 'Encrypted provider token is required';
  end if;
  if p_expires_at is null or p_expires_at <= v_now then
    raise invalid_parameter_value using message = 'Alias expiry must be in the future';
  end if;
  if coalesce(normalized_purpose, '') not in ('signup', 'recovery') then
    raise invalid_parameter_value using message = 'Alias purpose must be signup or recovery';
  end if;

  -- Serialize lifecycle mutations for one identity without holding a
  -- transaction open across email-provider I/O.
  perform pg_advisory_xact_lock(
    hashtextextended(normalized_email, 0)
  );

  perform public.purge_merchant_email_otp_aliases(v_now);

  update public.merchant_email_otp_aliases aliases
     set resolution = 'superseded',
         consumed_at = v_now,
         supabase_token = '',
         reservation_id = null,
         reserved_until = null
   where aliases.email = normalized_email
     and aliases.purpose in (normalized_purpose, 'legacy')
     and aliases.resolution is null
     and aliases.consumed_at is null;

  insert into public.merchant_email_otp_aliases (
    email,
    alias_code,
    supabase_token,
    expires_at,
    purpose
  )
  values (
    normalized_email,
    p_alias_code,
    p_supabase_token,
    p_expires_at,
    normalized_purpose
  )
  returning id into v_alias_id;

  return v_alias_id;
end;
$$;

revoke all on function public.create_merchant_email_otp_alias(
  text,
  text,
  text,
  timestamptz,
  text
) from public, anon, authenticated;
grant execute on function public.create_merchant_email_otp_alias(
  text,
  text,
  text,
  timestamptz,
  text
) to service_role;

create or replace function public.reserve_merchant_email_otp_alias(
  p_email text,
  p_alias_code text,
  p_purpose text
)
returns table (
  status text,
  reservation_id uuid,
  supabase_token text,
  retry_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  normalized_purpose text := lower(trim(p_purpose));
  v_now timestamptz := clock_timestamp();
  v_failed_attempt_count integer := 0;
  v_retry_at timestamptz;
  v_alias record;
  v_reservation_id uuid;
begin
  if coalesce(normalized_email, '') = '' or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise invalid_parameter_value using message = 'A normalized email is required';
  end if;
  if coalesce(p_alias_code, '') !~ '^[0-9]{6}$' then
    raise invalid_parameter_value using message = 'Alias code must be six digits';
  end if;
  if coalesce(normalized_purpose, '') not in ('signup', 'recovery') then
    raise invalid_parameter_value using message = 'Alias purpose must be signup or recovery';
  end if;

  -- The invalid-guess ceiling is email-global, so use the same lock as create
  -- before reading attempts or selecting the exact alias row.
  perform pg_advisory_xact_lock(hashtextextended(normalized_email, 0));

  perform public.purge_merchant_email_otp_aliases(v_now);

  select
    count(*)::integer,
    min(attempts.attempted_at) + interval '15 minutes'
  into v_failed_attempt_count, v_retry_at
  from public.merchant_email_otp_alias_attempts attempts
  where attempts.email = normalized_email
    and attempts.success = false
    and attempts.attempted_at > v_now - interval '15 minutes';

  -- The action-level email + request-identity limiter remains the primary
  -- guard. This higher service-side ceiling is a final safety net and must not
  -- slide when a caller is already throttled.
  if v_failed_attempt_count >= 20 then
    return query
    select 'throttled'::text, null::uuid, null::text, v_retry_at;
    return;
  end if;

  select aliases.*
  into v_alias
  from public.merchant_email_otp_aliases aliases
  where aliases.email = normalized_email
    and aliases.alias_code = p_alias_code
    and aliases.purpose in (normalized_purpose, 'legacy')
  order by
    case when aliases.purpose = normalized_purpose then 0 else 1 end,
    aliases.created_at desc
  limit 1
  for update;

  if not found then
    insert into public.merchant_email_otp_alias_attempts (
      email,
      alias_code,
      success,
      attempted_at
    )
    values (normalized_email, '[redacted]', false, v_now);

    return query
    select 'invalid'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_alias.expires_at <= v_now or v_alias.resolution = 'expired' then
    return query
    select 'expired'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_alias.resolution in ('verified', 'legacy_consumed')
     or (v_alias.consumed_at is not null and v_alias.resolution is null) then
    return query
    select 'used'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_alias.resolution = 'superseded' then
    return query
    select 'superseded'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_alias.resolution = 'rejected' then
    return query
    select 'rejected'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_alias.resolution is not null then
    return query
    select 'invalid'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if v_alias.reservation_id is not null
     and v_alias.reserved_until > v_now then
    return query
    select 'busy'::text, null::uuid, null::text, v_alias.reserved_until;
    return;
  end if;

  v_reservation_id := gen_random_uuid();

  update public.merchant_email_otp_aliases aliases
     set reservation_id = v_reservation_id,
         reserved_until = v_now + interval '2 minutes'
   where aliases.id = v_alias.id;

  insert into public.merchant_email_otp_alias_attempts (
    email,
    alias_code,
    success,
    attempted_at
  )
  values (normalized_email, '[redacted]', true, v_now);

  return query
  select
    'reserved'::text,
    v_reservation_id,
    v_alias.supabase_token,
    null::timestamptz;
end;
$$;

revoke all on function public.reserve_merchant_email_otp_alias(text, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_merchant_email_otp_alias(text, text, text)
  to service_role;

create or replace function public.finalize_merchant_email_otp_alias(
  p_reservation_id uuid,
  p_outcome text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_outcome text := lower(trim(p_outcome));
  affected_count integer := 0;
begin
  if coalesce(normalized_outcome, '') not in ('verified', 'expired', 'rejected') then
    raise invalid_parameter_value using message = 'Invalid alias finalization outcome';
  end if;

  update public.merchant_email_otp_aliases aliases
     set resolution = normalized_outcome,
         consumed_at = clock_timestamp(),
         supabase_token = '',
         reservation_id = null,
         reserved_until = null
   where aliases.reservation_id = p_reservation_id
     and aliases.resolution is null
     and aliases.consumed_at is null;
  get diagnostics affected_count = row_count;

  return affected_count = 1;
end;
$$;

revoke all on function public.finalize_merchant_email_otp_alias(uuid, text)
  from public, anon, authenticated;
grant execute on function public.finalize_merchant_email_otp_alias(uuid, text)
  to service_role;

create or replace function public.release_merchant_email_otp_alias(
  p_reservation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
begin
  update public.merchant_email_otp_aliases aliases
     set reservation_id = null,
         reserved_until = null
   where aliases.reservation_id = p_reservation_id
     and aliases.resolution is null
     and aliases.consumed_at is null;
  get diagnostics affected_count = row_count;

  return affected_count = 1;
end;
$$;

revoke all on function public.release_merchant_email_otp_alias(uuid)
  from public, anon, authenticated;
grant execute on function public.release_merchant_email_otp_alias(uuid)
  to service_role;

create or replace function public.revoke_merchant_email_otp_alias(
  p_alias_id uuid,
  p_outcome text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_outcome text := lower(trim(p_outcome));
  affected_count integer := 0;
begin
  if coalesce(normalized_outcome, '') <> 'delivery_failed' then
    raise invalid_parameter_value using message = 'Invalid alias revocation outcome';
  end if;

  update public.merchant_email_otp_aliases aliases
     set resolution = normalized_outcome,
         consumed_at = clock_timestamp(),
         supabase_token = '',
         reservation_id = null,
         reserved_until = null
   where aliases.id = p_alias_id
     and aliases.resolution is null
     and aliases.consumed_at is null;
  get diagnostics affected_count = row_count;

  return affected_count = 1;
end;
$$;

revoke all on function public.revoke_merchant_email_otp_alias(uuid, text)
  from public, anon, authenticated;
grant execute on function public.revoke_merchant_email_otp_alias(uuid, text)
  to service_role;

-- Rolling-deploy compatibility for an older app instance. New code has no
-- call site for this RPC; it can be dropped in a later migration once every
-- instance uses reserve/finalize/release.
create or replace function public.consume_merchant_email_otp_alias(
  p_email text,
  p_alias_code text
)
returns table (supabase_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  v_now timestamptz := clock_timestamp();
  provider_token text;
begin
  perform pg_advisory_xact_lock(hashtextextended(normalized_email, 0));

  perform public.purge_merchant_email_otp_aliases(v_now);

  with candidate as (
    select candidate.id, candidate.supabase_token as token
    from public.merchant_email_otp_aliases candidate
    where candidate.email = normalized_email
      and candidate.alias_code = p_alias_code
      and candidate.resolution is null
      and candidate.consumed_at is null
      and candidate.expires_at > v_now
      and (
        candidate.reservation_id is null
        or candidate.reserved_until <= v_now
      )
    order by candidate.created_at desc
    limit 1
    for update
  ), consumed as (
    update public.merchant_email_otp_aliases aliases
       set resolution = 'legacy_consumed',
           consumed_at = v_now,
           supabase_token = '',
           reservation_id = null,
           reserved_until = null
      from candidate
     where aliases.id = candidate.id
     returning candidate.token
  )
  select consumed.token into provider_token from consumed;

  if provider_token is null then
    return;
  end if;

  return query select provider_token as supabase_token;
end;
$$;

revoke all on function public.consume_merchant_email_otp_alias(text, text)
  from public, anon, authenticated;
grant execute on function public.consume_merchant_email_otp_alias(text, text)
  to service_role;
