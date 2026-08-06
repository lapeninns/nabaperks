-- Loyalty integrity — a referral can no longer fail in silence, and a visit is
-- never swallowed by one.
--
-- TWO DEFECTS, BOTH IN THE QR STAMP WRAPPER (20260805100100 / 20260712100000).
--
-- 1. A SETTLED BONUS COULD EAT THE CUSTOMER'S VISIT
-- The wrapper settles a scanner's own owed referral bonuses before their visit
-- stamp, so an older bonus is not outranked by a newer one. When that settlement
-- completed the card, the wrapper returned early — because calling the stamp
-- primitive at that point raises NBS02 and would roll the bonus back with it.
--
-- The early return is right. What it did on the way out was not: it reported the
-- REFERRAL BONUS row as `stamp_event_id`, hardcoded `geo_flagged := false`
-- whatever the customer's location said, and left last_visit_at untouched. The
-- customer stood in the venue, scanned, and the visit existed nowhere — not in
-- last_visit_at, not in product_events, not in the venue's dashboard. For a
-- product sold on measuring return visits that is the wrong thing to lose.
--
-- The stamp itself still cannot be added; a full card is a full card, and that is
-- the same answer any full card gives. What changes is that the VISIT is now
-- recorded even though the STAMP is not: last_visit_at moves, a product_event is
-- written, and the returned stamp_event_id is null rather than a bonus row
-- wearing a visit's clothes.
--
-- 2. REFERRAL FAILURES WENT TO THE SERVER LOG AND NOWHERE ELSE
-- Both referral calls were wrapped in `exception when others then raise warning`.
-- Degrading to a warning is correct — a broken referral must never cost a
-- customer their stamp — but a Postgres WARNING reaches the server log and
-- nothing else: not product_events, not fraud_flags, not an alert, not PostHog.
-- A referral bonus could be lost permanently with no ledger and no signal, which
-- is indistinguishable from never having been owed.
--
-- Both handlers now write a durable product_events row carrying the SQLSTATE and
-- the message, so the failure is queryable, countable and alertable. The warning
-- is kept as well, because it costs nothing and is useful when tailing logs.
--
-- `outcome` is used as the metadata key deliberately: it is already on the
-- external analytics allowlist in lib/analytics/privacy-core.ts. The referral
-- failures use the value 'failed', which that allowlist already permits;
-- visit_without_stamp uses 'blocked', which is added to the same key's value set
-- in this change. Both are fixed enum tokens, so nothing customer-identifying is
-- widened — the allowlist still drops any property it does not recognise.
--
-- Forward-only and re-runnable.

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
    raise exception 'Venue QR scan proof required' using errcode = 'NBS08';
  end if;

  select
    memberships.merchant_id,
    memberships.customer_id,
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
    raise exception 'Valid venue QR scan proof required' using errcode = 'NBS08';
  end if;

  begin
    v_drained := public.drain_due_referrer_bonuses_for_membership(p_membership_id);
  exception
    when others then
      raise warning 'referral settle-before-stamp skipped for %: %', p_membership_id, sqlerrm;
      insert into public.product_events (
        event_name, merchant_id, customer_id, membership_id,
        actor_type, actor_id, metadata
      ) values (
        'referral_settlement_failed', v_membership.merchant_id,
        v_membership.customer_id, p_membership_id, 'system', 'system',
        jsonb_build_object(
          'outcome', 'failed',
          'stage', 'settle_before_stamp',
          'sqlstate', sqlstate,
          'error', left(sqlerrm, 500)
        )
      );
  end;

  if v_drained > 0 then
    select memberships.current_stamp_count
    into new_stamp_count
    from public.customer_memberships memberships
    where memberships.id = p_membership_id;

    if new_stamp_count >= v_membership.stamps_required then
      -- The card filled on the settled bonus, so no visit stamp can be added.
      -- Record the VISIT anyway: it happened, and it is what the venue is
      -- paying to measure.
      update public.customer_memberships
      set last_visit_at = now()
      where customer_memberships.id = p_membership_id;

      insert into public.product_events (
        event_name, merchant_id, customer_id, membership_id,
        actor_type, actor_id, metadata
      ) values (
        'visit_without_stamp', v_membership.merchant_id, v_membership.customer_id,
        p_membership_id, 'customer', p_customer_id::text,
        jsonb_build_object(
          'outcome', 'blocked',
          'reason', 'reward_ready_after_referral_settlement',
          'settled_bonuses', v_drained,
          'new_stamp_count', new_stamp_count
        )
      );

      -- Null, not the referral bonus row: no visit stamp was issued, and
      -- returning a bonus id here made the caller believe one was.
      stamp_event_id := null;
      reward_unlocked := true;
      geo_flagged := false;
      return next;
      return;
    end if;
  end if;

  select
    stamp.stamp_event_id, stamp.new_stamp_count, stamp.reward_unlocked, stamp.geo_flagged
  into
    stamp_event_id, new_stamp_count, reward_unlocked, geo_flagged
  from public.issue_self_service_stamp(
    p_membership_id, p_customer_id, p_latitude, p_longitude,
    p_accuracy_meters, p_location_status, p_capture_elapsed_ms
  ) stamp;

  begin
    perform public.award_referrer_bonus_stamp(p_membership_id, stamp_event_id);
  exception
    when others then
      raise warning 'referral bonus skipped for membership %: %', p_membership_id, sqlerrm;
      insert into public.product_events (
        event_name, merchant_id, customer_id, membership_id,
        actor_type, actor_id, metadata
      ) values (
        'referral_bonus_failed', v_membership.merchant_id,
        v_membership.customer_id, p_membership_id, 'system', 'system',
        jsonb_build_object(
          'outcome', 'failed',
          'stage', 'award_on_stamp',
          'sqlstate', sqlstate,
          'error', left(sqlerrm, 500),
          'stamp_event_id', stamp_event_id
        )
      );
  end;

  return next;
end;
$$;

comment on function public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer) is
  'QR visit-stamp wrapper. Settles owed referral bonuses first; records the visit even when a settled bonus leaves no room for a stamp; and writes a durable product_events row for any referral degradation instead of only a server-log warning.';

revoke all on function public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer)
  from public, anon, authenticated;
grant execute on function public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer)
  to service_role;

notify pgrst, 'reload schema';
