-- Database-owned lifecycle state.
--
-- 20260606142000:2605-2606 granted blanket INSERT/UPDATE/DELETE on every public
-- table to `authenticated`, and no later migration narrowed it — 20260730100000
-- deliberately kept DML "unchanged". RLS then only ever asked "do you own this
-- row", never "may you set THIS column to THIS value". So a user JWT could
-- create an already-activated billing-exempt venue, enrol itself in any loyalty
-- programme with chosen counters, forge its own contact-verification
-- provenance, and rewrite the birth date that gates adult rewards.
--
-- Strategy: take the caller-writable surface away where the application never
-- used it, keep exactly the columns the app does write, and leave the triggers
-- as defence in depth so a future re-grant cannot silently reopen any of this.
--
-- Closes: merchant-insert-billing-bypass, merchant-business-state-trigger-bypass,
-- customer-membership-insert-bypass, customer-contact-verification-self-forgery,
-- db-customer-dob-reward-policy-bypass.

-- ---------------------------------------------------------------------------
-- 1. Merchant creation is the onboarding transaction's job, never a table write
-- ---------------------------------------------------------------------------
-- public.complete_merchant_onboarding is SECURITY DEFINER, so it keeps working
-- after the grant is removed; it hardcodes status 'trial' + requires_billing.
revoke insert, delete on table public.merchants from authenticated;
drop policy if exists merchants_insert_owned_or_admin on public.merchants;

-- NOTE, deliberately not changed here: create_merchant_onboarding is SECURITY
-- DEFINER, granted to `authenticated`, has no TypeScript caller, and takes
-- p_business_slug verbatim with only a length check — so an authenticated user
-- with no merchant row can squat an arbitrary slug through it. That is a
-- SIBLING finding, not one of the scanned 25, and the grant is pinned by a
-- governed spec (rpc-execute-privilege-containment SPEC_PINNED_SELF_SERVICE
-- plus merchant-onboarding-transaction). Revoking it belongs in its own
-- reviewable change, not smuggled into this one.

-- Owners still edit their profile. These four columns are everything
-- app/app/profile/actions.ts writes with a user JWT; status, requires_billing,
-- business_slug and owner_user_id are deliberately absent.
revoke update on table public.merchants from authenticated;
grant update (business_name, business_type, email, phone)
  on table public.merchants to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Membership rows are the RESULT of a checked join, not an input
-- ---------------------------------------------------------------------------
-- join_customer_membership / *_with_first_stamp / claim_loyalty_invite are all
-- SECURITY DEFINER and remain the only creation paths. They enforce verified
-- contact, merchant + billing availability, an active card and QR, the terms
-- snapshot, and the customer_joined event — none of which a direct INSERT saw.
-- UPDATE/DELETE are revoked too: they were reachable only because no permissive
-- policy existed, which is the same fragile pairing that produced these
-- findings. The admin path is admin_adjust_membership_stamps (definer).
revoke insert, update, delete on table public.customer_memberships from authenticated;
drop policy if exists customer_memberships_insert_customer_or_admin
  on public.customer_memberships;

-- Defence in depth: a future blanket re-grant (20260606142000:2606 was exactly
-- that) must not silently reopen uncontrolled membership creation.
create or replace function public.enforce_membership_controlled_creation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_service_role_request()
     or public.is_internal_admin()
     or not public.has_request_context() then
    return new;
  end if;

  raise exception using
    errcode = 'insufficient_privilege',
    message = 'Loyalty memberships are created by the join transaction, not by direct writes';
end;
$$;

revoke execute on function public.enforce_membership_controlled_creation()
  from public, anon, authenticated;
grant execute on function public.enforce_membership_controlled_creation() to service_role;

drop trigger if exists customer_memberships_controlled_creation
  on public.customer_memberships;

create trigger customer_memberships_controlled_creation
  before insert on public.customer_memberships
  for each row
  execute function public.enforce_membership_controlled_creation();

-- ---------------------------------------------------------------------------
-- 3. Customer rows are written only by the trusted server paths
-- ---------------------------------------------------------------------------
-- Every write in lib/customer/{identity,profile}.ts already uses the
-- service-role client, so removing the caller-writable surface changes no
-- supported behaviour. Column-scoped SELECT from 20260630128000 is untouched.
revoke insert, update, delete on table public.customers from authenticated;
drop policy if exists customers_insert_self_or_admin on public.customers;
drop policy if exists customers_update_self_or_admin on public.customers;

-- ---------------------------------------------------------------------------
-- 4. Stop inferring "trusted backend SQL" from one missing claim
-- ---------------------------------------------------------------------------
-- The business-state trigger treated a missing LEGACY per-claim GUC as proof of
-- raw psql/migration access. PostgREST populates the aggregate claims blob and
-- not that GUC (which is exactly why is_service_role_request() consults
-- auth.jwt()), so an ordinary merchant request satisfied the exemption.
create or replace function public.has_request_context()
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '') <> ''
      or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') <> '';
$$;

comment on function public.has_request_context() is
  'True when the statement carries ANY request claim representation. Absence of one representation is not evidence of trusted backend SQL.';

revoke all on function public.has_request_context() from public, anon, authenticated;
grant execute on function public.has_request_context() to service_role;

create or replace function public.enforce_merchant_business_state_protection()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_privileged boolean;
begin
  v_privileged :=
    public.is_service_role_request()
    or public.is_internal_admin()
    -- Raw backend SQL (migration/seed/psql/superuser) carries NO request
    -- context at all, in either representation.
    or not public.has_request_context();

  -- INSERT: an untrusted writer may not choose the opening commercial state.
  if tg_op = 'INSERT' then
    if not v_privileged
       and (new.status is distinct from 'trial'
            or new.requires_billing is distinct from true) then
      raise exception using
        errcode = 'insufficient_privilege',
        message = 'New venues start on trial with billing required';
    end if;

    return new;
  end if;

  if new.requires_billing is not distinct from old.requires_billing
     and new.status is not distinct from old.status then
    return new;
  end if;

  if not v_privileged then
    if new.requires_billing is distinct from old.requires_billing then
      raise exception using
        errcode = 'insufficient_privilege',
        message = 'merchants.requires_billing is billing-protected and cannot be changed directly';
    end if;
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'merchants.status is billing-protected and cannot be changed directly';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_merchant_business_state_protection()
  from public, anon, authenticated;
grant execute on function public.enforce_merchant_business_state_protection()
  to service_role;

drop trigger if exists merchants_protect_business_state on public.merchants;

create trigger merchants_protect_business_state
  before insert or update on public.merchants
  for each row
  execute function public.enforce_merchant_business_state_protection();

-- ---------------------------------------------------------------------------
-- 5. Verification provenance and birth date are verifier-owned, at INSERT too
-- ---------------------------------------------------------------------------
-- The previous definition (20260707095000:834) guarded a contact only once its
-- timestamp was ALREADY non-null, and was attached BEFORE UPDATE only. So an
-- untrusted writer could either supply a forged timestamp at INSERT or promote
-- its own NULL to a value. date_of_birth had no guard at all, yet it is the
-- sole input to the 18+ redemption gates and birthday issuance.
create or replace function public.prevent_verified_customer_contact_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_trusted boolean;
begin
  v_trusted :=
    public.is_service_role_request()
    or public.is_internal_admin()
    or not public.has_request_context();

  -- The erasure GUC is a convenience for the definer purge RPCs, not an
  -- authority of its own: `app.*` is an unreserved namespace any role can
  -- set_config, so it must never be a standalone bypass of this whole trigger.
  if v_trusted and current_setting('app.customer_erasure', true) = 'true' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not v_trusted
       and (new.email_verified_at is not null
            or new.phone_verified_at is not null
            or new.date_of_birth is not null) then
      raise exception using
        errcode = 'insufficient_privilege',
        message = 'Customer verification state and date of birth cannot be supplied by the caller';
    end if;

    return new;
  end if;

  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'Customer auth user cannot be changed through profile updates';
  end if;

  -- Any transition of verifier-owned state, including NULL -> value.
  if not v_trusted
     and (new.email_verified_at is distinct from old.email_verified_at
          or new.phone_verified_at is distinct from old.phone_verified_at
          or new.date_of_birth is distinct from old.date_of_birth) then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Customer verification state and date of birth cannot be changed by the caller';
  end if;

  if old.email_verified_at is not null then
    if new.email is distinct from old.email
      or new.email_verified_at is distinct from old.email_verified_at then
      raise exception 'Verified customer email cannot be changed';
    end if;
  end if;

  if old.phone_verified_at is not null then
    if new.phone_hmac is distinct from old.phone_hmac
      or new.phone_ciphertext is distinct from old.phone_ciphertext
      or new.phone_last4 is distinct from old.phone_last4
      or new.phone_country is distinct from old.phone_country
      or new.phone_verified_at is distinct from old.phone_verified_at then
      raise exception 'Verified customer phone cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.prevent_verified_customer_contact_change()
  from public, anon, authenticated;
grant execute on function public.prevent_verified_customer_contact_change()
  to service_role;

drop trigger if exists customers_prevent_verified_contact_change on public.customers;

create trigger customers_prevent_verified_contact_change
  before insert or update on public.customers
  for each row
  execute function public.prevent_verified_customer_contact_change();

notify pgrst, 'reload schema';
