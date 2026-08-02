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

test("Given admin RPCs and RLS policies share the internal-admin helper When SQL is inspected Then the DB gate requires step-up only from enrolled admins", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260801120000_admin_assurance_boundary.sql"
  )
  const adminAuth = readProjectFile("lib", "admin", "auth.ts")

  assert.match(
    migration,
    /create or replace function public\.is_internal_admin\(\)/
  )

  // The gate must be conditional on enrolment. A DB-level AAL2 requirement
  // that ignored enrolment (20260702180000) locked out every admin, because
  // password sign-in is aal1 — 20260720100000 had to revert it. Requiring a
  // verified factor before demanding aal2 is what makes this safe to re-add.
  assert.match(migration, /has_verified_mfa_factor/)
  assert.match(migration, /=\s*'aal2'/)
  assert.match(migration, /not \(select public\.has_verified_mfa_factor/)

  // The assurance claim must degrade to aal1, never to "stepped up".
  assert.match(migration, /'aal1'\s*\);/)

  // The internal helpers stay off the authenticated EXECUTE allowlist.
  assert.match(
    migration,
    /revoke all on function public\.request_assurance_level\(\) from public, anon, authenticated/
  )
  assert.match(migration, /notify pgrst, 'reload schema'/)

  // The app layer still owns what the database cannot see (service-role reads
  // and Supabase-Auth factor enrolment).
  assert.match(adminAuth, /getAuthenticatorAssuranceLevel|resolveAdminMfaState/)
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
