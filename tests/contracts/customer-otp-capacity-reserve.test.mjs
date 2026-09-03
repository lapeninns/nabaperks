import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const read = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

test("recognised devices bypass only the anonymous allocation, never the hard ceiling", () => {
  const source = read("lib", "customer", "otp-rate-limit.ts")
  const migration = read(
    "supabase",
    "migrations",
    "20260902137000_reserve_customer_otp_capacity.sql"
  )

  assert.match(source, /admit_customer_otp_dispatch/)
  assert.match(migration, /if not v_trusted then[\s\S]*120,[\s\S]*else/)
  assert.match(migration, /:total:burst:v2'[\s\S]*30,[\s\S]*60000/)
  assert.match(migration, /:total:sustained:v2'[\s\S]*150,[\s\S]*3600000/)
  assert.match(migration, /:recognised-hour:v2'[\s\S]*3,[\s\S]*3600000/)
  assert.match(source, /customer_otp_dispatch_capacity_exhausted/)
  assert.match(source, /return false/)
})

test("device trust is created only by verified session issuance or an active session", () => {
  const migration = read(
    "supabase",
    "migrations",
    "20260902137000_reserve_customer_otp_capacity.sql"
  )
  const session = read("lib", "customer", "session.ts")
  const proxy = read("proxy.ts")

  assert.match(migration, /'verified_otp'/)
  assert.match(migration, /'active_session'/)
  assert.match(migration, /admit_customer_otp_dispatch/)
  assert.match(migration, /trusted_at <= now\(\) - interval '7 days'/)
  assert.match(migration, /from public\.customer_memberships membership/)
  assert.match(migration, /after update of phone_hmac/)
  assert.match(session, /p_device_hash: deviceHash/)
  assert.match(proxy, /requestHeaders\.delete\(CUSTOMER_DEVICE_HEADER\)/)
})

test("capacity refusal is neutral and skips provider work on both public paths", () => {
  for (const segments of [
    ["app", "home", "actions.ts"],
    ["app", "m", "[merchantSlug]", "join", "actions.ts"],
  ]) {
    const action = read(...segments)
    const admission = action.indexOf("const admitted =")
    const provider = action.indexOf("startCustomerPhoneVerification(contact)")
    assert.ok(admission >= 0 && provider > admission)
    assert.match(action.slice(admission, provider + 80), /if \(admitted\)/)
    assert.doesNotMatch(
      action.slice(admission, provider),
      /Too many (?:sign-in|verification) requests/
    )
  }
})

test("static QR authority and route implementation are outside the capacity patch", () => {
  const migration = read(
    "supabase",
    "migrations",
    "20260902137000_reserve_customer_otp_capacity.sql"
  )
  assert.doesNotMatch(migration, /qr_codes|stamp_events|add_stamp_by_qr/)
})
