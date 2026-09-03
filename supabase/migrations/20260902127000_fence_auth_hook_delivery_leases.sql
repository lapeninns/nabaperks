-- A signed auth-hook envelope has one exclusive provider-delivery owner.
-- Busy or uncertain claims fail closed; failed/expired owners may be replaced
-- only by a new fenced lease.

alter table public.auth_hook_deliveries
  add column if not exists lease_id uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists attempt_count integer not null default 0;

update public.auth_hook_deliveries
set lease_id = extensions.gen_random_uuid(),
    lease_expires_at = now() + interval '10 minutes',
    updated_at = now(),
    attempt_count = greatest(attempt_count, 1)
where status = 'processing';

drop function if exists public.claim_auth_hook_delivery(text, text);
create function public.claim_auth_hook_delivery(
  p_channel text,
  p_webhook_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_id text := nullif(btrim(p_webhook_id), '');
  v_now timestamptz := clock_timestamp();
  v_lease_id uuid := extensions.gen_random_uuid();
  v_row public.auth_hook_deliveries%rowtype;
begin
  if not public.is_service_role_request() then
    raise exception using errcode = 'insufficient_privilege', message = 'Service role required';
  end if;
  if v_id is null or p_channel not in ('email', 'sms') then
    raise exception using errcode = 'invalid_parameter_value', message = 'Valid auth-hook delivery identity required';
  end if;

  insert into public.auth_hook_deliveries (
    channel, webhook_id, status, lease_id, lease_expires_at,
    created_at, updated_at, attempt_count
  ) values (
    p_channel, v_id, 'processing', v_lease_id,
    v_now + interval '10 minutes', v_now, v_now, 1
  )
  on conflict (channel, webhook_id) do nothing
  returning * into v_row;

  if v_row.webhook_id is not null then
    return jsonb_build_object('status', 'claimed', 'lease_id', v_lease_id);
  end if;

  select * into v_row
  from public.auth_hook_deliveries
  where channel = p_channel and webhook_id = v_id
  for update;

  if v_row.status = 'completed' then
    return jsonb_build_object('status', 'replay');
  end if;

  if v_row.status = 'processing' and v_row.lease_expires_at > v_now then
    return jsonb_build_object('status', 'busy');
  end if;

  v_lease_id := extensions.gen_random_uuid();
  update public.auth_hook_deliveries
  set status = 'processing',
      lease_id = v_lease_id,
      lease_expires_at = v_now + interval '10 minutes',
      completed_at = null,
      updated_at = v_now,
      attempt_count = attempt_count + 1
  where channel = p_channel and webhook_id = v_id;

  return jsonb_build_object('status', 'claimed', 'lease_id', v_lease_id);
end;
$function$;

drop function if exists public.complete_auth_hook_delivery(text, text);
create function public.complete_auth_hook_delivery(
  p_channel text,
  p_webhook_id text,
  p_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_service_role_request() then
    raise exception using errcode = 'insufficient_privilege', message = 'Service role required';
  end if;
  if p_lease_id is null then return false; end if;

  update public.auth_hook_deliveries
  set status = 'completed',
      completed_at = clock_timestamp(),
      lease_expires_at = null,
      updated_at = clock_timestamp()
  where channel = p_channel
    and webhook_id = nullif(btrim(p_webhook_id), '')
    and status = 'processing'
    and lease_id = p_lease_id;
  return found;
end;
$function$;

drop function if exists public.fail_auth_hook_delivery(text, text);
create function public.fail_auth_hook_delivery(
  p_channel text,
  p_webhook_id text,
  p_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_service_role_request() then
    raise exception using errcode = 'insufficient_privilege', message = 'Service role required';
  end if;
  if p_lease_id is null then return false; end if;

  update public.auth_hook_deliveries
  set status = 'failed',
      lease_id = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
  where channel = p_channel
    and webhook_id = nullif(btrim(p_webhook_id), '')
    and status = 'processing'
    and lease_id = p_lease_id;
  return found;
end;
$function$;

create or replace function public.purge_auth_hook_deliveries(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_deleted integer;
begin
  if not public.is_service_role_request() then
    raise exception using errcode = 'insufficient_privilege', message = 'Service role required';
  end if;

  delete from public.auth_hook_deliveries
  where (status in ('completed', 'failed') and updated_at < p_now - interval '1 day')
     or (status = 'processing' and lease_expires_at < p_now - interval '1 day');

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.claim_auth_hook_delivery(text, text) from public, anon, authenticated;
revoke all on function public.complete_auth_hook_delivery(text, text, uuid) from public, anon, authenticated;
revoke all on function public.fail_auth_hook_delivery(text, text, uuid) from public, anon, authenticated;
revoke all on function public.purge_auth_hook_deliveries(timestamptz) from public, anon, authenticated;

grant execute on function public.claim_auth_hook_delivery(text, text) to service_role;
grant execute on function public.complete_auth_hook_delivery(text, text, uuid) to service_role;
grant execute on function public.fail_auth_hook_delivery(text, text, uuid) to service_role;
grant execute on function public.purge_auth_hook_deliveries(timestamptz) to service_role;

notify pgrst, 'reload schema';
