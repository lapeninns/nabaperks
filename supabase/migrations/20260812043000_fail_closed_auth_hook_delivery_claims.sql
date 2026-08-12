-- Only the request that inserts an auth-hook delivery claim may call a
-- provider. Existing processing, completed, or failed rows never create a new
-- claimant for the same signed webhook event.

create or replace function public.claim_auth_hook_delivery(
  p_channel text,
  p_webhook_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := nullif(btrim(p_webhook_id), '');
  v_status text;
  v_inserted boolean := false;
begin
  if not public.is_service_role_request() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Service role required';
  end if;

  if v_id is null or p_channel is null then
    return 'unavailable';
  end if;

  insert into public.auth_hook_deliveries (channel, webhook_id, status)
  values (p_channel, v_id, 'processing')
  on conflict (channel, webhook_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted then
    return 'claimed';
  end if;

  select status into v_status
  from public.auth_hook_deliveries
  where channel = p_channel and webhook_id = v_id
  for update;

  if v_status = 'completed' then
    return 'replay';
  end if;

  return 'unavailable';
end;
$$;

create or replace function public.complete_auth_hook_delivery(
  p_channel text,
  p_webhook_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := nullif(btrim(p_webhook_id), '');
begin
  if not public.is_service_role_request() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Service role required';
  end if;

  if v_id is null then return false; end if;

  update public.auth_hook_deliveries
  set status = 'completed', completed_at = now()
  where channel = p_channel
    and webhook_id = v_id
    and status = 'processing';

  return found;
end;
$$;
