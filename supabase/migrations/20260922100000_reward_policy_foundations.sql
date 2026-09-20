-- Reward policy foundations: immutable issuance snapshots and safe cycle identity.
--
-- WHAT CHANGES
--   * Existing rewards are labelled legacy_v1 and receive a row-derived snapshot.
--   * Cards and issued-reward sources gain explicit policy/age/terms settings.
--   * A partial unique index prevents two live stamp-cycle rewards for one cycle.
--   * Cancelling a legacy active-cycle reward releases that cycle under lock.
--   * available_from lands early so the single readiness predicate is deployable
--     before collection-window support.
--
-- Forward-only and re-runnable.

alter table public.reward_events
  add column if not exists reward_policy_version text not null default 'legacy_v1',
  add column if not exists reward_policy_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists available_from timestamptz;

alter table public.loyalty_cards
  add column if not exists reward_policy_version text not null default 'legacy_v1',
  add column if not exists birthday_reward_requires_age_check boolean not null default true,
  add column if not exists minimum_spend_pence integer,
  add column if not exists one_transaction_per_stamp boolean not null default true;

alter table public.reward_pool_items
  add column if not exists requires_age_check boolean not null default true;

alter table public.customer_memberships
  add column if not exists policy_cutover_notice_at timestamptz;

alter table public.pending_reward_invites
  add column if not exists requires_age_check boolean not null default true;

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'loyalty_cards_minimum_spend_pence_check'
      and conrelid = 'public.loyalty_cards'::regclass
  ) then
    alter table public.loyalty_cards
      add constraint loyalty_cards_minimum_spend_pence_check
      check (minimum_spend_pence is null or minimum_spend_pence >= 0) not valid;
  end if;
end
$do$;

alter table public.loyalty_cards
  validate constraint loyalty_cards_minimum_spend_pence_check;

update public.reward_events rewards
set reward_policy_snapshot = jsonb_build_object(
      'collection', 'next_uk_business_day',
      'expiry', case when rewards.expires_at is null then 'never' else 'fixed_days' end,
      'expiry_days', case
        when rewards.expires_at is null then null
        else rewards.expires_at::date - rewards.created_at::date
      end,
      'age_check', true
    ),
    available_from = case
      when rewards.redeemable_from is null then null
      else rewards.redeemable_from::timestamp at time zone 'Europe/London'
    end
where rewards.reward_policy_version = 'legacy_v1'
  and rewards.reward_policy_snapshot = '{}'::jsonb;

do $do$
declare
  v_duplicate record;
begin
  select membership_id, cycle_number, count(*) as reward_count
  into v_duplicate
  from public.reward_events
  where source = 'stamp_cycle'
    and status <> 'cancelled'
  group by membership_id, cycle_number
  having count(*) > 1
  limit 1;

  if v_duplicate.membership_id is not null then
    raise exception 'Cannot enforce one reward per cycle: membership % cycle % has % live rewards',
      v_duplicate.membership_id, v_duplicate.cycle_number, v_duplicate.reward_count;
  end if;
end
$do$;

create unique index if not exists reward_events_one_cycle_reward_idx
  on public.reward_events (membership_id, cycle_number)
  where source = 'stamp_cycle' and status <> 'cancelled';

create or replace function private.standard_reward_daily_cap_reached(
  p_reward_id uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select false;
$function$;

revoke all on function private.standard_reward_daily_cap_reached(uuid, timestamptz)
  from public, anon, authenticated, service_role;

alter table public.customer_memberships
  add column if not exists total_rewards_cancelled integer not null default 0
  check (total_rewards_cancelled >= 0);

create or replace function public.admin_cancel_reward(
  p_reward_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  reward_record record;
  membership_record record;
  admin_user_id uuid := (select auth.uid());
begin
  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'Cancellation reason is required';
  end if;

  select r.id, r.merchant_id, r.customer_id, r.membership_id, r.status,
         r.cycle_number, r.source
  into reward_record
  from public.reward_events r
  where r.id = p_reward_id
  for update;

  if reward_record.id is null then raise exception 'Reward not found'; end if;
  if reward_record.status = 'redeemed' then
    raise exception 'Redeemed rewards cannot be cancelled';
  end if;

  select memberships.id, memberships.active_cycle_number
  into membership_record
  from public.customer_memberships memberships
  where memberships.id = reward_record.membership_id
  for update;

  update public.reward_events
  set status = 'cancelled', cancelled_reason = trim(p_reason)
  where id = p_reward_id and status <> 'redeemed';

  if reward_record.source = 'stamp_cycle'
     and reward_record.cycle_number = membership_record.active_cycle_number then
    -- A cancelled active-cycle reward closes that cycle like an expiry does,
    -- and is counted so active_cycle_number keeps reconciling against
    -- redeemed + expired + cancelled + 1.
    update public.customer_memberships
    set active_cycle_number = active_cycle_number + 1,
        current_stamp_count = 0,
        total_rewards_cancelled = total_rewards_cancelled + 1
    where id = reward_record.membership_id;

    insert into public.audit_logs (
      actor_type, actor_id, merchant_id, customer_id,
      target_table, target_id, action, metadata
    ) values (
      'admin', admin_user_id::text, reward_record.merchant_id, reward_record.customer_id,
      'customer_memberships', reward_record.membership_id,
      'reward_cancelled_cycle_released',
      jsonb_build_object('reward_id', p_reward_id, 'cycle_number', reward_record.cycle_number)
    );
  end if;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  ) values (
    'reward_cancelled', reward_record.merchant_id, reward_record.customer_id,
    reward_record.membership_id, 'admin', admin_user_id::text,
    jsonb_build_object('reward_id', p_reward_id)
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id,
    target_table, target_id, action, metadata
  ) values (
    'admin', admin_user_id::text, reward_record.merchant_id, reward_record.customer_id,
    'reward_events', p_reward_id, 'reward_cancelled',
    jsonb_build_object('reason', trim(p_reason))
  );
end;
$function$;

revoke all on function public.admin_cancel_reward(uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_cancel_reward(uuid, text)
  to authenticated, service_role;

-- Referral outbox payloads use the copy from complete_referral_notification_payload.

-- Source: 20260710190000_referral_retry_outbox.sql; existing referral state and authorisation are preserved.
create or replace function public.referrals_emit_attributed()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  begin
    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
    )
    values (
      'referral_attributed', new.venue_id, new.referrer_customer_id, new.referrer_membership_id, 'system', null,
      jsonb_build_object('referral_edge_id', new.id, 'referred_membership_id', new.referred_membership_id,
        'referred_customer_id', new.referred_customer_id)
    );

    if new.referrer_customer_id is not null and new.referrer_membership_id is not null then
      perform public.enqueue_notification_event(
        p_event_type := 'referral_friend_joined',
        p_customer_id := new.referrer_customer_id,
        p_merchant_id := new.venue_id,
        p_membership_id := new.referrer_membership_id,
        p_dedupe_key := 'referral:' || new.id::text || ':attributed',
        p_payload := jsonb_build_object(
          'title', 'Your friend joined',
          'body', 'Someone you invited to ' || coalesce((select nullif(trim(business_name), '') from public.merchants where id = new.venue_id), 'Your venue') || ' just joined.',
          'url', '/card/' || new.referrer_membership_id::text),
        p_metadata := jsonb_build_object('referral_edge_id', new.id)
      );
    end if;
  exception
    when others then
      raise warning 'referral attributed outbox skipped for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- Source: 20260803100400_referral_exclude_offer_stamp_qualification.sql; existing referral state and authorisation are preserved.
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
      'referral_bonus', 'imported', 'manual_adjustment', 'loyalty_invite',
      'offer_campaign'
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
        p_payload := jsonb_build_object(
          'title', 'Your referral qualified',
          'body', 'Your invited friend made their first visit to ' || coalesce((select nullif(trim(business_name), '') from public.merchants where id = v_edge.venue_id), 'Your venue') || ' — your bonus is on its way.',
          'url', '/card/' || v_edge.referrer_membership_id::text),
        p_metadata := jsonb_build_object('referral_edge_id', v_edge.id)
      );
    exception
      when others then
        raise warning 'referral qualified notification skipped for %: %', v_edge.id, sqlerrm;
    end;
  end if;
end;
$$;

-- Source: 20260710190000_referral_retry_outbox.sql; existing referral state and authorisation are preserved.
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

  if p_reason = 'temporary_processing_error' then
    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
    )
    values (
      'referral_bonus_failed', v_edge.venue_id, v_edge.referrer_customer_id,
      v_edge.referrer_membership_id, 'system', null,
      jsonb_build_object('referral_edge_id', p_referral_id, 'referred_membership_id',
        v_edge.referred_membership_id, 'last_error', p_error)
    );
  end if;

  if v_edge.referrer_customer_id is not null and v_edge.referrer_membership_id is not null then
    begin
      perform public.enqueue_notification_event(
        p_event_type := 'referral_bonus_saved',
        p_customer_id := v_edge.referrer_customer_id,
        p_merchant_id := v_edge.venue_id,
        p_membership_id := v_edge.referrer_membership_id,
        p_dedupe_key := 'referral:' || p_referral_id::text || ':held',
        p_payload := jsonb_build_object(
          'title', 'Bonus saved',
          'body', 'Your referral bonus at ' || coalesce((select nullif(trim(business_name), '') from public.merchants where id = v_edge.venue_id), 'Your venue') || ' is saved and will be added automatically.',
          'url', '/card/' || v_edge.referrer_membership_id::text),
        p_metadata := jsonb_build_object('referral_edge_id', p_referral_id)
      );
    exception
      when others then
        raise warning 'referral bonus-saved notification skipped for %: %', p_referral_id, sqlerrm;
    end;
  end if;
end;
$$;

-- Source: 20260712100000_referral_review_hardening.sql; existing referral state and authorisation are preserved.
create or replace function nabaperks_internal.settle_referral_bonus_with_visit(p_referral_id uuid)
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
      p_payload := jsonb_build_object(
          'title', 'You earned a bonus stamp',
          'body', 'Someone you invited to ' || coalesce((select nullif(trim(business_name), '') from public.merchants where id = v_referrer.merchant_id), 'Your venue') || ' collected their first stamp — your bonus stamp is now on your card.',
          'url', '/card/' || v_referrer.id::text),
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

revoke all on function nabaperks_internal.settle_referral_bonus_with_visit(uuid)
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
