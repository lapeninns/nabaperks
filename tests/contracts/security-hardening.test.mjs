import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

function assertBefore(source, earlier, later) {
  const earlierIndex = source.indexOf(earlier)
  const laterIndex = source.indexOf(later)

  assert.notEqual(earlierIndex, -1, `${earlier} is present`)
  assert.notEqual(laterIndex, -1, `${later} is present`)
  assert.ok(earlierIndex < laterIndex, `${earlier} appears before ${later}`)
}

test("Given admin RPCs and RLS policies share the internal-admin helper When SQL is inspected Then the final DB gate requires AAL2", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260728100000_require_admin_aal2.sql"
  )
  const adminAuth = readProjectFile("lib", "admin", "auth.ts")

  assert.match(
    migration,
    /create or replace function public\.is_internal_admin\(\)/
  )
  assert.match(migration, /=\s*'aal2'/)
  assert.match(
    migration,
    /grant execute on function public\.is_internal_admin\(\) to authenticated, service_role/
  )
  assert.match(migration, /notify pgrst, 'reload schema'/)

  assert.match(adminAuth, /mfaState\s*=\s*"unavailable"/)
  assert.match(adminAuth, /access\.mfaState\s*!==\s*"satisfied"/)
})

test("Given the customer export RPC When later customer tables are added Then coverage expands without changing its signature or exporting secrets", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260728101000_expand_customer_export_coverage.sql"
  )

  assert.match(
    migration,
    /create function public\.admin_export_customer_data\(\s*p_customer_id uuid,\s*p_merchant_id uuid,\s*p_channel text,\s*p_notes text/
  )
  for (const key of [
    "notification_preferences",
    "customer_sessions",
    "loyalty_terms_acceptances",
    "push_subscriptions",
    "notification_deliveries",
    "referrals",
  ]) {
    assert.match(migration, new RegExp(`'${key}'`))
  }
  assert.match(
    migration,
    /grant execute on function public\.admin_export_customer_data\(uuid, uuid, text, text\)[\s\S]*to authenticated, service_role/
  )
  assert.match(
    migration,
    /revoke all on function public\.admin_export_customer_data_base_v1\(uuid, uuid, text, text\)[\s\S]*from public, anon, authenticated, service_role/
  )
  assert.doesNotMatch(migration, /^\s+(endpoint|p256dh|auth),$/m)
  assert.doesNotMatch(migration, /^\s+referral_code_used,$/m)
  assert.doesNotMatch(migration, /^\s+(referrer|referred)_customer_id,$/m)
})

test("Given customer OTP send flows When actions are inspected Then send limits include a phone-only bucket before provider dispatch", () => {
  for (const actionPath of [
    ["app", "m", "[merchantSlug]", "join", "actions.ts"],
    ["app", "home", "actions.ts"],
  ]) {
    const actions = readProjectFile(...actionPath)

    assert.match(actions, /enforceCustomerOtpSendRateLimit/)
    assertBefore(
      actions,
      "await enforceCustomerOtpSendRateLimit",
      "await startCustomerPhoneVerification(contact)"
    )
    assert.doesNotMatch(
      actions,
      /customer-(?:identity|login):\$\{contact\.toLowerCase\(\)\}:\$\{requestIdentity\}/
    )
  }
})

test("Given customer OTP verification flows When actions are inspected Then guess attempts are limited before provider verification", () => {
  for (const actionPath of [
    ["app", "m", "[merchantSlug]", "join", "actions.ts"],
    ["app", "home", "actions.ts"],
  ]) {
    const actions = readProjectFile(...actionPath)

    assert.match(actions, /enforceCustomerOtpVerifyRateLimit/)
    assertBefore(
      actions,
      "await enforceCustomerOtpVerifyRateLimit",
      "await checkCustomerPhoneVerification(contact, otp)"
    )
  }
})

test("Given admin MFA removal When the server action is inspected Then AAL2 and durable audit evidence precede the identity mutation", () => {
  const actions = readProjectFile("app", "admin", "security", "actions.ts")
  const unenrollment = actions.slice(
    actions.indexOf("export async function unenrollAdminMfa")
  )

  assert.match(unenrollment, /adminMfaUnenrollmentAllowed\(access\.mfaState\)/)
  assert.match(unenrollment, /actor_id: access\.userId/)
  assertBefore(
    unenrollment,
    'action: "admin_mfa_unenrollment_authorised"',
    "supabase.auth.mfa.unenroll"
  )
  assertBefore(
    unenrollment,
    "supabase.auth.mfa.unenroll",
    'revalidatePath("/admin")'
  )
  assertBefore(
    unenrollment,
    'revalidatePath("/admin/audit")',
    'action: "admin_mfa_factor_unenrolled"'
  )
})
