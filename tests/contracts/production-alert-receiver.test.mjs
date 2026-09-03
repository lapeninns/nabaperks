import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
}

test("production deploy proves secrets, receiver status and signed paging", () => {
  const config = read("supabase/config.toml")
  const workflow = read(".github/workflows/production-deploy.yml")

  assert.match(config, /\[functions\.production-alert\]/)
  assert.match(config, /verify_jwt = false/)
  assert.match(workflow, /functions deploy production-alert/)
  assert.match(workflow, /--no-verify-jwt/)
  assert.match(workflow, /functions list/)
  assert.match(workflow, /\.status == "ACTIVE"/)
  for (const name of [
    "PRODUCTION_ALERT_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "RESEND_FROM",
  ]) {
    assert.match(workflow, new RegExp(name))
  }
  assert.match(workflow, /notify-production-alert\.mjs trigger release-canary/)
  assert.match(workflow, /notify-production-alert\.mjs resolve release-canary/)
})

test("receiver authenticates before parsing and never follows attacker URLs", () => {
  const core = read("supabase/functions/_shared/production-alert-core.mjs")
  const receiver = read("supabase/functions/production-alert/index.mjs")

  assert.ok(core.indexOf("expectedSignature(") < core.indexOf("JSON.parse("))
  assert.match(
    core,
    /github\\\.com\\\/lapeninns\\\/nabaperks\\\/actions\\\/runs/
  )
  assert.doesNotMatch(receiver, /fetch\(payload\.runUrl/)
  assert.doesNotMatch(receiver, /console\.(?:log|error)/)
  assert.match(receiver, /idempotency-key/)
  assert.match(core, /claim_failed/)
  assert.ok(core.indexOf("claimDelivery(") < core.indexOf("sendPage("))
})

test("database receipt functions are service-role-only and state changes follow paging", () => {
  const migration = read(
    "supabase/migrations/20260903130000_production_alert_receiver.sql"
  )

  assert.match(migration, /if not public\.is_service_role_request\(\)/)
  assert.match(migration, /pending_delivery_id/)
  assert.match(migration, /complete_production_alert_delivery/)
  assert.match(migration, /state = case v_delivery\.action/)
  assert.match(
    migration,
    /revoke all on function public\.claim_production_alert/
  )
  assert.match(migration, /grant execute .* to service_role/)
})
