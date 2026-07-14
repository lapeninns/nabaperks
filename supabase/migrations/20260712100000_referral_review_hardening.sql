-- Follow-up hardening for Referral v2 review findings.
--
-- Keeps fraud-terminal edges terminal during direct settlement, reconnects both
-- sides of an edge after membership churn, respects retry schedules in member
-- drains, prevents a completing bonus from being rolled back by the following
-- visit stamp, makes admin code disablement durable, and emits complete referral
-- push payloads from the SQL outbox.

-- 1. Durable admin disablement ------------------------------------------------
alter table public.customer_memberships
  add column if not exists referral_code_admin_disabled_at timestamptz;

-- Existing admin-disable flags predate the dedicated column. Preserve them as
-- durable disables instead of allowing an owner rotation to reactivate the code.
update public.customer_memberships memberships
set referral_code_admin_disabled_at = coalesce(
  memberships.referral_code_admin_disabled_at,
  (
    select max(fraud_flags.created_at)
    from public.fraud_flags
    where fraud_flags.membership_id = memberships.id
      and fraud_flags.signal = 'referral_code_disabled'
  ),
  now()
)
where memberships.referral_code_admin_disabled_at is null
and exists (
  select 1
  from public.fraud_flags
  where fraud_flags.membership_id = memberships.id
    and fraud_flags.signal = 'referral_code_disabled'
);

create or replace function public.rotate_membership_referral_code(p_membership_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_membership record;
  v_new_code text;
begin
  select customer_id, referral_code_admin_disabled_at
  into v_membership
  from public.customer_memberships
  where id = p_membership_id
  for update;

  if v_membership.customer_id is null then
    raise exception 'Membership not found';
  end if;

  if not ((select public.is_customer_owner(v_membership.customer_id)) or (select public.is_service_role_request())) then
    raise insufficient_privilege using message = 'Membership owner access required';
  end if;

  if v_membership.referral_code_admin_disabled_at is not null
     and not (select public.is_service_role_request()) then
    raise insufficient_privilege using message = 'Referral code disabled by an administrator';
  end if;

  v_new_code := public.generate_membership_referral_code();

  update public.customer_memberships
  set referral_code = v_new_code,
      referral_code_active = (referral_code_admin_disabled_at is null),
      referral_code_rotated_at = now()
  where id = p_membership_id;

  return v_new_code;
end;
$$;

revoke all on function public.rotate_membership_referral_code(uuid) from public, anon;
grant execute on function public.rotate_membership_referral_code(uuid) to authenticated, service_role;

create or replace function public.set_membership_referral_code_active(
  p_membership_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_membership record;
  v_requested_active boolean := coalesce(p_active, true);
begin
  select customer_id, referral_code_admin_disabled_at
  into v_membership
  from public.customer_memberships
  where id = p_membership_id
  for update;

  if v_membership.customer_id is null then
    raise exception 'Membership not found';
  end if;

  if not ((select public.is_customer_owner(v_membership.customer_id)) or (select public.is_service_role_request())) then
    raise insufficient_privilege using message = 'Membership owner access required';
  end if;

  if v_requested_active
     and v_membership.referral_code_admin_disabled_at is not null
     and not (select public.is_service_role_request()) then
    raise insufficient_privilege using message = 'Referral code disabled by an administrator';
  end if;

  update public.customer_memberships
  set referral_code_active = v_requested_active
    and referral_code_admin_disabled_at is null
  where id = p_membership_id;
end;
$$;

revoke all on function public.set_membership_referral_code_active(uuid, boolean) from public, anon;
grant execute on function public.set_membership_referral_code_active(uuid, boolean) to authenticated, service_role;

create or replace function public.admin_disable_referral_code(
  p_membership_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
  v_m record;
begin
  admin_user_id := (select auth.uid());
  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'A reason is required';
  end if;

  select id, merchant_id, customer_id
  into v_m
  from public.customer_memberships
  where id = p_membership_id
  for update;

  if v_m.id is null then
    raise exception 'Membership not found';
  end if;

  update public.customer_memberships
  set referral_code_active = false,
      referral_code_admin_disabled_at = coalesce(referral_code_admin_disabled_at, now())
  where id = p_membership_id;

  insert into public.fraud_flags (
    merchant_id, customer_id, membership_id, signal, severity, metadata
  )
  values (
    v_m.merchant_id, v_m.customer_id, p_membership_id, 'referral_code_disabled', 'medium',
    jsonb_build_object('reason', trim(p_reason), 'disabled_by', admin_user_id)
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'admin', admin_user_id::text, v_m.merchant_id, v_m.customer_id,
    'customer_memberships', p_membership_id, 'referral_code_disabled',
    jsonb_build_object('reason', trim(p_reason))
  );
end;
$$;

grant execute on function public.admin_disable_referral_code(uuid, text) to authenticated, service_role;

-- Attribution requires both the member-controlled active flag and the separate
-- admin control. Reproduce the current wrapper with the additional predicate.
create or replace function public.join_customer_membership_with_first_stamp(
  p_customer_id uuid,
  p_merchant_slug text,
  p_qr_id text,
  p_marketing_opt_in boolean,
  p_policy_version text,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_ref text default null
)
returns table (
  membership_id uuid,
  created_membership boolean,
  first_stamp_issued boolean,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  select j.membership_id, j.created_membership
  into membership_id, created_membership
  from public.join_customer_membership(
    p_customer_id,
    p_merchant_slug,
    p_qr_id,
    p_marketing_opt_in,
    p_policy_version
  ) j;

  first_stamp_issued := false;
  new_stamp_count := 0;
  reward_unlocked := false;
  geo_flagged := false;

  if created_membership and p_ref is not null and btrim(p_ref) <> '' then
    insert into public.referrals (
      referred_membership_id,
      referrer_membership_id,
      referral_code_used
    )
    select nm.id, rm.id, rm.referral_code
    from public.customer_memberships nm
    join public.customer_memberships rm
      on rm.referral_code = btrim(p_ref)
     and rm.referral_code_active
     and rm.referral_code_admin_disabled_at is null
     and rm.merchant_id = nm.merchant_id
     and rm.customer_id <> nm.customer_id
    where nm.id = membership_id
    on conflict (referred_membership_id) do nothing;
  end if;

  if created_membership and p_qr_id is not null and trim(p_qr_id) <> '' then
    begin
      select s.new_stamp_count, s.reward_unlocked, s.geo_flagged
      into new_stamp_count, reward_unlocked, geo_flagged
      from public.issue_self_service_stamp(
        membership_id,
        p_customer_id,
        p_qr_id,
        p_latitude,
        p_longitude
      ) s;

      first_stamp_issued := true;
    exception
      when others then
        raise warning 'join first stamp skipped for membership % (customer %): %',
          membership_id, p_customer_id, sqlerrm;
        first_stamp_issued := false;
        new_stamp_count := 0;
        reward_unlocked := false;
        geo_flagged := false;
    end;
  end if;

  return next;
end;
$$;

grant execute on function public.join_customer_membership_with_first_stamp(
  uuid, text, text, boolean, text, numeric, numeric, text
) to authenticated, service_role;

-- 6. Review cannot rewrite already-paid ledger state -------------------------
create or replace function public.admin_review_referral(
  p_referral_id uuid,
  p_action text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
  v_edge record;
begin
  admin_user_id := (select auth.uid());
  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;
  if p_action not in ('clear', 'reject', 'cancel') then
    raise exception 'Unsupported review action';
  end if;

  select id, venue_id, referrer_customer_id, referrer_membership_id, status,
         referrer_bonus_awarded_at
  into v_edge
  from public.referrals
  where id = p_referral_id
  for update;

  if v_edge.id is null then
    raise exception 'Referral not found';
  end if;

  if v_edge.status = 'awarded' or v_edge.referrer_bonus_awarded_at is not null then
    raise exception 'Awarded referrals cannot be reviewed';
  end if;

  if p_action = 'clear' then
    -- Dismiss the referrer's open referral flags BEFORE re-qualifying, so the
    -- fraud trigger (which fires on → qualified) respects the review and does not
    -- immediately re-pause the referral.
    update public.fraud_flags
    set status = 'dismissed'
    where status = 'open'
      and membership_id = v_edge.referrer_membership_id
      and signal like 'referral_%';

    update public.referrals
    set status = 'qualified', last_error = null, next_retry_at = now()
    where id = p_referral_id;
  elsif p_action = 'reject' then
    update public.referrals set status = 'rejected' where id = p_referral_id;
  else
    update public.referrals set status = 'cancelled' where id = p_referral_id;
  end if;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'admin', admin_user_id::text, v_edge.venue_id, v_edge.referrer_customer_id,
    'referrals', p_referral_id, 'referral_reviewed',
    jsonb_build_object('review_action', p_action, 'previous_status', v_edge.status,
      'reason', trim(coalesce(p_reason, '')))
  );
end;
$$;

grant execute on function public.admin_review_referral(uuid, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';

-- 2. Membership-identity relinking + churn-safe qualification ----------------
create or replace function public.relink_referral_memberships(p_referral_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.referrals r
  set referrer_membership_id = current_referrer.id,
      referred_membership_id = current_referred.id
  from public.customer_memberships current_referrer,
       public.customer_memberships current_referred
  where r.id = p_referral_id
    and current_referrer.customer_id = r.referrer_customer_id
    and current_referrer.merchant_id = r.venue_id
    and current_referred.customer_id = r.referred_customer_id
    and current_referred.merchant_id = r.venue_id
    and (
      r.referrer_membership_id is distinct from current_referrer.id
      or r.referred_membership_id is distinct from current_referred.id
    );

  -- Relink each side independently when only one customer currently has a
  -- membership; settlement can then distinguish a genuinely absent referrer.
  update public.referrals r
  set referrer_membership_id = current_referrer.id
  from public.customer_memberships current_referrer
  where r.id = p_referral_id
    and current_referrer.customer_id = r.referrer_customer_id
    and current_referrer.merchant_id = r.venue_id
    and r.referrer_membership_id is distinct from current_referrer.id;

  update public.referrals r
  set referred_membership_id = current_referred.id
  from public.customer_memberships current_referred
  where r.id = p_referral_id
    and current_referred.customer_id = r.referred_customer_id
    and current_referred.merchant_id = r.venue_id
    and r.referred_membership_id is distinct from current_referred.id;
end;
$$;

revoke all on function public.relink_referral_memberships(uuid) from public, anon, authenticated;
grant execute on function public.relink_referral_memberships(uuid) to service_role;

create or replace function public.qualify_referral_on_stamp(
  p_membership_id uuid,
  p_stamp_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_edge record;
  v_membership record;
  v_qualifying_stamp uuid;
begin
  select customer_id, merchant_id
  into v_membership
  from public.customer_memberships
  where id = p_membership_id;

  if v_membership.customer_id is null then
    return;
  end if;

  select r.id, r.venue_id, r.referrer_customer_id, r.referrer_membership_id
  into v_edge
  from public.referrals r
  where r.status = 'attributed'
    and (
      r.referred_membership_id = p_membership_id
      or (
        r.referred_customer_id = v_membership.customer_id
        and r.venue_id = v_membership.merchant_id
      )
    )
  for update of r;

  if v_edge.id is null then
    return;
  end if;

  perform public.relink_referral_memberships(v_edge.id);

  select se.id
  into v_qualifying_stamp
  from public.stamp_events se
  where se.membership_id = p_membership_id
    and se.event_type = 'earned'
    and coalesce(se.metadata->>'source', '') not in (
      'referral_bonus', 'imported', 'manual_adjustment'
    )
  order by
    case when se.id = p_stamp_event_id then 0 else 1 end,
    se.created_at asc,
    se.id asc
  limit 1;

  if v_qualifying_stamp is null then
    return;
  end if;

  update public.referrals
  set status = 'qualified',
      qualified_at = now(),
      qualifying_stamp_id = v_qualifying_stamp,
      referred_membership_id = p_membership_id
  where id = v_edge.id;

  -- The fraud trigger has run by the time this statement returns. Product and
  -- notification events describe qualification even when settlement is paused.
  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'referral_qualified', v_edge.venue_id, v_edge.referrer_customer_id,
    v_edge.referrer_membership_id, 'system', null,
    jsonb_build_object('referral_edge_id', v_edge.id,
      'qualifying_stamp_id', v_qualifying_stamp,
      'referred_membership_id', p_membership_id)
  );

  if v_edge.referrer_customer_id is not null and v_edge.referrer_membership_id is not null then
    begin
      perform public.enqueue_notification_event(
        p_event_type := 'referral_qualified',
        p_customer_id := v_edge.referrer_customer_id,
        p_merchant_id := v_edge.venue_id,
        p_membership_id := v_edge.referrer_membership_id,
        p_dedupe_key := 'referral:' || v_edge.id::text || ':qualified',
        p_payload := jsonb_build_object('url', '/card/' || v_edge.referrer_membership_id::text),
        p_metadata := jsonb_build_object('referral_edge_id', v_edge.id)
      );
    exception
      when others then
        raise warning 'referral qualified notification skipped for %: %', v_edge.id, sqlerrm;
    end;
  end if;
end;
$$;

revoke all on function public.qualify_referral_on_stamp(uuid, uuid) from public, anon, authenticated;
grant execute on function public.qualify_referral_on_stamp(uuid, uuid) to service_role;

-- 3. Complete SQL-created referral notification payloads ---------------------
create or replace function public.complete_referral_notification_payload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_name text;
  v_title text;
  v_body text;
  v_url text;
begin
  if new.event_type not in (
    'referral_friend_joined',
    'referral_qualified',
    'referral_bonus_saved',
    'referral_bonus_stamp_issued'
  ) then
    return new;
  end if;

  select business_name into v_business_name
  from public.merchants
  where id = new.merchant_id;
  v_business_name := coalesce(nullif(trim(v_business_name), ''), 'Your venue');
  v_url := coalesce(new.payload->>'url', '/home');

  case new.event_type
    when 'referral_friend_joined' then
      v_title := 'Your friend joined';
      v_body := 'Someone you invited to ' || v_business_name || ' just joined.';
    when 'referral_qualified' then
      v_title := 'Your referral qualified';
      v_body := 'Your invited friend made their first visit to ' || v_business_name
        || ' — your bonus is on its way.';
    when 'referral_bonus_saved' then
      v_title := 'Bonus saved';
      v_body := 'Your referral bonus at ' || v_business_name
        || ' is saved and will be added automatically.';
    else
      v_title := 'You earned a bonus stamp';
      v_body := 'Someone you invited to ' || v_business_name
        || ' collected their first stamp — your bonus stamp is now on your card.';
  end case;

  new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
    'title', v_title,
    'body', v_body,
    'url', v_url,
    'tag', new.event_type || ':' || coalesce(new.membership_id::text, new.customer_id::text),
    'eventType', new.event_type,
    'data', jsonb_strip_nulls(jsonb_build_object(
      'eventType', new.event_type,
      'merchantId', new.merchant_id,
      'membershipId', new.membership_id,
      'rewardEventId', new.reward_event_id
    ))
  );
  return new;
end;
$$;

drop trigger if exists complete_referral_notification_payload_biu on public.notification_events;
create trigger complete_referral_notification_payload_biu
  before insert or update of payload, event_type, merchant_id, membership_id
  on public.notification_events
  for each row execute function public.complete_referral_notification_payload();

-- Repair queued referral notifications created before this migration.
update public.notification_events
set payload = payload
where event_type in (
  'referral_friend_joined',
  'referral_qualified',
  'referral_bonus_saved',
  'referral_bonus_stamp_issued'
)
and status in ('queued', 'delivering');

-- 4. Terminal-safe, churn-safe settlement -----------------------------------
create or replace function public.settle_referral_bonus(p_referral_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_edge record;
  v_referrer record;
  v_card record;
  v_new_count integer;
  v_bonus_stamp_id uuid;
  v_total_weight integer := 0;
  v_active_reward_count integer := 0;
  v_weight_threshold integer;
  v_reward record;
  v_today_bonus_count integer;
  v_daily_bonus_cap constant integer := 2;
  v_business_date date := public.uk_business_date(now());
begin
  select r.* into v_edge from public.referrals r where r.id = p_referral_id for update;

  if v_edge.id is null then
    return 'not_found';
  end if;
  if v_edge.status in ('awarded', 'rejected', 'cancelled', 'expired')
     or v_edge.referrer_bonus_awarded_at is not null then
    return 'skipped_terminal';
  end if;

  -- Membership FKs are SET NULL on churn. Restore either side from the durable
  -- customer + venue identity before qualification and settlement.
  perform public.relink_referral_memberships(p_referral_id);
  select r.* into v_edge
  from public.referrals r
  where r.id = p_referral_id
  for update;

  -- An attributed edge is qualified here if the friend has genuinely visited
  -- (any-path first stamp — e.g. issued outside the self-service hook), so a bonus
  -- is never stranded merely because qualification was not recorded inline.
  if v_edge.status = 'attributed' and v_edge.referred_membership_id is not null then
    perform public.qualify_referral_on_stamp(v_edge.referred_membership_id, null);
    select r.* into v_edge
    from public.referrals r
    where r.id = p_referral_id
    for update;

    -- Qualification can synchronously trigger the concentration fraud check.
    -- Re-read and preserve every terminal decision before entering settlement.
    if v_edge.status in ('awarded', 'rejected', 'cancelled', 'expired')
       or v_edge.referrer_bonus_awarded_at is not null then
      return 'skipped_terminal';
    end if;
    if v_edge.status = 'attributed' then
      return 'not_qualified';
    end if;
  elsif v_edge.status = 'attributed' then
    return 'not_qualified';
  end if;

  if v_edge.status in ('awarded', 'rejected', 'cancelled', 'expired')
     or v_edge.referrer_bonus_awarded_at is not null then
    return 'skipped_terminal';
  end if;

  -- In-flight marker (never a committed resting state).
  update public.referrals
  set status = 'settling'
  where id = p_referral_id
    and status not in ('awarded', 'rejected', 'cancelled', 'expired')
    and referrer_bonus_awarded_at is null;

  -- Revalidate the referrer.
  if v_edge.referrer_membership_id is null then
    perform public.hold_referral_bonus(p_referral_id, 'referrer_membership_inactive');
    return 'held';
  end if;

  select m.id, m.merchant_id, m.customer_id, m.active_cycle_number, m.current_stamp_count
  into v_referrer
  from public.customer_memberships m
  where m.id = v_edge.referrer_membership_id
  for update of m;

  if v_referrer.id is null then
    perform public.hold_referral_bonus(p_referral_id, 'referrer_membership_inactive');
    return 'held';
  end if;

  select cards.id as loyalty_card_id, cards.location_id, cards.stamps_required
  into v_card
  from public.loyalty_cards cards
  where cards.merchant_id = v_referrer.merchant_id and cards.is_active
  order by cards.created_at asc
  limit 1;

  if v_card.loyalty_card_id is null then
    perform public.hold_referral_bonus(p_referral_id, 'reward_unavailable');
    return 'held';
  end if;

  -- Retain the v1 due marker.
  update public.referrals
  set referrer_bonus_due_at = coalesce(referrer_bonus_due_at, now())
  where id = p_referral_id;

  -- Velocity cap (per referrer per UK business day).
  select count(*)
  into v_today_bonus_count
  from public.referrals
  where referrer_membership_id = v_edge.referrer_membership_id
    and referrer_bonus_awarded_at is not null
    and public.uk_business_date(referrer_bonus_awarded_at) = v_business_date;

  if v_today_bonus_count >= v_daily_bonus_cap then
    if not exists (
      select 1 from public.fraud_flags
      where merchant_id = v_referrer.merchant_id
        and membership_id = v_referrer.id
        and signal = 'referral_bonus_velocity'
        and status = 'open'
        and public.uk_business_date(created_at) = v_business_date
    ) then
      insert into public.fraud_flags (
        merchant_id, customer_id, membership_id, signal, severity, metadata
      )
      values (
        v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id,
        'referral_bonus_velocity', 'medium',
        jsonb_build_object('referral_edge_id', p_referral_id, 'cap', v_daily_bonus_cap,
          'business_date', v_business_date, 'observed_awards_today', v_today_bonus_count)
      );
    end if;
    perform public.hold_referral_bonus(p_referral_id, 'daily_bonus_limit');
    return 'held';
  end if;

  -- Full card.
  if v_referrer.current_stamp_count >= v_card.stamps_required then
    perform public.hold_referral_bonus(p_referral_id, 'card_full');
    return 'held';
  end if;

  -- A completing bonus must be able to select a fulfilable reward.
  if v_referrer.current_stamp_count + 1 >= v_card.stamps_required then
    select count(*), coalesce(sum(reward_pool_items.weight), 0)
    into v_active_reward_count, v_total_weight
    from public.reward_pool_items
    where reward_pool_items.merchant_id = v_referrer.merchant_id
      and reward_pool_items.location_id = v_card.location_id
      and reward_pool_items.loyalty_card_id = v_card.loyalty_card_id
      and reward_pool_items.is_active;

    if v_active_reward_count < 3 or v_total_weight <= 0 then
      perform public.hold_referral_bonus(p_referral_id, 'reward_unavailable');
      return 'held';
    end if;
  end if;

  -- Award through the normal pipeline. Any unexpected error is caught and recorded
  -- as a temporary hold rather than corrupting the edge or the ledger.
  begin
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, metadata
    )
    values (
      v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id,
      v_card.loyalty_card_id, v_card.location_id,
      'earned', 1, null, v_referrer.active_cycle_number,
      jsonb_build_object(
        'source', 'referral_bonus',
        'referred_membership_id', v_edge.referred_membership_id,
        'referral_edge_id', p_referral_id
      )
    )
    returning id into v_bonus_stamp_id;

    update public.customer_memberships
    set current_stamp_count = current_stamp_count + 1,
        total_stamps_earned = total_stamps_earned + 1,
        last_visit_at = now()
    where id = v_referrer.id
    returning current_stamp_count into v_new_count;

    if v_new_count >= v_card.stamps_required then
      if v_referrer.active_cycle_number = 1 then
        select *
        into v_reward
        from public.reward_pool_items
        where reward_pool_items.merchant_id = v_referrer.merchant_id
          and reward_pool_items.location_id = v_card.location_id
          and reward_pool_items.loyalty_card_id = v_card.loyalty_card_id
          and reward_pool_items.is_active
        order by reward_pool_items.display_order asc,
          reward_pool_items.created_at asc,
          reward_pool_items.id asc
        limit 1;
      else
        v_weight_threshold := floor(random() * v_total_weight)::integer + 1;
        select *
        into v_reward
        from (
          select
            reward_pool_items.*,
            sum(reward_pool_items.weight) over (
              order by reward_pool_items.display_order asc,
                reward_pool_items.created_at asc,
                reward_pool_items.id asc
            ) as running_weight
          from public.reward_pool_items
          where reward_pool_items.merchant_id = v_referrer.merchant_id
            and reward_pool_items.location_id = v_card.location_id
            and reward_pool_items.loyalty_card_id = v_card.loyalty_card_id
            and reward_pool_items.is_active
        ) weighted_items
        where weighted_items.running_weight >= v_weight_threshold
        order by weighted_items.running_weight asc
        limit 1;
      end if;

      insert into public.reward_events (
        merchant_id, customer_id, membership_id, loyalty_card_id, reward_pool_item_id,
        reward_name, reward_terms, redeemable_from, status, cycle_number, metadata
      )
      values (
        v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id, v_card.loyalty_card_id,
        v_reward.id, v_reward.reward_name, v_reward.reward_terms,
        public.next_uk_business_date(now()), 'unlocked', v_referrer.active_cycle_number,
        jsonb_build_object('source', 'referral_bonus',
          'selection_mode',
          case when v_referrer.active_cycle_number = 1 then 'first_cycle_default' else 'weighted_random' end)
      );

      insert into public.product_events (
        event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
      )
      values (
        'reward_unlocked', v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id, 'system', null,
        jsonb_build_object('loyalty_card_id', v_card.loyalty_card_id, 'source', 'referral_bonus')
      );
    end if;

    update public.referrals
    set status = 'awarded',
        referrer_bonus_awarded_at = now(),
        referrer_stamp_event_id = v_bonus_stamp_id,
        hold_reason = null,
        held_at = null,
        next_retry_at = null,
        last_error = null
    where id = p_referral_id;

    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
    )
    values (
      'referral_bonus_awarded', v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id, 'system', null,
      jsonb_build_object('referral_edge_id', p_referral_id, 'referred_membership_id', v_edge.referred_membership_id,
        'bonus_stamp_event_id', v_bonus_stamp_id, 'new_stamp_count', v_new_count)
    );

    perform public.enqueue_notification_event(
      p_event_type := 'referral_bonus_stamp_issued',
      p_customer_id := v_referrer.customer_id,
      p_merchant_id := v_referrer.merchant_id,
      p_membership_id := v_referrer.id,
      p_dedupe_key := 'referral_bonus:' || p_referral_id::text,
      p_payload := jsonb_build_object('url', '/card/' || v_referrer.id::text),
      p_metadata := jsonb_build_object('referral_edge_id', p_referral_id)
    );

    return 'awarded';
  exception
    when others then
      perform public.hold_referral_bonus(p_referral_id, 'temporary_processing_error', left(sqlerrm, 500));
      return 'error';
  end;
end;
$$;

revoke all on function public.settle_referral_bonus(uuid) from public, anon, authenticated;
grant execute on function public.settle_referral_bonus(uuid) to service_role;

-- The member-specific drain now reconnects churned referrers and obeys the same
-- due-time contract as the scheduled global drain.
create or replace function public.drain_due_referrer_bonuses_for_membership(
  p_referrer_membership_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  r record;
  v_membership record;
  n integer := 0;
  v_out text;
begin
  select customer_id, merchant_id
  into v_membership
  from public.customer_memberships
  where id = p_referrer_membership_id;

  if v_membership.customer_id is null then
    return 0;
  end if;

  update public.referrals
  set referrer_membership_id = p_referrer_membership_id
  where referrer_customer_id = v_membership.customer_id
    and venue_id = v_membership.merchant_id
    and referrer_membership_id is distinct from p_referrer_membership_id;

  for r in
    select referrals.id
    from public.referrals
    where referrals.referrer_membership_id = p_referrer_membership_id
      and referrals.referrer_bonus_awarded_at is null
      and (referrals.next_retry_at is null or referrals.next_retry_at <= now())
      and (
        referrals.status in ('qualified', 'held', 'settling')
        or (
          referrals.status = 'attributed'
          and exists (
            select 1 from public.stamp_events se
            join public.customer_memberships referred
              on referred.id = se.membership_id
            where referred.customer_id = referrals.referred_customer_id
              and referred.merchant_id = referrals.venue_id
              and se.event_type = 'earned'
              and coalesce(se.metadata->>'source', '') not in (
                'referral_bonus', 'imported', 'manual_adjustment'
              )
          )
        )
      )
    order by referrals.created_at asc
    for update skip locked
  loop
    begin
      v_out := public.settle_referral_bonus(r.id);
      if v_out = 'awarded' then
        n := n + 1;
      end if;
    exception
      when others then
        raise warning 'referral settle failed for %: %', r.id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;

revoke all on function public.drain_due_referrer_bonuses_for_membership(uuid) from public, anon, authenticated;
grant execute on function public.drain_due_referrer_bonuses_for_membership(uuid) to service_role;

-- A churned referred member reaches this shim with the new membership id. The
-- qualification function reconnects the durable edge before this lookup.
create or replace function public.award_referrer_bonus_stamp(
  p_referred_membership_id uuid,
  p_source_stamp_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_edge_id uuid;
  v_membership record;
begin
  perform public.qualify_referral_on_stamp(p_referred_membership_id, p_source_stamp_event_id);

  select customer_id, merchant_id
  into v_membership
  from public.customer_memberships
  where id = p_referred_membership_id;

  select id
  into v_edge_id
  from public.referrals
  where (
      referred_membership_id = p_referred_membership_id
      or (
        referred_customer_id = v_membership.customer_id
        and venue_id = v_membership.merchant_id
      )
    )
    and referrer_bonus_awarded_at is null
    and status in ('qualified', 'held', 'settling')
  limit 1;

  if v_edge_id is not null then
    perform public.settle_referral_bonus(v_edge_id);
  end if;
end;
$$;

revoke all on function public.award_referrer_bonus_stamp(uuid, uuid) from public, anon, authenticated;
grant execute on function public.award_referrer_bonus_stamp(uuid, uuid) to service_role;

-- 5. Preserve a completing pre-stamp bonus instead of rolling it back ----------
create or replace function public.issue_self_service_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_qr_id text,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy_meters numeric default null,
  p_location_status text default null,
  p_capture_elapsed_ms integer default null
)
returns table (
  stamp_event_id uuid,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_membership record;
  v_drained integer := 0;
  v_qr_id text := trim(coalesce(p_qr_id, ''));
begin
  if v_qr_id = '' then
    raise insufficient_privilege using message = 'Venue QR scan proof required';
  end if;

  select
    memberships.merchant_id,
    cards.id as loyalty_card_id,
    cards.stamps_required
  into v_membership
  from public.customer_memberships memberships
  join public.loyalty_cards cards
    on cards.merchant_id = memberships.merchant_id
   and cards.is_active
  where memberships.id = p_membership_id
    and memberships.customer_id = p_customer_id
  order by cards.created_at asc
  limit 1;

  if v_membership.merchant_id is null then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  if not exists (
    select 1
    from public.qr_codes qr_codes
    where qr_codes.qr_id = v_qr_id
      and qr_codes.merchant_id = v_membership.merchant_id
      and qr_codes.loyalty_card_id = v_membership.loyalty_card_id
      and qr_codes.destination_type = 'join'
      and qr_codes.is_active
  ) then
    raise insufficient_privilege using message = 'Valid venue QR scan proof required';
  end if;

  -- referral settlement (SE-13): settle the scanner's OWN owed referral bonuses
  -- before their visit stamp, in this same transaction, so an older bonus is not
  -- outranked. Fail-safe: any settle failure degrades to a warning.
  begin
    v_drained := public.drain_due_referrer_bonuses_for_membership(p_membership_id);
  exception
    when others then
      raise warning 'referral settle-before-stamp skipped for %: %', p_membership_id, sqlerrm;
  end;

  -- If the drained bonus completed this card, return that successful award.
  -- Calling the visit-stamp primitive now would raise "reward ready" and roll
  -- the bonus back with the wrapper transaction.
  if v_drained > 0 then
    select memberships.current_stamp_count
    into new_stamp_count
    from public.customer_memberships memberships
    where memberships.id = p_membership_id;

    if new_stamp_count >= v_membership.stamps_required then
      select stamp_events.id
      into stamp_event_id
      from public.stamp_events stamp_events
      where stamp_events.membership_id = p_membership_id
        and stamp_events.event_type = 'earned'
        and stamp_events.metadata->>'source' = 'referral_bonus'
      order by stamp_events.created_at desc, stamp_events.id desc
      limit 1;

      reward_unlocked := true;
      geo_flagged := false;
      return next;
      return;
    end if;
  end if;

  select
    stamp.stamp_event_id,
    stamp.new_stamp_count,
    stamp.reward_unlocked,
    stamp.geo_flagged
  into
    stamp_event_id,
    new_stamp_count,
    reward_unlocked,
    geo_flagged
  from public.issue_self_service_stamp(
    p_membership_id,
    p_customer_id,
    p_latitude,
    p_longitude,
    p_accuracy_meters,
    p_location_status,
    p_capture_elapsed_ms
  ) stamp;

  -- referral bonus stamp: award the referrer's "Bring a Regular" bonus on the
  -- friend's first in-venue stamp, in this same transaction. Wrapped so any bonus
  -- failure degrades to no-bonus (a warning) and never blocks the friend's stamp.
  begin
    perform public.award_referrer_bonus_stamp(p_membership_id, stamp_event_id);
  exception
    when others then
      raise warning 'referral bonus skipped for membership %: %', p_membership_id, sqlerrm;
  end;

  return next;
end;
$$;

grant execute on function public.issue_self_service_stamp(
  uuid, uuid, text, numeric, numeric, numeric, text, integer
) to authenticated, service_role;
