-- SEC-RISK-001 is deliberately reopened. Requiring a previously customer-bound
-- device or a verified recovery email left every customer created before
-- 20260903120000 unable to open their own wallet: that migration revoked all
-- pre-existing device trust, and a recovery email can only be verified from an
-- authenticated session. Until wallets carry recovery emails, a verified phone
-- OTP is accepted as continuity proof on its own, from any browser or device.
--
-- 'verified_phone' is deliberately NOT added to
-- public.customer_auth_device_is_trusted. Devices trusted by phone alone must
-- not silently satisfy the stronger control when it is restored, which happens
-- by reverting this migration and the application flag it serves.

alter table public.customer_otp_trusted_devices
  drop constraint if exists customer_otp_trusted_devices_source_check;
alter table public.customer_otp_trusted_devices
  add constraint customer_otp_trusted_devices_source_check
  check (
    trust_source in (
      'verified_otp',
      'active_session',
      'new_identity',
      'verified_email',
      'recognised_device',
      'verified_phone'
    )
  );

create or replace function public.register_customer_session(
  p_customer_id uuid,
  p_session_id uuid,
  p_expires_at timestamptz,
  p_device_hash text,
  p_continuity_source text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  registered_session_id uuid;
  continuity_is_valid boolean := false;
begin
  if p_customer_id is null
     or p_session_id is null
     or p_expires_at <= now()
     or p_device_hash is null
     or p_device_hash !~ '^[0-9a-f]{64}$'
     or p_continuity_source not in (
       'new_identity',
       'verified_email',
       'recognised_device',
       'verified_phone'
     ) then
    raise exception 'Invalid customer session';
  end if;

  -- Serialise first-session creation so two concurrent phone verifications
  -- cannot both observe a new identity and mint independent sessions.
  perform 1
  from public.customers customer
  where customer.id = p_customer_id
  for update;
  if not found then
    raise exception 'Invalid customer session';
  end if;

  if p_continuity_source = 'new_identity' then
    select exists (
      select 1
      from public.customers customer
      where customer.id = p_customer_id
        and customer.created_at > now() - interval '10 minutes'
        and not exists (
          select 1
          from public.customer_sessions session
          where session.customer_id = customer.id
        )
        and not exists (
          select 1
          from public.customer_memberships membership
          where membership.customer_id = customer.id
        )
        and not exists (
          select 1
          from public.customer_otp_trusted_devices device
          where device.customer_id = customer.id
        )
    ) into continuity_is_valid;
  elsif p_continuity_source = 'verified_email' then
    select exists (
      select 1
      from public.customers customer
      where customer.id = p_customer_id
        and customer.email is not null
        and customer.email_verified_at is not null
    ) into continuity_is_valid;
  elsif p_continuity_source = 'verified_phone' then
    -- The caller has already proved possession of the number bound to this
    -- customer row. That is the whole of the reopened control: no device or
    -- email proof is demanded on top of it. The customer row was locked above.
    continuity_is_valid := true;
  else
    select public.customer_auth_device_is_trusted(
      p_customer_id,
      p_device_hash
    ) into continuity_is_valid;
  end if;

  if not continuity_is_valid then
    raise insufficient_privilege
      using message = 'Customer continuity proof required';
  end if;

  insert into public.customer_sessions (
    id,
    customer_id,
    expires_at,
    last_seen_at,
    revoked_at,
    device_hash
  )
  values (
    p_session_id,
    p_customer_id,
    p_expires_at,
    now(),
    null,
    p_device_hash
  )
  returning id into registered_session_id;

  insert into public.customer_otp_trusted_devices (
    customer_id,
    device_hash,
    trust_source,
    trusted_at,
    last_seen_at,
    trusted_until,
    revoked_at
  )
  values (
    p_customer_id,
    p_device_hash,
    p_continuity_source,
    now(),
    now(),
    now() + interval '90 days',
    null
  )
  -- A device whose lapsed stronger trust is refreshed by a phone-only login is
  -- downgraded to 'verified_phone' on purpose, so restoring the control makes
  -- it re-prove rather than inherit trust it did not earn.
  on conflict (customer_id, device_hash) do update
  set
    trust_source = excluded.trust_source,
    last_seen_at = now(),
    trusted_until = now() + interval '90 days',
    revoked_at = null;

  return registered_session_id;
end;
$$;

revoke all on function public.register_customer_session(
  uuid,
  uuid,
  timestamptz,
  text,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.register_customer_session(
  uuid,
  uuid,
  timestamptz,
  text,
  text
) to service_role;

notify pgrst, 'reload schema';
