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

test("existing phone OTP reaches one shared continuity boundary before session minting", () => {
  const wallet = read("app", "home", "actions.ts")
  const join = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  const boundary = read("lib", "customer", "access-continuity.ts")

  for (const source of [wallet, join]) {
    assert.match(source, /establishCustomerSessionAfterVerifiedPhone/)
    assert.doesNotMatch(source, /setCustomerSession\(/)
  }
  assert.match(
    boundary,
    /customerWasCreated[\s\S]*"new_identity"[\s\S]*customerDeviceIsRecognised[\s\S]*"recognised_device"[\s\S]*REQUIRE_DEVICE_CONTINUITY[\s\S]*startCustomerAccessRecovery[\s\S]*setCustomerSession\(customer\.id, "verified_phone"\)/
  )
  assert.match(join, /customerWasCreated: resolution\.created/)
  assert.match(join, /step: "terms"/)
})

test("device continuity is disabled: a verified phone OTP alone opens an existing wallet on any device", () => {
  const boundary = read("lib", "customer", "access-continuity.ts")

  assert.match(boundary, /SEC-RISK-001 is deliberately reopened/)
  assert.match(boundary, /const REQUIRE_DEVICE_CONTINUITY: boolean = false/)
  assert.match(boundary, /setCustomerSession\(customer\.id, "verified_phone"\)/)
})

test("the dormant email recovery journey stays intact behind the disabled gate", () => {
  const recovery = read("lib", "customer", "access-continuity.ts")
  const action = read("app", "home", "recover", "actions.ts")

  assert.match(
    recovery,
    /customer\.email\?\.trim\(\) && customer\.emailVerifiedAt/
  )
  assert.match(recovery, /emailHmac: null,[\s\S]*codeHmac: null/)
  assert.match(
    recovery,
    /recoveryChannelStillMatches[\s\S]*customer\.email_verified_at/
  )
  assert.match(recovery, /recoveryPhoneStillMatches/)
  assert.match(
    action,
    /setCustomerSession\([\s\S]*result\.customerId,[\s\S]*"verified_email",[\s\S]*result\.sessionId/
  )
  assert.doesNotMatch(recovery, /formData|submittedEmail|input\.email/)
})

test("customer sessions are device-bound and legacy unbound entry points are retired", () => {
  const migration = read(
    "supabase",
    "migrations",
    "20260903120000_require_customer_access_continuity.sql"
  )

  assert.match(
    migration,
    /update public\.customer_sessions[\s\S]*revoked_at[\s\S]*where device_hash is null/
  )
  assert.match(
    migration,
    /update public\.customer_otp_trusted_devices[\s\S]*where trust_source in \('verified_otp', 'active_session'\)/
  )
  assert.match(
    migration,
    /drop function if exists public\.register_customer_session\([\s\S]*timestamptz[\s\S]*\);/
  )
  assert.match(
    migration,
    /device_hash = p_device_hash[\s\S]*revoked_at is null/
  )
  assert.match(migration, /customer_auth_device_is_trusted/)
  assert.match(
    migration,
    /device\.trust_source in \([\s\S]*'new_identity'[\s\S]*'verified_email'[\s\S]*'recognised_device'/
  )
  assert.match(migration, /p_continuity_source = 'new_identity'/)
  assert.match(migration, /p_continuity_source = 'verified_email'/)
  assert.doesNotMatch(migration, /qr_codes|stamp_events|reward_events/)
})

test("phone-only continuity is accepted by the RPC without widening device trust", () => {
  const relaxation = read(
    "supabase",
    "migrations",
    "20260908120000_allow_verified_phone_continuity.sql"
  )

  assert.match(
    relaxation,
    /p_continuity_source not in \([\s\S]*'verified_phone'[\s\S]*\) then/
  )
  assert.match(
    relaxation,
    /p_continuity_source = 'verified_phone' then[\s\S]*continuity_is_valid := true/
  )
  assert.match(
    relaxation,
    /customer_otp_trusted_devices_source_check[\s\S]*'verified_phone'/
  )
  assert.doesNotMatch(
    relaxation,
    /create or replace function public\.customer_auth_device_is_trusted/
  )
  assert.match(relaxation, /notify pgrst, 'reload schema';/)
})

test("static QR and customer loyalty routes remain outside the continuity patch", () => {
  const qr = read("app", "q", "[qrId]", "page.tsx")
  const join = read("app", "m", "[merchantSlug]", "join", "actions.ts")

  assert.match(qr, /resolveQrForJoin/)
  assert.match(qr, /getExistingMembershipForCurrentUser/)
  assert.match(qr, /\/card\/\$\{membership\.id\}\/stamp\?qr=/)
  assert.match(qr, /buildCustomerJoinHref/)
  assert.match(join, /destinationForReturningQrVisit/)
  assert.match(join, /joinRewardsAction/)
})
