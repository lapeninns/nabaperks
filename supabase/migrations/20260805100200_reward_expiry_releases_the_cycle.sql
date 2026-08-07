-- Loyalty integrity — an unredeemed reward parks a card, it no longer kills it.
--
-- THE PROBLEM
-- issue_self_service_stamp refuses every stamp once the active cycle holds
-- stamps_required earned rows ('A reward is already ready to redeem', now NBS02).
-- The only thing that ever cleared that state was redemption, because
-- redeem_self_service_reward is the sole writer of active_cycle_number
-- (20260704091000:387). A customer who completed a card and did not redeem it
-- therefore stopped earning permanently, and every later visit was refused in
-- silence. That is the wrong customer to punish: it is the one who filled a card.
--
-- WHY EXPIRY WAS NOT ALREADY THE ANSWER
-- The expiry machinery has existed since 20260622140000 but is INERT for earned
-- rewards. resolve_reward_event_expires_at reads
-- reward_pool_items.reward_expires_after_days then loyalty_cards.reward_expires_after_days;
-- both are nullable, neither has a default, and NOTHING in app/, lib/ or any
-- migration has ever written either. So expires_at is always null for
-- source='stamp_cycle', and expire_due_reward_events can never select one.
--
-- Worse, had one ever expired it would have BRICKED the card rather than freeing
-- it: expire_due_reward_events touches only reward_events and the notification
-- ledger, so the cycle would not advance, the NBS02 gate would keep firing
-- against the ledger, and redeem_self_service_reward would refuse the expired
-- row ('Reward is not redeemable'). There is no recovery RPC for that state —
-- admin_adjust_membership_stamps moves the counter, not the earned rows the gate
-- actually counts.
--
-- WHAT THIS MIGRATION DOES
--   1. Gives earned rewards a real, merchant-editable expiry, defaulting to 30
--      days, so a full card is parked for a bounded time instead of for ever.
--   2. Makes expiry RELEASE the cycle: an expired stamp-cycle reward advances
--      active_cycle_number and clears the completed stamps, so the customer's
--      next visit stamps normally.
--   3. Adds total_rewards_expired, because advancing the cycle without it would
--      break the invariant active_cycle_number = total_rewards_redeemed + 1 that
--      tests/db/membership-counter-ledger-reconciliation.test.mjs asserts. The
--      invariant becomes
--        active_cycle_number = total_rewards_redeemed + total_rewards_expired + 1.
--   4. Heals cycles that completed WITHOUT a reward row, which promotional
--      grants can produce (see mint_cycle_reward_if_missing, 20260805100100).
--      Without this, such a card has nothing to expire and so would never be
--      released by (2).
--
-- NOT RETROACTIVE, DELIBERATELY
-- expires_at is snapshotted onto reward_events at INSERT by
-- set_reward_event_expiry_snapshot. Backfilling the card default therefore
-- affects rewards minted from now on and leaves every reward already in a
-- customer's hands exactly as it was issued. A reward earned under "never
-- expires" is not quietly given a deadline.
--
-- Forward-only and re-runnable.

-- 1. The expired-reward counter -------------------------------------------------
alter table public.customer_memberships
  add column if not exists total_rewards_expired integer not null default 0;

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_memberships_total_rewards_expired_check'
  ) then
    alter table public.customer_memberships
      add constraint customer_memberships_total_rewards_expired_check
      check (total_rewards_expired >= 0);
  end if;
end
$do$;

comment on column public.customer_memberships.total_rewards_expired is
  'Earned rewards that lapsed unredeemed. Counts toward the cycle the same way a redemption does: active_cycle_number = total_rewards_redeemed + total_rewards_expired + 1.';

-- 2. A real default expiry for earned rewards -----------------------------------
-- 30 days matches the merchant-facing default already used for sent rewards
-- (pending_reward_invites.reward_expires_after_days default 30,
-- lib/merchant/send-reward-fields.ts), so the product has one answer to
-- "how long do I have?" rather than two.
alter table public.loyalty_cards
  alter column reward_expires_after_days set default 30;

update public.loyalty_cards
set reward_expires_after_days = 30,
    updated_at = now()
where reward_expires_after_days is null;

-- 3. Heal cycles that completed without a reward --------------------------------
-- Runs in the sweep rather than in the stamping path: the stamp path discovers
-- this state immediately before it raises NBS02, and raising would roll back
-- anything minted alongside it. Here the mint commits.
create or replace function public.release_completed_cycles_without_reward(
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_membership record;
  v_healed integer := 0;
begin
  for v_membership in
    select memberships.id
    from public.customer_memberships memberships
    join public.loyalty_cards cards
      on cards.merchant_id = memberships.merchant_id and cards.is_active
    where memberships.current_stamp_count >= cards.stamps_required
      and not exists (
        select 1 from public.reward_events
        where reward_events.membership_id = memberships.id
          and reward_events.cycle_number = memberships.active_cycle_number
          and reward_events.source = 'stamp_cycle'
      )
    limit greatest(coalesce(p_limit, 500), 1)
  loop
    if public.mint_cycle_reward_if_missing(v_membership.id) is not null then
      v_healed := v_healed + 1;
    end if;
  end loop;

  return v_healed;
end;
$function$;

comment on function public.release_completed_cycles_without_reward(integer) is
  'Mints the missing reward for cycles filled by a promotional grant, so the NBS02 gate always names a reward that exists and the expiry sweep always has something to release.';

revoke all on function public.release_completed_cycles_without_reward(integer)
  from public, anon, authenticated;
grant execute on function public.release_completed_cycles_without_reward(integer)
  to service_role;

-- 4. Expiry that releases the card ----------------------------------------------
-- Same selection and the same notification as 20260622140000. What is added is
-- the membership update for source='stamp_cycle' rewards, mirroring exactly what
-- redeem_self_service_reward does on the happy path (20260704091000:381-392)
-- except that the tally moves to total_rewards_expired.
--
-- Issued rewards (birthday_month, merchant_direct) carry cycle_number null and
-- must NOT advance a cycle: they were never backed by a full card. The branch
-- below is on reward_source for exactly that reason.
create or replace function public.expire_due_reward_events(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  expired_reward record;
  v_count integer := 0;
begin
  -- Heal first: a completed cycle with no reward row has nothing to expire, so
  -- without this it would never be released.
  perform public.release_completed_cycles_without_reward();

  for expired_reward in
    update public.reward_events
    set
      status = 'expired',
      expired_at = coalesce(expired_at, p_now),
      metadata = reward_events.metadata || jsonb_build_object(
        'expired_by', 'scheduled_notification_worker'
      )
    where reward_events.status = 'unlocked'
      and reward_events.expires_at is not null
      and reward_events.expires_at <= p_now
    returning
      id,
      merchant_id,
      customer_id,
      membership_id,
      cycle_number,
      expires_at,
      reward_name,
      source,
      loyalty_card_id
  loop
    v_count := v_count + 1;

    -- Release the card. Without this the membership keeps an active cycle that
    -- already holds stamps_required earned rows, and NBS02 refuses every future
    -- stamp for ever.
    if expired_reward.source = 'stamp_cycle' then
      update public.customer_memberships memberships
      set current_stamp_count = greatest(
            memberships.current_stamp_count - coalesce(cards.stamps_required, 0), 0
          ),
          total_rewards_expired = memberships.total_rewards_expired + 1,
          active_cycle_number = memberships.active_cycle_number + 1
      from public.loyalty_cards cards
      where memberships.id = expired_reward.membership_id
        and cards.id = expired_reward.loyalty_card_id;

      insert into public.audit_logs (
        actor_type, actor_id, merchant_id, customer_id,
        target_table, target_id, action, metadata
      )
      values (
        'system', 'system', expired_reward.merchant_id, expired_reward.customer_id,
        'reward_events', expired_reward.id, 'reward_expired_cycle_released',
        jsonb_build_object(
          'membership_id', expired_reward.membership_id,
          'cycle_number', expired_reward.cycle_number,
          'expires_at', expired_reward.expires_at
        )
      );
    end if;

    perform public.enqueue_notification_event(
      'reward_expired',
      expired_reward.customer_id,
      expired_reward.merchant_id,
      expired_reward.membership_id,
      expired_reward.id,
      expired_reward.cycle_number,
      public.uk_business_date(expired_reward.expires_at),
      p_now,
      'reward_expired:' || expired_reward.id::text,
      jsonb_build_object(
        'title', 'Reward expired',
        'body', expired_reward.reward_name,
        'url', '/home/rewards',
        'rewardEventId', expired_reward.id
      ),
      jsonb_build_object('source', 'reward_expiry')
    );
  end loop;

  return v_count;
end;
$$;

comment on function public.expire_due_reward_events(timestamptz) is
  'Expires due rewards and, for stamp-cycle rewards, releases the membership cycle so a full card that was never redeemed stops refusing new stamps.';

revoke all on function public.expire_due_reward_events(timestamptz)
  from public, anon, authenticated;
grant execute on function public.expire_due_reward_events(timestamptz) to service_role;

notify pgrst, 'reload schema';
