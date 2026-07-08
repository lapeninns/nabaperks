-- MS-referral-bonus-stamp — "Bring a Regular": the referrer bonus stamp.
--
-- Builds on the attribution rails (20260708090000). When a referred friend earns
-- their FIRST in-venue stamp, the referrer receives exactly one bonus stamp on
-- their card at that venue — "you both get a stamp". The bonus is issued in the
-- same transaction as the friend's stamp, behind a fail-safe wrapper so it can
-- never block or roll back the friend's stamp. A full-card referrer is OWED, not
-- dropped: the debt is drained once their card has room.
-- Contract: micro-specs/referral/bonus-stamp.md.
--
-- Idempotent by construction (safe to re-apply): additive DDL is guarded with
-- IF NOT EXISTS; constraints and functions are dropped/replaced before create.

-- 1. Bonus state on the attribution edge (RB-3, RB-5) -------------------------
-- Timestamp-derived state: due_at = owed (friend visited), awarded_at = paid.
-- Drainable = due_at is not null and awarded_at is null.
alter table public.referrals
  add column if not exists referrer_bonus_due_at timestamptz,
  add column if not exists referrer_bonus_awarded_at timestamptz,
  add column if not exists referrer_stamp_event_id uuid
    references public.stamp_events(id) on delete set null;

create index if not exists referrals_bonus_unpaid_idx
  on public.referrals (referrer_membership_id)
  where referrer_bonus_awarded_at is null;

-- 2. Register the transactional notification type (RB-8) ----------------------
-- notification_event_category() has an else-raise, and notification_events has a
-- CHECK allow-list; both must learn the new type or the enqueue throws. Reproduce
-- the CURRENT mapping (issued_rewards, 20260704090000) plus referral_bonus.
create or replace function public.notification_event_category(p_event_type text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  case p_event_type
    when
      'push_permission_prompt_viewed',
      'push_permission_granted',
      'push_subscription_created',
      'push_subscription_disabled',
      'push_subscription_failed'
    then
      return 'operational';
    when
      'one_stamp_away',
      'reward_unlocked_waiting',
      'reward_ready',
      'profile_required_to_collect',
      'reward_collected_cycle_started',
      'referral_bonus_stamp_issued'
    then
      return 'transactional';
    when
      'next_stamp_available',
      'reward_expiring_soon',
      'reward_expired'
    then
      return 'reminder';
    when
      'dormant_progress',
      'venue_announcement',
      'birthday_reward_issued',
      'merchant_reward_received'
    then
      return 'marketing';
    else
      raise exception 'Unsupported notification event type: %', p_event_type;
  end case;
end;
$$;

alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;
alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in (
    'push_permission_prompt_viewed',
    'push_permission_granted',
    'push_subscription_created',
    'push_subscription_disabled',
    'push_subscription_failed',
    'one_stamp_away',
    'next_stamp_available',
    'reward_unlocked_waiting',
    'reward_ready',
    'profile_required_to_collect',
    'reward_expiring_soon',
    'reward_expired',
    'reward_collected_cycle_started',
    'dormant_progress',
    'venue_announcement',
    'birthday_reward_issued',
    'merchant_reward_received',
    'referral_bonus_stamp_issued'
  ));

-- 3. The bonus primitive (RB-1..RB-6, RB-8, RB-10, RB-11) ---------------------
-- SECURITY DEFINER, service-role-only. Self-guarded on an unpaid referrals edge
-- and a genuine friend visit, so it is safe to call speculatively (from the
-- stamp hook AND the drain sweep). The referrer bonus stamp is event_type
-- 'earned' with a NULL earned_business_date, so it advances the referrer's cycle
-- while remaining exempt from the one-per-UK-day partial unique index.
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
  -- Lock the unpaid edge for this referred membership (RB-3 idempotency).
  select r.id, r.referred_membership_id, r.referrer_membership_id,
         r.referrer_bonus_due_at, r.referrer_bonus_awarded_at
  into v_edge
  from public.referrals r
  where r.referred_membership_id = p_referred_membership_id
    and r.referrer_bonus_awarded_at is null
  for update of r;

  if v_edge.id is null then
    return; -- no edge, or already awarded
  end if;

  -- Only owed once the friend has genuinely visited (>= 1 earned stamp).
  if not exists (
    select 1 from public.stamp_events
    where stamp_events.membership_id = p_referred_membership_id
      and stamp_events.event_type = 'earned'
  ) then
    return;
  end if;

  -- Load the referrer and their active card (same merchant, by construction).
  select m.id, m.merchant_id, m.customer_id, m.active_cycle_number, m.current_stamp_count
  into v_referrer
  from public.customer_memberships m
  where m.id = v_edge.referrer_membership_id
  for update of m;

  if v_referrer.id is null then
    return;
  end if;

  select cards.id as loyalty_card_id, cards.location_id, cards.stamps_required
  into v_card
  from public.loyalty_cards cards
  where cards.merchant_id = v_referrer.merchant_id
    and cards.is_active
  order by cards.created_at asc
  limit 1;

  if v_card.loyalty_card_id is null then
    return;
  end if;

  -- The debt is now owed; record it (idempotent).
  update public.referrals
  set referrer_bonus_due_at = coalesce(referrer_bonus_due_at, now())
  where id = v_edge.id;

  select count(*)
  into v_today_bonus_count
  from public.referrals
  where referrals.referrer_membership_id = v_edge.referrer_membership_id
    and referrals.referrer_bonus_awarded_at is not null
    and public.uk_business_date(referrals.referrer_bonus_awarded_at) = v_business_date;

  if v_today_bonus_count >= v_daily_bonus_cap then
    if not exists (
      select 1 from public.fraud_flags
      where fraud_flags.merchant_id = v_referrer.merchant_id
        and fraud_flags.membership_id = v_referrer.id
        and fraud_flags.signal = 'referral_bonus_velocity'
        and fraud_flags.status = 'open'
        and public.uk_business_date(fraud_flags.created_at) = v_business_date
    ) then
      insert into public.fraud_flags (
        merchant_id, customer_id, membership_id, signal, severity, metadata
      )
      values (
        v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id,
        'referral_bonus_velocity', 'medium',
        jsonb_build_object('referral_edge_id', v_edge.id, 'cap', v_daily_bonus_cap,
          'business_date', v_business_date, 'observed_awards_today', v_today_bonus_count)
      );
    end if;
    return; -- held due
  end if;

  -- Full-card hold (RB-5): no room → leave due, the drain sweep retries.
  if v_referrer.current_stamp_count >= v_card.stamps_required then
    return;
  end if;

  -- A completing bonus must be able to select a reward, mirroring the ledger's
  -- min-three-rewards rule; otherwise hold due rather than issue an unusable card.
  if v_referrer.current_stamp_count + 1 >= v_card.stamps_required then
    select count(*), coalesce(sum(reward_pool_items.weight), 0)
    into v_active_reward_count, v_total_weight
    from public.reward_pool_items
    where reward_pool_items.merchant_id = v_referrer.merchant_id
      and reward_pool_items.location_id = v_card.location_id
      and reward_pool_items.loyalty_card_id = v_card.loyalty_card_id
      and reward_pool_items.is_active;

    if v_active_reward_count < 3 or v_total_weight <= 0 then
      return; -- hold due; cannot complete the card cleanly
    end if;
  end if;

  -- Issue the bonus (RB-2): earned, NULL business date (cap-exempt), referral_bonus.
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
      'referred_membership_id', p_referred_membership_id,
      'trigger_stamp_event_id', p_source_stamp_event_id,
      'referral_edge_id', v_edge.id
    )
  )
  returning id into v_bonus_stamp_id;

  update public.customer_memberships
  set current_stamp_count = current_stamp_count + 1,
      total_stamps_earned = total_stamps_earned + 1,
      last_visit_at = now()
  where id = v_referrer.id
  returning current_stamp_count into v_new_count;

  -- Unlock the referrer's reward if the bonus completed the card (RB-4).
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

  -- Mark the edge paid (RB-3).
  update public.referrals
  set referrer_bonus_awarded_at = now(),
      referrer_stamp_event_id = v_bonus_stamp_id
  where id = v_edge.id;

  -- Analytics (RB-11).
  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'referral_bonus_awarded', v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id, 'system', null,
    jsonb_build_object('referral_edge_id', v_edge.id, 'referred_membership_id', p_referred_membership_id,
      'bonus_stamp_event_id', v_bonus_stamp_id, 'new_stamp_count', v_new_count)
  );

  -- Notify the referrer (RB-8): transactional, deduped per edge, no friend PII.
  perform public.enqueue_notification_event(
    p_event_type := 'referral_bonus_stamp_issued',
    p_customer_id := v_referrer.customer_id,
    p_merchant_id := v_referrer.merchant_id,
    p_membership_id := v_referrer.id,
    p_dedupe_key := 'referral_bonus:' || v_edge.id::text,
    p_payload := jsonb_build_object('url', '/card/' || v_referrer.id::text),
    p_metadata := jsonb_build_object('referral_edge_id', v_edge.id)
  );
end;
$$;

revoke all on function public.award_referrer_bonus_stamp(uuid, uuid) from public, anon, authenticated;
grant execute on function public.award_referrer_bonus_stamp(uuid, uuid) to service_role;

-- 4. Hook the QR-gated stamp entrypoint (RB-1, RB-7) --------------------------
-- Both the standalone stamp and the join first-stamp route through this outer
-- overload. Reproduce its current body (20260626090000) verbatim, capturing the
-- inner ledger's result instead of streaming it, then award the bonus behind a
-- fail-safe wrapper before returning.
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

-- 5. Drain sweep (RB-6) -------------------------------------------------------
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
  v_before_count integer;
  v_after_count integer;
begin
  for r in
    select distinct e.referred_membership_id
    from public.referrals e
    where e.referrer_membership_id = p_referrer_membership_id
      and e.referrer_bonus_awarded_at is null
      and exists (
        select 1 from public.stamp_events s
        where s.membership_id = e.referred_membership_id
          and s.event_type = 'earned'
      )
    order by e.referred_membership_id
  loop
    begin
      select current_stamp_count
      into v_before_count
      from public.customer_memberships
      where id = p_referrer_membership_id;

      perform public.award_referrer_bonus_stamp(r.referred_membership_id, null);

      select current_stamp_count
      into v_after_count
      from public.customer_memberships
      where id = p_referrer_membership_id;

      n := n + greatest(coalesce(v_after_count, 0) - coalesce(v_before_count, 0), 0);
    exception
      when others then
        raise warning 'referral bonus drain skipped for %: %', r.referred_membership_id, sqlerrm;
    end;
  end loop;

  return n;
end;
$$;

revoke all on function public.drain_due_referrer_bonuses_for_membership(uuid) from public, anon, authenticated;
grant execute on function public.drain_due_referrer_bonuses_for_membership(uuid) to service_role;

-- Pays every owed-but-unpaid bonus whose friend has visited, when the referrer
-- has room. Idempotent: already-awarded edges are excluded; full-card edges stay
-- due and are retried on the next run.
create or replace function public.drain_due_referrer_bonuses()
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select distinct e.referrer_membership_id
    from public.referrals e
    where e.referrer_bonus_awarded_at is null
      and exists (
        select 1 from public.stamp_events s
        where s.membership_id = e.referred_membership_id
          and s.event_type = 'earned'
      )
  loop
    begin
      n := n + public.drain_due_referrer_bonuses_for_membership(
        r.referrer_membership_id
      );
    exception
      when others then
        raise warning 'referral bonus drain skipped for referrer %: %', r.referrer_membership_id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;

revoke all on function public.drain_due_referrer_bonuses() from public, anon, authenticated;
grant execute on function public.drain_due_referrer_bonuses() to service_role;
