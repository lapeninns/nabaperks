-- Signed auth hooks must consume their webhook id, not just verify it.
--
-- app/api/auth/hooks/signed-hook-envelope.ts verifies the Standard-Webhooks
-- signature and then discards the authenticated `webhook-id`. Signature
-- authenticity is not event consumption: lib/notifications/standard-webhook.ts
-- only checks a ±300s freshness window, so anyone who captures one authentic
-- envelope can replay it inside that window and drive another Twilio SMS or
-- another email-alias creation plus Resend send.
--
-- DESIGN NOTE — why this deduplicates COMPLETED deliveries only.
--
-- These hooks are synchronous and sit in the middle of an auth flow. A
-- duplicate OTP is an annoyance; a MISSING OTP locks the customer out. The
-- design is therefore deliberately asymmetric: fail CLOSED on replay, fail OPEN
-- on concurrency, and never introduce a new HTTP status. A replay returns the
-- ordinary Supabase success body, exactly as a first delivery does, so the
-- GoTrue retry contract is untouched and no Retry-After header is needed.
--
-- Keying on webhook-id is safe because GoTrue mints a fresh id per invocation.
-- Measured against a local GoTrue with the send_email hook pointed at a capture
-- endpoint: two OTP requests for the SAME recipient, 100 seconds apart, yielded
-- e6cdf06e-1d12-4d40-8f1d-de278e739207 and f3e615c6-4fdd-49d8-b1b5-18b33c3fbc6c.
-- Had the id been per-user, this table would have turned a legitimate second
-- code request into a silent no-op — worse than the vulnerability.
--
-- Closes: auth-hook-replay.

create table if not exists public.auth_hook_deliveries (
  channel text not null check (channel in ('email', 'sms')),
  -- Deliberately unconstrained beyond NOT NULL. A CHECK stricter than the
  -- function's own validation would make any id outside the pattern fail
  -- permanently on every retry — a self-inflicted outage on an auth path.
  -- Standard-Webhooks ids are opaque strings.
  webhook_id text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (channel, webhook_id)
);

-- No payload digest column: the hook body carries a plaintext 6-digit OTP plus
-- the recipient's address, and a sha256 of that is brute-forceable over a known
-- template. The id is already HMAC-bound to the body by the signature, so a
-- digest would add risk and prove nothing.

create index if not exists auth_hook_deliveries_created_at_idx
  on public.auth_hook_deliveries (created_at);

alter table public.auth_hook_deliveries enable row level security;
alter table public.auth_hook_deliveries force row level security;

revoke all on table public.auth_hook_deliveries from anon, authenticated;
grant select, insert, update, delete on table public.auth_hook_deliveries to service_role;

create policy auth_hook_deliveries_service_role_all
  on public.auth_hook_deliveries for all to service_role
  using (true) with check (true);

/**
 * Claim one delivery. Returns:
 *   'claimed'    — we own it, perform the side effect
 *   'replay'     — already completed; skip the side effect, answer success
 *   'concurrent' — another attempt is in flight; PROCEED anyway (fail open)
 */
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

  -- An unsigned or header-less request never reaches here, but if the id is
  -- unusable we must still deliver rather than strand the customer.
  if v_id is null or p_channel is null then
    return 'concurrent';
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

  if v_status = 'failed' then
    -- A previous attempt failed outright, so a genuine provider retry of the
    -- same envelope must be allowed to send again.
    update public.auth_hook_deliveries
    set status = 'processing', completed_at = null
    where channel = p_channel and webhook_id = v_id;
    return 'claimed';
  end if;

  return 'concurrent';
end;
$$;

/**
 * Record that a provider accepted the delivery.
 *
 * Deliberately claims from ANY non-completed state. If it required
 * 'processing', this sequence would erase a proven delivery: owner A claims,
 * fail-open B sends successfully, A's own send fails and releases the row, then
 * B's completion matches nothing — leaving no record and reopening replay.
 */
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
    and status <> 'completed';

  return found;
end;
$$;

/**
 * Record that the delivery failed. Marks 'failed' rather than deleting, so a
 * concurrent sender's success can still be recorded over it (see above) while a
 * genuine retry of a wholly failed delivery is still allowed to re-send.
 */
create or replace function public.fail_auth_hook_delivery(
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
  set status = 'failed'
  where channel = p_channel
    and webhook_id = v_id
    and status = 'processing';

  return found;
end;
$$;

/** Retention: the signature window is ±300s, so a day is generous. */
create or replace function public.purge_auth_hook_deliveries(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.is_service_role_request() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Service role required';
  end if;

  delete from public.auth_hook_deliveries
  where created_at < p_now - interval '1 day';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.claim_auth_hook_delivery(text, text) from public, anon, authenticated;
revoke all on function public.complete_auth_hook_delivery(text, text) from public, anon, authenticated;
revoke all on function public.fail_auth_hook_delivery(text, text) from public, anon, authenticated;
revoke all on function public.purge_auth_hook_deliveries(timestamptz) from public, anon, authenticated;

grant execute on function public.claim_auth_hook_delivery(text, text) to service_role;
grant execute on function public.complete_auth_hook_delivery(text, text) to service_role;
grant execute on function public.fail_auth_hook_delivery(text, text) to service_role;
grant execute on function public.purge_auth_hook_deliveries(timestamptz) to service_role;

notify pgrst, 'reload schema';
