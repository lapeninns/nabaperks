import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const migration = readFileSync(
  "supabase/migrations/20260726102000_admin_unaffiliated_privacy_workflow.sql",
  "utf8"
)
const actions = readFileSync("app/admin/privacy/actions.ts", "utf8")
const panel = readFileSync(
  "app/admin/privacy/unaffiliated-customers-panel.tsx",
  "utf8"
)
const consentLog = readFileSync(
  "app/admin/privacy/consent-log-panel.tsx",
  "utf8"
)

test("unaffiliated privacy support uses additive customer-scoped RPCs", () => {
  assert.match(
    migration,
    /create or replace function public\.admin_log_unaffiliated_data_request/
  )
  assert.match(
    migration,
    /create or replace function public\.admin_record_unaffiliated_consent_opt_out/
  )
  assert.match(
    migration,
    /not exists \([\s\S]*public\.customer_memberships[\s\S]*for update/,
    "each action rechecks the unaffiliated scope while locking the customer"
  )
  assert.match(
    migration,
    /alter table public\.consent_records[\s\S]*merchant_id drop not null/
  )
  assert.match(migration, /'scope', 'account'/)
  assert.match(migration, /'unaffiliated', true/)
})

test("unaffiliated export, erasure and consent cover live customer data", () => {
  assert.match(migration, /'loyalty_invitations'/)
  assert.match(migration, /admin_erase_loyalty_invitations_for_customer/)
  assert.match(migration, /update public\.customer_sessions[\s\S]*revoked_at/)
  assert.match(
    migration,
    /update public\.push_subscriptions[\s\S]*enabled = false/
  )
  assert.match(
    migration,
    /update public\.notification_events[\s\S]*status = 'cancelled'/
  )
  assert.match(
    migration,
    /insert into public\.notification_preferences[\s\S]*marketing_enabled/
  )
  assert.match(consentLog, /Account-wide/)
})

test("unaffiliated RPC execution is revoke-then-allowlisted", () => {
  for (const signature of [
    "admin_record_unaffiliated_consent_opt_out",
    "admin_log_unaffiliated_data_request",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${signature}[\\s\\S]*from public, anon, authenticated, service_role`
      )
    )
    assert.match(
      migration,
      new RegExp(
        `grant execute on function public\\.${signature}[\\s\\S]*to authenticated, service_role`
      )
    )
  }
})

test("the unaffiliated admin record exposes scoped forms and downloads", () => {
  assert.match(panel, /Account privacy actions/)
  assert.match(panel, /privacyScope" value="unaffiliated"/)
  assert.match(panel, /recordUnaffiliatedConsentOptOutAction/)
  assert.match(panel, /logUnaffiliatedDataRequestAction/)
  assert.match(actions, /admin_record_unaffiliated_consent_opt_out/)
  assert.match(actions, /admin_log_unaffiliated_data_request/)
  assert.match(actions, /buildExportDownload\(data\)/)
})
