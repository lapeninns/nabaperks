-- db notification durability — Blocker 3: caller-proof, cycle-aware enqueue.
--
-- The scheduled worker's producers select up to 100 rows and enqueue each every
-- run, passing an ad-hoc dedupe key. For the stamp producers that key was
-- `${eventType}:${membershipId}:${businessDate}` — it OMITTED the cycle, so a
-- membership rolling into a new cycle on the same day lost its second nudge; and
-- because the key was caller-supplied, a bad key would break dedupe. The audit
-- counted 14,455 enqueue calls collapsing to 222 rows.
--
-- The dedupe identity for the scheduled producer event types now lives in the DB
-- and is derived from (event_type, membership, cycle, business_date) — ignoring
-- any caller key — so it is caller-proof and cycle-aware. It is applied only when
-- membership_id is known: a null-membership key would collapse different
-- customers into one row. Transactional event types keep honouring their caller
-- key (and the hourly default). The insert/return contract is otherwise
-- unchanged.
--
-- Forward-only, fresh-safe, idempotent: CREATE OR REPLACE with the same 11-arg
-- signature; declarative ACL re-assert.

create or replace function public.enqueue_notification_event(
  p_event_type text,
  p_customer_id uuid,
  p_merchant_id uuid default null,
  p_membership_id uuid default null,
  p_reward_event_id uuid default null,
  p_cycle_number integer default null,
  p_business_date date default null,
  p_due_at timestamptz default now(),
  p_dedupe_key text default null,
  p_payload jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_event_id uuid;
  v_category text := public.notification_event_category(p_event_type);
  -- Scheduled producers run every worker tick; the DB owns their dedupe identity
  -- so it is caller-proof and cycle-aware.
  v_is_scheduled boolean := p_event_type in (
    'next_stamp_available',
    'reward_ready',
    'reward_expiring_soon',
    'reward_expired',
    'dormant_progress'
  );
  v_dedupe_key text;
begin
  if p_customer_id is null then
    raise exception 'Customer is required for notification events';
  end if;

  if v_is_scheduled and p_membership_id is not null then
    -- One row per (event_type, membership, cycle, business_date). membership is
    -- the identity anchor, so this never collapses across customers.
    v_dedupe_key := concat_ws(
      ':',
      p_event_type,
      p_membership_id::text,
      coalesce(p_cycle_number::text, 'no-cycle'),
      coalesce(
        p_business_date,
        public.uk_business_date(coalesce(p_due_at, now()))
      )::text
    );
  else
    v_dedupe_key := coalesce(
      nullif(trim(p_dedupe_key), ''),
      public.build_notification_dedupe_key(
        p_event_type,
        p_customer_id,
        p_membership_id,
        p_reward_event_id,
        p_cycle_number,
        p_business_date,
        p_due_at
      )
    );
  end if;

  insert into public.notification_events (
    event_type,
    category,
    customer_id,
    merchant_id,
    membership_id,
    reward_event_id,
    cycle_number,
    business_date,
    due_at,
    dedupe_key,
    payload,
    metadata
  )
  values (
    p_event_type,
    v_category,
    p_customer_id,
    p_merchant_id,
    p_membership_id,
    p_reward_event_id,
    p_cycle_number,
    p_business_date,
    coalesce(p_due_at, now()),
    v_dedupe_key,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (dedupe_key) do update
    set updated_at = public.notification_events.updated_at
  returning id into v_event_id;

  return v_event_id;
end;
$$;

-- Re-assert the Wave-1 containment ACL. enqueue_notification_event is
-- perform-called inside authenticated-executable SECURITY DEFINER RPCs
-- (issue_merchant_direct_reward, issue_self_service_stamp, birthday/referral
-- issuers), which run as the definer, so an in-body role assertion would break
-- them — the ACL lock is the correct protection and stays service-role only.
revoke execute on function public.enqueue_notification_event(text, uuid, uuid, uuid, uuid, integer, date, timestamptz, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_notification_event(text, uuid, uuid, uuid, uuid, integer, date, timestamptz, text, jsonb, jsonb) to service_role;
