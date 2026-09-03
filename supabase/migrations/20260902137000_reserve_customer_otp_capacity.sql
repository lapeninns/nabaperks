-- Keep a protected slice of the hard SMS budget available to browsers that
-- have previously completed customer authentication. The browser credential
-- is signed and verified by Proxy; only its one-way hash reaches this table.

create table if not exists public.customer_otp_trusted_devices (
  customer_id uuid not null references public.customers(id) on delete cascade,
  device_hash text not null,
  trust_source text not null,
  trusted_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  trusted_until timestamptz not null,
  revoked_at timestamptz,
  primary key (customer_id, device_hash),
  constraint customer_otp_trusted_devices_hash_check
    check (device_hash ~ '^[0-9a-f]{64}$'),
  constraint customer_otp_trusted_devices_source_check
    check (trust_source in ('verified_otp', 'active_session')),
  constraint customer_otp_trusted_devices_window_check
    check (trusted_until > trusted_at)
);

create index if not exists customer_otp_trusted_devices_lookup_idx
  on public.customer_otp_trusted_devices (device_hash, trusted_until desc)
  where revoked_at is null;

alter table public.customer_otp_trusted_devices enable row level security;
alter table public.customer_otp_trusted_devices force row level security;

drop policy if exists customer_otp_trusted_devices_service_role_all
  on public.customer_otp_trusted_devices;
create policy customer_otp_trusted_devices_service_role_all
  on public.customer_otp_trusted_devices
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.customer_otp_trusted_devices
  from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_otp_trusted_devices
  to service_role;

create or replace function public.customer_otp_device_is_trusted(
  p_phone_hmac text,
  p_device_hash text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, extensions
as $$
  select
    p_phone_hmac ~ '^[0-9a-f]{64}$'
    and p_device_hash ~ '^[0-9a-f]{64}$'
    and exists (
      select 1
      from public.customers customer
      join public.customer_otp_trusted_devices device
        on device.customer_id = customer.id
      where customer.phone_hmac = p_phone_hmac
        and device.device_hash = p_device_hash
        and device.revoked_at is null
        and customer.created_at <= now() - interval '7 days'
        and device.trusted_at <= now() - interval '7 days'
        and device.trusted_until > now()
        and exists (
          select 1
          from public.customer_memberships membership
          where membership.customer_id = customer.id
        )
    );
$$;

create or replace function public.register_customer_session(
  p_customer_id uuid,
  p_session_id uuid,
  p_expires_at timestamptz,
  p_device_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  registered_session_id uuid;
begin
  if p_customer_id is null
     or p_session_id is null
     or p_expires_at <= now()
     or p_device_hash is null
     or p_device_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid customer session';
  end if;

  insert into public.customer_sessions (
    id,
    customer_id,
    expires_at,
    last_seen_at,
    revoked_at
  )
  values (
    p_session_id,
    p_customer_id,
    p_expires_at,
    now(),
    null
  )
  on conflict (id) do update
  set
    customer_id = excluded.customer_id,
    expires_at = excluded.expires_at,
    last_seen_at = now(),
    revoked_at = null
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
    'verified_otp',
    now(),
    now(),
    now() + interval '90 days',
    null
  )
  on conflict (customer_id, device_hash) do update
  set
    trust_source = 'verified_otp',
    last_seen_at = now(),
    trusted_until = now() + interval '90 days',
    revoked_at = null;

  return registered_session_id;
end;
$$;

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
declare
  session_is_active boolean;
  session_created_at timestamptz;
begin
  if p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  update public.customer_sessions
  set last_seen_at = now()
  where id = p_session_id
    and customer_id = p_customer_id
    and revoked_at is null
    and expires_at > now()
  returning created_at into session_created_at;

  session_is_active := found;
  if not session_is_active then
    return false;
  end if;

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
    'active_session',
    session_created_at,
    now(),
    now() + interval '90 days',
    null
  )
  on conflict (customer_id, device_hash) do update
  set
    last_seen_at = now(),
    trusted_until = now() + interval '90 days',
    revoked_at = null;

  return true;
end;
$$;

create or replace function public.admit_customer_otp_dispatch(
  p_scope text,
  p_phone_bucket text,
  p_identity_bucket text,
  p_ip_bucket text,
  p_phone_hmac text,
  p_device_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_trusted boolean := false;
begin
  if p_scope not in ('wallet', 'join')
     or p_phone_bucket !~ '^[0-9a-f]{64}$'
     or p_identity_bucket !~ '^[0-9a-f]{64}$'
     or p_ip_bucket !~ '^[0-9a-f]{64}$'
     or p_phone_hmac !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid customer OTP admission input';
  end if;

  if p_device_hash ~ '^[0-9a-f]{64}$' then
    select exists (
      select 1
      from public.customers customer
      join public.customer_otp_trusted_devices device
        on device.customer_id = customer.id
      where customer.phone_hmac = p_phone_hmac
        and device.device_hash = p_device_hash
        and device.revoked_at is null
        and customer.created_at <= now() - interval '7 days'
        and device.trusted_at <= now() - interval '7 days'
        and device.trusted_until > now()
        and exists (
          select 1
          from public.customer_memberships membership
          where membership.customer_id = customer.id
        )
    ) into v_trusted;
  end if;

  -- One outer RPC transaction owns every debit. If any narrower or global
  -- check rejects, PostgreSQL rolls back all earlier increments.
  if not v_trusted then
    perform public.enforce_rate_limit(
      'customer-otp:dispatch:' || p_scope || ':anonymous:burst:v2',
      24,
      60000
    );
    perform public.enforce_rate_limit(
      'customer-otp:dispatch:' || p_scope || ':anonymous:sustained:v2',
      120,
      3600000
    );
  else
    perform public.enforce_rate_limit(
      p_phone_bucket || ':recognised-hour:v2',
      3,
      3600000
    );
  end if;

  perform public.enforce_rate_limit(p_ip_bucket, 30, 86400000);
  perform public.enforce_rate_limit(p_identity_bucket, 10, 86400000);
  perform public.enforce_rate_limit(p_phone_bucket, 5, 900000);
  perform public.enforce_rate_limit(
    'customer-otp:dispatch:' || p_scope || ':total:burst:v2',
    30,
    60000
  );
  perform public.enforce_rate_limit(
    'customer-otp:dispatch:' || p_scope || ':total:sustained:v2',
    150,
    3600000
  );

  return v_trusted;
end;
$$;

create or replace function public.purge_customer_otp_devices_after_erasure()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if old.phone_hmac is not null and new.phone_hmac is null then
    delete from public.customer_otp_trusted_devices
    where customer_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists purge_customer_otp_devices_after_erasure
  on public.customers;
create trigger purge_customer_otp_devices_after_erasure
after update of phone_hmac on public.customers
for each row
execute function public.purge_customer_otp_devices_after_erasure();

revoke all on function public.customer_otp_device_is_trusted(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.register_customer_session(uuid, uuid, timestamptz, text)
  from public, anon, authenticated, service_role;
revoke all on function public.touch_customer_session(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admit_customer_otp_dispatch(
  text, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.purge_customer_otp_devices_after_erasure()
  from public, anon, authenticated, service_role;

grant execute on function public.customer_otp_device_is_trusted(text, text)
  to service_role;
grant execute on function public.register_customer_session(uuid, uuid, timestamptz, text)
  to service_role;
grant execute on function public.touch_customer_session(uuid, uuid, text)
  to service_role;
grant execute on function public.admit_customer_otp_dispatch(
  text, text, text, text, text, text
) to service_role;

notify pgrst, 'reload schema';
