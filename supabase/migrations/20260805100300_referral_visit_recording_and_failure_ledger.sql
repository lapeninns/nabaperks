-- Loyalty integrity — referral settlement cannot fabricate a verified visit or
-- fail in silence.
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
-- REFERRAL BONUS row as `stamp_event_id` and the bonus settlement itself advanced
-- last_visit_at even though this path never reached location verification. A
-- referral stamp is not evidence that the referrer visited the venue. Settlement
-- now preserves the previous visit timestamp, and the wrapper returns a null
-- stamp_event_id rather than a bonus row wearing a visit's clothes.
--
-- 2. REFERRAL FAILURES WENT TO THE SERVER LOG AND NOWHERE ELSE
-- Both referral calls were wrapped in `exception when others then raise warning`.
-- Degrading to a warning is correct — a broken referral must never cost a
-- customer their stamp — but a Postgres WARNING reaches the server log and
-- nothing else: not product_events, not fraud_flags, not an alert, not PostHog.
-- A referral bonus could be lost permanently with no ledger and no signal, which
-- is indistinguishable from never having been owed.
--
-- The post-stamp handler writes a durable product_events row. The pre-stamp call
-- is executed by the application before entering this transaction, which lets it
-- persist the same failure signal even when the later stamp transaction rejects.
--
-- `outcome` is used as the metadata key deliberately: it is already on the
-- external analytics allowlist in lib/analytics/privacy-core.ts. The referral
-- failures use the value 'failed', which that allowlist already permits. It is a
-- fixed enum token, so nothing customer-identifying is widened — the allowlist
-- still drops any property it does not recognise.
--
-- Forward-only and re-runnable.

-- The existing settlement routine awards the stamp correctly but also advances
-- last_visit_at. Keep that routine as the locked, atomic core and wrap it at its
-- public boundary so referral awards never masquerade as location-verified
-- visits. Calling relink first handles churned memberships before the snapshot.
create schema if not exists nabaperks_internal;
revoke all on schema nabaperks_internal
  from public, anon, authenticated, service_role;

do $$
begin
  if to_regprocedure('nabaperks_internal.settle_referral_bonus_with_visit(uuid)') is null then
    alter function public.settle_referral_bonus(uuid)
      rename to settle_referral_bonus_with_visit;
    alter function public.settle_referral_bonus_with_visit(uuid)
      set schema nabaperks_internal;
  end if;
end;
$$;

create or replace function public.settle_referral_bonus(p_referral_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_membership_id uuid;
  v_last_visit_at timestamptz;
  v_outcome text;
begin
  perform public.relink_referral_memberships(p_referral_id);

  select referrals.referrer_membership_id
  into v_membership_id
  from public.referrals referrals
  where referrals.id = p_referral_id;

  if v_membership_id is not null then
    select memberships.last_visit_at
    into v_last_visit_at
    from public.customer_memberships memberships
    where memberships.id = v_membership_id;
  end if;

  v_outcome := nabaperks_internal.settle_referral_bonus_with_visit(p_referral_id);

  if v_outcome = 'awarded' and v_membership_id is not null then
    update public.customer_memberships memberships
    set last_visit_at = v_last_visit_at
    where memberships.id = v_membership_id
      and memberships.last_visit_at is distinct from v_last_visit_at;
  end if;

  return v_outcome;
end;
$$;

revoke all on function nabaperks_internal.settle_referral_bonus_with_visit(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.settle_referral_bonus(uuid)
  from public, anon, authenticated;
grant execute on function public.settle_referral_bonus(uuid) to service_role;

drop function if exists public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer);

create or replace function public.issue_self_service_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_qr_id text,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy_meters numeric default null,
  p_location_status text default null,
  p_capture_elapsed_ms integer default null,
  p_referral_bonuses_pre_drained integer default null
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
  v_drained integer := coalesce(p_referral_bonuses_pre_drained, 0);
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

  if p_referral_bonuses_pre_drained is null then
    begin
      v_drained := public.drain_due_referrer_bonuses_for_membership(p_membership_id);
    exception
      when others then
        raise warning 'referral settle-before-stamp skipped for %: %', p_membership_id, sqlerrm;
    end;
  end if;

  if v_drained > 0 then
    select memberships.current_stamp_count
    into new_stamp_count
    from public.customer_memberships memberships
    where memberships.id = p_membership_id;

    if new_stamp_count >= v_membership.stamps_required then
      -- No visit is recorded here: a full card cannot enter the normal location
      -- verifier, so counting this scan as an in-venue visit would weaken the
      -- integrity of the merchant's return-visit metric.
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

comment on function public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer, integer) is
  'QR visit-stamp wrapper. Accepts a separately committed pre-drain count, keeps full-card scans out of visit metrics, and writes post-stamp referral degradation to product_events.';

revoke all on function public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer, integer)
  to service_role;

notify pgrst, 'reload schema';
