-- A customer-entered date of birth is profile data, not verified age or
-- birthday evidence. Keep the existing profile field, but attach explicit
-- verifier provenance and require it at every reward entitlement sink.

alter table public.customers
  add column if not exists date_of_birth_verified_at timestamptz,
  add column if not exists date_of_birth_verification_source text,
  add column if not exists date_of_birth_verified_by uuid;

alter table public.customers
  drop constraint if exists customers_date_of_birth_verification_coherent;
alter table public.customers
  add constraint customers_date_of_birth_verification_coherent check (
    (
      date_of_birth_verified_at is null
      and date_of_birth_verification_source is null
      and date_of_birth_verified_by is null
    )
    or (
      date_of_birth is not null
      and date_of_birth_verified_at is not null
      and date_of_birth_verification_source in ('internal_admin', 'trusted_database')
      and (
        date_of_birth_verification_source <> 'internal_admin'
        or date_of_birth_verified_by is not null
      )
    )
  );

comment on column public.customers.date_of_birth_verified_at is
  'When an authorised verifier confirmed the stored date of birth; null means customer-asserted only.';
comment on column public.customers.date_of_birth_verification_source is
  'Authoritative verification path. Customer/profile writes cannot populate this field.';
comment on column public.customers.date_of_birth_verified_by is
  'Internal admin user that performed verification, when source is internal_admin.';

create or replace function public.protect_customer_date_of_birth_verification()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_admin_user_id uuid := (select auth.uid());
  v_is_internal_admin boolean := public.is_internal_admin();
  v_is_customer_erasure boolean :=
    current_setting('app.customer_erasure', true) = 'true';
  -- DB migrations and the live DB test harness connect as postgres directly.
  -- PostgREST service-role requests retain authenticator as session_user and
  -- therefore cannot enter this branch merely by presenting a service key.
  v_is_trusted_database boolean := session_user in ('postgres', 'supabase_admin');
begin
  if tg_op = 'INSERT' then
    if new.date_of_birth is null then
      new.date_of_birth_verified_at := null;
      new.date_of_birth_verification_source := null;
      new.date_of_birth_verified_by := null;
    elsif v_is_trusted_database then
      new.date_of_birth_verified_at := coalesce(
        new.date_of_birth_verified_at,
        clock_timestamp()
      );
      new.date_of_birth_verification_source := 'trusted_database';
      new.date_of_birth_verified_by := null;
    elsif new.date_of_birth_verified_at is not null
       or new.date_of_birth_verification_source is not null
       or new.date_of_birth_verified_by is not null then
      raise insufficient_privilege using
        message = 'Date of birth verification provenance cannot be supplied by this caller';
    end if;

    return new;
  end if;

  if not v_is_internal_admin
     and not v_is_trusted_database
     and (
       new.date_of_birth_verified_at is distinct from old.date_of_birth_verified_at
       or new.date_of_birth_verification_source is distinct from old.date_of_birth_verification_source
       or new.date_of_birth_verified_by is distinct from old.date_of_birth_verified_by
     ) then
    raise insufficient_privilege using
      message = 'Date of birth verification provenance cannot be changed by this caller';
  end if;

  if new.date_of_birth is distinct from old.date_of_birth then
    if v_is_customer_erasure then
      new.date_of_birth_verified_at := null;
      new.date_of_birth_verification_source := null;
      new.date_of_birth_verified_by := null;
    elsif v_is_trusted_database then
      if new.date_of_birth is null then
        new.date_of_birth_verified_at := null;
        new.date_of_birth_verification_source := null;
        new.date_of_birth_verified_by := null;
      else
        new.date_of_birth_verified_at := clock_timestamp();
        new.date_of_birth_verification_source := 'trusted_database';
        new.date_of_birth_verified_by := null;
      end if;
    elsif v_is_internal_admin then
      if new.date_of_birth is null
         or new.date_of_birth_verified_at is null
         or new.date_of_birth_verification_source <> 'internal_admin'
         or new.date_of_birth_verified_by is distinct from v_admin_user_id then
        raise exception 'Internal admin DOB changes require audited verification provenance';
      end if;
    else
      -- Customer-originated profile writes use a service-role application
      -- bridge. Changing the asserted value invalidates any prior verification.
      new.date_of_birth_verified_at := null;
      new.date_of_birth_verification_source := null;
      new.date_of_birth_verified_by := null;
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists customers_protect_date_of_birth_verification
  on public.customers;
create trigger customers_protect_date_of_birth_verification
  before insert or update on public.customers
  for each row execute function public.protect_customer_date_of_birth_verification();

revoke all on function public.protect_customer_date_of_birth_verification()
  from public, anon, authenticated;
grant execute on function public.protect_customer_date_of_birth_verification()
  to service_role;

create or replace function public.retire_reward_scan_tokens_after_dob_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.date_of_birth is distinct from old.date_of_birth
     or (
       old.date_of_birth_verified_at is not null
       and new.date_of_birth_verified_at is null
     ) then
    update public.reward_scan_tokens
    set superseded_at = coalesce(superseded_at, clock_timestamp()),
        expires_at = '-infinity'::timestamptz
    where customer_id = new.id
      and consumed_at is null;
  end if;

  return new;
end;
$function$;

drop trigger if exists customers_retire_reward_tokens_after_dob_change
  on public.customers;
create trigger customers_retire_reward_tokens_after_dob_change
  after update of date_of_birth,
    date_of_birth_verified_at,
    date_of_birth_verification_source,
    date_of_birth_verified_by
  on public.customers
  for each row execute function public.retire_reward_scan_tokens_after_dob_change();

revoke all on function public.retire_reward_scan_tokens_after_dob_change()
  from public, anon, authenticated, service_role;
grant execute on function public.retire_reward_scan_tokens_after_dob_change()
  to service_role;

create or replace function public.customer_has_verified_adult_date_of_birth(
  p_customer_id uuid,
  p_now timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    (
      select customers.date_of_birth is not null
        and customers.date_of_birth_verified_at is not null
        and customers.date_of_birth_verification_source is not null
        and customers.date_of_birth
          <= (public.uk_business_date(p_now) - interval '18 years')::date
      from public.customers
      where customers.id = p_customer_id
    ),
    false
  );
$function$;

revoke all on function public.customer_has_verified_adult_date_of_birth(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.customer_has_verified_adult_date_of_birth(uuid, timestamptz)
  to service_role;

create or replace function public.require_verified_dob_for_reward_scan_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.customer_has_verified_adult_date_of_birth(new.customer_id, now()) then
    raise exception 'Verified adult date of birth required before reward collection';
  end if;

  return new;
end;
$function$;

drop trigger if exists reward_scan_tokens_require_verified_dob
  on public.reward_scan_tokens;
create trigger reward_scan_tokens_require_verified_dob
  before insert on public.reward_scan_tokens
  for each row execute function public.require_verified_dob_for_reward_scan_token();

revoke all on function public.require_verified_dob_for_reward_scan_token()
  from public, anon, authenticated;
grant execute on function public.require_verified_dob_for_reward_scan_token()
  to service_role;

create or replace function public.require_verified_dob_for_reward_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_is_birthday_insert boolean :=
    tg_op = 'INSERT' and new.source = 'birthday_month';
  v_is_redeeming boolean :=
    new.status = 'redeemed'
    and (tg_op = 'INSERT' or old.status is distinct from new.status);
begin
  if v_is_birthday_insert
     and not public.customer_has_verified_adult_date_of_birth(new.customer_id, now()) then
    -- The birthday sweep is set-based. Skip an ineligible row rather than
    -- aborting issuance for every other verified customer in the statement.
    return null;
  end if;

  if v_is_redeeming
     and not public.customer_has_verified_adult_date_of_birth(new.customer_id, now()) then
    raise exception 'Verified adult date of birth required before reward redemption';
  end if;

  return new;
end;
$function$;

drop trigger if exists reward_events_require_verified_dob
  on public.reward_events;
create trigger reward_events_require_verified_dob
  before insert or update on public.reward_events
  for each row execute function public.require_verified_dob_for_reward_event();

revoke all on function public.require_verified_dob_for_reward_event()
  from public, anon, authenticated;
grant execute on function public.require_verified_dob_for_reward_event()
  to service_role;

-- Tokens minted before this provenance boundary must not remain reusable.
update public.reward_scan_tokens tokens
set superseded_at = coalesce(tokens.superseded_at, clock_timestamp()),
    expires_at = '-infinity'::timestamptz
where tokens.consumed_at is null
  and not public.customer_has_verified_adult_date_of_birth(tokens.customer_id, now());

create or replace function public.admin_verify_customer_date_of_birth(
  p_customer_id uuid,
  p_date_of_birth date,
  p_reason text
)
returns table (
  customer_id uuid,
  date_of_birth date,
  verified_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_admin_user_id uuid := (select auth.uid());
  v_verified_at timestamptz := clock_timestamp();
  v_previous_date date;
begin
  if v_admin_user_id is null or not public.is_internal_admin() then
    raise insufficient_privilege using message = 'Activated AAL2 internal admin required';
  end if;
  if p_date_of_birth is null
     or p_date_of_birth > public.uk_business_date(now())
     or p_date_of_birth < (public.uk_business_date(now()) - interval '130 years')::date then
    raise exception 'A valid historical date of birth is required';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 4
     or char_length(btrim(p_reason)) > 500 then
    raise exception 'Verification reason must be between 4 and 500 characters';
  end if;

  select customers.date_of_birth
  into v_previous_date
  from public.customers
  where customers.id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer not found';
  end if;

  update public.customers
  set date_of_birth = p_date_of_birth,
      date_of_birth_verified_at = v_verified_at,
      date_of_birth_verification_source = 'internal_admin',
      date_of_birth_verified_by = v_admin_user_id
  where id = p_customer_id;

  insert into public.audit_logs (
    actor_type,
    actor_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  ) values (
    'admin',
    v_admin_user_id::text,
    p_customer_id,
    'customers',
    p_customer_id,
    'customer_date_of_birth_verified',
    jsonb_build_object(
      'reason', btrim(p_reason),
      'changed', v_previous_date is distinct from p_date_of_birth,
      'verification_source', 'internal_admin'
    )
  );

  customer_id := p_customer_id;
  date_of_birth := p_date_of_birth;
  verified_at := v_verified_at;
  return next;
end;
$function$;

revoke all on function public.admin_verify_customer_date_of_birth(uuid, date, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_verify_customer_date_of_birth(uuid, date, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
