-- A phone OTP proves current possession of a reusable telephone number, not
-- continuity with the historical customer attached to it. Bind every new
-- customer session to the verified browser device and require the caller to
-- state which independent continuity proof authorised the registration.

alter table public.customer_sessions
  add column if not exists device_hash text;

-- Existing rows pre-date device binding and cannot be safely assigned to the
-- first browser that presents them. Revoke them explicitly instead.
update public.customer_sessions
set revoked_at = coalesce(revoked_at, now())
where device_hash is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_sessions_device_hash_check'
      and conrelid = 'public.customer_sessions'::regclass
  ) then
    alter table public.customer_sessions
      add constraint customer_sessions_device_hash_check
      check (
        (device_hash is not null and device_hash ~ '^[0-9a-f]{64}$')
        or (device_hash is null and revoked_at is not null)
      );
  end if;
end $$;

create index if not exists customer_sessions_customer_device_active_idx
  on public.customer_sessions (customer_id, device_hash, expires_at desc)
  where revoked_at is null;

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
      'recognised_device'
    )
  );

-- Trust created before this migration ultimately came from the vulnerable
-- phone-only session flow. It cannot be promoted into independent continuity.
update public.customer_otp_trusted_devices
set revoked_at = coalesce(revoked_at, now())
where trust_source in ('verified_otp', 'active_session');

create or replace function public.customer_auth_device_is_trusted(
  p_customer_id uuid,
  p_device_hash text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, extensions
as $$
  select
    p_customer_id is not null
    and p_device_hash ~ '^[0-9a-f]{64}$'
    and exists (
      select 1
      from public.customer_otp_trusted_devices device
      where device.customer_id = p_customer_id
        and device.device_hash = p_device_hash
        and device.trust_source in (
          'new_identity',
          'verified_email',
          'recognised_device'
        )
        and device.revoked_at is null
        and device.trusted_until > now()
    );
$$;

-- Remove the historical unbound overload before replacing registration with
-- the device- and continuity-aware signature.
drop function if exists public.register_customer_session(
  uuid,
  uuid,
  timestamptz
);
drop function if exists public.register_customer_session(
  uuid,
  uuid,
  timestamptz,
  text
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
       'recognised_device'
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
  on conflict (customer_id, device_hash) do update
  set
    trust_source = excluded.trust_source,
    last_seen_at = now(),
    trusted_until = now() + interval '90 days',
    revoked_at = null;

  return registered_session_id;
end;
$$;

drop function if exists public.touch_customer_session(uuid, uuid);
drop function if exists public.touch_customer_session(uuid, uuid, text);

create or replace function public.touch_customer_session(
  p_customer_id uuid,
  p_session_id uuid,
  p_device_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  update public.customer_sessions
  set last_seen_at = now()
  where id = p_session_id
    and customer_id = p_customer_id
    and device_hash = p_device_hash
    and revoked_at is null
    and expires_at > now();

  if not found then
    return false;
  end if;

  update public.customer_otp_trusted_devices
  set
    last_seen_at = now(),
    trusted_until = now() + interval '90 days'
  where customer_id = p_customer_id
    and device_hash = p_device_hash
    and revoked_at is null;

  return true;
end;
$$;

revoke all on function public.customer_auth_device_is_trusted(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.register_customer_session(
  uuid,
  uuid,
  timestamptz,
  text,
  text
) from public, anon, authenticated, service_role;
revoke all on function public.touch_customer_session(uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.customer_auth_device_is_trusted(uuid, text)
  to service_role;
grant execute on function public.register_customer_session(
  uuid,
  uuid,
  timestamptz,
  text,
  text
) to service_role;
grant execute on function public.touch_customer_session(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
