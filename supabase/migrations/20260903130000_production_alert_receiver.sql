create schema if not exists private;

create table private.production_alert_incidents (
  dedup_key text primary key,
  kind text not null check (kind in ('readiness', 'availability-slo', 'release-canary')),
  state text not null default 'resolved' check (state in ('triggered', 'resolved')),
  pending_delivery_id uuid,
  pending_action text check (pending_action in ('trigger', 'resolve')),
  pending_until timestamptz,
  last_delivery_id uuid,
  last_occurred_at timestamptz,
  updated_at timestamptz not null default now()
);

create table private.production_alert_deliveries (
  delivery_id uuid primary key,
  dedup_key text not null,
  kind text not null check (kind in ('readiness', 'availability-slo', 'release-canary')),
  action text not null check (action in ('trigger', 'resolve')),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('claimed', 'completed', 'failed')),
  page_required boolean not null,
  occurred_at timestamptz not null,
  run_url text not null,
  revision text,
  error_code text,
  claimed_at timestamptz not null default now(),
  completed_at timestamptz
);

revoke all on table private.production_alert_incidents from public, anon, authenticated, service_role;
revoke all on table private.production_alert_deliveries from public, anon, authenticated, service_role;

create or replace function public.claim_production_alert(
  p_delivery_id uuid,
  p_action text,
  p_kind text,
  p_dedup_key text,
  p_payload_hash text,
  p_occurred_at timestamptz,
  p_run_url text,
  p_revision text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_delivery private.production_alert_deliveries%rowtype;
  v_incident private.production_alert_incidents%rowtype;
  v_expected_dedup text;
  v_page_required boolean;
  v_recipient_email text;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  v_expected_dedup := case p_kind
    when 'readiness' then 'nabaperks-production-readiness'
    when 'availability-slo' then 'nabaperks-production-availability-slo'
    when 'release-canary' then 'nabaperks-production-release-canary'
    else null
  end;
  if p_delivery_id is null
    or p_action not in ('trigger', 'resolve')
    or v_expected_dedup is null
    or p_dedup_key <> v_expected_dedup
    or p_payload_hash !~ '^[0-9a-f]{64}$'
    or p_occurred_at is null
    or p_run_url !~ '^https://github[.]com/lapeninns/nabaperks/actions/runs/[0-9]+$'
    or (p_revision is not null and p_revision !~ '^[0-9a-f]{12}$') then
    raise invalid_parameter_value using message = 'Invalid production alert';
  end if;

  select * into v_delivery
  from private.production_alert_deliveries
  where delivery_id = p_delivery_id
  for update;

  if found then
    if v_delivery.payload_hash <> p_payload_hash
      or v_delivery.action <> p_action
      or v_delivery.kind <> p_kind
      or v_delivery.dedup_key <> p_dedup_key then
      raise invalid_parameter_value using message = 'Delivery identity conflict';
    end if;
    if v_delivery.status = 'completed' then
      return jsonb_build_object('pageRequired', false, 'duplicate', true);
    end if;
  else
    insert into private.production_alert_deliveries (
      delivery_id, dedup_key, kind, action, payload_hash, status,
      page_required, occurred_at, run_url, revision
    ) values (
      p_delivery_id, p_dedup_key, p_kind, p_action, p_payload_hash, 'claimed',
      true, p_occurred_at, p_run_url, p_revision
    );
  end if;

  insert into private.production_alert_incidents (dedup_key, kind)
  values (p_dedup_key, p_kind)
  on conflict (dedup_key) do nothing;

  select * into v_incident
  from private.production_alert_incidents
  where dedup_key = p_dedup_key
  for update;

  if v_incident.kind <> p_kind then
    raise invalid_parameter_value using message = 'Incident identity conflict';
  end if;
  if v_incident.pending_delivery_id is not null
    and v_incident.pending_delivery_id <> p_delivery_id
    and v_incident.pending_until > now() then
    raise lock_not_available using message = 'Incident delivery in progress';
  end if;

  v_page_required := not (
    (p_action = 'trigger' and v_incident.state = 'triggered')
    or (p_action = 'resolve' and v_incident.state = 'resolved')
  );

  if not v_page_required then
    update private.production_alert_deliveries
    set status = 'completed', page_required = false, completed_at = now(), error_code = null
    where delivery_id = p_delivery_id;
    return jsonb_build_object('pageRequired', false, 'duplicate', true);
  end if;

  select email into v_recipient_email
  from public.internal_admins
  where is_active
  order by created_at asc
  limit 1;

  update private.production_alert_deliveries
  set status = 'claimed', page_required = true, claimed_at = now(), error_code = null
  where delivery_id = p_delivery_id;
  update private.production_alert_incidents
  set pending_delivery_id = p_delivery_id,
      pending_action = p_action,
      pending_until = now() + interval '5 minutes',
      updated_at = now()
  where dedup_key = p_dedup_key;

  return jsonb_build_object(
    'pageRequired', true,
    'duplicate', false,
    'recipientEmail', v_recipient_email
  );
end;
$$;

create or replace function public.complete_production_alert_delivery(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_delivery private.production_alert_deliveries%rowtype;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;
  select * into v_delivery
  from private.production_alert_deliveries
  where delivery_id = p_delivery_id
  for update;
  if not found then
    raise invalid_parameter_value using message = 'Unknown production alert delivery';
  end if;
  if v_delivery.status = 'completed' then return; end if;
  if v_delivery.status <> 'claimed' then
    raise object_not_in_prerequisite_state using message = 'Production alert delivery is not claimed';
  end if;

  update private.production_alert_incidents
  set state = case v_delivery.action when 'trigger' then 'triggered' else 'resolved' end,
      pending_delivery_id = null,
      pending_action = null,
      pending_until = null,
      last_delivery_id = v_delivery.delivery_id,
      last_occurred_at = v_delivery.occurred_at,
      updated_at = now()
  where dedup_key = v_delivery.dedup_key
    and pending_delivery_id = v_delivery.delivery_id;
  if not found then
    raise object_not_in_prerequisite_state using message = 'Production alert claim expired';
  end if;

  update private.production_alert_deliveries
  set status = 'completed', completed_at = now(), error_code = null
  where delivery_id = p_delivery_id;

  insert into public.audit_logs (
    actor_type, actor_id, target_table, target_id, action, metadata
  ) values (
    'system', 'production-alert-receiver', 'production_alert_incidents',
    p_delivery_id, 'production_alert_' || v_delivery.action,
    jsonb_build_object(
      'kind', v_delivery.kind,
      'dedup_key', v_delivery.dedup_key,
      'occurred_at', v_delivery.occurred_at,
      'revision', v_delivery.revision,
      'run_url', v_delivery.run_url
    )
  );
end;
$$;

create or replace function public.fail_production_alert_delivery(
  p_delivery_id uuid,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;
  if p_error_code !~ '^[a-z_]{1,40}$' then
    raise invalid_parameter_value using message = 'Invalid error code';
  end if;
  update private.production_alert_deliveries
  set status = 'failed', error_code = p_error_code
  where delivery_id = p_delivery_id and status = 'claimed';
  update private.production_alert_incidents
  set pending_delivery_id = null,
      pending_action = null,
      pending_until = null,
      updated_at = now()
  where pending_delivery_id = p_delivery_id;
end;
$$;

revoke all on function public.claim_production_alert(uuid, text, text, text, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.complete_production_alert_delivery(uuid) from public, anon, authenticated;
revoke all on function public.fail_production_alert_delivery(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_production_alert(uuid, text, text, text, text, timestamptz, text, text) to service_role;
grant execute on function public.complete_production_alert_delivery(uuid) to service_role;
grant execute on function public.fail_production_alert_delivery(uuid, text) to service_role;

notify pgrst, 'reload schema';
