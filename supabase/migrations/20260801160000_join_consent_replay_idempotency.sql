-- Join replay must not append unbounded consent evidence.
--
-- Membership creation and the loyalty-terms snapshot are both idempotent
-- (20260713110000: `on conflict (merchant_id, customer_id) do nothing` and
-- `on conflict on constraint customer_terms_membership_policy_unique`), but the
-- marketing-consent insert beside them was unconditional. Re-submitting the
-- same join therefore appended another consent_records row every time, from
-- TWO entry points: joinRewardsAction and claim_loyalty_invite.
--
-- The invariant is "one join-originated GRANT of consent per venue, customer,
-- channel and policy version". Withdrawals stay append-only, so
-- consent_status = 'opted_in' is part of the key — an explicit opt-out is still
-- recorded, and admin_record_consent_opt_out keeps working with any source.
--
-- Closes: join-terms-replay-unbounded-consent-rows.

-- ---------------------------------------------------------------------------
-- 1. Refuse to migrate silently over pre-existing duplicates
-- ---------------------------------------------------------------------------
-- Same locked-preflight shape as 20260710100000:9-81. Collapsing replayed
-- consent evidence is a data decision with a retention/GDPR dimension; it must
-- be made deliberately, not as a side effect of a deploy.
do $join_consent_preflight$
declare
  v_duplicate_count bigint;
begin
  if to_regclass('public.consent_records_customer_join_once_idx') is null then
    lock table public.consent_records in share row exclusive mode;

    select count(*) into v_duplicate_count
    from (
      select merchant_id, customer_id, channel, policy_version
      from public.consent_records
      where source = 'customer_join'
        and consent_status = 'opted_in'
        and customer_id is not null
      group by 1, 2, 3, 4
      having count(*) > 1
    ) duplicates;

    if v_duplicate_count > 0 then
      raise exception using
        errcode = '23505',
        message = format(
          'Cannot enforce one join consent per venue/customer/channel/policy: %s duplicate group(s) exist',
          v_duplicate_count
        ),
        hint = 'Collapse replayed customer_join consent rows explicitly (keep the earliest per group) before replaying this migration.';
    end if;
  end if;
end;
$join_consent_preflight$;

-- ---------------------------------------------------------------------------
-- 2. The natural key
-- ---------------------------------------------------------------------------
-- `customer_id is not null` is load-bearing twice: erasure nulls the column
-- (the FK is ON DELETE SET NULL so compliance history survives deletion) and
-- that anonymised evidence is legitimately duplicable, and it also keeps
-- already-orphaned legacy rows out of both the index and the preflight.
create unique index if not exists consent_records_customer_join_once_idx
  on public.consent_records (merchant_id, customer_id, channel, policy_version)
  where source = 'customer_join'
    and consent_status = 'opted_in'
    and customer_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Make the join write idempotent
-- ---------------------------------------------------------------------------
-- Reproduced verbatim from the effective 20260713110000 definition, with two
-- edits: the ON CONFLICT clause (its predicate must stay character-identical to
-- the index above for arbiter inference) and btrim(p_policy_version), so the
-- consent key agrees with the terms-acceptance key, which already btrims.
CREATE OR REPLACE FUNCTION public.join_customer_membership(p_customer_id uuid, p_merchant_slug text, p_qr_id text, p_marketing_opt_in boolean, p_policy_version text)
 RETURNS TABLE(membership_id uuid, created_membership boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  customer_record record;
  v_merchant_id uuid;
  v_loyalty_card_id uuid;
  v_qr_code_uuid uuid;
  v_merchant_status text;
  v_card_active boolean;
  v_billing_status text;
  v_requires_billing boolean;
  v_availability_reason text;
  v_merchant_name text;
  v_card_name text;
  v_reward_terms text;
  v_stamps_required integer;
  v_terms_json jsonb;
  v_terms_snapshot text;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;
  if p_policy_version is null or btrim(p_policy_version) = '' then
    raise exception 'Loyalty terms version required';
  end if;

  select customers.id, customers.auth_user_id, customers.email,
         customers.email_hmac, customers.email_verified_at,
         customers.phone_hmac, customers.phone_verified_at
  into customer_record
  from public.customers
  where customers.id = p_customer_id;

  if customer_record.id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('customer-identity:' || p_customer_id::text, 0)
  );

  select customers.id, customers.auth_user_id, customers.email,
         customers.email_hmac, customers.email_verified_at,
         customers.phone_hmac, customers.phone_verified_at
  into customer_record
  from public.customers
  where customers.id = p_customer_id;

  if customer_record.id is null or not (
    (customer_record.phone_hmac is not null and customer_record.phone_verified_at is not null)
    or
    (customer_record.email is not null and customer_record.email_verified_at is not null)
  ) then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  if not public.is_service_role_request() then
    if current_user_id is null
      or customer_record.auth_user_id is null
      or customer_record.auth_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Customer ownership required';
    end if;
  end if;

  if p_qr_id is not null and p_qr_id <> '' then
    select
      qr_codes.id,
      qr_codes.merchant_id,
      qr_codes.loyalty_card_id,
      merchants.status,
      loyalty_cards.is_active,
      billing_customers.status,
      merchants.requires_billing,
      merchants.business_name,
      loyalty_cards.card_name,
      loyalty_cards.reward_terms,
      loyalty_cards.stamps_required
    into
      v_qr_code_uuid,
      v_merchant_id,
      v_loyalty_card_id,
      v_merchant_status,
      v_card_active,
      v_billing_status,
      v_requires_billing,
      v_merchant_name,
      v_card_name,
      v_reward_terms,
      v_stamps_required
    from public.qr_codes
    join public.merchants on merchants.id = qr_codes.merchant_id
    join public.loyalty_cards on loyalty_cards.id = qr_codes.loyalty_card_id
    left join public.billing_customers on billing_customers.merchant_id = qr_codes.merchant_id
    where qr_codes.qr_id = p_qr_id
      and qr_codes.destination_type = 'join'
      and qr_codes.is_active
      and loyalty_cards.is_active
      and merchants.business_slug = p_merchant_slug;
  else
    select
      merchants.id,
      loyalty_cards.id,
      merchants.status,
      loyalty_cards.is_active,
      billing_customers.status,
      merchants.requires_billing,
      merchants.business_name,
      loyalty_cards.card_name,
      loyalty_cards.reward_terms,
      loyalty_cards.stamps_required
    into
      v_merchant_id,
      v_loyalty_card_id,
      v_merchant_status,
      v_card_active,
      v_billing_status,
      v_requires_billing,
      v_merchant_name,
      v_card_name,
      v_reward_terms,
      v_stamps_required
    from public.merchants
    join public.loyalty_cards on loyalty_cards.merchant_id = merchants.id
    left join public.billing_customers on billing_customers.merchant_id = merchants.id
    where merchants.business_slug = p_merchant_slug
      and loyalty_cards.is_active
    order by loyalty_cards.created_at asc
    limit 1;
  end if;

  if v_merchant_id is null or v_loyalty_card_id is null then
    raise exception 'This loyalty card is unavailable';
  end if;

  v_availability_reason := public.loyalty_availability_reason(
    v_merchant_status,
    v_card_active,
    v_billing_status,
    v_requires_billing
  );
  if v_availability_reason = 'billing_required' then
    raise exception 'This merchant loyalty programme is not active yet';
  elsif v_availability_reason in ('merchant_inactive', 'billing_blocked') then
    raise exception 'This merchant loyalty programme is not active';
  elsif v_availability_reason is not null then
    raise exception 'This loyalty card is unavailable';
  end if;

  insert into public.customer_memberships (merchant_id, customer_id)
  values (v_merchant_id, p_customer_id)
  on conflict (merchant_id, customer_id) do nothing
  returning id into membership_id;

  created_membership := membership_id is not null;
  if membership_id is null then
    select memberships.id
    into membership_id
    from public.customer_memberships memberships
    where memberships.merchant_id = v_merchant_id
      and memberships.customer_id = p_customer_id;
  end if;

  v_terms_json := jsonb_build_object(
    'merchant_name', v_merchant_name,
    'card_name', v_card_name,
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'reward',
        'body', 'A mystery reward is assigned from the venue reward pool when the customer earns the final visit stamp.'
      ),
      jsonb_build_object(
        'id', 'earning-rule',
        'body', format('Collect %s visit stamps from the venue QR. One stamp may be issued per UK date.', v_stamps_required)
      ),
      jsonb_build_object('id', 'stamps-needed', 'body', format('%s stamps', v_stamps_required)),
      jsonb_build_object(
        'id', 'redemption',
        'body', 'The assigned reward can be redeemed from the next UK business day after it is revealed. Show your reward QR at the counter and the venue team scans it.'
      ),
      jsonb_build_object(
        'id', 'exclusions',
        'body', coalesce(nullif(btrim(v_reward_terms), ''), 'No additional exclusions configured.')
      ),
      jsonb_build_object(
        'id', 'fraud-and-abuse',
        'body', 'The merchant may refuse, cancel, or adjust stamps and rewards where abuse, duplicate claims, QR misuse, or location anomalies are suspected. Location checks are non-blocking: stamps still save if location is denied, unavailable, timed out, or inaccurate.'
      ),
      jsonb_build_object('id', 'merchant-contact', 'body', 'Ask the venue team')
    )
  );
  v_terms_snapshot := v_terms_json::text;

  insert into public.customer_loyalty_terms_acceptances (
    membership_id,
    customer_id,
    merchant_id,
    loyalty_card_id,
    qr_code_id,
    policy_version,
    terms_snapshot,
    terms_sha256
  ) values (
    membership_id,
    p_customer_id,
    v_merchant_id,
    v_loyalty_card_id,
    v_qr_code_uuid,
    btrim(p_policy_version),
    v_terms_json,
    encode(extensions.digest(v_terms_snapshot, 'sha256'), 'hex')
  )
  on conflict on constraint customer_terms_membership_policy_unique do nothing;

  if p_marketing_opt_in then
    insert into public.consent_records (
      merchant_id, customer_id, channel, consent_status, source, policy_version, metadata
    ) values (
      v_merchant_id,
      p_customer_id,
      case when customer_record.email is not null then 'email' else 'sms' end,
      'opted_in',
      'customer_join',
      btrim(p_policy_version),
      jsonb_build_object('qr_code_id', v_qr_code_uuid)
    )
    on conflict (merchant_id, customer_id, channel, policy_version)
      where source = 'customer_join'
        and consent_status = 'opted_in'
        and customer_id is not null
      do nothing;
  end if;

  if created_membership then
    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id, qr_code_id,
      actor_type, actor_id, metadata
    ) values (
      'customer_joined',
      v_merchant_id,
      p_customer_id,
      membership_id,
      v_qr_code_uuid,
      'customer',
      coalesce(current_user_id::text, p_customer_id::text),
      jsonb_build_object('marketing_opt_in', p_marketing_opt_in)
    );
  end if;

  return next;
end;
$function$;

revoke all on function public.join_customer_membership(uuid, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.join_customer_membership(uuid, text, text, boolean, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Consent evidence is written by the server, not by callers
-- ---------------------------------------------------------------------------
-- Every application read of consent_records goes through the service-role
-- client and every write goes through a SECURITY DEFINER RPC, so the direct
-- caller-writable surface is unused. Removing it stops a caller minting its own
-- consent evidence, and the trigger keeps that true if the blanket grant from
-- 20260606142000:2606 is ever restored.
revoke insert, update, delete on table public.consent_records from authenticated;
drop policy if exists consent_records_insert_customer_or_admin on public.consent_records;

create or replace function public.enforce_consent_evidence_server_owned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_service_role_request()
     or public.is_internal_admin()
     or not public.has_request_context() then
    return new;
  end if;

  raise exception using
    errcode = 'insufficient_privilege',
    message = 'Consent evidence is recorded by the server, not by direct writes';
end;
$$;

revoke all on function public.enforce_consent_evidence_server_owned()
  from public, anon, authenticated;
grant execute on function public.enforce_consent_evidence_server_owned() to service_role;

drop trigger if exists consent_records_server_owned on public.consent_records;

create trigger consent_records_server_owned
  before insert on public.consent_records
  for each row
  execute function public.enforce_consent_evidence_server_owned();

notify pgrst, 'reload schema';
