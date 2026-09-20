-- Reward age verification follows the immutable item flag captured at issuance.
--
-- WHAT CHANGES
--   * A private helper defaults missing legacy snapshots to requiring verification.
--   * Birthday and cycle reward inserts snapshot their configured item flag.
--   * Token mint, reward redemption and owner verification use that snapshot.
--
-- Forward-only and re-runnable.

create or replace function private.reward_requires_age_check(p_reward_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select coalesce((
    select coalesce((rewards.reward_policy_snapshot ->> 'age_check')::boolean, true)
    from public.reward_events rewards where rewards.id = p_reward_id
  ), true);
$function$;

revoke all on function private.reward_requires_age_check(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.snapshot_issued_reward_age_policy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_requires_age_check boolean := true;
begin
  if new.source = 'birthday_month' then
    select cards.birthday_reward_requires_age_check
    into v_requires_age_check
    from public.loyalty_cards cards where cards.id = new.loyalty_card_id;
  elsif new.reward_pool_item_id is not null then
    select items.requires_age_check into v_requires_age_check
    from public.reward_pool_items items where items.id = new.reward_pool_item_id;
  elsif new.metadata ? 'requires_age_check' then
    v_requires_age_check := (new.metadata ->> 'requires_age_check')::boolean;
  end if;
  new.reward_policy_snapshot := coalesce(new.reward_policy_snapshot, '{}'::jsonb)
    || jsonb_build_object('age_check', coalesce(v_requires_age_check, true));
  return new;
end;
$function$;

drop trigger if exists a_reward_events_snapshot_issued_age on public.reward_events;
create trigger a_reward_events_snapshot_issued_age
before insert on public.reward_events
for each row execute function public.snapshot_issued_reward_age_policy();

revoke all on function public.snapshot_issued_reward_age_policy()
  from public, anon, authenticated, service_role;

drop trigger if exists reward_scan_tokens_require_verified_dob on public.reward_scan_tokens;
drop function if exists public.require_verified_dob_for_reward_scan_token();

create or replace function private.reward_scan_token_eligibility_reason(p_reward_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_reason text := private.reward_scan_eligibility_reason(p_reward_id);
begin
  if v_reason = 'Customer must have verified photo ID and be 18 or over to redeem'
     and exists (
       select 1 from public.reward_events rewards
       join public.customers customers on customers.id = rewards.customer_id
       where rewards.id = p_reward_id
         and nullif(btrim(customers.full_name), '') is not null
         and customers.date_of_birth >= date '1900-01-01'
         and customers.date_of_birth <= (public.uk_business_date(now()) - interval '18 years')::date
     ) then
    return null;
  end if;
  return v_reason;
end;
$function$;

revoke all on function private.reward_scan_token_eligibility_reason(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.require_eligible_reward_for_scan_token()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_reward public.reward_events%rowtype;
  v_reason text;
begin
  perform 1 from public.customers where id = new.customer_id for update;
  select * into v_reward from public.reward_events
  where id = new.reward_event_id for update;
  if not found or v_reward.customer_id is distinct from new.customer_id
     or v_reward.merchant_id is distinct from new.merchant_id
     or v_reward.membership_id is distinct from new.membership_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;
  v_reason := private.reward_scan_token_eligibility_reason(new.reward_event_id);
  if v_reason is not null then raise exception '%', v_reason; end if;
  return new;
end;
$function$;

drop trigger if exists reward_scan_tokens_require_verified_dob on public.reward_scan_tokens;
drop trigger if exists a_reward_scan_tokens_require_eligible_reward on public.reward_scan_tokens;
create trigger a_reward_scan_tokens_require_eligible_reward
before insert on public.reward_scan_tokens
for each row execute function public.require_eligible_reward_for_scan_token();
revoke all on function public.require_eligible_reward_for_scan_token()
  from public, anon, authenticated, service_role;

create or replace function public.create_reward_scan_token(
  p_reward_event_id uuid, p_customer_id uuid
)
returns table (scan_token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_reward public.reward_events%rowtype;
  v_token public.reward_scan_tokens%rowtype;
  v_reason text;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;
  perform 1 from public.customers where id = p_customer_id for update;
  select * into v_reward from public.reward_events
  where id = p_reward_event_id for update;
  if not found or v_reward.customer_id is distinct from p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;
  v_reason := private.reward_scan_token_eligibility_reason(p_reward_event_id);
  if v_reason is not null then raise exception '%', v_reason; end if;

  select * into v_token from public.reward_scan_tokens t
  where t.reward_event_id = p_reward_event_id
    and t.customer_id = p_customer_id
    and t.consumed_at is null and t.superseded_at is null
    and t.expires_at > now() + interval '5 minutes'
  order by t.expires_at desc limit 1;
  if v_token.id is not null then
    scan_token := v_token.id;
    expires_at := v_token.expires_at;
    return next;
    return;
  end if;
  insert into public.reward_scan_tokens (
    reward_event_id, merchant_id, customer_id, membership_id, expires_at
  ) values (
    v_reward.id, v_reward.merchant_id, v_reward.customer_id, v_reward.membership_id,
    least(now() + interval '10 minutes', v_reward.expires_at)
  ) returning id, reward_scan_tokens.expires_at into scan_token, expires_at;
  return next;
end;
$function$;

revoke all on function public.create_reward_scan_token(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_reward_scan_token(uuid, uuid) to service_role;

create or replace function public.require_verified_dob_for_reward_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_is_birthday_insert boolean := tg_op = 'INSERT' and new.source = 'birthday_month';
  v_is_redeeming boolean := new.status = 'redeemed'
    and (tg_op = 'INSERT' or old.status is distinct from new.status);
begin
  if v_is_birthday_insert
     and coalesce((new.reward_policy_snapshot ->> 'age_check')::boolean, true)
     and not public.customer_has_verified_adult_date_of_birth(new.customer_id, now()) then
    return null;
  end if;
  if v_is_redeeming
     and coalesce((new.reward_policy_snapshot ->> 'age_check')::boolean, true)
     and not public.customer_has_verified_adult_date_of_birth(new.customer_id, now()) then
    raise exception 'Verified adult date of birth required before reward redemption';
  end if;
  return new;
end;
$function$;

revoke all on function public.require_verified_dob_for_reward_event()
  from public, anon, authenticated;
grant execute on function public.require_verified_dob_for_reward_event() to service_role;

do $do$
begin
  if to_regprocedure('public.upsert_reward_pool_item(uuid,uuid,uuid,text,text,integer,boolean,integer)') is not null
     and to_regprocedure('private.upsert_reward_pool_item(uuid,uuid,uuid,text,text,integer,boolean,integer)') is null then
    alter function public.upsert_reward_pool_item(uuid,uuid,uuid,text,text,integer,boolean,integer)
      set schema private;
  end if;
  if to_regprocedure('public.save_loyalty_card_birthday_reward(uuid,uuid,boolean,text,text)') is not null
     and to_regprocedure('private.save_loyalty_card_birthday_reward(uuid,uuid,boolean,text,text)') is null then
    alter function public.save_loyalty_card_birthday_reward(uuid,uuid,boolean,text,text)
      set schema private;
  end if;
  if to_regprocedure('public.add_reward_pool_presets(uuid,uuid,jsonb)') is not null
     and to_regprocedure('private.add_reward_pool_presets(uuid,uuid,jsonb)') is null then
    alter function public.add_reward_pool_presets(uuid,uuid,jsonb) set schema private;
  end if;
end
$do$;

revoke all on function private.upsert_reward_pool_item(uuid,uuid,uuid,text,text,integer,boolean,integer)
  from public, anon, authenticated, service_role;
revoke all on function private.save_loyalty_card_birthday_reward(uuid,uuid,boolean,text,text)
  from public, anon, authenticated, service_role;
revoke all on function private.add_reward_pool_presets(uuid,uuid,jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.upsert_reward_pool_item(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_reward_pool_item_id uuid,
  p_reward_name text,
  p_reward_terms text,
  p_weight integer,
  p_is_active boolean,
  p_display_order integer,
  p_requires_age_check boolean default true
)
returns table (
  reward_pool_item_id uuid,
  saved_action text,
  requires_age_check boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_saved record;
begin
  select * into v_saved from private.upsert_reward_pool_item(
    p_merchant_id, p_loyalty_card_id, p_reward_pool_item_id,
    p_reward_name, p_reward_terms, p_weight, p_is_active, p_display_order
  );
  update public.reward_pool_items items
  set requires_age_check = coalesce(p_requires_age_check, true)
  where items.id = v_saved.reward_pool_item_id;
  reward_pool_item_id := v_saved.reward_pool_item_id;
  saved_action := v_saved.saved_action;
  requires_age_check := coalesce(p_requires_age_check, true);
  return next;
end;
$function$;

revoke all on function public.upsert_reward_pool_item(uuid,uuid,uuid,text,text,integer,boolean,integer,boolean)
  from public, anon;
grant execute on function public.upsert_reward_pool_item(uuid,uuid,uuid,text,text,integer,boolean,integer,boolean)
  to authenticated, service_role;

create or replace function public.add_reward_pool_presets(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_presets jsonb
)
returns table (
  preset_id text, reward_pool_item_id uuid, reward_name text, reward_terms text,
  weight integer, is_active boolean, display_order integer, saved_action text,
  active_reward_count integer, requires_age_check boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_row record;
begin
  for v_row in select * from private.add_reward_pool_presets(
    p_merchant_id, p_loyalty_card_id, p_presets
  ) loop
    select coalesce((entry ->> 'requires_age_check')::boolean, true)
    into requires_age_check
    from jsonb_array_elements(p_presets) entry
    where entry ->> 'preset_id' = v_row.preset_id
    limit 1;
    requires_age_check := coalesce(requires_age_check, true);
    update public.reward_pool_items items
    set requires_age_check = add_reward_pool_presets.requires_age_check
    where items.id = v_row.reward_pool_item_id;
    preset_id := v_row.preset_id;
    reward_pool_item_id := v_row.reward_pool_item_id;
    reward_name := v_row.reward_name;
    reward_terms := v_row.reward_terms;
    weight := v_row.weight;
    is_active := v_row.is_active;
    display_order := v_row.display_order;
    saved_action := v_row.saved_action;
    active_reward_count := v_row.active_reward_count;
    return next;
  end loop;
end;
$function$;

revoke all on function public.add_reward_pool_presets(uuid,uuid,jsonb)
  from public, anon;
grant execute on function public.add_reward_pool_presets(uuid,uuid,jsonb)
  to authenticated, service_role;

create or replace function public.save_loyalty_card_birthday_reward(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_enabled boolean,
  p_reward_name text,
  p_reward_terms text,
  p_requires_age_check boolean default true
)
returns table (
  loyalty_card_id uuid,
  birthday_reward_enabled boolean,
  birthday_reward_name text,
  birthday_reward_terms text,
  birthday_reward_requires_age_check boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_enabled boolean := coalesce(p_enabled, false);
  v_name text := nullif(btrim(p_reward_name), '');
  v_terms text := nullif(btrim(p_reward_terms), '');
begin
  if not public.is_service_role_request() and (
    v_user_id is null or not exists (
      select 1 from public.merchants
      where id = p_merchant_id and owner_user_id = v_user_id
    )
  ) then raise insufficient_privilege using message = 'Merchant owner access required'; end if;
  perform 1 from public.loyalty_cards
  where id = p_loyalty_card_id and merchant_id = p_merchant_id for update;
  if not found then raise exception 'Loyalty card not found for merchant'; end if;
  if v_enabled and (v_name is null or v_terms is null) then
    raise exception 'A birthday reward name and terms are required when enabling';
  end if;
  if v_name is not null and char_length(v_name) > 100 then
    raise exception 'Birthday reward name must be 100 characters or fewer';
  end if;
  if v_terms is not null and char_length(v_terms) not between 12 and 500 then
    raise exception 'Birthday reward terms must be between 12 and 500 characters';
  end if;
  update public.loyalty_cards cards
  set birthday_reward_enabled = v_enabled,
      birthday_reward_name = v_name,
      birthday_reward_terms = v_terms,
      birthday_reward_requires_age_check = coalesce(p_requires_age_check, true)
  where cards.id = p_loyalty_card_id;
  return query select cards.id, cards.birthday_reward_enabled,
    cards.birthday_reward_name, cards.birthday_reward_terms,
    cards.birthday_reward_requires_age_check
  from public.loyalty_cards cards where cards.id = p_loyalty_card_id;
end;
$function$;

revoke all on function public.save_loyalty_card_birthday_reward(uuid, uuid, boolean, text, text, boolean)
  from public, anon;
grant execute on function public.save_loyalty_card_birthday_reward(uuid, uuid, boolean, text, text, boolean)
  to authenticated, service_role;

create or replace function public.get_owner_reward_scan_context(p_scan_token uuid)
returns table (
  scan_status text, reward_event_id uuid, reward_name text, reward_terms text,
  membership_id uuid, current_stamp_count integer, customer_email text,
  customer_phone_last4 text, blocked_reason text,
  customer_full_name text, customer_date_of_birth date
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_merchant_id uuid := private.reward_scan_owner_merchant(p_scan_token);
  v_context record;
  v_customer_id uuid;
  v_reason text;
begin
  select * into v_context from public.get_reward_scan_context(p_scan_token, v_merchant_id);
  scan_status := v_context.scan_status;
  reward_event_id := v_context.reward_event_id;
  reward_name := v_context.reward_name;
  reward_terms := v_context.reward_terms;
  membership_id := v_context.membership_id;
  current_stamp_count := v_context.current_stamp_count;
  -- This authenticated RPC is callable directly, without the application's
  -- display formatter. Use the existing contact-privacy boundary in every
  -- lifecycle state; never copy the service-only context's raw email.
  select masked.email into customer_email
  from public.reward_events rewards
  join public.customers_masked masked on masked.id = rewards.customer_id
  where rewards.id = v_context.reward_event_id;
  customer_phone_last4 := v_context.customer_phone_last4;
  blocked_reason := v_context.blocked_reason;

  if scan_status = 'blocked'
     and blocked_reason = 'Customer must have verified photo ID and be 18 or over to redeem'
     and private.reward_scan_token_eligibility_reason(reward_event_id) is null then
    scan_status := 'ready';
    blocked_reason := null;
  end if;
  if scan_status = 'ready' then
    v_reason := private.reward_scan_token_eligibility_reason(reward_event_id);
    if v_reason is not null then
      scan_status := 'blocked';
      blocked_reason := v_reason;
    else
      select r.customer_id into v_customer_id
      from public.reward_events r where r.id = reward_event_id;
      if private.reward_requires_age_check(reward_event_id)
         and not public.customer_has_verified_adult_date_of_birth(v_customer_id) then
        scan_status := 'verification_required';
        select c.full_name, c.date_of_birth
        into customer_full_name, customer_date_of_birth
        from public.customers c where c.id = v_customer_id;
      end if;
    end if;
  end if;
  return next;
end;
$function$;

revoke all on function public.get_owner_reward_scan_context(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_owner_reward_scan_context(uuid) to authenticated;

create or replace function public.issue_birthday_rewards(
  p_now timestamptz default now(),
  p_customer_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_row record;
  v_count integer := 0;
  v_year integer := extract(year from (p_now at time zone 'Europe/London'))::int;
  v_month integer := extract(month from (p_now at time zone 'Europe/London'))::int;
  v_expires_at timestamptz :=
    (date_trunc('month', (p_now at time zone 'Europe/London')) + interval '1 month')
      at time zone 'Europe/London';
  v_business_name text;
begin
  for v_row in
    insert into public.reward_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      status,
      source,
      birthday_year,
      reward_name,
      reward_terms,
      redeemable_from,
      expires_at,
      cycle_number,
      metadata,
      created_at,
      updated_at
    )
    select
      m.merchant_id,
      m.customer_id,
      m.id,
      card.id,
      'unlocked',
      'birthday_month',
      v_year,
      card.birthday_reward_name,
      card.birthday_reward_terms,
      public.uk_business_date(p_now),
      v_expires_at,
      null,
      jsonb_build_object('issued_by', 'birthday_sweep'),
      p_now,
      p_now
    from public.customer_memberships m
    join public.customers c on c.id = m.customer_id
    join public.merchants mer on mer.id = m.merchant_id
    left join public.billing_customers bc on bc.merchant_id = m.merchant_id
    join lateral (
      select lc.id, lc.birthday_reward_name, lc.birthday_reward_terms,
             lc.birthday_reward_requires_age_check
      from public.loyalty_cards lc
      where lc.merchant_id = m.merchant_id
        and lc.is_active
        and lc.birthday_reward_enabled
        and lc.birthday_reward_name is not null
        and lc.birthday_reward_terms is not null
      order by lc.created_at asc
      limit 1
    ) card on true
    where
      (p_customer_id is null or m.customer_id = p_customer_id)
      and c.date_of_birth is not null
      and extract(month from c.date_of_birth)::int = v_month
      and (not card.birthday_reward_requires_age_check
        or c.date_of_birth <= (public.uk_business_date(p_now) - interval '18 years')::date)
      and public.loyalty_availability_reason(mer.status, true, bc.status, mer.requires_billing) is null
      and m.last_visit_at is not null
      and m.last_visit_at >= p_now - interval '12 months'
      and not exists (
        select 1
        from public.reward_events re
        where re.merchant_id = m.merchant_id
          and re.customer_id = m.customer_id
          and re.source = 'birthday_month'
          and re.birthday_year = v_year
      )
    on conflict (merchant_id, customer_id, birthday_year) where source = 'birthday_month'
      do nothing
    returning id, merchant_id, customer_id, membership_id, reward_name
  loop
    v_count := v_count + 1;

    select merchants.business_name
    into v_business_name
    from public.merchants
    where merchants.id = v_row.merchant_id;

    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
    )
    values (
      'reward_issued',
      v_row.merchant_id,
      v_row.customer_id,
      v_row.membership_id,
      'system',
      'birthday_sweep',
      jsonb_build_object(
        'reward_id', v_row.id,
        'reward_name', v_row.reward_name,
        'source', 'birthday_month',
        'birthday_year', v_year
      )
    );

    perform public.enqueue_notification_event(
      'birthday_reward_issued',
      v_row.customer_id,
      v_row.merchant_id,
      v_row.membership_id,
      v_row.id,
      null,
      public.uk_business_date(p_now),
      p_now,
      'birthday_reward_issued:' || v_row.id::text,
      jsonb_build_object(
        'title', 'Birthday treat',
        'body', v_row.reward_name || ' at ' || coalesce(v_business_name, 'your venue'),
        'url', '/home/rewards',
        'rewardEventId', v_row.id
      ),
      jsonb_build_object('source', 'birthday_sweep')
    );
  end loop;

  return v_count;
end;
$$;

revoke all on function public.issue_birthday_rewards(timestamptz, uuid) from public;
grant execute on function public.issue_birthday_rewards(timestamptz, uuid) to service_role;

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
  perform private.reward_scan_owner_merchant(p_scan_token);
  v_reason := private.reward_scan_token_eligibility_reason(v_token.reward_event_id);
  if v_reason is not null then raise exception '%', v_reason; end if;

  insert into private.merchant_id_verification_receipts (
    customer_id, merchant_id, owner_user_id, reward_event_id, verified_at, attestation
  ) values (
    v_customer.id, v_merchant_id, v_owner_id, v_token.reward_event_id, v_verified_at,
    'photo_id_matches_customer_dob_and_adult'
  ) returning id into v_receipt_id;

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

  return query select * from public.collect_current_reward_scan_token(p_scan_token, v_merchant_id);
end;
$function$;
revoke all on function public.verify_and_collect_reward_scan_token(uuid, date, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.verify_and_collect_reward_scan_token(uuid, date, boolean)
  to authenticated;

notify pgrst, 'reload schema';
