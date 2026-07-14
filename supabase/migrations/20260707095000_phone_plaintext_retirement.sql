-- db phone plaintext retirement: plaintext customer phone numbers stop
-- existing at rest (2026-07-06 audit; owner-sequenced last in the program).
--
-- customers.phone was legacy-only: new signups write NULL and the encrypted
-- set (phone_hmac / phone_ciphertext / phone_last4 / phone_country) is the
-- live identity — but the plaintext column still counted as "contact
-- present", fed the masked view's fallback, was returned raw by
-- get_reward_scan_context, and was selected by admin lookups.
--
-- Order matters and everything happens in this one migration:
--   1. backfill phone_last4 from the plaintext digits for legacy rows;
--   2. recreate every DB object that referenced the column
--      (admin_erase_customer_pii, admin_export_customer_data,
--      admin_purge_stale_customer_pii, join_customer_membership,
--      get_reward_scan_context — whose RETURNS loses the raw customer_phone
--      column, so drop + create + re-grant — the customers_masked view, and
--      the verified-contact trigger function);
--   3. swap the contact-present CHECK to email | phone_hmac | phone_last4
--      (the HMAC key lives app-side, so legacy phone-only rows keep passing
--      via their backfilled last4);
--   4. drop the column.
--
-- The join channel decision never read plaintext phone (it keys on email
-- presence), so consent behavior is unchanged by construction.
--
-- Idempotent: the backfill no-ops once the column is gone (guarded), OR
-- REPLACE re-runs harmlessly, the CHECK swap and drop are guarded.

-- 1) Backfill last4 for legacy plaintext-only rows (before the drop).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'phone'
  ) then
    update public.customers
    set phone_last4 = nullif(right(regexp_replace(phone, '[^0-9]', '', 'g'), 4), '')
    where phone is not null and phone_last4 is null;
  end if;
end
$$;

-- 2) Recreate the referencing objects.

CREATE OR REPLACE FUNCTION public.admin_erase_customer_pii(p_customer_id uuid, p_merchant_id uuid, p_channel text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  admin_user_id uuid;
  surrogate_email text;
  erased_count integer;
  v_phone_hmac text;
  v_email_hmac text;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
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

  -- Capture the phone HMAC before the update nulls it, so invites keyed only on
  -- the hashed phone can still be found and scrubbed.
  select phone_hmac, email_hmac
  into v_phone_hmac, v_email_hmac
  from public.customers
  where id = p_customer_id;

  surrogate_email := 'erased+' || replace(p_customer_id::text, '-', '') || '@privacy.invalid';
  perform set_config('app.customer_erasure', 'true', true);

  update public.customers
  set
    auth_user_id = null,
    email = surrogate_email,
    email_hmac = null,
    email_verified_at = null,
    full_name = null,
    date_of_birth = null,
    phone_hmac = null,
    phone_ciphertext = null,
    phone_last4 = null,
    phone_country = null,
    phone_verified_at = null,
    updated_at = now()
  where id = p_customer_id;

  get diagnostics erased_count = row_count;
  perform set_config('app.customer_erasure', '', true);

  if erased_count <> 1 then
    raise exception 'Customer not found';
  end if;

  -- Scrub any invite tied to this customer: cancel live ones, drop every hash.
  update public.pending_reward_invites
  set status = case when status in ('pending', 'matched') then 'cancelled' else status end,
      email_hmac = null, phone_hmac = null, email_masked = null, phone_last4 = null,
      claim_token_hash = 'scrubbed:' || id::text, updated_at = now()
  where matched_customer_id = p_customer_id
     or attached_customer_id = p_customer_id
     or (v_phone_hmac is not null and phone_hmac = v_phone_hmac)
     or (v_email_hmac is not null and email_hmac = v_email_hmac);

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'admin', admin_user_id::text, p_merchant_id, p_customer_id, 'customers', p_customer_id,
    'customer_pii_erased',
    jsonb_build_object(
      'request_type', 'deletion', 'channel', p_channel, 'notes', trim(p_notes),
      'surrogate', surrogate_email, 'ledger_retained', true
    )
  );

  return jsonb_build_object(
    'ok', true, 'request_type', 'deletion', 'customer_id', p_customer_id,
    'surrogate', surrogate_email, 'ledger_retained', true
  );
end;
$function$

;

CREATE OR REPLACE FUNCTION public.admin_export_customer_data(p_customer_id uuid, p_merchant_id uuid, p_channel text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  admin_user_id uuid;
  customer_json jsonb;
  membership_json jsonb;
  stamp_json jsonb;
  reward_json jsonb;
  pending_invite_json jsonb;
  consent_json jsonb;
  notification_json jsonb;
  product_event_json jsonb;
  export_payload jsonb;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
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

  select to_jsonb(customer_row)
  into customer_json
  from (
    select
      id,
      auth_user_id,
      email,
      email_verified_at,
      full_name,
      date_of_birth,
      phone_last4,
      phone_country,
      phone_verified_at,
      created_at,
      updated_at
    from public.customers
    where id = p_customer_id
  ) as customer_row;

  if customer_json is null then
    raise exception 'Customer not found';
  end if;

  select coalesce(jsonb_agg(to_jsonb(membership_row) order by membership_row.created_at), '[]'::jsonb)
  into membership_json
  from (
    select
      id,
      merchant_id,
      current_stamp_count,
      total_stamps_earned,
      total_rewards_redeemed,
      last_visit_at,
      active_cycle_number,
      created_at,
      updated_at
    from public.customer_memberships
    where customer_id = p_customer_id
  ) as membership_row;

  select coalesce(jsonb_agg(to_jsonb(stamp_row) order by stamp_row.created_at), '[]'::jsonb)
  into stamp_json
  from (
    select
      id,
      merchant_id,
      membership_id,
      loyalty_card_id,
      location_id,
      event_type,
      stamps_delta,
      created_at,
      metadata
    from public.stamp_events
    where customer_id = p_customer_id
  ) as stamp_row;

  select coalesce(jsonb_agg(to_jsonb(reward_row) order by reward_row.created_at), '[]'::jsonb)
  into reward_json
  from (
    select
      id,
      merchant_id,
      membership_id,
      loyalty_card_id,
      status,
      source,
      birthday_year,
      reward_name,
      reward_terms,
      cycle_number,
      redeemable_from,
      expires_at,
      redeemed_at,
      expired_at,
      created_at,
      updated_at,
      metadata
    from public.reward_events
    where customer_id = p_customer_id
  ) as reward_row;

  select coalesce(jsonb_agg(to_jsonb(invite_row) order by invite_row.created_at), '[]'::jsonb)
  into pending_invite_json
  from (
    select
      id,
      merchant_id,
      status,
      email_masked,
      phone_last4,
      reward_name,
      reward_terms,
      personal_message,
      reward_expires_after_days,
      email_send_status,
      invite_expires_at,
      matched_customer_id,
      attached_membership_id,
      attached_reward_event_id,
      attached_at,
      created_at,
      updated_at
    from public.pending_reward_invites
    where matched_customer_id = p_customer_id
       or attached_customer_id = p_customer_id
  ) as invite_row;

  select coalesce(jsonb_agg(to_jsonb(consent_row) order by consent_row.created_at), '[]'::jsonb)
  into consent_json
  from (
    select
      id,
      merchant_id,
      channel,
      consent_status,
      source,
      policy_version,
      created_at,
      metadata
    from public.consent_records
    where customer_id = p_customer_id
  ) as consent_row;

  select coalesce(jsonb_agg(to_jsonb(notification_row) order by notification_row.created_at), '[]'::jsonb)
  into notification_json
  from (
    select
      id,
      event_type,
      category,
      merchant_id,
      membership_id,
      reward_event_id,
      status,
      due_at,
      created_at,
      updated_at,
      metadata
    from public.notification_events
    where customer_id = p_customer_id
  ) as notification_row;

  select coalesce(jsonb_agg(to_jsonb(product_event_row) order by product_event_row.created_at), '[]'::jsonb)
  into product_event_json
  from (
    select
      id,
      event_name,
      merchant_id,
      membership_id,
      qr_code_id,
      actor_type,
      actor_id,
      created_at,
      metadata
    from public.product_events
    where customer_id = p_customer_id
  ) as product_event_row;

  export_payload := jsonb_build_object(
    'schema', 'nabaperks.customer-data-export.v1',
    'generated_at', now(),
    'customer', customer_json,
    'memberships', membership_json,
    'stamp_events', stamp_json,
    'reward_events', reward_json,
    'pending_reward_invites', pending_invite_json,
    'consent_records', consent_json,
    'notification_events', notification_json,
    'product_events', product_event_json
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
    'customers',
    p_customer_id,
    'customer_data_exported',
    jsonb_build_object(
      'request_type', 'export',
      'channel', p_channel,
      'notes', trim(p_notes),
      'export_schema', 'nabaperks.customer-data-export.v1',
      'membership_count', jsonb_array_length(membership_json),
      'stamp_event_count', jsonb_array_length(stamp_json),
      'reward_event_count', jsonb_array_length(reward_json),
      'pending_reward_invite_count', jsonb_array_length(pending_invite_json),
      'consent_record_count', jsonb_array_length(consent_json),
      'notification_event_count', jsonb_array_length(notification_json),
      'product_event_count', jsonb_array_length(product_event_json)
    )
  );

  return export_payload;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.admin_purge_stale_customer_pii(p_cutoff timestamp with time zone DEFAULT (now() - '365 days'::interval))
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  stale_customer record;
  purged_count integer := 0;
  v_phone_hmac text;
  v_email_hmac text;
begin
  perform set_config('app.customer_erasure', 'true', true);

  for stale_customer in
    select customers.id
    from public.customers
    where customers.updated_at < p_cutoff
      and coalesce(customers.email, '') not like 'erased+%@privacy.invalid'
      and not exists (
        select 1 from public.customer_memberships
        where customer_memberships.customer_id = customers.id
          and customer_memberships.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.reward_events
        where reward_events.customer_id = customers.id
          and reward_events.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.stamp_events
        where stamp_events.customer_id = customers.id
          and stamp_events.created_at >= p_cutoff
      )
  loop
    select phone_hmac, email_hmac
    into v_phone_hmac, v_email_hmac
    from public.customers
    where id = stale_customer.id;

    update public.customers
    set
      auth_user_id = null,
      email = 'erased+' || replace(stale_customer.id::text, '-', '') || '@privacy.invalid',
      email_hmac = null,
      email_verified_at = null,
      full_name = null,
      date_of_birth = null,
      phone_hmac = null,
      phone_ciphertext = null,
      phone_last4 = null,
      phone_country = null,
      phone_verified_at = null,
      updated_at = now()
    where id = stale_customer.id;

    update public.pending_reward_invites
    set status = case when status in ('pending', 'matched') then 'cancelled' else status end,
        email_hmac = null, phone_hmac = null, email_masked = null, phone_last4 = null,
        claim_token_hash = 'scrubbed:' || id::text, updated_at = now()
    where matched_customer_id = stale_customer.id
       or attached_customer_id = stale_customer.id
       or (v_phone_hmac is not null and phone_hmac = v_phone_hmac)
       or (v_email_hmac is not null and email_hmac = v_email_hmac);

    purged_count := purged_count + 1;
  end loop;

  perform set_config('app.customer_erasure', '', true);
  return purged_count;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.join_customer_membership(p_customer_id uuid, p_merchant_slug text, p_qr_id text, p_marketing_opt_in boolean, p_policy_version text)
 RETURNS TABLE(membership_id uuid, created_membership boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
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
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  select
    customers.id,
    customers.auth_user_id,
    customers.email,
    customers.phone_hmac
  into customer_record
  from public.customers
  where customers.id = p_customer_id;

  if customer_record.id is null then
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
      merchants.requires_billing
    into
      v_qr_code_uuid,
      v_merchant_id,
      v_loyalty_card_id,
      v_merchant_status,
      v_card_active,
      v_billing_status,
      v_requires_billing
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
      merchants.requires_billing
    into
      v_merchant_id,
      v_loyalty_card_id,
      v_merchant_status,
      v_card_active,
      v_billing_status,
      v_requires_billing
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

  insert into public.customer_memberships (
    merchant_id,
    customer_id
  )
  values (
    v_merchant_id,
    p_customer_id
  )
  on conflict (merchant_id, customer_id) do nothing
  returning id into membership_id;

  created_membership := membership_id is not null;

  if membership_id is null then
    select customer_memberships.id
    into membership_id
    from public.customer_memberships
    where customer_memberships.merchant_id = v_merchant_id
      and customer_memberships.customer_id = p_customer_id;
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
      p_customer_id,
      case when customer_record.email is not null then 'email' else 'sms' end,
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
$function$

;

drop function if exists public.get_reward_scan_context(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_reward_scan_context(p_scan_token uuid, p_merchant_id uuid)
 RETURNS TABLE(scan_status text, reward_event_id uuid, reward_name text, reward_terms text, membership_id uuid, current_stamp_count integer, customer_email text, customer_phone_last4 text, blocked_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
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
    reward_events.source as reward_source,
    reward_events.reward_name as assigned_reward_name,
    reward_events.reward_terms as assigned_reward_terms,
    reward_events.redeemable_from,
    customer_memberships.id as card_membership_id,
    customer_memberships.current_stamp_count as card_stamp_count,
    customers.email as safe_customer_email,
    customers.phone_last4 as safe_customer_phone_last4,
    customers.full_name as customer_full_name,
    customers.date_of_birth as customer_date_of_birth,
    customers.email_verified_at as customer_email_verified_at,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    merchants.status as merchant_status,
    merchants.requires_billing,
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
  membership_id := scan_record.card_membership_id;
  current_stamp_count := scan_record.card_stamp_count;
  customer_email := scan_record.safe_customer_email;
  customer_phone_last4 := scan_record.safe_customer_phone_last4;

  if scan_record.consumed_at is not null or scan_record.event_status = 'redeemed' then
    scan_status := 'redeemed';
    return next;
    return;
  end if;

  -- Expired tokens get a stable, distinct status so the read path agrees with
  -- the collect path (which raises 'Reward scan token expired') instead of
  -- collapsing expiry into not_found / a 404.
  if scan_record.expires_at <= now() then
    scan_status := 'expired';
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
    scan_record.billing_status,
    scan_record.requires_billing
  );

  if availability_reason is not null then
    scan_status := 'blocked';
    blocked_reason := 'This loyalty programme is unavailable right now.';
    return next;
    return;
  end if;

  -- Stamp threshold applies to earned rewards only; issued rewards skip it.
  if scan_record.reward_source = 'stamp_cycle'
    and scan_record.card_stamp_count < scan_record.stamps_required then
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

  -- Age gate parity with the mint/redeem paths: DOB is non-null by the profile
  -- gate above. Blocks a token whose customer is (or became) under 18.
  if scan_record.customer_date_of_birth
       > (public.uk_business_date(now()) - interval '18 years')::date then
    scan_status := 'blocked';
    blocked_reason := 'This customer must be 18 or over to collect this reward.';
    return next;
    return;
  end if;

  scan_status := 'ready';
  return next;
end;
$function$

;

revoke all on function public.get_reward_scan_context(uuid, uuid) from public;
grant execute on function public.get_reward_scan_context(uuid, uuid) to service_role;

create or replace view public.customers_masked
with (security_barrier = true) as
select
  customers.id,
  case
    when customers.email is null or btrim(customers.email) = '' then null::text
    when position('@' in btrim(customers.email)) > 1
     and position('@' in btrim(customers.email)) < length(btrim(customers.email))
      then lower(left(btrim(customers.email), 1)) || '***@' || lower(split_part(btrim(customers.email), '@', 2))
    else 'Email hidden'
  end as email,
  case
    when customers.phone_last4 is null then null::text
    else 'Phone ending ' || customers.phone_last4
  end as phone,
  customers.phone_last4,
  customers.created_at,
  customers.updated_at
from public.customers
where customers.auth_user_id = (select auth.uid())
   or (select public.merchant_can_access_customer(customers.id))
   or (select public.is_internal_admin());

create or replace function public.prevent_verified_customer_contact_change() returns trigger
language plpgsql
as $$
begin
  if current_setting('app.customer_erasure', true) = 'true' then
    return new;
  end if;

  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'Customer auth user cannot be changed through profile updates';
  end if;

  if old.email_verified_at is not null then
    if new.email is distinct from old.email
      or new.email_verified_at is distinct from old.email_verified_at then
      raise exception 'Verified customer email cannot be changed';
    end if;
  end if;

  if old.phone_verified_at is not null then
    if new.phone_hmac is distinct from old.phone_hmac
      or new.phone_ciphertext is distinct from old.phone_ciphertext
      or new.phone_last4 is distinct from old.phone_last4
      or new.phone_country is distinct from old.phone_country
      or new.phone_verified_at is distinct from old.phone_verified_at then
      raise exception 'Verified customer phone cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

-- 3) Contact-present accepts last4 so backfilled legacy rows keep passing.
alter table public.customers
  drop constraint if exists customers_contact_present;
alter table public.customers
  add constraint customers_contact_present
  check (email is not null or phone_hmac is not null or phone_last4 is not null);

-- 4) The plaintext column goes.
alter table public.customers drop column if exists phone;
