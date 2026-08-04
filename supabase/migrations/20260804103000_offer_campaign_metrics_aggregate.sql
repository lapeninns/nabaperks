-- Merchant Offers and Campaign QR — campaign totals computed in SQL.
--
-- WHY THIS EXISTS
-- The merchant desk reports five counts for a campaign. Three of them already
-- came back as counts rather than as rows. Two did not: the claim total and the
-- welcome-stamp total were derived in TypeScript from a full read of
-- public.offer_campaign_claims through PostgREST.
--
-- supabase/config.toml sets `max_rows = 1000`, so that read is silently capped
-- at a thousand rows. A campaign with more claims than that reported exactly
-- 1000 claims and the stamp sum of only the first thousand — a wrong number
-- presented as an exact one, and wrong in the direction that flatters nobody:
-- the more successful the campaign, the further under it read. Nothing in the
-- response says the list was truncated, so there was no way to notice.
--
-- Paginating the read in the application would have fixed the number and left
-- the shape wrong: a desk render would fetch every claim row a campaign has
-- ever taken in order to count them. So the aggregation moves to where the rows
-- already are, and the desk fetches one row of five numbers.
--
-- WHAT IT COUNTS
-- Exactly what the five tiles said they counted before, unchanged:
--   * link_opens         — sum of the per-day rollup (20260803101000). Page
--                          loads of a claimable link, not people and not scans.
--   * claims             — customers who completed the join through this offer.
--   * bonus_stamps_issued— welcome stamps actually granted across those claims.
--   * active_passes      — discount passes still 'active' and still inside
--                          their window on today's UK business date.
--   * pass_redemptions   — rows in the append-only redemption ledger.
-- `uk_business_date(now())` is the same calendar day the application's
-- `ukTodayIso()` computes for Europe/London, so moving the window test into SQL
-- does not shift which passes count as in date.
--
-- Reads only; takes no lock and writes nothing. Unknown campaign ids return one
-- row of zeroes rather than no row, so a desk that lost a race with an ending
-- campaign renders zeroes instead of failing.
--
-- CONTAINMENT
-- security definer because it reads five RLS-protected tables, and the merchant
-- desk calls it through the service-role client after it has already resolved
-- the campaign for the signed-in venue. It is therefore service_role-only: no
-- EXECUTE for public, anon or authenticated, so it never widens what a merchant
-- session can reach directly.

create or replace function public.offer_campaign_metrics(
  p_campaign_id uuid
)
returns table (
  link_opens bigint,
  claims bigint,
  bonus_stamps_issued bigint,
  active_passes bigint,
  pass_redemptions bigint
)
language sql
stable
security definer
set search_path = public, auth, extensions
as $function$
  select
    (
      select coalesce(sum(opens.open_count), 0)::bigint
      from public.offer_campaign_open_counts as opens
      where opens.campaign_id = p_campaign_id
    ) as link_opens,
    (
      select count(*)::bigint
      from public.offer_campaign_claims as claims
      where claims.campaign_id = p_campaign_id
    ) as claims,
    (
      select coalesce(sum(claims.bonus_stamps_awarded), 0)::bigint
      from public.offer_campaign_claims as claims
      where claims.campaign_id = p_campaign_id
    ) as bonus_stamps_issued,
    (
      select count(*)::bigint
      from public.offer_discount_entitlements as passes
      where passes.campaign_id = p_campaign_id
        and passes.status = 'active'
        and passes.valid_to >= public.uk_business_date(now())
    ) as active_passes,
    (
      select count(*)::bigint
      from public.offer_redemptions as redemptions
      where redemptions.campaign_id = p_campaign_id
    ) as pass_redemptions;
$function$;

comment on function public.offer_campaign_metrics(uuid) is
  'Exact per-campaign totals for the merchant Offers desk, aggregated in SQL so no count can be truncated by the PostgREST row limit.';

revoke all on function public.offer_campaign_metrics(uuid)
  from public, anon, authenticated;
grant execute on function public.offer_campaign_metrics(uuid)
  to service_role;

notify pgrst, 'reload schema';
