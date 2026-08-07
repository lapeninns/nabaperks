-- Loyalty — the venue chooses how long an earned reward stays claimable.
--
-- 20260805100200 gave earned rewards a real expiry and made that expiry RELEASE
-- the card, so a completed card is parked for a bounded time instead of for ever.
-- It set the platform default to 30 days by giving
-- loyalty_cards.reward_expires_after_days a default and backfilling nulls.
--
-- What it could not do is let a venue change it: nothing in app/ or lib/ has ever
-- written that column, so the value was correct but unreachable. This migration
-- adds the parameter to save_loyalty_card, which is the RPC the merchant card
-- form already calls, so the setting arrives on a screen the merchant uses rather
-- than as a new one.
--
-- SIGNATURE CHANGE, HANDLED PROPERLY
-- Adding a defaulted parameter creates a NEW function rather than replacing the
-- old one, which would leave the 7-argument version callable and make named-
-- parameter calls ambiguous. The old signature is therefore dropped explicitly,
-- and the `authenticated` grant is restated for the new one — save_loyalty_card
-- is on the authenticated allowlist (20260711090000) because the merchant desk
-- calls it through the user-JWT client, and that must not be silently lost.
--
--   NBS12  reward expiry outside the permitted 1..3660 days
--
-- Everything else in the body is unchanged from 20260630127000.
--
-- Forward-only and re-runnable.

drop function if exists public.save_loyalty_card(uuid, uuid, text, integer, text, text, boolean);

create or replace function public.save_loyalty_card(
  p_merchant_id uuid,
  p_card_id uuid,
  p_card_name text,
  p_stamps_required integer,
  p_reward_name text,
  p_reward_terms text,
  p_is_active boolean,
  p_reward_expires_after_days integer default 30
)
returns table (loyalty_card_id uuid, saved_action text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
  existing_card_id uuid;
  existing_active_card_id uuid;
  v_reward_name text := coalesce(nullif(trim(p_reward_name), ''), 'Surprise reward');
  v_previous_stamps_required integer;
  v_reconciled_rewards integer := 0;
  v_expires_after_days integer := coalesce(p_reward_expires_after_days, 30);
begin
  -- Mirrors the loyalty_cards.reward_expires_after_days CHECK (1..3660). The
  -- venue chooses how long a customer has to claim a reward they earned; 30 days
  -- is the default, matching the sent-reward default so the product has one
  -- answer to "how long do I have?".
  if v_expires_after_days < 1 or v_expires_after_days > 3660 then
    raise exception 'Reward expiry must be between 1 and 3660 days'
      using errcode = 'NBS12';
  end if;

  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.merchants
    where merchants.id = p_merchant_id
      and merchants.owner_user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select merchant_locations.id
  into v_location_id
  from public.merchant_locations
  where merchant_locations.merchant_id = p_merchant_id
  order by merchant_locations.is_primary desc, merchant_locations.created_at asc
  limit 1;

  if v_location_id is null then
    raise exception 'Merchant location is required before creating a loyalty card';
  end if;

  if p_card_id is not null then
    select loyalty_cards.id, loyalty_cards.stamps_required
    into existing_card_id, v_previous_stamps_required
    from public.loyalty_cards
    where loyalty_cards.id = p_card_id
      and loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id;

    if existing_card_id is null then
      raise insufficient_privilege using message = 'Loyalty card not found for merchant';
    end if;
  else
    select loyalty_cards.id, loyalty_cards.stamps_required
    into existing_card_id, v_previous_stamps_required
    from public.loyalty_cards
    where loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id
    order by loyalty_cards.is_active desc, loyalty_cards.created_at asc
    limit 1;
  end if;

  if p_is_active then
    select loyalty_cards.id
    into existing_active_card_id
    from public.loyalty_cards
    where loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id
      and loyalty_cards.is_active
      and (existing_card_id is null or loyalty_cards.id <> existing_card_id)
    limit 1;

    if existing_active_card_id is not null then
      raise exception 'Only one active loyalty card is allowed for this location';
    end if;
  end if;

  if existing_card_id is null then
    insert into public.loyalty_cards (
      merchant_id,
      location_id,
      card_name,
      stamps_required,
      reward_name,
      reward_terms,
      is_active,
      reward_expires_after_days
    )
    values (
      p_merchant_id,
      v_location_id,
      p_card_name,
      p_stamps_required,
      v_reward_name,
      p_reward_terms,
      p_is_active,
      v_expires_after_days
    )
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_created';
  else
    update public.loyalty_cards
    set
      card_name = p_card_name,
      stamps_required = p_stamps_required,
      reward_name = v_reward_name,
      reward_terms = p_reward_terms,
      is_active = p_is_active,
      reward_expires_after_days = v_expires_after_days
    where loyalty_cards.id = existing_card_id
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_updated';
  end if;

  if existing_card_id is not null and p_is_active then
    v_reconciled_rewards := public.reconcile_loyalty_card_threshold_rewards(
      p_merchant_id,
      loyalty_card_id,
      v_previous_stamps_required,
      p_stamps_required
    );
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    saved_action,
    p_merchant_id,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object(
      'loyalty_card_id', loyalty_card_id,
      'is_active', p_is_active,
      'threshold_reconciled_rewards', v_reconciled_rewards
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
    (select auth.uid())::text,
    p_merchant_id,
    'loyalty_cards',
    loyalty_card_id,
    saved_action,
    jsonb_build_object(
      'stamps_required', p_stamps_required,
      'previous_stamps_required', v_previous_stamps_required,
      'reward_name', v_reward_name,
      'reward_expires_after_days', v_expires_after_days,
      'threshold_reconciled_rewards', v_reconciled_rewards
    )
  );

  return next;
end;
$$;

comment on function public.save_loyalty_card(uuid, uuid, text, integer, text, text, boolean, integer) is
  'Creates or updates the venue loyalty card, including how many days an earned reward stays claimable before it expires and releases the card.';

revoke all on function public.save_loyalty_card(uuid, uuid, text, integer, text, text, boolean, integer)
  from public, anon;
grant execute on function public.save_loyalty_card(uuid, uuid, text, integer, text, text, boolean, integer)
  to authenticated, service_role;

notify pgrst, 'reload schema';
