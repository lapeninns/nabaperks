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

test("admin ceremonies use the fixed-origin server verifier with required user verification", () => {
  const browser = read("lib", "admin", "webauthn-mfa.ts")
  const edge = read("supabase", "functions", "admin-webauthn", "index.ts")

  assert.match(browser, /functions\.invoke\("admin-webauthn"/)
  assert.match(browser, /startRegistration/)
  assert.match(browser, /startAuthentication/)
  assert.doesNotMatch(browser, /supabase\.auth\.mfa/)
  assert.match(edge, /userVerification: "required"/)
  assert.match(edge, /requireUserVerification: true/)
  assert.match(edge, /advancedFIDOConfig: \{ userVerification: "required" \}/)
  assert.match(edge, /expectedOrigin: record\.origin/)
  assert.match(edge, /expectedRPID: RP_ID/)
})

test("dormant step-up remains isolated while the security page offers no enrolment", () => {
  const migration = read(
    "supabase",
    "migrations",
    "20260902120300_support_admin_passkey_step_up.sql"
  )
  const page = read("app", "admin", "security", "page.tsx")

  assert.match(migration, /admin_webauthn_one_live_credential/)
  assert.match(migration, /grant_admin_webauthn_session/)
  assert.match(
    migration,
    /step_up\.session_id = public\.request_auth_session_id\(\)/
  )
  assert.match(migration, /step_up\.credential_id = credential\.id/)
  assert.match(page, /Additional verification is not required/)
  assert.doesNotMatch(page, /AdminMfaPanel/)
  assert.doesNotMatch(page, /viewer_admin_webauthn_credential_id/)
  assert.doesNotMatch(page, /auth\.mfa\.listFactors/)
})

test("operator UI and rollout guidance record WebAuthn as dormant under the accepted-risk policy", () => {
  const shell = read("components", "layout", "admin-shell.tsx")
  const runbook = read("docs", "operations", "production-runbook.md")
  const section =
    runbook.match(
      /### Administrator authentication policy([\s\S]*?)### Passwordless Auth configuration sequencing/
    )?.[1] ?? ""

  assert.match(shell, /Admin verified/)
  assert.doesNotMatch(shell, /AAL2 verified/)
  assert.match(section, /MFA is an explicitly accepted product risk/)
  assert.match(
    section,
    /neither a passkey nor another second factor is required/
  )
  assert.match(section, /active `internal_admins` row/)
  assert.match(
    section,
    /WebAuthn tables and verifier may remain deployed as dormant/
  )
  assert.doesNotMatch(
    section,
    /run the bootstrap or activation workflows as a prerequisite/
  )
})
