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

test("Given admin RPCs and RLS policies share the internal-admin helper When SQL is inspected Then authority requires trusted factor activation and step-up", () => {
  const expandMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260902120000_require_activated_admin_mfa.sql"
  )
  const enforcementMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260902120500_enforce_activated_admin_mfa.sql"
  )
  const passkeyMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260902120300_support_admin_passkey_step_up.sql"
  )
  const adminAuth = readProjectFile("lib", "admin", "auth.ts")

  assert.match(
    expandMigration,
    /create or replace function public\.is_internal_admin\(\)/
  )

  // Browser-reachable enrolment must never be enough to activate authority.
  // The exact verified factor is bound independently, and drift to multiple
  // verified factors fails closed before the session's AAL2 claim is accepted.
  assert.match(expandMigration, /factor\.id = admin\.mfa_factor_id/)
  assert.match(expandMigration, /factor\.user_id = admin\.user_id/)
  assert.match(passkeyMigration, /admin_webauthn_credentials/)
  assert.match(passkeyMigration, /admin_webauthn_grants/)
  assert.match(expandMigration, /factor\.status = 'verified'/)
  assert.match(expandMigration, /select count\(\*\)[\s\S]*= 1/)
  assert.match(passkeyMigration, /step_up\.expires_at > clock_timestamp\(\)/)
  assert.match(
    expandMigration,
    /auth_session\.factor_id = admin\.mfa_factor_id/
  )
  assert.match(expandMigration, /amr\.updated_at > admin\.mfa_activated_at/)
  assert.doesNotMatch(
    expandMigration,
    /not \(select public\.has_verified_mfa_factor/
  )

  // Expansion immediately closes old AAL1 authority while self-only enrolment
  // remains reachable. The contract migration is only a state precondition.
  assert.doesNotMatch(
    enforcementMigration,
    /create or replace function public\.is_internal_admin\(\)/
  )
  assert.match(
    enforcementMigration,
    /raise check_violation using[\s\S]*message = 'Active internal admins require independently activated MFA before enforcement'/
  )

  // The internal helpers stay off the authenticated EXECUTE allowlist.
  assert.match(
    expandMigration,
    /revoke all on function public\.has_activated_admin_mfa\(uuid\)[\s\S]*from public, anon, authenticated/
  )
  assert.match(expandMigration, /notify pgrst, 'reload schema'/)
  assert.match(enforcementMigration, /notify pgrst, 'reload schema'/)

  // The app mirrors the database authority decision before any service-role
  // read while retaining self-only Supabase-Auth factor enrolment.
  assert.match(adminAuth, /resolveAdminMfaStateFromFacts/)
  assert.doesNotMatch(adminAuth, /getAuthenticatorAssuranceLevel/)
  assert.match(adminAuth, /mfaAuthority/)
  assert.match(adminAuth, /supabase\.rpc\(\s*"is_internal_admin"/)
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

test("Given admin MFA removal When the server action is inspected Then a current grant gates an atomically audited identity mutation", () => {
  const actions = readProjectFile("app", "admin", "security", "actions.ts")
  const lifecycleMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260903132000_preserve_admin_passkey_step_up.sql"
  )
  const unenrollment = actions.slice(
    actions.indexOf("export async function unenrollAdminMfa")
  )

  assert.match(unenrollment, /adminMfaUnenrollmentAllowed\(access\.mfaState\)/)
  assertBefore(
    unenrollment,
    "adminMfaUnenrollmentAllowed(access.mfaState)",
    'supabase.rpc(\n    "revoke_viewer_admin_webauthn_credential"'
  )
  assertBefore(
    unenrollment,
    'supabase.rpc(\n    "revoke_viewer_admin_webauthn_credential"',
    'revalidatePath("/admin")'
  )
  assert.match(
    lifecycleMigration,
    /create or replace function public\.invalidate_admin_webauthn_binding/
  )
  assert.match(lifecycleMigration, /'admin_mfa_factor_unenrolled'/)
})
