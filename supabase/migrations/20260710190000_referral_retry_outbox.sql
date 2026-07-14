-- Transactional outbox + event-driven retry.
--
-- Completes the referral outbox: every lifecycle transition writes a product event
-- (referral_attributed / qualified / bonus_held / bonus_awarded / bonus_failed) and,
-- where the member should hear it, a deduplicated notification (friend joined /
-- referral qualified / bonus saved / bonus added). Adds an event-driven retry: when
-- a merchant activates or replenishes reward-pool items, held reward_unavailable
-- bonuses for that venue are settled immediately (recursion-guarded, fail-safe).
-- The referrer-visit retry is the settlement stamp-ordering hook; the freed-card /
-- daily-reset retries are the scheduled drain.
-- Behavioral coverage: tests/contracts/referral-review-hardening.test.mjs.
--
-- Idempotent by construction (safe to re-apply): create-or-replace throughout;
-- notifications are deduped by referral id + event type via enqueue_notification_event.

-- 1. Register the three new member notification types -------------------------
-- Reproduce the current mapping (20260709090000) plus the referral lifecycle types.
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
      'referral_bonus_stamp_issued',
      'referral_friend_joined',
      'referral_qualified',
      'referral_bonus_saved'
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
    'referral_bonus_stamp_issued',
    'referral_friend_joined',
    'referral_qualified',
    'referral_bonus_saved'
  ));

-- 2. Attributed outbox: event + friend-joined notification (fail-safe) --------
-- AFTER INSERT so it only fires for edges that were actually written (the
-- BEFORE-INSERT denormalise trigger RETURNs NULL for a skipped duplicate). Wrapped
-- so the outbox can never block the friend's enrolment (core invariant #6).
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
        p_payload := jsonb_build_object('url', '/card/' || new.referrer_membership_id::text),
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

drop trigger if exists referrals_emit_attributed_ai on public.referrals;
create trigger referrals_emit_attributed_ai
  after insert on public.referrals
  for each row execute function public.referrals_emit_attributed();

-- 3. Qualification notification ----------------------------------------------
-- Reproduce the state-machine qualify function and append the referral-qualified
-- member notification (deduped, fail-safe so a notification failure never rolls
-- back qualification).
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
  v_edge_id uuid;
  v_venue uuid;
  v_referrer_customer uuid;
  v_referrer_membership uuid;
  v_qualifying_stamp uuid;
begin
  select r.id, r.venue_id, r.referrer_customer_id, r.referrer_membership_id
    into v_edge_id, v_venue, v_referrer_customer, v_referrer_membership
  from public.referrals r
  where r.referred_membership_id = p_membership_id
    and r.status = 'attributed'
  for update of r;

  if v_edge_id is null then
    return;
  end if;

  select se.id
    into v_qualifying_stamp
  from public.stamp_events se
  where se.membership_id = p_membership_id
    and se.event_type = 'earned'
    and coalesce(se.metadata->>'source', '') <> 'referral_bonus'
    and coalesce(se.metadata->>'source', '') <> 'imported'
    and coalesce(se.metadata->>'source', '') <> 'manual_adjustment'
  order by se.created_at asc, se.id asc
  limit 1;

  if v_qualifying_stamp is null then
    return;
  end if;

  update public.referrals
  set status = 'qualified',
      qualified_at = now(),
      qualifying_stamp_id = v_qualifying_stamp
  where id = v_edge_id;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'referral_qualified', v_venue, v_referrer_customer, v_referrer_membership, 'system', null,
    jsonb_build_object('referral_edge_id', v_edge_id, 'qualifying_stamp_id', v_qualifying_stamp,
      'referred_membership_id', p_membership_id)
  );

  if v_referrer_customer is not null and v_referrer_membership is not null then
    begin
      perform public.enqueue_notification_event(
        p_event_type := 'referral_qualified',
        p_customer_id := v_referrer_customer,
        p_merchant_id := v_venue,
        p_membership_id := v_referrer_membership,
        p_dedupe_key := 'referral:' || v_edge_id::text || ':qualified',
        p_payload := jsonb_build_object('url', '/card/' || v_referrer_membership::text),
        p_metadata := jsonb_build_object('referral_edge_id', v_edge_id)
      );
    exception
      when others then
        raise warning 'referral qualified notification skipped for %: %', v_edge_id, sqlerrm;
    end;
  end if;
end;
$$;

revoke all on function public.qualify_referral_on_stamp(uuid, uuid) from public, anon, authenticated;
grant execute on function public.qualify_referral_on_stamp(uuid, uuid) to service_role;

-- 4. Hold: bonus-saved notification + referral_bonus_failed event -------------
-- Reproduce the settlement hold writer and append the member "bonus saved"
-- notification (deduped per edge) and, for the error reason, a distinct
-- referral_bonus_failed product event.
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
        p_payload := jsonb_build_object('url', '/card/' || v_edge.referrer_membership_id::text),
        p_metadata := jsonb_build_object('referral_edge_id', p_referral_id)
      );
    exception
      when others then
        raise warning 'referral bonus-saved notification skipped for %: %', p_referral_id, sqlerrm;
    end;
  end if;
end;
$$;

revoke all on function public.hold_referral_bonus(uuid, text, text) from public, anon, authenticated;
grant execute on function public.hold_referral_bonus(uuid, text, text) to service_role;

-- 5. Event-driven retry on reward-pool replenishment -------------------------
-- WHEN a merchant activates/replenishes a reward-pool item, settle that venue's
-- reward_unavailable holds. Recursion-guarded (settlement never writes
-- reward_pool_items, but the depth guard is belt-and-suspenders) and fail-safe so a
-- reward edit is never blocked.
create or replace function public.referrals_retry_on_reward_replenish()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  r record;
begin
  begin
    for r in
      select referrals.id
      from public.referrals
      join public.customer_memberships m on m.id = referrals.referrer_membership_id
      where m.merchant_id = new.merchant_id
        and referrals.referrer_bonus_awarded_at is null
        and referrals.status = 'held'
        and referrals.hold_reason = 'reward_unavailable'
      for update of referrals skip locked
    loop
      perform public.settle_referral_bonus(r.id);
    end loop;
  exception
    when others then
      raise warning 'referral retry-on-replenish skipped for merchant %: %', new.merchant_id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists referrals_retry_on_reward_replenish_aiu on public.reward_pool_items;
create trigger referrals_retry_on_reward_replenish_aiu
  after insert or update on public.reward_pool_items
  for each row
  when (pg_trigger_depth() < 1 and new.is_active)
  execute function public.referrals_retry_on_reward_replenish();
