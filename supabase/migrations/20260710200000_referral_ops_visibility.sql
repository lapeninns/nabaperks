-- Support operational view + merchant aggregate.
--
-- Two read-only functions, two audiences:
--   admin_referral_ops(...)        — internal-admin (support) detail, identified.
--   merchant_referral_summary(id)  — venue-owner aggregate counts, PII-free.
-- Both follow the established guarded-RPC shape (admin_resolve_fraud_flag): a role
-- check that raises insufficient_privilege, SECURITY DEFINER, granted to
-- authenticated + service_role. The service-role branch lets the gated admin
-- loader (createAdminServiceRoleClient → requireAdminRead) call the detail RPC.
-- Behavioral coverage: tests/contracts/referral-review-hardening.test.mjs.
--
-- Idempotent (create-or-replace only); no schema or policy change.

-- 1. Support detail (internal-admin only) ------------------------------------
create or replace function public.admin_referral_ops(
  p_merchant_id uuid default null,
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  referral_id uuid,
  venue_id uuid,
  venue_name text,
  status text,
  hold_reason text,
  referrer_customer_id uuid,
  referrer_email text,
  referrer_membership_id uuid,
  referred_customer_id uuid,
  referred_email text,
  referred_membership_id uuid,
  attributed_at timestamptz,
  qualified_at timestamptz,
  bonus_awarded_at timestamptz,
  bonus_stamp_id uuid,
  retry_count integer,
  next_retry_at timestamptz,
  last_error text,
  fraud_flag_count integer
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not ((select public.is_internal_admin()) or (select public.is_service_role_request())) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  return query
  select
    r.id,
    r.venue_id,
    m.business_name,
    r.status,
    r.hold_reason,
    r.referrer_customer_id,
    rc.email,
    r.referrer_membership_id,
    r.referred_customer_id,
    fc.email,
    r.referred_membership_id,
    r.created_at,
    r.qualified_at,
    r.referrer_bonus_awarded_at,
    r.referrer_stamp_event_id,
    coalesce(r.retry_count, 0),
    r.next_retry_at,
    r.last_error,
    (
      select count(*)::integer
      from public.fraud_flags ff
      where ff.membership_id = r.referrer_membership_id
    )
  from public.referrals r
  left join public.merchants m on m.id = r.venue_id
  left join public.customers rc on rc.id = r.referrer_customer_id
  left join public.customers fc on fc.id = r.referred_customer_id
  where (p_merchant_id is null or r.venue_id = p_merchant_id)
    and (p_status is null or r.status = p_status)
  order by r.created_at desc
  limit greatest(least(coalesce(p_limit, 100), 500), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_referral_ops(uuid, text, integer, integer) from public, anon;
grant execute on function public.admin_referral_ops(uuid, text, integer, integer) to authenticated, service_role;

-- 2. Merchant aggregate (venue-owner only, no PII) ---------------------------
create or replace function public.merchant_referral_summary(p_merchant_id uuid)
returns table (
  total_count integer,
  attributed_count integer,
  qualified_count integer,
  awarded_count integer,
  held_count integer
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not (
    (select public.is_merchant_owner(p_merchant_id))
    or (select public.is_internal_admin())
    or (select public.is_service_role_request())
  ) then
    raise insufficient_privilege using message = 'Venue owner access required';
  end if;

  return query
  select
    count(*)::integer,
    count(*) filter (where r.status = 'attributed')::integer,
    count(*) filter (where r.status = 'qualified')::integer,
    count(*) filter (where r.status = 'awarded')::integer,
    count(*) filter (where r.status in ('held', 'settling'))::integer
  from public.referrals r
  where r.venue_id = p_merchant_id;
end;
$$;

revoke all on function public.merchant_referral_summary(uuid) from public, anon;
grant execute on function public.merchant_referral_summary(uuid) to authenticated, service_role;
