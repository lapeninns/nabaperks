-- One settlement function, durable holds, scheduled drain.
--
-- Replaces v1's membership-keyed award primitive with a single, referral-keyed
-- settlement function settle_referral_bonus(referral_id): lock the edge, refuse
-- terminal edges, require `qualified`, revalidate, check velocity / room / reward
-- availability, and either award through the normal pipeline (marking `awarded`)
-- or record a durable hold with a reason + retry schedule so no qualified referral
-- is silently unresolved. drain_due_referral_bonuses() settles due edges
-- concurrency-safely (FOR UPDATE SKIP LOCKED) and is registered as a cron. The
-- QR-gated stamp entrypoint settles a scanner's owed bonus before their visit
-- stamp. The legacy award/drain entrypoints become thin shims over settlement.
-- Behavioral coverage: tests/contracts/referral-review-hardening.test.mjs.
--
-- Idempotent by construction (safe to re-apply): all functions use
-- create-or-replace; the reward-unlock tail is reproduced verbatim from the v1
-- award primitive so the awarded stamp/reward writes are byte-for-byte identical.

-- 1. Durable hold writer -----------------------------------------------------
create or replace function public.hold_referral_bonus(
  p_referral_id uuid,
  p_reason text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_edge record;
  v_next timestamptz;
begin
  select id, retry_count, venue_id, referrer_customer_id, referrer_membership_id,
         referred_membership_id
  into v_edge
  from public.referrals
  where id = p_referral_id;

  if v_edge.id is null then
    return;
  end if;

  -- Backoff by reason. The daily cap frees at the next UK business day. A missing
  -- referrer or an unexpected error uses an exponential backoff (capped) so a stuck
  -- referral is visibly retried and surfaceable, never hot-looped. Card-full and
  -- reward-unavailable are event-driven (they clear when the referrer stamps /
  -- redeems or the merchant replenishes), so the scheduled drain stays eligible to
  -- retry them promptly as a backstop.
  if p_reason = 'daily_bonus_limit' then
    v_next := (public.next_uk_business_date(now())::timestamp) at time zone 'Europe/London';
  elsif p_reason in ('referrer_membership_inactive', 'temporary_processing_error') then
    v_next := now() + least(
      interval '30 minutes' * power(2, least(coalesce(v_edge.retry_count, 0), 6)),
      interval '12 hours'
    );
  else
    v_next := now();
  end if;

  update public.referrals
  set status = 'held',
      hold_reason = p_reason,
      held_at = now(),
      next_retry_at = v_next,
      retry_count = coalesce(retry_count, 0) + 1,
      last_error = p_error
  where id = p_referral_id;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'referral_bonus_held', v_edge.venue_id, v_edge.referrer_customer_id,
    v_edge.referrer_membership_id, 'system', null,
    jsonb_build_object('referral_edge_id', p_referral_id, 'hold_reason', p_reason,
      'referred_membership_id', v_edge.referred_membership_id)
  );
end;
$$;

revoke all on function public.hold_referral_bonus(uuid, text, text) from public, anon, authenticated;
grant execute on function public.hold_referral_bonus(uuid, text, text) to service_role;

-- 2. The single settlement function ------------------------------------------
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

  -- An attributed edge is qualified here if the friend has genuinely visited
  -- (any-path first stamp — e.g. issued outside the self-service hook), so a bonus
  -- is never stranded merely because qualification was not recorded inline. If the
  -- friend still has no qualifying visit, the bonus is not awarded (SE-3).
  if v_edge.status = 'attributed' then
    perform public.qualify_referral_on_stamp(v_edge.referred_membership_id, null);
    select r.status into v_edge.status from public.referrals r where r.id = p_referral_id;
    if v_edge.status = 'attributed' then
      return 'not_qualified';
    end if;
  end if;

  -- In-flight marker (never a committed resting state).
  update public.referrals set status = 'settling' where id = p_referral_id;

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

-- 3. Scheduled, concurrency-safe drain ---------------------------------------
create or replace function public.drain_due_referral_bonuses(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  r record;
  n integer := 0;
  v_out text;
begin
  for r in
    select referrals.id
    from public.referrals
    where referrals.referrer_bonus_awarded_at is null
      and (referrals.next_retry_at is null or referrals.next_retry_at <= now())
      and (
        referrals.status in ('qualified', 'held', 'settling')
        or (
          referrals.status = 'attributed'
          and exists (
            select 1 from public.stamp_events se
            where se.membership_id = referrals.referred_membership_id
              and se.event_type = 'earned'
              and coalesce(se.metadata->>'source', '') not in ('referral_bonus', 'imported', 'manual_adjustment')
          )
        )
      )
    order by coalesce(referrals.next_retry_at, referrals.qualified_at, referrals.created_at) asc
    limit greatest(p_limit, 1)
    for update skip locked
  loop
    begin
      v_out := public.settle_referral_bonus(r.id);
      if v_out = 'awarded' then
        n := n + 1;
      end if;
    exception
      when others then
        raise warning 'referral drain settle failed for %: %', r.id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;

revoke all on function public.drain_due_referral_bonuses(integer) from public, anon, authenticated;
grant execute on function public.drain_due_referral_bonuses(integer) to service_role;

-- 4. Legacy entrypoints become shims over settlement -------------------------
-- award_referrer_bonus_stamp keeps its signature (the stamp hook + join wrapper
-- call it): qualify, then resolve the edge and settle. The reward-unlock tail now
-- lives only in settle_referral_bonus.
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
begin
  perform public.qualify_referral_on_stamp(p_referred_membership_id, p_source_stamp_event_id);

  select id
  into v_edge_id
  from public.referrals
  where referred_membership_id = p_referred_membership_id
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

-- Per-referrer drain (the app on-scan path + the stamp-ordering hook use it):
-- settle all of one referrer's owed edges. Returns the count of bonuses applied.
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
  n integer := 0;
  v_out text;
begin
  for r in
    select referrals.id
    from public.referrals
    where referrals.referrer_membership_id = p_referrer_membership_id
      and referrals.referrer_bonus_awarded_at is null
      and (
        referrals.status in ('qualified', 'held', 'settling')
        or (
          referrals.status = 'attributed'
          and exists (
            select 1 from public.stamp_events se
            where se.membership_id = referrals.referred_membership_id
              and se.event_type = 'earned'
              and coalesce(se.metadata->>'source', '') not in ('referral_bonus', 'imported', 'manual_adjustment')
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

-- Global legacy sweep now delegates to the status-aware drain.
create or replace function public.drain_due_referrer_bonuses()
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  return public.drain_due_referral_bonuses(1000);
end;
$$;

revoke all on function public.drain_due_referrer_bonuses() from public, anon, authenticated;
grant execute on function public.drain_due_referrer_bonuses() to service_role;

-- 5. Stamp ordering: settle the scanner's owed bonus before their visit stamp --
-- Reproduces the QR-gated overload body (20260709090000) verbatim, adding one
-- fail-safe settle-before-stamp call so an older owed bonus is not outranked by
-- the referrer's fresh visit stamp. The friend-side award hook is unchanged.
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
  v_qr_id text := trim(coalesce(p_qr_id, ''));
begin
  if v_qr_id = '' then
    raise insufficient_privilege using message = 'Venue QR scan proof required';
  end if;

  select
    memberships.merchant_id,
    cards.id as loyalty_card_id
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

  -- MS-referral-settlement (SE-13): settle the scanner's OWN owed referral bonuses
  -- before their visit stamp, in this same transaction, so an older bonus is not
  -- outranked. Fail-safe: any settle failure degrades to a warning.
  begin
    perform public.drain_due_referrer_bonuses_for_membership(p_membership_id);
  exception
    when others then
      raise warning 'referral settle-before-stamp skipped for %: %', p_membership_id, sqlerrm;
  end;

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

  -- MS-referral-bonus-stamp: award the referrer's "Bring a Regular" bonus on the
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
