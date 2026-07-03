-- Issued rewards, phase 1: schema rails.
--
-- Rewards today are exclusively EARNED — a stamp card fills, a reward_events row
-- unlocks, a merchant scan redeems it. This migration adds a `source` so the
-- same ledger can also carry ISSUED rewards (birthday_month, merchant_direct)
-- that share the earned-reward redemption flow, screens, and expiry machinery.
-- This migration lands only schema + the birthday-config RPC + the notification
-- ledger twins; the source-aware gate functions live in the sibling migration
-- 20260704091000, and nothing issues a birthday/direct reward yet.
--
-- Every statement is written to be safe on this repo's re-apply-on-each-run
-- migration model: additive `add column if not exists`, named constraints via
-- `drop constraint if exists` + `add constraint`, `create index if not exists`,
-- and `create or replace function`.

-- 1. reward_events.source + birthday_year -------------------------------------

alter table public.reward_events
  add column if not exists source text not null default 'stamp_cycle',
  add column if not exists birthday_year integer;

alter table public.reward_events
  drop constraint if exists reward_events_source_check;
alter table public.reward_events
  add constraint reward_events_source_check
  check (source in ('stamp_cycle', 'birthday_month', 'merchant_direct'));

-- birthday_year is present IF AND ONLY IF the reward is a birthday reward. Both
-- operands are non-null booleans, so the equality is deterministic (never the
-- CHECK-passing NULL), which is what we want for a hard coherence rule.
alter table public.reward_events
  drop constraint if exists reward_events_birthday_year_coherent;
alter table public.reward_events
  add constraint reward_events_birthday_year_coherent
  check ((source = 'birthday_month') = (birthday_year is not null));

-- At most one birthday reward per (merchant, customer, calendar year), across
-- ALL statuses — a cancelled/expired birthday reward does not free a re-issue.
create unique index if not exists reward_events_one_birthday_per_year_idx
  on public.reward_events (merchant_id, customer_id, birthday_year)
  where source = 'birthday_month';

-- Support the merchant-facing "issued rewards" readbacks (sent list, activity)
-- without scanning the earned-reward volume.
create index if not exists reward_events_issued_source_idx
  on public.reward_events (merchant_id, source, created_at desc)
  where source <> 'stamp_cycle';

-- 2. loyalty_cards birthday-reward config -------------------------------------

alter table public.loyalty_cards
  add column if not exists birthday_reward_enabled boolean not null default false,
  add column if not exists birthday_reward_name text,
  add column if not exists birthday_reward_terms text;

-- Bounds mirror the earned-reward copy limits; enabling requires both fields,
-- but the values persist while disabled so a merchant can toggle without
-- retyping.
alter table public.loyalty_cards
  drop constraint if exists loyalty_cards_birthday_reward_valid;
alter table public.loyalty_cards
  add constraint loyalty_cards_birthday_reward_valid
  check (
    (birthday_reward_name is null or char_length(birthday_reward_name) between 1 and 100)
    and (birthday_reward_terms is null or char_length(birthday_reward_terms) between 12 and 500)
    and (
      birthday_reward_enabled = false
      or (birthday_reward_name is not null and birthday_reward_terms is not null)
    )
  );

-- 3. notification ledger twins -------------------------------------------------
-- The birthday/direct producers (later phases) enqueue these; they are
-- marketing (promotional gifts) so they honour marketing prefs + push consent.
-- The reward stays fully visible in-app regardless of push delivery.

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
      'reward_collected_cycle_started'
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
    'merchant_reward_received'
  ));

-- 4. Birthday-reward config RPC -----------------------------------------------
-- A dedicated RPC (NOT an extension of save_loyalty_card, whose signature has
-- already forced a drop-function migration once): the merchant owner toggles and
-- names the birthday reward. Friendly validation mirrors the CHECK so the UI
-- gets a readable message before the constraint fires.

create or replace function public.save_loyalty_card_birthday_reward(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_enabled boolean,
  p_reward_name text,
  p_reward_terms text
)
returns table (
  loyalty_card_id uuid,
  birthday_reward_enabled boolean,
  birthday_reward_name text,
  birthday_reward_terms text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_enabled boolean := coalesce(p_enabled, false);
  v_name text := nullif(btrim(p_reward_name), '');
  v_terms text := nullif(btrim(p_reward_terms), '');
  v_card_id uuid;
begin
  if not public.is_service_role_request() then
    if current_user_id is null
      or not exists (
        select 1
        from public.merchants
        where merchants.id = p_merchant_id
          and merchants.owner_user_id = current_user_id
      ) then
      raise insufficient_privilege using message = 'Merchant owner access required';
    end if;
  end if;

  select loyalty_cards.id
  into v_card_id
  from public.loyalty_cards
  where loyalty_cards.id = p_loyalty_card_id
    and loyalty_cards.merchant_id = p_merchant_id
  for update;

  if v_card_id is null then
    raise exception 'Loyalty card not found for merchant';
  end if;

  if v_enabled and (v_name is null or v_terms is null) then
    raise exception 'A birthday reward name and terms are required when enabling';
  end if;

  if v_name is not null and char_length(v_name) > 100 then
    raise exception 'Birthday reward name must be 100 characters or fewer';
  end if;

  if v_terms is not null and char_length(v_terms) not between 12 and 500 then
    raise exception 'Birthday reward terms must be between 12 and 500 characters';
  end if;

  update public.loyalty_cards
  set
    birthday_reward_enabled = v_enabled,
    birthday_reward_name = v_name,
    birthday_reward_terms = v_terms
  where loyalty_cards.id = p_loyalty_card_id;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'loyalty_card_updated',
    p_merchant_id,
    'merchant',
    coalesce(current_user_id::text, 'service_role'),
    jsonb_build_object(
      'loyalty_card_id', p_loyalty_card_id,
      'birthday_reward_enabled', v_enabled,
      'change', 'birthday_reward'
    )
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    coalesce(current_user_id::text, 'service_role'),
    p_merchant_id,
    'loyalty_cards',
    p_loyalty_card_id,
    'birthday_reward_saved',
    jsonb_build_object('birthday_reward_enabled', v_enabled)
  );

  return query
    select
      loyalty_cards.id,
      loyalty_cards.birthday_reward_enabled,
      loyalty_cards.birthday_reward_name,
      loyalty_cards.birthday_reward_terms
    from public.loyalty_cards
    where loyalty_cards.id = p_loyalty_card_id;
end;
$$;

revoke all on function public.save_loyalty_card_birthday_reward(uuid, uuid, boolean, text, text) from public;
grant execute on function public.save_loyalty_card_birthday_reward(uuid, uuid, boolean, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
