-- Referral qualification must ignore bulk-invitation welcome stamps.
--
-- A bulk two-stamp loyalty invitation (claim_loyalty_invite, 20260722100200)
-- enrols a member and writes two stamp_events with metadata source
-- 'loyalty_invite' and a NULL business date — an administrative welcome, not a
-- genuine venue visit. qualify_referral_on_stamp already excludes
-- referral_bonus / imported / manual_adjustment from being a qualifying visit;
-- loyalty_invite belongs in the same set. Owner decision (2026-07-23): an
-- invited-and-joined member must NOT settle a referral bonus for their referrer
-- until they earn a real visit stamp.
--
-- Verbatim from 20260712100000_referral_review_hardening.sql with 'loyalty_invite'
-- added to the excluded-source list; signature and grants are unchanged, so
-- create-or-replace preserves the existing ACL.

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
      'referral_bonus', 'imported', 'manual_adjustment', 'loyalty_invite'
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
        p_payload := jsonb_build_object('url', '/card/' || v_edge.referrer_membership_id::text),
        p_metadata := jsonb_build_object('referral_edge_id', v_edge.id)
      );
    exception
      when others then
        raise warning 'referral qualified notification skipped for %: %', v_edge.id, sqlerrm;
    end;
  end if;
end;
$$;
