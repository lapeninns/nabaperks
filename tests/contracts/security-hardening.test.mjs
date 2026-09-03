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

test("Given administrator MFA is an accepted risk When authority is inspected Then active membership remains the shared boundary", () => {
  const policyMigration = readProjectFile(
    "supabase",
    "migrations",
    "20260902120500_enforce_activated_admin_mfa.sql"
  )
  const adminAuth = readProjectFile("lib", "admin", "auth.ts")

  assert.match(
    policyMigration,
    /create or replace function public\.is_internal_admin\(\)/
  )
  assert.match(policyMigration, /admin\.user_id = auth\.uid\(\)/)
  assert.match(policyMigration, /and admin\.is_active/)
  assert.match(policyMigration, /security definer/)
  assert.match(policyMigration, /revoke all[\s\S]*from public, anon/)
  assert.doesNotMatch(policyMigration, /has_activated_admin_mfa/)
  assert.doesNotMatch(policyMigration, /request_has_post_activation_admin_mfa/)
  assert.match(policyMigration, /notify pgrst, 'reload schema'/)

  // The app keeps every RLS-bypassing service-role read behind the same
  // authenticated active-admin lookup, but deliberately does not demand a
  // second factor.
  assert.match(adminAuth, /\.from\("internal_admins"\)/)
  assert.match(adminAuth, /\.eq\("user_id", user\.id\)/)
  assert.match(adminAuth, /if \(!data\?\.is_active\)/)
  assert.match(adminAuth, /mfaRequired: false/)
  assert.match(
    adminAuth,
    /export async function requireAdminStepUp\(\)[\s\S]*return requireAdminRead\(\)/
  )
  assert.doesNotMatch(adminAuth, /viewer_has_activated_admin_mfa/)
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
