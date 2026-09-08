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
  // A customer minted in this request cannot already hold a card, so the
  // returning-member lookup is skipped for them.
  assert.match(join, /if \(qrId && !resolution\.created\)/)
  assert.match(join, /joinRewardsAction/)
})

test("the session load RPC delegates to the device-bound touch and returns exactly the identity columns", () => {
  const migration = read(
    "supabase",
    "migrations",
    "20260909110000_customer_session_and_card_read_rpcs.sql"
  )
  const session = read("lib", "customer", "session.ts")
  const identity = read("lib", "customer", "identity.ts")

  // Session validity has one definition; the loader calls it, never copies it.
  assert.match(
    migration,
    /not public\.touch_customer_session\(p_customer_id, p_session_id, p_device_hash\)/
  )
  assert.doesNotMatch(
    migration,
    /create or replace function public\.touch_customer_session\(/
  )
  assert.doesNotMatch(
    migration,
    /create or replace function public\.register_customer_session/
  )
  assert.doesNotMatch(migration, /customer_otp_trusted_devices/)
  assert.match(migration, /is_service_role_request\(\)/)
  assert.match(
    migration,
    /grant execute on function public\.touch_customer_session_and_load\(uuid, uuid, text\)\s+to service_role;/
  )

  // The row the RPC returns is the row identity narrows: every column in
  // CUSTOMER_COLUMNS must be declared in the returns table.
  const columns = identity
    .match(/const CUSTOMER_COLUMNS =\s*"([^"]+)"/)[1]
    .split(",")
    .map((column) => column.trim())
  const returnsTable = migration.slice(
    migration.indexOf("returns table ("),
    migration.indexOf(")\nlanguage plpgsql")
  )
  for (const column of columns) {
    assert.match(returnsTable, new RegExp(`\\b${column} `), column)
  }

  // One touch per request: session.ts calls the merged RPC and keeps the
  // legacy touch only behind the missing-RPC fallback; identity reads the row
  // the touch returned instead of issuing its own select.
  assert.match(session, /\.rpc\(\s*"touch_customer_session_and_load"/)
  assert.ok(
    session.indexOf("isMissingRpcError(error)") <
      session.indexOf('.rpc("touch_customer_session",'),
    "the legacy touch is reachable only when the merged RPC is missing"
  )
  assert.match(session, /p_device_hash: deviceHash/)
  assert.match(identity, /resolveCustomerSession\(\)/)
  assert.match(identity, /toCurrentCustomer\(customer\.row\)/)
  const getCurrent = identity.slice(
    identity.indexOf("export const getCurrentCustomer"),
    identity.indexOf("async function loadCustomerById")
  )
  assert.doesNotMatch(getCurrent, /\.from\("customers"\)/)
})
