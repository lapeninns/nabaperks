-- Hot-path indexes for customer_memberships (+ a small admin-list index).
--
-- customer_memberships was the one high-traffic table left with only the two
-- single-column FK indexes (customer_id, merchant_id) from the initial schema,
-- while every sibling event table (stamp_events, reward_events, product_events)
-- already got composite/partial coverage in 20260615150000_performance_indexes.
-- These back the reads that grow with a venue's success:
--
--   1. merchant dashboard "new members" range counts + the member roster ordered
--      newest-first: .eq(merchant_id).order(created_at desc) and created_at
--      COUNT windows in lib/merchant/dashboard-metrics.ts / dashboard.ts.
--   2. dashboard "repeat visit %": .eq(merchant_id).gt(total_stamps_earned, 1)
--      (get_merchant_dashboard_metrics + countRepeatCustomers).
--   3. notification worker producers scanning current_stamp_count > 0 (and the
--      dormant-progress updated_at <= cutoff) in lib/notifications/delivery-worker.ts,
--      which today sequentially scan the whole table each tick.
--
-- All are CREATE INDEX IF NOT EXISTS so the migration stays idempotent and
-- re-runnable, matching the existing performance-index migration's style.

create index if not exists customer_memberships_merchant_created_at_idx
  on public.customer_memberships (merchant_id, created_at desc);

create index if not exists customer_memberships_merchant_repeat_idx
  on public.customer_memberships (merchant_id, total_stamps_earned);

create index if not exists customer_memberships_active_progress_idx
  on public.customer_memberships (updated_at)
  where current_stamp_count > 0;

-- Admin merchant list orders every merchant newest-first
-- (lib/admin/data.ts, lib/admin/pilot-report.ts). Cheap to cover now.
create index if not exists merchants_created_at_idx
  on public.merchants (created_at desc);
