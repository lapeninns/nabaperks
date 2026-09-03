-- Moving a browser push endpoint between customers requires proof that the
-- caller holds the existing subscription's browser-private key material.

create sequence if not exists public.push_subscription_continuity_version_seq;

alter table public.push_subscriptions
  add column if not exists continuity_version bigint,
  add column if not exists continuity_trusted boolean;

-- Seed pre-existing rows once. Active ownership sorts last, while revoked-only
-- history retains the best chronology available before this invariant existed.
with ranked as (
  select subscriptions.id,
         row_number() over (
           order by
             md5(subscriptions.endpoint),
             (subscriptions.enabled and subscriptions.revoked_at is null),
             subscriptions.revoked_at nulls first,
             subscriptions.created_at,
             subscriptions.id
         ) as continuity_version,
         dense_rank() over (
           partition by subscriptions.endpoint
           order by
             (subscriptions.enabled and subscriptions.revoked_at is null) desc,
             subscriptions.revoked_at desc nulls last,
             subscriptions.created_at desc
         ) as endpoint_recency_rank,
         count(*) over (
           partition by
             subscriptions.endpoint,
             (subscriptions.enabled and subscriptions.revoked_at is null),
             subscriptions.revoked_at,
             subscriptions.created_at
         ) as recency_tie_count,
         bool_or(
           subscriptions.enabled and subscriptions.revoked_at is null
         ) over (partition by subscriptions.endpoint) as has_active_owner
  from public.push_subscriptions subscriptions
  where subscriptions.continuity_version is null
)
update public.push_subscriptions subscriptions
set continuity_version = ranked.continuity_version,
    continuity_trusted = not (
      not ranked.has_active_owner
      and ranked.endpoint_recency_rank = 1
      and ranked.recency_tie_count > 1
    )
from ranked
where subscriptions.id = ranked.id;

select setval(
  'public.push_subscription_continuity_version_seq',
  greatest(
    coalesce((select max(continuity_version) from public.push_subscriptions), 0),
    1
  ),
  exists (select 1 from public.push_subscriptions)
);

alter table public.push_subscriptions
  alter column continuity_version
    set default nextval('public.push_subscription_continuity_version_seq'),
  alter column continuity_version set not null,
  alter column continuity_trusted set default true,
  alter column continuity_trusted set not null;

alter sequence public.push_subscription_continuity_version_seq
  owned by public.push_subscriptions.continuity_version;

revoke all on sequence public.push_subscription_continuity_version_seq
  from public, anon, authenticated;
grant usage, select on sequence public.push_subscription_continuity_version_seq
  to service_role;

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
as $function$
declare
  subscription_id uuid;
  existing_owner record;
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

  if length(trim(coalesce(p_p256dh, ''))) < 20
     or length(trim(coalesce(p_auth, ''))) < 8 then
    raise exception 'Push subscription keys are required';
  end if;

  insert into public.notification_preferences (customer_id)
  values (p_customer_id)
  on conflict (customer_id) do nothing;

  perform pg_advisory_xact_lock(hashtextextended(trim(p_endpoint), 0));

  select subscriptions.id,
         subscriptions.customer_id,
         subscriptions.p256dh,
         subscriptions.auth,
         subscriptions.continuity_trusted
  into existing_owner
  from public.push_subscriptions subscriptions
  where subscriptions.endpoint = trim(p_endpoint)
  order by
           (subscriptions.enabled and subscriptions.revoked_at is null) desc,
           subscriptions.continuity_version desc
  limit 1;

  if existing_owner.id is not null
     and not existing_owner.continuity_trusted then
    raise insufficient_privilege using
      message = 'Push subscription ownership requires operator reconciliation';
  end if;

  if existing_owner.id is not null
     and existing_owner.customer_id <> p_customer_id
     and (
    normalized_permission <> 'granted'
    or existing_owner.p256dh is distinct from trim(p_p256dh)
    or existing_owner.auth is distinct from trim(p_auth)
  ) then
    raise insufficient_privilege using
      message = 'Existing push subscription proof is required';
  end if;

  update public.push_subscriptions
  set enabled = false,
      revoked_at = now(),
      failure_reason = 'ownership_transferred',
      updated_at = now()
  where endpoint = trim(p_endpoint)
    and customer_id <> p_customer_id
    and enabled
    and revoked_at is null;

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
    set p256dh = trim(p_p256dh),
        auth = trim(p_auth),
        user_agent = nullif(left(trim(coalesce(p_user_agent, '')), 240), ''),
        permission_state = normalized_permission,
        enabled = normalized_permission = 'granted',
        revoked_at = case
          when normalized_permission = 'granted' then null
          else coalesce(revoked_at, now())
        end,
        last_seen_at = now(),
        failure_reason = null,
        continuity_version = nextval(
          'public.push_subscription_continuity_version_seq'
        )
    where id = subscription_id;
  end if;

  return subscription_id;
end;
$function$;

revoke all on function public.register_push_subscription_for_customer(
  uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.register_push_subscription_for_customer(
  uuid, text, text, text, text, text
) to service_role;

-- This user-JWT predecessor was removed from the effective RPC allowlist in
-- 20260711090000. Repeat the signature-specific revoke so a future replay or
-- drift cannot bypass the service wrapper above.
revoke all on function public.register_push_subscription(
  text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.register_push_subscription(
  text, text, text, text, text
) to service_role;

notify pgrst, 'reload schema';
