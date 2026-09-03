-- Bound anonymous real-user telemetry at the database write boundary. Every
-- request spends fixed global work capacity; replays still converge on one row.

create or replace function public.record_web_vital_sample(
  p_metric_name text,
  p_metric_id text,
  p_value double precision,
  p_delta double precision,
  p_rating text,
  p_route_key text,
  p_navigation_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_digest text;
  v_sample_id uuid;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  -- These names and limits are not caller-controlled. Charge request work
  -- before replay detection so distributed duplicate RPCs remain bounded.
  perform public.enforce_rate_limit(
    'web-vitals-global-burst-v1',
    600,
    60000
  );
  perform public.enforce_rate_limit(
    'web-vitals-global-daily-v1',
    10000,
    86400000
  );

  v_digest := encode(
    digest(
      convert_to(
        'nabaperks:web-vital:v1:' || coalesce(p_metric_name, '') || ':' ||
          coalesce(p_metric_id, ''),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
  v_sample_id := (
    substr(v_digest, 1, 8) || '-' ||
    substr(v_digest, 9, 4) || '-' ||
    substr(v_digest, 13, 4) || '-' ||
    substr(v_digest, 17, 4) || '-' ||
    substr(v_digest, 21, 12)
  )::uuid;

  insert into public.web_vital_samples (
    id,
    metric_name,
    metric_id,
    value,
    delta,
    rating,
    route_key,
    navigation_type
  ) values (
    v_sample_id,
    p_metric_name,
    p_metric_id,
    p_value,
    p_delta,
    p_rating,
    p_route_key,
    p_navigation_type
  )
  on conflict (id) do nothing;

  if not found then
    return false;
  end if;

  return true;
end;
$function$;

revoke all on function public.record_web_vital_sample(
  text, text, double precision, double precision, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_web_vital_sample(
  text, text, double precision, double precision, text, text, text
) to service_role;

revoke insert on table public.web_vital_samples from service_role;

notify pgrst, 'reload schema';
