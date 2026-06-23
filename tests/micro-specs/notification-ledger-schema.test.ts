import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const migration = read(
  "supabase/migrations/20260622140000_notification_ledger_reward_expiry.sql"
)
const schemaRules = read("scripts/verify-supabase-schema-rules.mjs")
const sqlTest = read("supabase/tests/notification_ledger_reward_expiry.sql")

const notificationEvents = [
  "push_permission_prompt_viewed",
  "push_permission_granted",
  "push_subscription_created",
  "push_subscription_disabled",
  "push_subscription_failed",
  "one_stamp_away",
  "next_stamp_available",
  "reward_unlocked_waiting",
  "reward_ready",
  "profile_required_to_collect",
  "reward_expiring_soon",
  "reward_expired",
  "reward_collected_cycle_started",
  "dormant_progress",
  "venue_announcement",
]

describe("browser push notification ledger schema", () => {
  it("adds durable event and delivery tables with forced RLS", () => {
    for (const table of ["notification_events", "notification_deliveries"]) {
      expect(migration).toContain(`create table if not exists public.${table}`)
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      )
      expect(migration).toContain(
        `alter table public.${table} force row level security`
      )
      expect(migration).toContain(
        `create policy ${table}_select_customer_or_admin`
      )
    }

    expect(migration).toContain("event_type text not null")
    expect(migration).toContain("category text not null")
    expect(migration).toContain("dedupe_key text not null")
    expect(migration).toContain("notification_events_dedupe_key_idx")
    expect(migration).toContain("prevent_notification_delivery_mutation")
    expect(migration).toContain("function public.merchant_can_access_customer(")
    expect(migration).toContain("target_merchant_id uuid")
    expect(migration).toContain("target_customer_id uuid")
  })

  it("covers every planned event type without turning product_events into the source of truth", () => {
    for (const event of notificationEvents) {
      expect(migration).toContain(event)
    }

    expect(migration).toContain("function public.enqueue_notification_event")
    expect(migration).toContain("function public.record_notification_delivery")
    expect(migration).toContain("function public.notification_event_category")
    expect(migration).not.toContain("from public.product_events")
  })

  it("is wired into static schema verification and SQL evidence", () => {
    expect(schemaRules).toContain('"notification_events"')
    expect(schemaRules).toContain('"notification_deliveries"')
    expect(schemaRules).toContain('"enqueue_notification_event"')
    expect(schemaRules).toContain('"record_notification_delivery"')

    expect(sqlTest).toContain("notification_ledger_reward_expiry_fixture")
    expect(sqlTest).toContain("duplicate enqueue reuses one event")
    expect(sqlTest).toContain("delivery attempts are append-only")
  })
})

function read(path: string) {
  return readFileSync(path, "utf8")
}
