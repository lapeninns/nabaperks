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

test("Given admin RPCs and RLS policies share the internal-admin helper When SQL is inspected Then admin access is active-row only without AAL2", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260720100000_remove_admin_aal2_requirement.sql"
  )
  const adminAuth = readProjectFile("lib", "admin", "auth.ts")

  assert.match(
    migration,
    /create or replace function public\.is_internal_admin\(\)/
  )
  assert.doesNotMatch(migration, /=\s*'aal2'/)
  assert.match(migration, /notify pgrst, 'reload schema'/)
  assert.match(
    adminAuth,
    /export function isAdminMfaRequired[\s\S]*return false/
  )
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
