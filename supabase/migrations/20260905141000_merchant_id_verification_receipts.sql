-- Durable evidence for an in-person check, writable only by the owner RPC.
-- No document images/numbers or duplicate DOB/contact data are retained.
create table private.merchant_id_verification_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  owner_user_id uuid not null,
  reward_event_id uuid not null unique references public.reward_events(id) on delete cascade,
  verified_at timestamptz not null,
  transaction_id xid8 not null default pg_current_xact_id(),
  attestation text not null check (attestation = 'photo_id_matches_customer_dob_and_adult')
);
create index merchant_id_verification_receipts_customer_idx
  on private.merchant_id_verification_receipts(customer_id);
create index merchant_id_verification_receipts_merchant_idx
  on private.merchant_id_verification_receipts(merchant_id);
alter table private.merchant_id_verification_receipts enable row level security;
alter table private.merchant_id_verification_receipts force row level security;
revoke all on table private.merchant_id_verification_receipts
  from public, anon, authenticated, service_role;

alter table public.customers drop constraint customers_date_of_birth_verification_coherent;
alter table public.customers add constraint customers_date_of_birth_verification_coherent check (
  (date_of_birth_verified_at is null and date_of_birth_verification_source is null
    and date_of_birth_verified_by is null)
  or (date_of_birth is not null and date_of_birth_verified_at is not null
    and date_of_birth_verification_source in ('internal_admin', 'trusted_database', 'merchant_owner')
    and (date_of_birth_verification_source = 'trusted_database'
      or date_of_birth_verified_by is not null))
);
comment on column public.customers.date_of_birth_verified_by is
  'Authenticated internal admin or venue owner who performed the recorded evidence check.';

create or replace function public.protect_customer_date_of_birth_verification()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_admin_user_id uuid := (select auth.uid());
  v_is_internal_admin boolean := public.is_internal_admin();
  v_is_customer_erasure boolean := current_setting('app.customer_erasure', true) = 'true';
  v_is_trusted_database boolean := session_user in ('postgres', 'supabase_admin');
  v_is_owner_verification boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.date_of_birth is null then
      new.date_of_birth_verified_at := null;
      new.date_of_birth_verification_source := null;
      new.date_of_birth_verified_by := null;
    elsif v_is_trusted_database then
      new.date_of_birth_verified_at := coalesce(new.date_of_birth_verified_at, clock_timestamp());
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

  if new.date_of_birth_verification_source = 'merchant_owner'
     and new.date_of_birth is not distinct from old.date_of_birth
     and new.date_of_birth_verified_by = v_admin_user_id
     and auth.role() = 'authenticated' then
    select exists (
      select 1 from private.merchant_id_verification_receipts receipts
      join public.merchants merchants on merchants.id = receipts.merchant_id
      where receipts.customer_id = new.id
        and receipts.owner_user_id = v_admin_user_id
        and merchants.owner_user_id = v_admin_user_id
        and receipts.verified_at = new.date_of_birth_verified_at
        and receipts.transaction_id = pg_current_xact_id()
    ) into v_is_owner_verification;
  end if;

  if not v_is_internal_admin and not v_is_trusted_database and not v_is_owner_verification
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
      if new.date_of_birth is null or new.date_of_birth_verified_at is null
         or new.date_of_birth_verification_source <> 'internal_admin'
         or new.date_of_birth_verified_by is distinct from v_admin_user_id then
        raise exception 'Internal admin DOB changes require audited verification provenance';
      end if;
    else
      new.date_of_birth_verified_at := null;
      new.date_of_birth_verification_source := null;
      new.date_of_birth_verified_by := null;
    end if;
  end if;
  return new;
end;
$function$;

-- Internal redemption may recognise the owner only inside this exact operation.
-- The receipt is not a reusable capability and cannot be supplied by a client.
create or replace function private.has_current_owner_id_check(
  p_reward_id uuid, p_customer_id uuid, p_owner_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
  select auth.role() = 'authenticated' and exists (
    select 1 from private.merchant_id_verification_receipts receipts
    join public.merchants merchants on merchants.id = receipts.merchant_id
    where receipts.reward_event_id = p_reward_id
      and receipts.customer_id = p_customer_id
      and receipts.owner_user_id = p_owner_user_id
      and merchants.owner_user_id = p_owner_user_id
      and receipts.transaction_id = pg_current_xact_id()
  );
$function$;
revoke all on function private.has_current_owner_id_check(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.purge_merchant_id_checks_after_customer_erasure()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.date_of_birth is null and new.full_name is null then
    delete from private.merchant_id_verification_receipts where customer_id = new.id;
  end if;
  return new;
end;
$function$;
create trigger customers_purge_merchant_id_checks_after_erasure
after update of date_of_birth, full_name on public.customers
for each row execute function public.purge_merchant_id_checks_after_customer_erasure();
revoke all on function public.purge_merchant_id_checks_after_customer_erasure()
  from public, anon, authenticated, service_role;

create or replace function public.verify_and_collect_reward_scan_token(
  p_scan_token uuid, p_expected_date_of_birth date, p_id_confirmed boolean
)
returns table (
  reward_event_id uuid, reward_name text, membership_id uuid, new_stamp_count integer
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_merchant_id uuid := private.reward_scan_owner_merchant(p_scan_token);
  v_owner_id uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_token public.reward_scan_tokens%rowtype;
  v_reason text;
  v_verified_at timestamptz := clock_timestamp();
  v_receipt_id uuid;
begin
  if p_id_confirmed is distinct from true then
    raise exception 'Confirm the in-person photo ID check before collection';
  end if;

  select * into v_token from public.reward_scan_tokens where id = p_scan_token;
  -- Customer first also serialises checks for the same account at two venues
  -- and cannot deadlock against profile changes that retire this account's tokens.
  select * into v_customer from public.customers where id = v_token.customer_id for update;
  perform 1 from public.reward_events where id = v_token.reward_event_id for update;
  select * into v_token from public.reward_scan_tokens where id = p_scan_token for update;
  if not found then raise exception 'Reward scan token not found'; end if;
  if v_token.merchant_id is distinct from v_merchant_id then
    raise insufficient_privilege using message = 'Reward not available to this merchant';
  end if;
  if v_token.superseded_at is not null then raise exception 'Reward scan token superseded'; end if;
  if v_token.expires_at <= now() then raise exception 'Reward scan token expired'; end if;
  if v_token.consumed_at is not null then raise exception 'Reward already collected'; end if;
  if p_expected_date_of_birth is null
     or v_customer.date_of_birth is distinct from p_expected_date_of_birth then
    raise exception 'Customer date of birth changed; refresh and check the ID again';
  end if;
  -- Recheck ownership after waiting for locks, before making any durable changes.
  perform private.reward_scan_owner_merchant(p_scan_token);
  v_reason := private.reward_scan_eligibility_reason(v_token.reward_event_id);
  if v_reason is not null then raise exception '%', v_reason; end if;

  insert into private.merchant_id_verification_receipts (
    customer_id, merchant_id, owner_user_id, reward_event_id, verified_at, attestation
  ) values (
    v_customer.id, v_merchant_id, v_owner_id, v_token.reward_event_id, v_verified_at,
    'photo_id_matches_customer_dob_and_adult'
  ) returning id into v_receipt_id;

  -- A second venue may have verified the account while this owner reviewed ID.
  -- Keep its existing account provenance; this receipt records this actual check.
  if not public.customer_has_verified_adult_date_of_birth(v_customer.id) then
    update public.customers
    set date_of_birth_verified_at = v_verified_at,
        date_of_birth_verification_source = 'merchant_owner',
        date_of_birth_verified_by = v_owner_id
    where id = v_customer.id;
  end if;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  ) values (
    'merchant', v_owner_id::text, v_merchant_id, v_customer.id, 'customers', v_customer.id,
    'customer_date_of_birth_verified',
    jsonb_build_object(
      'verification_source', 'merchant_owner', 'receipt_id', v_receipt_id,
      'reward_id', v_token.reward_event_id, 'changed', false,
      'reason', 'In-person photo ID matches customer, stored date of birth and adult age',
      'account_already_verified', v_customer.date_of_birth_verified_at is not null
    )
  );

  -- An exception here rolls back the receipt, customer update and audit as well.
  return query select * from public.collect_current_reward_scan_token(p_scan_token, v_merchant_id);
end;
$function$;
revoke all on function public.verify_and_collect_reward_scan_token(uuid, date, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.verify_and_collect_reward_scan_token(uuid, date, boolean)
  to authenticated;

notify pgrst, 'reload schema';
