import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(path, "utf8")

test("commercial evidence is ledger-derived, approval-gated and audited", () => {
  const migration = read(
    "supabase/migrations/20260731140000_commercial_growth_systems.sql"
  )
  const publicLoader = read("lib/marketing/commercial-evidence.ts")

  assert.match(migration, /commercial_evidence_cases/)
  assert.match(migration, /normal-return-visits-v1/)
  assert.match(migration, /extensions\.digest/)
  assert.match(migration, /stamp_events_commercial_evidence_idx/)
  assert.match(migration, /merchant_approved_at is not null/)
  assert.match(migration, /commercial_evidence_published/)
  assert.match(
    migration,
    /grant select on table public\.commercial_evidence_cases[\s\S]*?to authenticated, service_role;/
  )
  assert.match(
    migration,
    /admin_capture_commercial_evidence_case\([\s\S]*?\) to authenticated, service_role;/
  )
  assert.match(publicLoader, /\.eq\("status", "published"\)/)
  assert.doesNotMatch(publicLoader, /source_reference|approval_reference/)
})

test("merchant cancellation records an interview before direct Stripe cancellation", () => {
  const migration = read(
    "supabase/migrations/20260731140000_commercial_growth_systems.sql"
  )
  const actions = read("app/app/billing/actions.ts")
  const panel = read("components/merchant/account/billing-panel-view.tsx")

  assert.match(migration, /merchant_cancellation_interviews/)
  assert.match(migration, /merchant_cancellation_interview_recorded/)
  assert.match(
    migration,
    /grant select on table public\.merchant_cancellation_interviews[\s\S]*?to authenticated, service_role;/
  )
  assert.match(
    migration,
    /record_merchant_cancellation_interview\([\s\S]*?\) to authenticated, service_role;/
  )
  assert.match(actions, /record_merchant_cancellation_interview/)
  assert.match(actions, /type: "payment_method_update"/)
  assert.match(actions, /type: "subscription_cancel"/)
  assert.ok(
    actions.indexOf('type: "payment_method_update"') <
      actions.indexOf("submitCancellationInterviewAction")
  )
  assert.ok(
    actions.indexOf('type: "subscription_cancel"') >
      actions.indexOf("submitCancellationInterviewAction")
  )
  assert.match(panel, /Review cancellation options/)
})

test("merchant terms specify the ROI start, claim window and both billing remedies", () => {
  const facts = read("lib/marketing/facts.ts")
  const legal = read("lib/legal/content.ts")

  assert.match(facts, /The 90 days start/)
  assert.match(facts, /day 90 through day 104/)
  assert.match(legal, /id: "roi-extension"/)
  assert.match(legal, /next three renewal invoices/)
  assert.match(legal, /refunds £209\.97/)
  assert.match(legal, /within 10 calendar days/)
})
