-- Hosted Supabase does not expose WebAuthn as an MFA factor. Keep the
-- administrator boundary fail-closed with an application-owned WebAuthn
-- ceremony whose verified grant is bound to the signed Auth session.

create table if not exists public.admin_webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0 check (counter >= 0),
  transports jsonb not null default '[]'::jsonb
    check (jsonb_typeof(transports) = 'array'),
  device_type text not null check (device_type in ('singleDevice', 'multiDevice')),
  backed_up boolean not null,
  user_verified boolean not null check (user_verified),
  created_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  check (
    credential_id ~ '^[A-Za-z0-9_-]+$'
    and char_length(credential_id) between 16 and 1024
  ),
  check (
    public_key ~ '^[A-Za-z0-9_-]+$'
    and char_length(public_key) between 16 and 8192
  )
);

create unique index if not exists admin_webauthn_one_live_credential
  on public.admin_webauthn_credentials (user_id)
  where revoked_at is null;

create table if not exists public.admin_webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  purpose text not null check (purpose in ('registration', 'authentication')),
  challenge text not null,
  origin text not null check (
    origin in ('https://nabaperks.com', 'https://mfa.nabaperks.com')
  ),
  credential_id uuid references public.admin_webauthn_credentials(id)
    on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '5 minutes'),
  consumed_at timestamptz,
  finalised_at timestamptz,
  check (
    challenge ~ '^[A-Za-z0-9_-]+$'
    and char_length(challenge) between 32 and 256
  ),
  check (expires_at > created_at),
  check (
    (
      purpose = 'registration'
      and (
        (finalised_at is null and credential_id is null)
        or (finalised_at is not null and credential_id is not null)
      )
    )
    or (purpose = 'authentication' and credential_id is not null)
  )
);

create index if not exists admin_webauthn_challenges_expiry
  on public.admin_webauthn_challenges (expires_at);

create table if not exists public.admin_webauthn_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  credential_id uuid not null references public.admin_webauthn_credentials(id)
    on delete cascade,
  verified_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (user_id, session_id),
  check (expires_at > verified_at)
);

create index if not exists admin_webauthn_grants_expiry
  on public.admin_webauthn_grants (expires_at);

alter table public.admin_webauthn_credentials enable row level security;
alter table public.admin_webauthn_credentials force row level security;
alter table public.admin_webauthn_challenges enable row level security;
alter table public.admin_webauthn_challenges force row level security;
alter table public.admin_webauthn_grants enable row level security;
alter table public.admin_webauthn_grants force row level security;

revoke all on table public.admin_webauthn_credentials
  from public, anon, authenticated, service_role;
revoke all on table public.admin_webauthn_challenges
  from public, anon, authenticated, service_role;
revoke all on table public.admin_webauthn_grants
  from public, anon, authenticated, service_role;

comment on table public.admin_webauthn_credentials is
  'Server-verified administrator WebAuthn credentials. No browser role has table access.';
comment on table public.admin_webauthn_challenges is
  'One-use, five-minute WebAuthn challenges bound to one signed Auth session and purpose.';
comment on table public.admin_webauthn_grants is
  'Short-lived WebAuthn step-up proof bound to an exact credential and live Auth session.';

create or replace function public.can_bootstrap_admin_webauthn()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.request_auth_session_id() is not null
    and (
      select count(*) from public.internal_admins admin where admin.is_active
    ) = 1
    and exists (
      select 1
      from public.internal_admins admin
      join auth.sessions auth_session
        on auth_session.id = public.request_auth_session_id()
       and auth_session.user_id = admin.user_id
      where admin.user_id = auth.uid()
        and admin.is_active
        and admin.mfa_factor_id is null
        and admin.mfa_activated_at is null
        and not exists (
          select 1
          from public.admin_webauthn_credentials credential
          where credential.user_id = admin.user_id
            and credential.revoked_at is null
        )
    );
$$;

create or replace function public.begin_admin_webauthn_challenge(
  p_purpose text,
  p_challenge text,
  p_origin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := public.request_auth_session_id();
  v_credential_id uuid;
  v_challenge_id uuid;
begin
  if v_user_id is null or v_session_id is null then
    raise insufficient_privilege using message = 'Authenticated session required';
  end if;
  if p_purpose not in ('registration', 'authentication')
     or p_origin not in ('https://nabaperks.com', 'https://mfa.nabaperks.com')
     or p_challenge !~ '^[A-Za-z0-9_-]+$'
     or char_length(p_challenge) not between 32 and 256 then
    raise invalid_parameter_value using message = 'Invalid WebAuthn challenge request';
  end if;
  if not exists (
    select 1 from auth.sessions auth_session
    where auth_session.id = v_session_id and auth_session.user_id = v_user_id
  ) then
    raise insufficient_privilege using message = 'Live authenticated session required';
  end if;

  perform public.enforce_rate_limit(
    'admin-webauthn:' || p_purpose || ':' || v_user_id::text || ':' || v_session_id::text,
    10,
    300000
  );

  if p_purpose = 'registration' then
    if not public.can_bootstrap_admin_webauthn() then
      raise insufficient_privilege using message = 'Administrator registration is not available';
    end if;
  else
    select credential.id
    into v_credential_id
    from public.internal_admins admin
    join public.admin_webauthn_credentials credential
      on credential.id = admin.mfa_factor_id
     and credential.user_id = admin.user_id
     and credential.revoked_at is null
     and credential.user_verified
    where admin.user_id = v_user_id
      and admin.is_active
      and admin.mfa_activated_at is not null;
    if v_credential_id is null then
      raise insufficient_privilege using message = 'Activated administrator credential required';
    end if;
  end if;

  delete from public.admin_webauthn_challenges
  where expires_at <= clock_timestamp()
     or created_at < clock_timestamp() - interval '1 day';

  insert into public.admin_webauthn_challenges (
    user_id, session_id, purpose, challenge, origin, credential_id
  ) values (
    v_user_id, v_session_id, p_purpose, p_challenge, p_origin, v_credential_id
  ) returning id into v_challenge_id;

  return v_challenge_id;
end;
$$;

create or replace function public.consume_viewer_admin_webauthn_challenge(
  p_challenge_id uuid,
  p_purpose text,
  p_origin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or public.request_auth_session_id() is null then
    raise insufficient_privilege using message = 'Authenticated session required';
  end if;

  perform public.enforce_rate_limit(
    'admin-webauthn:verify:' || p_purpose || ':' || auth.uid()::text || ':' || public.request_auth_session_id()::text,
    10,
    300000
  );

  update public.admin_webauthn_challenges challenge
  set consumed_at = clock_timestamp()
  where challenge.id = p_challenge_id
    and challenge.user_id = auth.uid()
    and challenge.session_id = public.request_auth_session_id()
    and challenge.purpose = p_purpose
    and challenge.origin = p_origin
    and challenge.consumed_at is null
    and challenge.finalised_at is null
    and challenge.expires_at > clock_timestamp()
    and exists (
      select 1 from auth.sessions auth_session
      where auth_session.id = challenge.session_id
        and auth_session.user_id = challenge.user_id
    );
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.read_admin_webauthn_challenge(
  p_challenge_id uuid,
  p_require_consumed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  select jsonb_build_object(
    'id', challenge.id,
    'userId', challenge.user_id,
    'sessionId', challenge.session_id,
    'purpose', challenge.purpose,
    'challenge', challenge.challenge,
    'origin', challenge.origin,
    'credentialRecordId', credential.id,
    'credentialId', credential.credential_id,
    'publicKey', credential.public_key,
    'counter', credential.counter,
    'transports', credential.transports,
    'deviceType', credential.device_type,
    'backedUp', credential.backed_up
  )
  into v_result
  from public.admin_webauthn_challenges challenge
  join auth.sessions auth_session
    on auth_session.id = challenge.session_id
   and auth_session.user_id = challenge.user_id
  left join public.admin_webauthn_credentials credential
    on credential.id = challenge.credential_id
   and credential.revoked_at is null
  where challenge.id = p_challenge_id
    and challenge.expires_at > clock_timestamp()
    and challenge.finalised_at is null
    and (not p_require_consumed or challenge.consumed_at is not null);

  if v_result is null then
    raise no_data_found using message = 'Live WebAuthn challenge required';
  end if;
  return v_result;
end;
$$;

create or replace function public.register_admin_webauthn_credential(
  p_challenge_id uuid,
  p_credential_id text,
  p_public_key text,
  p_counter bigint,
  p_transports jsonb,
  p_device_type text,
  p_backed_up boolean,
  p_user_verified boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge public.admin_webauthn_challenges%rowtype;
  v_credential_id uuid;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;
  if not p_user_verified or p_counter < 0
     or p_credential_id !~ '^[A-Za-z0-9_-]+$'
     or char_length(p_credential_id) not between 16 and 1024
     or p_public_key !~ '^[A-Za-z0-9_-]+$'
     or char_length(p_public_key) not between 16 and 8192
     or jsonb_typeof(p_transports) <> 'array'
     or p_device_type not in ('singleDevice', 'multiDevice') then
    raise invalid_parameter_value using message = 'Invalid verified WebAuthn credential';
  end if;

  select challenge.* into v_challenge
  from public.admin_webauthn_challenges challenge
  join auth.sessions auth_session
    on auth_session.id = challenge.session_id
   and auth_session.user_id = challenge.user_id
  where challenge.id = p_challenge_id
    and challenge.purpose = 'registration'
    and challenge.consumed_at is not null
    and challenge.finalised_at is null
    and challenge.expires_at > clock_timestamp()
  for update of challenge;
  if not found then
    raise insufficient_privilege using message = 'Consumed registration challenge required';
  end if;
  if not exists (
    select 1 from public.internal_admins admin
    where admin.user_id = v_challenge.user_id
      and admin.is_active
      and admin.mfa_factor_id is null
      and admin.mfa_activated_at is null
  ) or exists (
    select 1 from public.admin_webauthn_credentials credential
    where credential.user_id = v_challenge.user_id and credential.revoked_at is null
  ) then
    raise insufficient_privilege using message = 'Administrator registration is not available';
  end if;

  insert into public.admin_webauthn_credentials (
    user_id, credential_id, public_key, counter, transports,
    device_type, backed_up, user_verified
  ) values (
    v_challenge.user_id, p_credential_id, p_public_key, p_counter,
    p_transports, p_device_type, p_backed_up, true
  ) returning id into v_credential_id;

  update public.admin_webauthn_challenges
  set finalised_at = clock_timestamp(), credential_id = v_credential_id
  where id = p_challenge_id;

  insert into public.audit_logs (
    actor_type, actor_id, target_table, target_id, action, metadata
  ) values (
    'admin', v_challenge.user_id::text, 'admin_webauthn_credentials',
    v_credential_id, 'admin_webauthn_credential_registered',
    jsonb_build_object('credential_id', v_credential_id)
  );
  return v_credential_id;
end;
$$;

create or replace function public.grant_admin_webauthn_session(
  p_challenge_id uuid,
  p_credential_id text,
  p_expected_counter bigint,
  p_new_counter bigint,
  p_user_verified boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge public.admin_webauthn_challenges%rowtype;
  v_credential public.admin_webauthn_credentials%rowtype;
  v_verified_at timestamptz := clock_timestamp();
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;
  if not p_user_verified or p_expected_counter < 0 or p_new_counter < 0 then
    raise invalid_parameter_value using message = 'User-verified assertion required';
  end if;

  select challenge.* into v_challenge
  from public.admin_webauthn_challenges challenge
  join auth.sessions auth_session
    on auth_session.id = challenge.session_id
   and auth_session.user_id = challenge.user_id
  where challenge.id = p_challenge_id
    and challenge.purpose = 'authentication'
    and challenge.consumed_at is not null
    and challenge.finalised_at is null
    and challenge.expires_at > clock_timestamp()
  for update of challenge;
  if not found then
    raise insufficient_privilege using message = 'Consumed authentication challenge required';
  end if;

  select credential.* into v_credential
  from public.admin_webauthn_credentials credential
  join public.internal_admins admin
    on admin.mfa_factor_id = credential.id
   and admin.user_id = credential.user_id
   and admin.is_active
   and admin.mfa_activated_at is not null
  where credential.id = v_challenge.credential_id
    and credential.user_id = v_challenge.user_id
    and credential.credential_id = p_credential_id
    and credential.revoked_at is null
    and credential.user_verified
  for update of credential;
  if not found or v_credential.counter <> p_expected_counter
     or (v_credential.counter > 0 and p_new_counter <= v_credential.counter) then
    raise insufficient_privilege using message = 'Current activated credential required';
  end if;

  update public.admin_webauthn_credentials
  set counter = p_new_counter,
      device_type = v_credential.device_type,
      backed_up = v_credential.backed_up
  where id = v_credential.id and counter = p_expected_counter;
  if not found then
    raise serialization_failure using message = 'Credential counter changed';
  end if;

  insert into public.admin_webauthn_grants (
    user_id, session_id, credential_id, verified_at, expires_at
  ) values (
    v_challenge.user_id, v_challenge.session_id, v_credential.id,
    v_verified_at, v_verified_at + interval '10 minutes'
  ) on conflict (user_id, session_id) do update
    set credential_id = excluded.credential_id,
        verified_at = excluded.verified_at,
        expires_at = excluded.expires_at;

  update public.admin_webauthn_challenges
  set finalised_at = v_verified_at
  where id = p_challenge_id;
  return true;
end;
$$;

create or replace function public.has_activated_admin_mfa(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_admins admin
    join public.admin_webauthn_credentials credential
      on credential.id = admin.mfa_factor_id
     and credential.user_id = admin.user_id
     and credential.revoked_at is null
     and credential.user_verified
    where admin.user_id = p_user_id
      and admin.is_active
      and admin.mfa_activated_at is not null
      and (
        select count(*)
        from public.admin_webauthn_credentials live_credential
        where live_credential.user_id = admin.user_id
          and live_credential.revoked_at is null
      ) = 1
  );
$$;

create or replace function public.request_has_post_activation_admin_mfa(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_admins admin
    join public.admin_webauthn_credentials credential
      on credential.id = admin.mfa_factor_id
     and credential.user_id = admin.user_id
     and credential.revoked_at is null
     and credential.user_verified
    join public.admin_webauthn_grants step_up
      on step_up.user_id = admin.user_id
     and step_up.credential_id = credential.id
     and step_up.session_id = public.request_auth_session_id()
     and step_up.verified_at > admin.mfa_activated_at
     and step_up.expires_at > clock_timestamp()
    join auth.sessions auth_session
      on auth_session.id = step_up.session_id
     and auth_session.user_id = step_up.user_id
    where admin.user_id = p_user_id
      and admin.is_active
      and admin.mfa_activated_at is not null
  );
$$;

create or replace function public.is_internal_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_activated_admin_mfa(auth.uid())
    and public.request_has_post_activation_admin_mfa(auth.uid());
$$;

create or replace function public.viewer_has_verified_mfa_factor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_webauthn_credentials credential
    join public.internal_admins admin on admin.user_id = credential.user_id
    where credential.user_id = auth.uid()
      and credential.revoked_at is null
      and credential.user_verified
      and admin.is_active
  );
$$;

create or replace function public.viewer_has_activated_admin_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_activated_admin_mfa(auth.uid());
$$;

create or replace function public.viewer_admin_webauthn_credential_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select credential.id
  from public.admin_webauthn_credentials credential
  join public.internal_admins admin on admin.user_id = credential.user_id
  where credential.user_id = auth.uid()
    and credential.revoked_at is null
    and credential.user_verified
    and admin.is_active;
$$;

create or replace function public.activate_internal_admin_mfa(
  p_user_id uuid,
  p_factor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_factor_id uuid;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;
  select admin.mfa_factor_id into v_previous_factor_id
  from public.internal_admins admin
  where admin.user_id = p_user_id and admin.is_active
  for update;
  if not found then
    raise insufficient_privilege using message = 'Active admin required';
  end if;
  if not exists (
    select 1 from public.admin_webauthn_credentials credential
    where credential.id = p_factor_id
      and credential.user_id = p_user_id
      and credential.revoked_at is null
      and credential.user_verified
  ) or (
    select count(*) from public.admin_webauthn_credentials credential
    where credential.user_id = p_user_id and credential.revoked_at is null
  ) <> 1 then
    raise insufficient_privilege using
      message = 'Exactly one server-verified WebAuthn credential is required';
  end if;

  update public.internal_admins
  set mfa_factor_id = p_factor_id,
      mfa_activated_at = clock_timestamp()
  where user_id = p_user_id;
  delete from public.admin_webauthn_grants where user_id = p_user_id;
  insert into public.audit_logs (
    actor_type, actor_id, target_table, target_id, action, metadata
  ) values (
    'system', 'trusted_admin_mfa_operator', 'internal_admins', p_user_id,
    'admin_mfa_factor_activated',
    jsonb_build_object('factor_id', p_factor_id, 'previous_factor_id', v_previous_factor_id)
  );
  return true;
end;
$$;

create or replace function public.revoke_viewer_admin_webauthn_credential(
  p_credential_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_internal_admin() then
    raise insufficient_privilege using message = 'Current administrator step-up required';
  end if;
  update public.admin_webauthn_credentials
  set revoked_at = clock_timestamp()
  where id = p_credential_id
    and user_id = auth.uid()
    and revoked_at is null;
  if not found then
    raise no_data_found using message = 'Current administrator credential required';
  end if;
  return true;
end;
$$;

create or replace function public.invalidate_admin_webauthn_binding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.revoked_at is not null and old.revoked_at is null then
    update public.internal_admins
    set mfa_factor_id = null, mfa_activated_at = null
    where user_id = new.user_id and mfa_factor_id = new.id;
    delete from public.admin_webauthn_grants
    where user_id = new.user_id and credential_id = new.id;
    insert into public.audit_logs (
      actor_type, actor_id, target_table, target_id, action, metadata
    ) values (
      'system', 'admin_mfa_factor_lifecycle', 'internal_admins', new.user_id,
      'admin_mfa_factor_unenrolled', jsonb_build_object('factor_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists admin_webauthn_credentials_invalidate_binding
  on public.admin_webauthn_credentials;
create trigger admin_webauthn_credentials_invalidate_binding
  after update of revoked_at on public.admin_webauthn_credentials
  for each row execute function public.invalidate_admin_webauthn_binding();

revoke all on function public.can_bootstrap_admin_webauthn()
  from public, anon, authenticated, service_role;
grant execute on function public.can_bootstrap_admin_webauthn()
  to authenticated, service_role;
revoke all on function public.begin_admin_webauthn_challenge(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.begin_admin_webauthn_challenge(text, text, text)
  to authenticated, service_role;
revoke all on function public.consume_viewer_admin_webauthn_challenge(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_viewer_admin_webauthn_challenge(uuid, text, text)
  to authenticated, service_role;
revoke all on function public.read_admin_webauthn_challenge(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.read_admin_webauthn_challenge(uuid, boolean)
  to service_role;
revoke all on function public.register_admin_webauthn_credential(uuid, text, text, bigint, jsonb, text, boolean, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.register_admin_webauthn_credential(uuid, text, text, bigint, jsonb, text, boolean, boolean)
  to service_role;
revoke all on function public.grant_admin_webauthn_session(uuid, text, bigint, bigint, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.grant_admin_webauthn_session(uuid, text, bigint, bigint, boolean)
  to service_role;
revoke all on function public.has_activated_admin_mfa(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.has_activated_admin_mfa(uuid) to service_role;
revoke all on function public.request_has_post_activation_admin_mfa(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.request_has_post_activation_admin_mfa(uuid)
  to service_role;
revoke all on function public.is_internal_admin()
  from public, anon, authenticated, service_role;
grant execute on function public.is_internal_admin() to authenticated, service_role;
revoke all on function public.viewer_has_verified_mfa_factor()
  from public, anon, authenticated, service_role;
grant execute on function public.viewer_has_verified_mfa_factor()
  to authenticated, service_role;
revoke all on function public.viewer_has_activated_admin_mfa()
  from public, anon, authenticated, service_role;
grant execute on function public.viewer_has_activated_admin_mfa()
  to authenticated, service_role;
revoke all on function public.viewer_admin_webauthn_credential_id()
  from public, anon, authenticated, service_role;
grant execute on function public.viewer_admin_webauthn_credential_id()
  to authenticated, service_role;
revoke all on function public.activate_internal_admin_mfa(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.activate_internal_admin_mfa(uuid, uuid)
  to service_role;
revoke all on function public.revoke_viewer_admin_webauthn_credential(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_viewer_admin_webauthn_credential(uuid)
  to authenticated, service_role;
revoke all on function public.invalidate_admin_webauthn_binding()
  from public, anon, authenticated, service_role;

drop trigger if exists sessions_require_admin_webauthn_user_verification
  on auth.sessions;
drop trigger if exists mfa_factors_invalidate_internal_admin_binding
  on auth.mfa_factors;

notify pgrst, 'reload schema';
