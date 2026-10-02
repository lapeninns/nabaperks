create table private.auth_hook_sms_challenges (
  challenge_digest text primary key check (challenge_digest ~ '^[0-9a-f]{64}$'),
  delivery_id text not null unique,
  first_seen_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > first_seen_at)
);
alter table private.auth_hook_sms_challenges enable row level security;
alter table private.auth_hook_sms_challenges force row level security;
revoke all on table private.auth_hook_sms_challenges
  from public, anon, authenticated, service_role;

create or replace function public.claim_auth_hook_sms_delivery(
  p_challenge_digest text,
  p_window_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_created boolean;
  v_now timestamptz;
  v_challenge private.auth_hook_sms_challenges%rowtype;
  v_delivery public.auth_hook_deliveries%rowtype;
  v_claim jsonb;
  v_rollover boolean := false;
begin
  if not public.is_service_role_request() then
    raise exception using errcode = 'insufficient_privilege', message = 'Service role required';
  end if;
  if p_challenge_digest is null or p_challenge_digest !~ '^[0-9a-f]{64}$'
     or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception using errcode = 'invalid_parameter_value', message = 'Valid SMS challenge digest and expiry required';
  end if;

  v_now := clock_timestamp();
  insert into private.auth_hook_sms_challenges (
    challenge_digest, delivery_id, first_seen_at, expires_at
  ) values (
    p_challenge_digest,
    'sms-otp:' || p_challenge_digest || ':' || extensions.gen_random_uuid()::text,
    v_now, v_now + make_interval(secs => p_window_seconds)
  ) on conflict (challenge_digest) do nothing
  returning true into v_created;

  select * into v_challenge from private.auth_hook_sms_challenges
  where challenge_digest = p_challenge_digest for update;
  v_now := clock_timestamp();

  if not coalesce(v_created, false) then
    select * into v_delivery from public.auth_hook_deliveries
    where channel = 'sms' and webhook_id = v_challenge.delivery_id for update;

    if not found then
      raise exception 'SMS delivery state unavailable';
    elsif v_challenge.expires_at <= v_now then
      -- OTP expiry alone cannot replace an active or uncertain provider owner.
      if v_delivery.status = 'processing' then
        if v_delivery.lease_expires_at > v_now then
          return jsonb_build_object('status', 'busy', 'delivery_id', v_challenge.delivery_id);
        end if;
        if v_delivery.provider_attempted_at is not null then
          return jsonb_build_object('status', 'replay', 'delivery_id', v_challenge.delivery_id);
        end if;
      end if;
      v_rollover := true;
    end if;
  end if;

  if v_rollover then
    -- Each generation keeps its old lease identity, fencing late callbacks.
    update private.auth_hook_sms_challenges
    set delivery_id = 'sms-otp:' || p_challenge_digest || ':' || extensions.gen_random_uuid()::text,
        first_seen_at = v_now,
        expires_at = v_now + make_interval(secs => p_window_seconds)
    where challenge_digest = p_challenge_digest
    returning * into v_challenge;
  end if;

  v_claim := public.claim_auth_hook_delivery_v2('sms', v_challenge.delivery_id);
  return v_claim || jsonb_build_object('delivery_id', v_challenge.delivery_id);
end;
$function$;

revoke all on function public.claim_auth_hook_sms_delivery(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_auth_hook_sms_delivery(text, integer)
  to service_role;

notify pgrst, 'reload schema';
