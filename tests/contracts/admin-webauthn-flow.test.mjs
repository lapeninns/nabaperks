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

test("admin enrolment uses WebAuthn with required user verification", () => {
  const implementation = readProjectFile("lib", "admin", "webauthn-mfa.ts")
  const panel = readProjectFile("components", "admin", "mfa-panel.tsx")

  assert.match(implementation, /factorType: "webauthn"/)
  assert.match(
    implementation,
    /authenticatorSelection = \{[\s\S]*userVerification: "required"/
  )
  assert.match(implementation, /publicKey\.userVerification = "required"/)
  assert.match(implementation, /removeUnverifiedFactor/)
  assert.match(panel, /await authorizeAdminMfaEnrollment\(\)/)
  assert.match(
    panel,
    /await registerAdminWebAuthnFactor\([\s\S]*getSupabaseBrowserClient\(\)/
  )
  assert.doesNotMatch(panel, /qrCode|secret|6-digit|authenticator app/i)
})

test("step-up accepts exactly one verified WebAuthn factor", () => {
  const implementation = readProjectFile("lib", "admin", "webauthn-mfa.ts")
  const page = readProjectFile("app", "admin", "security", "page.tsx")

  assert.match(implementation, /factors\.data\?\.webauthn\.length !== 1/)
  assert.match(
    implementation,
    /const factorId = factors\.data\.webauthn\[0\]\.id/
  )
  assert.match(page, /data\?\.webauthn\?\.\[0\]\?\.id/)
  assert.doesNotMatch(page, /data\?\.totp/)
})
