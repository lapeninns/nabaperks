-- db integrity hardening: make impossible states unrepresentable, index
-- the erase/cascade FK paths, purge the one unbounded-growth table, and
-- retire the last NOT VALID constraint (2026-07-06 schema audit).
--
--   * reward_events / notification_events status⇒timestamp coherence was
--     maintained only by RPC convention; now CHECK-enforced (one-way
--     implications only — redeemed_at may legitimately outlive a later
--     admin cancellation, so timestamp⇒status is deliberately NOT
--     constrained).
--   * Nine FK columns had no supporting index (Postgres never auto-indexes
--     FKs), so customer-erasure and cascade paths seq-scanned.
--   * rate_limit_buckets had no delete path: per-IP/per-email keys accumulate
--     forever. purge_stale_rate_limit_buckets removes buckets whose window
--     ended over 24h ago (in-flight windows untouchable by construction);
--     the daily privacy-retention cron calls it.
--   * push_subscriptions_allowed_endpoint_check was NOT VALID since creation;
--     nonconforming rows (undeliverable dead weight) are deleted, then the
--     constraint is validated. Delivery history survives via SET NULL.
--
-- Idempotent: repairs are coalesce/no-op on re-run, constraint adds are
-- guarded, VALIDATE is a no-op once valid, index creates are IF NOT EXISTS.

-- 1) Repair pass for legacy incoherent rows (expected zero; prod-safe).

update public.reward_events
set redeemed_at = updated_at
where status = 'redeemed' and redeemed_at is null;

update public.reward_events
set expired_at = updated_at
where status = 'expired' and expired_at is null;

update public.reward_events
set cancelled_reason = 'unrecorded (backfilled 2026-07-07)'
where status = 'cancelled' and cancelled_reason is null;

update public.notification_events
set sent_at = updated_at
where status = 'sent' and sent_at is null;

update public.notification_events
set cancelled_at = updated_at
where status = 'cancelled' and cancelled_at is null;

-- 2) Coherence checks: add NOT VALID, then VALIDATE.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reward_events_redeemed_coherent') then
    alter table public.reward_events
      add constraint reward_events_redeemed_coherent
      check (status <> 'redeemed' or redeemed_at is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reward_events_expired_coherent') then
    alter table public.reward_events
      add constraint reward_events_expired_coherent
      check (status <> 'expired' or expired_at is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reward_events_cancelled_coherent') then
    alter table public.reward_events
      add constraint reward_events_cancelled_coherent
      check (status <> 'cancelled' or cancelled_reason is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_events_sent_coherent') then
    alter table public.notification_events
      add constraint notification_events_sent_coherent
      check (status <> 'sent' or sent_at is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notification_events_cancelled_coherent') then
    alter table public.notification_events
      add constraint notification_events_cancelled_coherent
      check (status <> 'cancelled' or cancelled_at is not null) not valid;
  end if;
end
$$;

alter table public.reward_events validate constraint reward_events_redeemed_coherent;
alter table public.reward_events validate constraint reward_events_expired_coherent;
alter table public.reward_events validate constraint reward_events_cancelled_coherent;
alter table public.notification_events validate constraint notification_events_sent_coherent;
alter table public.notification_events validate constraint notification_events_cancelled_coherent;

-- 3) FK support indexes (partial on nullable columns).

create index if not exists fraud_flags_customer_id_idx
  on public.fraud_flags (customer_id) where customer_id is not null;
create index if not exists fraud_flags_membership_id_idx
  on public.fraud_flags (membership_id) where membership_id is not null;
create index if not exists notification_events_merchant_id_idx
  on public.notification_events (merchant_id) where merchant_id is not null;
create index if not exists notification_events_membership_id_idx
  on public.notification_events (membership_id) where membership_id is not null;
create index if not exists reward_scan_tokens_membership_id_idx
  on public.reward_scan_tokens (membership_id);
create index if not exists reward_scan_tokens_consumed_by_merchant_id_idx
  on public.reward_scan_tokens (consumed_by_merchant_id) where consumed_by_merchant_id is not null;
create index if not exists pending_reward_invites_attached_customer_id_idx
  on public.pending_reward_invites (attached_customer_id) where attached_customer_id is not null;
create index if not exists pending_reward_invites_attached_membership_id_idx
  on public.pending_reward_invites (attached_membership_id) where attached_membership_id is not null;
create index if not exists pending_reward_invites_attached_reward_event_id_idx
  on public.pending_reward_invites (attached_reward_event_id) where attached_reward_event_id is not null;

-- 4) Stale rate-limit bucket purge (called by the privacy-retention cron).

create or replace function public.purge_stale_rate_limit_buckets(p_now timestamp with time zone default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.rate_limit_buckets
  where reset_at < p_now - interval '24 hours';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_stale_rate_limit_buckets(timestamp with time zone) from public;
grant execute on function public.purge_stale_rate_limit_buckets(timestamp with time zone) to service_role;

-- 5) Retire the NOT VALID remnant on the push endpoint allowlist.

delete from public.push_subscriptions
where not public.is_allowed_web_push_endpoint(endpoint);

alter table public.push_subscriptions validate constraint push_subscriptions_allowed_endpoint_check;
