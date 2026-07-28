import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const migration = readFileSync(
  "supabase/migrations/20260726100000_admin_fraud_terminal_idempotency.sql",
  "utf8"
)
const panel = readFileSync("app/admin/fraud/fraud-flags-panel.tsx", "utf8")
const aclRepair = readFileSync(
  "supabase/migrations/20260726101000_restore_admin_fraud_service_role_execute.sql",
  "utf8"
)

test("admin fraud reviews are terminal and retry-safe", () => {
  assert.match(migration, /flag_record\.status <> 'open'/)
  assert.match(
    migration,
    /flag_record\.status = p_status[\s\S]*return;/,
    "same-status retries are no-ops"
  )
  assert.match(migration, /Fraud flag is already resolved/)
  assert.match(
    migration,
    /revoke all on function public\.admin_resolve_fraud_flag\(uuid, text, text\)[\s\S]*from public, anon, authenticated, service_role/
  )
  assert.match(
    migration,
    /grant execute on function public\.admin_resolve_fraud_flag\(uuid, text, text\)[\s\S]*to authenticated/
  )
  assert.match(
    aclRepair,
    /grant execute on function public\.admin_resolve_fraud_flag\(uuid, text, text\)[\s\S]*to service_role/,
    "the later append-only repair preserves service-role execution"
  )
})

test("resolved fraud flags no longer render mutation controls", () => {
  assert.match(panel, /flag\.status === "open"/)
  assert.match(panel, /Review complete/)
})
