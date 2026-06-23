create table public.notification_preferences (
  customer_id uuid primary key references public.customers (id) on delete cascade,
  transactional_enabled boolean not null default true,
  reminder_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  quiet_hours_start time not null default '20:00',
  quiet_hours_end time not null default '09:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  permission_state text not null default 'granted',
  enabled boolean not null default true,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_permission_state_check
    check (permission_state in ('prompt', 'granted', 'denied', 'unsupported', 'unknown')),
  constraint push_subscriptions_endpoint_length_check
    check (char_length(endpoint) between 20 and 2048),
  constraint push_subscriptions_p256dh_length_check
    check (char_length(p256dh) between 20 and 512),
  constraint push_subscriptions_auth_length_check
    check (char_length(auth) between 8 and 256)
);

create index notification_preferences_updated_at_idx
  on public.notification_preferences (updated_at desc);
create unique index push_subscriptions_customer_endpoint_hash_idx
  on public.push_subscriptions (customer_id, md5(endpoint));
create index push_subscriptions_customer_enabled_seen_idx
  on public.push_subscriptions (customer_id, enabled, last_seen_at desc);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();
create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

create policy notification_preferences_select_customer_or_admin
  on public.notification_preferences for select to authenticated
  using ((select public.is_customer_owner(customer_id)) or (select public.is_internal_admin()));
create policy notification_preferences_insert_customer_or_admin
  on public.notification_preferences for insert to authenticated
  with check ((select public.is_customer_owner(customer_id)) or (select public.is_internal_admin()));
create policy notification_preferences_update_customer_or_admin
  on public.notification_preferences for update to authenticated
  using ((select public.is_customer_owner(customer_id)) or (select public.is_internal_admin()))
  with check ((select public.is_customer_owner(customer_id)) or (select public.is_internal_admin()));

create policy push_subscriptions_select_customer_or_admin
  on public.push_subscriptions for select to authenticated
  using ((select public.is_customer_owner(customer_id)) or (select public.is_internal_admin()));
create policy push_subscriptions_insert_customer_or_admin
  on public.push_subscriptions for insert to authenticated
  with check ((select public.is_customer_owner(customer_id)) or (select public.is_internal_admin()));
create policy push_subscriptions_update_customer_or_admin
  on public.push_subscriptions for update to authenticated
  using ((select public.is_customer_owner(customer_id)) or (select public.is_internal_admin()))
  with check ((select public.is_customer_owner(customer_id)) or (select public.is_internal_admin()));

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_permission_state text default 'granted'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_customer_id uuid;
  subscription_id uuid;
  normalized_permission text := lower(trim(coalesce(p_permission_state, 'granted')));
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Customer authentication required';
  end if;

  select id
  into current_customer_id
  from public.customers
  where auth_user_id = (select auth.uid());

  if current_customer_id is null then
    raise insufficient_privilege using message = 'Customer profile required';
  end if;

  if normalized_permission not in ('prompt', 'granted', 'denied', 'unsupported', 'unknown') then
    raise exception 'Unsupported push permission state';
  end if;

  if length(trim(coalesce(p_endpoint, ''))) < 20 then
    raise exception 'Push endpoint is required';
  end if;

  if length(trim(coalesce(p_p256dh, ''))) < 20 or length(trim(coalesce(p_auth, ''))) < 8 then
    raise exception 'Push subscription keys are required';
  end if;

  insert into public.notification_preferences (customer_id)
  values (current_customer_id)
  on conflict (customer_id) do nothing;

  select id
  into subscription_id
  from public.push_subscriptions
  where customer_id = current_customer_id
    and endpoint = trim(p_endpoint);

  if subscription_id is null then
    begin
      insert into public.push_subscriptions (
        customer_id,
        endpoint,
        p256dh,
        auth,
        user_agent,
        permission_state,
        enabled,
        revoked_at,
        last_seen_at,
        failure_reason
      )
      values (
        current_customer_id,
        trim(p_endpoint),
        trim(p_p256dh),
        trim(p_auth),
        nullif(left(trim(coalesce(p_user_agent, '')), 240), ''),
        normalized_permission,
        normalized_permission = 'granted',
        case when normalized_permission = 'granted' then null else now() end,
        now(),
        null
      )
      returning id into subscription_id;
    exception
      when unique_violation then
        select id
        into subscription_id
        from public.push_subscriptions
        where customer_id = current_customer_id
          and md5(endpoint) = md5(trim(p_endpoint));
    end;
  end if;

  update public.push_subscriptions
  set
    p256dh = trim(p_p256dh),
    auth = trim(p_auth),
    user_agent = nullif(left(trim(coalesce(p_user_agent, '')), 240), ''),
    permission_state = normalized_permission,
    enabled = normalized_permission = 'granted',
    revoked_at = case when normalized_permission = 'granted' then null else coalesce(revoked_at, now()) end,
    last_seen_at = now(),
    failure_reason = null
  where id = subscription_id
    and customer_id = current_customer_id;

  return subscription_id;
end;
$$;

create or replace function public.disable_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_customer_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Customer authentication required';
  end if;

  select id
  into current_customer_id
  from public.customers
  where auth_user_id = (select auth.uid());

  if current_customer_id is null then
    raise insufficient_privilege using message = 'Customer profile required';
  end if;

  update public.push_subscriptions
  set
    enabled = false,
    permission_state = case when permission_state = 'granted' then 'unknown' else permission_state end,
    revoked_at = coalesce(revoked_at, now()),
    last_seen_at = now(),
    failure_reason = 'customer_disabled'
  where customer_id = current_customer_id
    and endpoint = trim(coalesce(p_endpoint, ''));
end;
$$;

create or replace function public.update_notification_preferences(
  p_transactional_enabled boolean,
  p_reminder_enabled boolean,
  p_marketing_enabled boolean
)
returns table (
  transactional_enabled boolean,
  reminder_enabled boolean,
  marketing_enabled boolean,
  quiet_hours_start time,
  quiet_hours_end time,
  active_subscription_count integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_customer_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Customer authentication required';
  end if;

  select id
  into current_customer_id
  from public.customers
  where auth_user_id = (select auth.uid());

  if current_customer_id is null then
    raise insufficient_privilege using message = 'Customer profile required';
  end if;

  insert into public.notification_preferences (
    customer_id,
    transactional_enabled,
    reminder_enabled,
    marketing_enabled
  )
  values (
    current_customer_id,
    coalesce(p_transactional_enabled, true),
    coalesce(p_reminder_enabled, true),
    coalesce(p_marketing_enabled, false)
  )
  on conflict (customer_id) do update
  set
    transactional_enabled = excluded.transactional_enabled,
    reminder_enabled = excluded.reminder_enabled,
    marketing_enabled = excluded.marketing_enabled;

  if not coalesce(p_transactional_enabled, true)
    and not coalesce(p_reminder_enabled, true)
    and not coalesce(p_marketing_enabled, false) then
    update public.push_subscriptions
    set
      enabled = false,
      revoked_at = coalesce(revoked_at, now()),
      failure_reason = 'preferences_disabled'
    where customer_id = current_customer_id
      and enabled;
  end if;

  return query
  select
    preferences.transactional_enabled,
    preferences.reminder_enabled,
    preferences.marketing_enabled,
    preferences.quiet_hours_start,
    preferences.quiet_hours_end,
    (
      select count(*)::integer
      from public.push_subscriptions subscriptions
      where subscriptions.customer_id = current_customer_id
        and subscriptions.enabled
    ) as active_subscription_count
  from public.notification_preferences preferences
  where preferences.customer_id = current_customer_id;
end;
$$;

create or replace function public.get_notification_preferences()
returns table (
  transactional_enabled boolean,
  reminder_enabled boolean,
  marketing_enabled boolean,
  quiet_hours_start time,
  quiet_hours_end time,
  active_subscription_count integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_customer_id uuid;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Customer authentication required';
  end if;

  select id
  into current_customer_id
  from public.customers
  where auth_user_id = (select auth.uid());

  if current_customer_id is null then
    raise insufficient_privilege using message = 'Customer profile required';
  end if;

  insert into public.notification_preferences (customer_id)
  values (current_customer_id)
  on conflict (customer_id) do nothing;

  return query
  select
    preferences.transactional_enabled,
    preferences.reminder_enabled,
    preferences.marketing_enabled,
    preferences.quiet_hours_start,
    preferences.quiet_hours_end,
    (
      select count(*)::integer
      from public.push_subscriptions subscriptions
      where subscriptions.customer_id = current_customer_id
        and subscriptions.enabled
    ) as active_subscription_count
  from public.notification_preferences preferences
  where preferences.customer_id = current_customer_id;
end;
$$;

create or replace function public.register_push_subscription_for_customer(
  p_customer_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_permission_state text default 'granted'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  subscription_id uuid;
  normalized_permission text := lower(trim(coalesce(p_permission_state, 'granted')));
begin
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise insufficient_privilege using message = 'Customer profile required';
  end if;

  if normalized_permission not in ('prompt', 'granted', 'denied', 'unsupported', 'unknown') then
    raise exception 'Unsupported push permission state';
  end if;

  if length(trim(coalesce(p_endpoint, ''))) < 20 then
    raise exception 'Push endpoint is required';
  end if;

  if length(trim(coalesce(p_p256dh, ''))) < 20 or length(trim(coalesce(p_auth, ''))) < 8 then
    raise exception 'Push subscription keys are required';
  end if;

  insert into public.notification_preferences (customer_id)
  values (p_customer_id)
  on conflict (customer_id) do nothing;

  select id
  into subscription_id
  from public.push_subscriptions
  where customer_id = p_customer_id
    and endpoint = trim(p_endpoint);

  if subscription_id is null then
    insert into public.push_subscriptions (
      customer_id,
      endpoint,
      p256dh,
      auth,
      user_agent,
      permission_state,
      enabled,
      revoked_at,
      last_seen_at,
      failure_reason
    )
    values (
      p_customer_id,
      trim(p_endpoint),
      trim(p_p256dh),
      trim(p_auth),
      nullif(left(trim(coalesce(p_user_agent, '')), 240), ''),
      normalized_permission,
      normalized_permission = 'granted',
      case when normalized_permission = 'granted' then null else now() end,
      now(),
      null
    )
    returning id into subscription_id;
  else
    update public.push_subscriptions
    set
      p256dh = trim(p_p256dh),
      auth = trim(p_auth),
      user_agent = nullif(left(trim(coalesce(p_user_agent, '')), 240), ''),
      permission_state = normalized_permission,
      enabled = normalized_permission = 'granted',
      revoked_at = case when normalized_permission = 'granted' then null else coalesce(revoked_at, now()) end,
      last_seen_at = now(),
      failure_reason = null
    where id = subscription_id;
  end if;

  return subscription_id;
end;
$$;

create or replace function public.disable_push_subscription_for_customer(
  p_customer_id uuid,
  p_endpoint text,
  p_reason text default 'customer_disabled'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise insufficient_privilege using message = 'Customer profile required';
  end if;

  update public.push_subscriptions
  set
    enabled = false,
    permission_state = case when permission_state = 'granted' then 'unknown' else permission_state end,
    revoked_at = coalesce(revoked_at, now()),
    last_seen_at = now(),
    failure_reason = left(coalesce(nullif(trim(p_reason), ''), 'customer_disabled'), 120)
  where customer_id = p_customer_id
    and endpoint = trim(coalesce(p_endpoint, ''));
end;
$$;

create or replace function public.update_notification_preferences_for_customer(
  p_customer_id uuid,
  p_transactional_enabled boolean,
  p_reminder_enabled boolean,
  p_marketing_enabled boolean
)
returns table (
  transactional_enabled boolean,
  reminder_enabled boolean,
  marketing_enabled boolean,
  quiet_hours_start time,
  quiet_hours_end time,
  active_subscription_count integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise insufficient_privilege using message = 'Customer profile required';
  end if;

  insert into public.notification_preferences (
    customer_id,
    transactional_enabled,
    reminder_enabled,
    marketing_enabled
  )
  values (
    p_customer_id,
    coalesce(p_transactional_enabled, true),
    coalesce(p_reminder_enabled, true),
    coalesce(p_marketing_enabled, false)
  )
  on conflict (customer_id) do update
  set
    transactional_enabled = excluded.transactional_enabled,
    reminder_enabled = excluded.reminder_enabled,
    marketing_enabled = excluded.marketing_enabled;

  if not coalesce(p_transactional_enabled, true)
    and not coalesce(p_reminder_enabled, true)
    and not coalesce(p_marketing_enabled, false) then
    update public.push_subscriptions
    set
      enabled = false,
      revoked_at = coalesce(revoked_at, now()),
      failure_reason = 'preferences_disabled'
    where customer_id = p_customer_id
      and enabled;
  end if;

  return query
  select
    preferences.transactional_enabled,
    preferences.reminder_enabled,
    preferences.marketing_enabled,
    preferences.quiet_hours_start,
    preferences.quiet_hours_end,
    (
      select count(*)::integer
      from public.push_subscriptions subscriptions
      where subscriptions.customer_id = p_customer_id
        and subscriptions.enabled
    ) as active_subscription_count
  from public.notification_preferences preferences
  where preferences.customer_id = p_customer_id;
end;
$$;

create or replace function public.get_notification_preferences_for_customer(
  p_customer_id uuid
)
returns table (
  transactional_enabled boolean,
  reminder_enabled boolean,
  marketing_enabled boolean,
  quiet_hours_start time,
  quiet_hours_end time,
  active_subscription_count integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise insufficient_privilege using message = 'Customer profile required';
  end if;

  insert into public.notification_preferences (customer_id)
  values (p_customer_id)
  on conflict (customer_id) do nothing;

  return query
  select
    preferences.transactional_enabled,
    preferences.reminder_enabled,
    preferences.marketing_enabled,
    preferences.quiet_hours_start,
    preferences.quiet_hours_end,
    (
      select count(*)::integer
      from public.push_subscriptions subscriptions
      where subscriptions.customer_id = p_customer_id
        and subscriptions.enabled
    ) as active_subscription_count
  from public.notification_preferences preferences
  where preferences.customer_id = p_customer_id;
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text, text) from public;
revoke all on function public.disable_push_subscription(text) from public;
revoke all on function public.update_notification_preferences(boolean, boolean, boolean) from public;
revoke all on function public.get_notification_preferences() from public;
revoke all on function public.register_push_subscription_for_customer(uuid, text, text, text, text, text) from public;
revoke all on function public.disable_push_subscription_for_customer(uuid, text, text) from public;
revoke all on function public.update_notification_preferences_for_customer(uuid, boolean, boolean, boolean) from public;
revoke all on function public.get_notification_preferences_for_customer(uuid) from public;

grant execute on function public.register_push_subscription(text, text, text, text, text) to authenticated, service_role;
grant execute on function public.disable_push_subscription(text) to authenticated, service_role;
grant execute on function public.update_notification_preferences(boolean, boolean, boolean) to authenticated, service_role;
grant execute on function public.get_notification_preferences() to authenticated, service_role;
grant execute on function public.register_push_subscription_for_customer(uuid, text, text, text, text, text) to service_role;
grant execute on function public.disable_push_subscription_for_customer(uuid, text, text) to service_role;
grant execute on function public.update_notification_preferences_for_customer(uuid, boolean, boolean, boolean) to service_role;
grant execute on function public.get_notification_preferences_for_customer(uuid) to service_role;
