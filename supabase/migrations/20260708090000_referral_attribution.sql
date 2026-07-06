-- MS-referral-attribution — "Bring a Regular" attribution rails.
--
-- Every membership is minted a shareable opaque referral code; a friend who
-- joins a venue via a referrer's code (?ref) is durably attributed to that
-- referrer, in the same transaction as enrolment. No reward is issued here —
-- that is MS-referral-bonus-stamp. Contract: micro-specs/referral/attribution.md.
--
-- Idempotent by construction (safe to re-apply): additive DDL is guarded with
-- IF NOT EXISTS, the policy is dropped before create, and the wrapper's every
-- overload is dropped before the canonical version is (re)created.

-- 1. Opaque per-membership share code (RA-1) ---------------------------------
-- Reuses the qr_codes.qr_id base64url convention. SECURITY DEFINER so the
-- uniqueness probe sees every row regardless of the caller's RLS scope; wired
-- as the customer_memberships.referral_code DEFAULT so the existing join INSERT
-- mints a code with no inner-RPC change.
create or replace function public.generate_membership_referral_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  candidate text;
begin
  loop
    candidate := lower(
      replace(
        replace(
          rtrim(encode(extensions.gen_random_bytes(9), 'base64'), '='),
          '+',
          '-'
        ),
        '/',
        '_'
      )
    );
    exit when not exists (
      select 1
      from public.customer_memberships
      where customer_memberships.referral_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

grant execute on function public.generate_membership_referral_code()
  to authenticated, service_role;

alter table public.customer_memberships
  add column if not exists referral_code text;

-- Backfill existing memberships (the volatile generator yields a distinct code
-- per row); no-op on re-apply once every row has a code.
update public.customer_memberships
set referral_code = public.generate_membership_referral_code()
where referral_code is null;

alter table public.customer_memberships
  alter column referral_code set default public.generate_membership_referral_code(),
  alter column referral_code set not null;

create unique index if not exists customer_memberships_referral_code_key
  on public.customer_memberships (referral_code);

-- 2. Attribution edge (RA-3, RA-4, RA-8) ------------------------------------
-- referred_membership_id UNIQUE => at most one referrer per membership (RA-8);
-- the check bans a self-edge (RA-4); both sides are memberships.
create table if not exists public.referrals (
  id uuid primary key default extensions.gen_random_uuid(),
  referred_membership_id uuid not null unique
    references public.customer_memberships(id) on delete cascade,
  referrer_membership_id uuid not null
    references public.customer_memberships(id) on delete cascade,
  referral_code_used text not null,
  created_at timestamptz not null default now(),
  constraint referrals_no_self_reference
    check (referred_membership_id <> referrer_membership_id)
);

create index if not exists referrals_referrer_idx
  on public.referrals (referrer_membership_id);

-- 3. RLS (RA-10): a customer may read only edges touching a membership they own;
-- internal admin reads all. No customer write policy — writes happen solely via
-- the SECURITY DEFINER join wrapper, which bypasses RLS.
alter table public.referrals enable row level security;

grant select on table public.referrals to authenticated;
grant select, insert, update, delete on table public.referrals to service_role;

drop policy if exists referrals_select_scoped on public.referrals;
create policy referrals_select_scoped
  on public.referrals for select to authenticated
  using (
    (select public.is_internal_admin())
    or exists (
      select 1
      from public.customer_memberships m
      where m.id = referrals.referred_membership_id
        and (select public.is_customer_owner(m.customer_id))
    )
    or exists (
      select 1
      from public.customer_memberships m
      where m.id = referrals.referrer_membership_id
        and (select public.is_customer_owner(m.customer_id))
    )
  );

-- 4. Thread p_ref through the join wrapper (RA-3,4,5,6,7,8,9,11) -------------
-- Adding p_ref changes the arg count, which forbids CREATE OR REPLACE. Drop
-- EVERY existing overload of the wrapper, then recreate the single canonical
-- version and replay its grant. The inner join_customer_membership is untouched.
do $$
declare
  r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where proname = 'join_customer_membership_with_first_stamp'
      and pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || r.sig::text;
  end loop;
end;
$$;

create function public.join_customer_membership_with_first_stamp(
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

  -- Referral attribution (share-a-link). Only a genuinely new membership is
  -- attributed; the guards live in the join/where clause so a
  -- missing/unknown/self/cross-venue ref records nothing (RA-4/5/6) and the
  -- join always proceeds. created_membership gates the whole block (RA-7);
  -- on conflict keeps at most one referrer (RA-8).
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
