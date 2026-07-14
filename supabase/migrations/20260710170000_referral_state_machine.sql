-- Referral v2 explicit state machine + qualification.
--
-- Replaces v1's two-timestamp inference with an explicit, auditable `status`
-- lifecycle (attributed → qualified → settling → awarded | held, plus terminal
-- rejected/cancelled/expired) and the denormalised identities, qualification
-- facts, and durable hold/retry columns the later specs write. Its load-bearing
-- change is decoupling qualification from attribution: a `?ref` enrolment records
-- an `attributed` edge and nothing more; only the referred friend's FIRST genuine
-- non-bonus venue `earned` stamp transitions it to `qualified`.
-- Behavioral coverage: tests/contracts/referral-review-hardening.test.mjs.
--
-- Additive and backward-compatible: enrolment, stamping, and the v1 referrer bonus
-- behave exactly as before; the only behavioural change to the award primitive is
-- that it now also records `status='awarded'`. The v1 columns
-- (referrer_bonus_due_at / referrer_bonus_awarded_at / referrer_stamp_event_id) are
-- retained as the v2 bonus fields, so every existing read path keeps working.
--
-- Idempotent by construction (safe to re-apply / replay): additive DDL is guarded,
-- constraints are dropped before create, functions use create-or-replace.

-- 1. State-machine columns ---------------------------------------------------
alter table public.referrals
  add column if not exists status text not null default 'attributed',
  add column if not exists venue_id uuid,
  add column if not exists referrer_customer_id uuid,
  add column if not exists referred_customer_id uuid,
  add column if not exists qualified_at timestamptz,
  add column if not exists qualifying_stamp_id uuid,
  add column if not exists hold_reason text,
  add column if not exists held_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.referrals drop constraint if exists referrals_status_check;
alter table public.referrals add constraint referrals_status_check
  check (status in (
    'attributed', 'qualified', 'settling', 'held',
    'awarded', 'rejected', 'cancelled', 'expired'
  ));

alter table public.referrals drop constraint if exists referrals_hold_reason_check;
alter table public.referrals add constraint referrals_hold_reason_check
  check (hold_reason is null or hold_reason in (
    'referrer_membership_inactive', 'card_full', 'daily_bonus_limit',
    'reward_unavailable', 'temporary_processing_error'
  ));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'referrals_qualifying_stamp_id_fkey'
  ) then
    alter table public.referrals add constraint referrals_qualifying_stamp_id_fkey
      foreign key (qualifying_stamp_id) references public.stamp_events(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'referrals_venue_id_fkey'
  ) then
    alter table public.referrals add constraint referrals_venue_id_fkey
      foreign key (venue_id) references public.merchants(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'referrals_referrer_customer_id_fkey'
  ) then
    alter table public.referrals add constraint referrals_referrer_customer_id_fkey
      foreign key (referrer_customer_id) references public.customers(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'referrals_referred_customer_id_fkey'
  ) then
    alter table public.referrals add constraint referrals_referred_customer_id_fkey
      foreign key (referred_customer_id) references public.customers(id) on delete cascade;
  end if;
end;
$$;

-- 2. Edges survive membership churn (core invariant #1) ----------------------
-- The referred side stops cascade-deleting so attribution persists across a
-- leave-and-rejoin; identity is carried by referred_customer_id. The referrer
-- side likewise survives for audit/traceability.
alter table public.referrals alter column referred_membership_id drop not null;
alter table public.referrals drop constraint if exists referrals_referred_membership_id_fkey;
alter table public.referrals add constraint referrals_referred_membership_id_fkey
  foreign key (referred_membership_id) references public.customer_memberships(id) on delete set null;

alter table public.referrals alter column referrer_membership_id drop not null;
alter table public.referrals drop constraint if exists referrals_referrer_membership_id_fkey;
alter table public.referrals add constraint referrals_referrer_membership_id_fkey
  foreign key (referrer_membership_id) references public.customer_memberships(id) on delete set null;

-- 3. Denormalise + dedupe trigger --------------------------------------------
-- BEFORE INSERT: fill venue_id / customer ids from the referrer and referred
-- memberships (so the v1 join-wrapper INSERT is untouched), and silently skip
-- (RETURN NULL) a duplicate (venue_id, referred_customer_id) so the new
-- uniqueness never raises inside — and never blocks — the friend's join.
create or replace function public.referrals_denormalize()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue uuid;
  v_referrer_customer uuid;
  v_referred_customer uuid;
  v_referrer_venue uuid;
begin
  select m.customer_id, m.merchant_id
    into v_referrer_customer, v_referrer_venue
  from public.customer_memberships m
  where m.id = new.referrer_membership_id;

  select m.customer_id, coalesce(v_referrer_venue, m.merchant_id)
    into v_referred_customer, v_venue
  from public.customer_memberships m
  where m.id = new.referred_membership_id;

  new.venue_id := coalesce(new.venue_id, v_venue, v_referrer_venue);
  new.referrer_customer_id := coalesce(new.referrer_customer_id, v_referrer_customer);
  new.referred_customer_id := coalesce(new.referred_customer_id, v_referred_customer);
  new.updated_at := clock_timestamp();

  if new.venue_id is not null and new.referred_customer_id is not null and exists (
    select 1 from public.referrals r
    where r.venue_id = new.venue_id
      and r.referred_customer_id = new.referred_customer_id
      and r.id <> new.id
  ) then
    return null; -- one referrer per (venue, referred customer); keep the first
  end if;

  return new;
end;
$$;

drop trigger if exists referrals_denormalize_bi on public.referrals;
create trigger referrals_denormalize_bi
  before insert on public.referrals
  for each row execute function public.referrals_denormalize();

create or replace function public.referrals_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists referrals_touch_updated_at_bu on public.referrals;
create trigger referrals_touch_updated_at_bu
  before update on public.referrals
  for each row execute function public.referrals_touch_updated_at();

-- 4. Backfill legacy rows' status from the v1 timestamps (idempotent) --------
create or replace function public.backfill_referral_states()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Only touch un-progressed rows so a re-run never downgrades a live edge.
  update public.referrals r set
    status = case
      when r.referrer_bonus_awarded_at is not null then 'awarded'
      when r.referrer_bonus_due_at is not null then 'qualified'
      else 'attributed'
    end,
    qualified_at = coalesce(
      r.qualified_at, r.referrer_bonus_due_at, r.referrer_bonus_awarded_at
    )
  where r.status = 'attributed';
  get diagnostics v_count = row_count;

  update public.referrals r set
    referrer_customer_id = coalesce(
      r.referrer_customer_id,
      (select m.customer_id from public.customer_memberships m where m.id = r.referrer_membership_id)
    ),
    referred_customer_id = coalesce(
      r.referred_customer_id,
      (select m.customer_id from public.customer_memberships m where m.id = r.referred_membership_id)
    ),
    venue_id = coalesce(
      r.venue_id,
      (select m.merchant_id from public.customer_memberships m where m.id = r.referrer_membership_id),
      (select m.merchant_id from public.customer_memberships m where m.id = r.referred_membership_id)
    )
  where r.venue_id is null
     or r.referrer_customer_id is null
     or r.referred_customer_id is null;

  return v_count;
end;
$$;

revoke all on function public.backfill_referral_states() from public, anon, authenticated;
grant execute on function public.backfill_referral_states() to service_role;

select public.backfill_referral_states();

-- 5. Uniqueness that survives membership recreation (core invariant #1) -------
create unique index if not exists referrals_venue_referred_customer_key
  on public.referrals (venue_id, referred_customer_id);

-- 6. Qualification transition (attributed → qualified), one-way + idempotent --
-- The qualifying visit is the referred membership's earliest non-bonus / non
-- imported / non manual `earned` stamp; resolved from the ledger so it is correct
-- whether called from the stamp hook or a drain, and never records a bonus stamp
-- as the qualifier. service-role-only.
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
    return; -- no attributed edge (none, or already qualified/awarded/terminal)
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
    return; -- membership creation alone / only a bonus stamp — no genuine visit yet
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
    jsonb_build_object(
      'referral_edge_id', v_edge_id,
      'qualifying_stamp_id', v_qualifying_stamp,
      'referred_membership_id', p_membership_id
    )
  );
end;
$$;

revoke all on function public.qualify_referral_on_stamp(uuid, uuid) from public, anon, authenticated;
grant execute on function public.qualify_referral_on_stamp(uuid, uuid) to service_role;

-- 7. Award primitive: qualify prepend + status='awarded' ---------------------
-- Reproduces the v1 body (20260709090000) verbatim with exactly two additions:
--   (a) a leading qualify_referral_on_stamp() so the edge is recorded `qualified`
--       before any bonus is attempted (decoupling qualification from the award);
--   (b) `status='awarded'` in the final edge update.
-- Every other line — daily cap, full-card hold-as-due, reward-pool guard,
-- reward selection, product/notification writes — is unchanged.
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
  -- (a) Qualification is now a distinct, recorded step (attributed → qualified),
  -- independent of whether the bonus can be paid this instant.
  perform public.qualify_referral_on_stamp(p_referred_membership_id, p_source_stamp_event_id);

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

  -- Mark the edge paid (RB-3) and now also `awarded` in the v2 state machine.
  update public.referrals
  set referrer_bonus_awarded_at = now(),
      referrer_stamp_event_id = v_bonus_stamp_id,
      status = 'awarded'
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
