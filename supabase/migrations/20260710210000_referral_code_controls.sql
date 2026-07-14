-- Rotatable + deactivatable referral codes.
--
-- Adds a per-membership active flag + rotated-at timestamp, makes attribution
-- resolve only ACTIVE codes (one added predicate in the join wrapper), and provides
-- owner-guarded rotate / set-active RPCs. A rotated or paused code never blocks a
-- friend's enrolment — it simply records no edge, like an unknown code.
-- Behavioral coverage: tests/contracts/referral-review-hardening.test.mjs.
--
-- Idempotent (guarded DDL + create-or-replace). The referral_code column stays
-- NOT NULL + UNIQUE; deactivation is a boolean flag, never a null/empty code.

-- 1. Control columns (existing rows default to active) ------------------------
alter table public.customer_memberships
  add column if not exists referral_code_active boolean not null default true,
  add column if not exists referral_code_rotated_at timestamptz;

-- 2. Attribution resolves only active codes ----------------------------------
-- Reproduce the v1 join wrapper (20260708090000) verbatim, adding a single
-- predicate `and rm.referral_code_active` to the ?ref resolution join. Everything
-- else — the guards, the on-conflict, the first-stamp block — is unchanged.
create or replace function public.join_customer_membership_with_first_stamp(
  p_customer_id uuid,
  p_merchant_slug text,
  p_qr_id text,
  p_marketing_opt_in boolean,
  p_policy_version text,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_ref text default null
)
returns table (
  membership_id uuid,
  created_membership boolean,
  first_stamp_issued boolean,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  select j.membership_id, j.created_membership
  into membership_id, created_membership
  from public.join_customer_membership(
    p_customer_id,
    p_merchant_slug,
    p_qr_id,
    p_marketing_opt_in,
    p_policy_version
  ) j;

  first_stamp_issued := false;
  new_stamp_count := 0;
  reward_unlocked := false;
  geo_flagged := false;

  if created_membership and p_ref is not null and btrim(p_ref) <> '' then
    insert into public.referrals (
      referred_membership_id,
      referrer_membership_id,
      referral_code_used
    )
    select nm.id, rm.id, rm.referral_code
    from public.customer_memberships nm
    join public.customer_memberships rm
      on rm.referral_code = btrim(p_ref)
     and rm.referral_code_active
     and rm.merchant_id = nm.merchant_id
     and rm.customer_id <> nm.customer_id
    where nm.id = membership_id
    on conflict (referred_membership_id) do nothing;
  end if;

  if created_membership and p_qr_id is not null and trim(p_qr_id) <> '' then
    begin
      select s.new_stamp_count, s.reward_unlocked, s.geo_flagged
      into new_stamp_count, reward_unlocked, geo_flagged
      from public.issue_self_service_stamp(
        membership_id,
        p_customer_id,
        p_qr_id,
        p_latitude,
        p_longitude
      ) s;

      first_stamp_issued := true;
    exception
      when others then
        raise warning 'join first stamp skipped for membership % (customer %): %',
          membership_id, p_customer_id, sqlerrm;
        first_stamp_issued := false;
        new_stamp_count := 0;
        reward_unlocked := false;
        geo_flagged := false;
    end;
  end if;

  return next;
end;
$$;

grant execute on function public.join_customer_membership_with_first_stamp(
  uuid, text, text, boolean, text, numeric, numeric, text
) to authenticated, service_role;

-- 3. Rotate (owner-guarded) --------------------------------------------------
create or replace function public.rotate_membership_referral_code(p_membership_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_customer uuid;
  v_new_code text;
begin
  select customer_id into v_customer
  from public.customer_memberships
  where id = p_membership_id;

  if v_customer is null then
    raise exception 'Membership not found';
  end if;

  if not ((select public.is_customer_owner(v_customer)) or (select public.is_service_role_request())) then
    raise insufficient_privilege using message = 'Membership owner access required';
  end if;

  v_new_code := public.generate_membership_referral_code();

  update public.customer_memberships
  set referral_code = v_new_code,
      referral_code_active = true,
      referral_code_rotated_at = now()
  where id = p_membership_id;

  return v_new_code;
end;
$$;

revoke all on function public.rotate_membership_referral_code(uuid) from public, anon;
grant execute on function public.rotate_membership_referral_code(uuid) to authenticated, service_role;

-- 4. Deactivate / reactivate (owner-guarded) ---------------------------------
create or replace function public.set_membership_referral_code_active(
  p_membership_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_customer uuid;
begin
  select customer_id into v_customer
  from public.customer_memberships
  where id = p_membership_id;

  if v_customer is null then
    raise exception 'Membership not found';
  end if;

  if not ((select public.is_customer_owner(v_customer)) or (select public.is_service_role_request())) then
    raise insufficient_privilege using message = 'Membership owner access required';
  end if;

  update public.customer_memberships
  set referral_code_active = coalesce(p_active, true)
  where id = p_membership_id;
end;
$$;

revoke all on function public.set_membership_referral_code_active(uuid, boolean) from public, anon;
grant execute on function public.set_membership_referral_code_active(uuid, boolean) to authenticated, service_role;
