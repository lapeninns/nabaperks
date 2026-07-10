-- MS-db-notification-durability — Blocker 2: lease + reclaim for the claim step.
--
-- claim_due_notification_events flipped queued -> 'delivering' with no lease, so
-- a worker that died mid-drain left its claimed rows in 'delivering' forever —
-- never delivered, never retried. This adds a visibility-timeout lease:
--   * every claim stamps claimed_at + lease_expires_at,
--   * a later claim RECLAIMS a 'delivering' row whose lease has expired,
--   * a row under a live lease, or a NULL-lease (pre-lease) row, is left alone.
--
-- Pre-existing 'delivering' rows (claimed before this migration, so NULL lease)
-- are reset to 'queued' once so they re-enter the normal queue; the reclaim
-- predicate then requires a non-null expired lease, so a row a concurrent
-- old-path worker is still processing is never double-claimed on the deploy
-- boundary.
--
-- Forward-only, fresh-safe, idempotent: add-column-if-not-exists,
-- create-or-replace, a no-op-safe one-time reset, and declarative grants. The
-- (timestamptz, integer) signature and return columns are unchanged (no new
-- overload, no worker cast churn).

alter table public.notification_events
  add column if not exists claimed_at timestamptz;
alter table public.notification_events
  add column if not exists lease_expires_at timestamptz;

-- One-time heal: pre-lease rows stuck in 'delivering' (NULL lease) re-enter the
-- queue. Idempotent — after the first run no such rows remain.
update public.notification_events
set status = 'queued', claimed_at = null, lease_expires_at = null
where status = 'delivering' and lease_expires_at is null;

create or replace function public.claim_due_notification_events(
  p_now timestamptz default now(),
  p_limit integer default 50
)
returns table (
  id uuid,
  event_type text,
  category text,
  customer_id uuid,
  merchant_id uuid,
  membership_id uuid,
  reward_event_id uuid,
  payload jsonb,
  metadata jsonb,
  due_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 500);
  v_now timestamptz := coalesce(p_now, now());
  -- Visibility timeout: a claimed row is invisible for this long; a worker that
  -- dies mid-drain releases its rows once the lease expires.
  v_lease interval := interval '5 minutes';
begin
  return query
  with picked as (
    select notification_events.id
    from public.notification_events
    where (
        (notification_events.status = 'queued'
          and notification_events.due_at <= v_now)
        or (notification_events.status = 'delivering'
          and notification_events.lease_expires_at is not null
          and notification_events.lease_expires_at <= v_now)
      )
    order by notification_events.due_at asc, notification_events.created_at asc
    limit v_limit
    for update skip locked
  ),
  claimed as (
    update public.notification_events
    set status = 'delivering',
        claimed_at = v_now,
        lease_expires_at = v_now + v_lease
    from picked
    where notification_events.id = picked.id
    returning
      notification_events.id,
      notification_events.event_type,
      notification_events.category,
      notification_events.customer_id,
      notification_events.merchant_id,
      notification_events.membership_id,
      notification_events.reward_event_id,
      notification_events.payload,
      notification_events.metadata,
      notification_events.due_at
  )
  select
    claimed.id,
    claimed.event_type,
    claimed.category,
    claimed.customer_id,
    claimed.merchant_id,
    claimed.membership_id,
    claimed.reward_event_id,
    claimed.payload,
    claimed.metadata,
    claimed.due_at
  from claimed
  order by claimed.due_at asc;
end;
$$;

-- Re-assert the Wave-1 containment ACL (CREATE OR REPLACE preserves grants; be
-- explicit so the service-role-only lockdown is provable from this migration).
revoke execute on function public.claim_due_notification_events(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_due_notification_events(timestamptz, integer) to service_role;
