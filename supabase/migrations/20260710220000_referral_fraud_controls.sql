-- Concentration pause, admin review, code disablement.
--
-- Pauses (never claws back) suspicious referral bonuses. A referrer who crosses a
-- rolling-24h concentration threshold has their newest qualifying referral paused
-- (status='rejected') + a deduped referral_concentration flag raised. Support can
-- review any referral (clear/reject/cancel, admin-only, audited) and disable a code
-- outright. Detection is a trigger on the → qualified transition; it never blocks
-- qualification and never reverses a stamp.
-- Behavioral coverage: tests/contracts/referral-review-hardening.test.mjs.
--
-- Note (deliberate scope): device/network/IP clustering and recycled-phone are not
-- built — no device/IP columns exist and phone_hmac is uniquely indexed (self-referral
-- via a shared phone is already impossible). fraud_flags.signal is free-text, so the
-- new signals need no DDL. Idempotent (create-or-replace + guarded trigger).

-- 1. Concentration detection -------------------------------------------------
create or replace function public.flag_referral_concentration(p_referral_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_edge record;
  v_recent integer;
  v_threshold constant integer := 5;
begin
  select id, venue_id, referrer_customer_id, referrer_membership_id, status
  into v_edge
  from public.referrals
  where id = p_referral_id;

  if v_edge.id is null
     or v_edge.referrer_membership_id is null
     or v_edge.status in ('awarded', 'rejected', 'cancelled', 'expired') then
    return false;
  end if;

  -- Respect an admin who already dismissed this referrer's concentration flag today.
  if exists (
    select 1 from public.fraud_flags
    where signal = 'referral_concentration'
      and membership_id = v_edge.referrer_membership_id
      and status = 'dismissed'
      and public.uk_business_date(created_at) = public.uk_business_date(now())
  ) then
    return false;
  end if;

  select count(*)
  into v_recent
  from public.referrals
  where referrer_membership_id = v_edge.referrer_membership_id
    and status in ('qualified', 'held', 'settling', 'awarded')
    and qualified_at >= now() - interval '24 hours';

  if v_recent <= v_threshold then
    return false;
  end if;

  if not exists (
    select 1 from public.fraud_flags
    where signal = 'referral_concentration'
      and membership_id = v_edge.referrer_membership_id
      and status = 'open'
      and public.uk_business_date(created_at) = public.uk_business_date(now())
  ) then
    insert into public.fraud_flags (
      merchant_id, customer_id, membership_id, signal, severity, metadata
    )
    values (
      v_edge.venue_id, v_edge.referrer_customer_id, v_edge.referrer_membership_id,
      'referral_concentration', 'medium',
      jsonb_build_object('window_hours', 24, 'threshold', v_threshold, 'observed', v_recent)
    );
  end if;

  update public.referrals
  set status = 'rejected', last_error = 'fraud:concentration'
  where id = p_referral_id;

  return true;
end;
$$;

revoke all on function public.flag_referral_concentration(uuid) from public, anon, authenticated;
grant execute on function public.flag_referral_concentration(uuid) to service_role;

create or replace function public.referrals_fraud_check()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  begin
    perform public.flag_referral_concentration(new.id);
  exception
    when others then
      raise warning 'referral fraud check skipped for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists referrals_fraud_check_au on public.referrals;
create trigger referrals_fraud_check_au
  after update on public.referrals
  for each row
  when (new.status = 'qualified' and old.status is distinct from 'qualified')
  execute function public.referrals_fraud_check();

-- 2. Admin review (clear / reject / cancel) ----------------------------------
create or replace function public.admin_review_referral(
  p_referral_id uuid,
  p_action text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
  v_edge record;
begin
  admin_user_id := (select auth.uid());
  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;
  if p_action not in ('clear', 'reject', 'cancel') then
    raise exception 'Unsupported review action';
  end if;

  select id, venue_id, referrer_customer_id, referrer_membership_id, status
  into v_edge
  from public.referrals
  where id = p_referral_id
  for update;

  if v_edge.id is null then
    raise exception 'Referral not found';
  end if;

  if p_action = 'clear' then
    -- Dismiss the referrer's open referral flags BEFORE re-qualifying, so the
    -- fraud trigger (which fires on → qualified) respects the review and does not
    -- immediately re-pause the referral.
    update public.fraud_flags
    set status = 'dismissed'
    where status = 'open'
      and membership_id = v_edge.referrer_membership_id
      and signal like 'referral_%';

    update public.referrals
    set status = 'qualified', last_error = null, next_retry_at = now()
    where id = p_referral_id;
  elsif p_action = 'reject' then
    update public.referrals set status = 'rejected' where id = p_referral_id;
  else
    update public.referrals set status = 'cancelled' where id = p_referral_id;
  end if;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'admin', admin_user_id::text, v_edge.venue_id, v_edge.referrer_customer_id,
    'referrals', p_referral_id, 'referral_reviewed',
    jsonb_build_object('review_action', p_action, 'previous_status', v_edge.status,
      'reason', trim(coalesce(p_reason, '')))
  );
end;
$$;

grant execute on function public.admin_review_referral(uuid, text, text) to authenticated, service_role;

-- 3. Admin code disablement --------------------------------------------------
create or replace function public.admin_disable_referral_code(
  p_membership_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
  v_m record;
begin
  admin_user_id := (select auth.uid());
  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'A reason is required';
  end if;

  select id, merchant_id, customer_id
  into v_m
  from public.customer_memberships
  where id = p_membership_id;

  if v_m.id is null then
    raise exception 'Membership not found';
  end if;

  update public.customer_memberships
  set referral_code_active = false
  where id = p_membership_id;

  insert into public.fraud_flags (
    merchant_id, customer_id, membership_id, signal, severity, metadata
  )
  values (
    v_m.merchant_id, v_m.customer_id, p_membership_id, 'referral_code_disabled', 'medium',
    jsonb_build_object('reason', trim(p_reason), 'disabled_by', admin_user_id)
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'admin', admin_user_id::text, v_m.merchant_id, v_m.customer_id,
    'customer_memberships', p_membership_id, 'referral_code_disabled',
    jsonb_build_object('reason', trim(p_reason))
  );
end;
$$;

grant execute on function public.admin_disable_referral_code(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
