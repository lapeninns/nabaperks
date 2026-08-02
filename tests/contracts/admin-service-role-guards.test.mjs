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

test("Given admin read helpers use the service role When they create a client Then admin access is checked first", () => {
  const adminAuth = readProjectFile("lib", "admin", "auth.ts")
  const adminServiceRole = readProjectFile("lib", "admin", "service-role.ts")

  assert.match(adminAuth, /export async function requireAdminRead\(\)/)
  assert.match(adminAuth, /if \(!isAllowedAdminAccess\(access\)\)/)
  assert.match(adminAuth, /export async function canRenderAdminPage\(\)/)
  assert.match(adminAuth, /switch \(access\.status\)/)

  // The service-role client bypasses RLS, so the database-side assurance gate
  // in is_internal_admin() cannot see it. This factory must therefore demand
  // the step-up itself — requireAdminRead alone is not enough.
  assert.match(adminServiceRole, /import \{ requireAdminStepUp \}/)
  assert.match(adminServiceRole, /await requireAdminStepUp\(\)/)
  assert.doesNotMatch(adminServiceRole, /await requireAdminRead\(\)/)
  assert.match(adminServiceRole, /createSupabaseServiceRoleClient\(\)/)
})

test("Given the admin step-up gate When auth helpers are inspected Then privileged surfaces deny an unmet or indeterminate assurance level", () => {
  const adminAuth = readProjectFile("lib", "admin", "auth.ts")
  const mfaGate = readProjectFile("lib", "admin", "mfa-gate.ts")
  const securityActions = readProjectFile(
    "app",
    "admin",
    "security",
    "actions.ts"
  )

  // Enrolment state must be read from the database. supabase-js derives
  // nextLevel from the cached session cookie's factor list, so a session minted
  // before the factor was enrolled reports "no factor" and would pass the gate.
  assert.match(adminAuth, /viewer_has_verified_mfa_factor/)
  assert.match(adminAuth, /resolveAdminMfaStateFromFacts/)
  assert.doesNotMatch(adminAuth, /aal\.nextLevel/)

  // getAuthenticatorAssuranceLevel reports failure by returning
  // { data: null, error } — it does not throw — so the error must be read.
  assert.match(adminAuth, /error: aalError/)
  assert.match(adminAuth, /adminStepUpSatisfied\(access\.mfaState\)/)
  assert.match(mfaGate, /"unknown"/)

  // Indeterminate assurance must be recoverable, not a dead-end card.
  assert.match(adminAuth, /if \(mfaState === "unknown"\) \{\s*redirect\(/)

  // Enrolling a NEW factor is a credential-minting transition, so it cannot be
  // reachable from the very aal1 session the step-up is waiting on. Slice to
  // the NEXT export so a sibling function's copy cannot satisfy the assertion.
  assert.match(
    sliceExport(securityActions, "beginAdminMfaEnrollment"),
    /adminMfaEnrollmentAllowed\(access\.mfaState\)/
  )
  assert.match(
    sliceExport(securityActions, "verifyAdminMfaEnrollment"),
    /adminMfaEnrollmentAllowed\(access\.mfaState\)/
  )

  // Stepping up itself must stay on the read gate or it is unsatisfiable.
  const stepUp = sliceExport(securityActions, "stepUpAdminMfa")
  assert.match(stepUp, /await requireAdminRead\(\)/)
  assert.doesNotMatch(stepUp, /adminMfaEnrollmentAllowed/)
})

test("Given the admin layout and security page When inspected Then an indeterminate assurance level cannot strand an admin", () => {
  const layout = readProjectFile("app", "admin", "layout.tsx")
  const securityPage = readProjectFile("app", "admin", "security", "page.tsx")

  // A literal === "step-up-required" skips the "unknown" state, rendering the
  // full shell with every leaf page blanked and no step-up form anywhere.
  assert.match(layout, /adminMfaStepUpRequired\(access\.mfaState\)/)
  assert.doesNotMatch(layout, /mfaState === "step-up-required"/)

  // Deriving enrolment from `!== "no-factor"` shows the wrong panel.
  assert.match(securityPage, /access\.mfaEnrolled/)
  assert.doesNotMatch(securityPage, /mfaState !== "no-factor"/)
})

/** Source of one exported function, up to the next export. */
function sliceExport(source, name) {
  const start = source.indexOf(`export async function ${name}`)
  assert.notEqual(start, -1, `${name} is present`)
  const rest = source.slice(start + 1)
  const next = rest.indexOf("\nexport ")
  return next === -1 ? rest : rest.slice(0, next)
}

test("Given admin data modules are imported directly When source is inspected Then they do not bypass the admin service-role gate", () => {
  const guardedFiles = [
    ["lib", "admin", "data.ts"],
    ["lib", "admin", "billing-data.ts"],
    ["lib", "admin", "pilot-report.ts"],
    ["lib", "admin", "pilot-report-sources.ts"],
    ["lib", "analytics", "funnels.ts"],
  ]

  for (const filePath of guardedFiles) {
    const source = readProjectFile(...filePath)
    assert.match(source, /createAdminServiceRoleClient/)
    assert.doesNotMatch(source, /createSupabaseServiceRoleClient/)
  }
})

test("Given admin pages load service-role backed data When source is inspected Then page rendering is gated before loaders run", () => {
  const adminPages = [
    ["app", "admin", "page.tsx"],
    ["app", "admin", "audit", "page.tsx"],
    ["app", "admin", "billing", "page.tsx"],
    ["app", "admin", "customers", "page.tsx"],
    ["app", "admin", "fraud", "page.tsx"],
    ["app", "admin", "merchants", "page.tsx"],
    ["app", "admin", "pilot", "page.tsx"],
    ["app", "admin", "privacy", "page.tsx"],
  ]

  for (const filePath of adminPages) {
    const source = readProjectFile(...filePath)
    const gateIndex = source.indexOf("await canRenderAdminPage()")
    const loaderMatch = source.match(
      /await (?:Promise\.all\(\[)?\s*(?:getAdmin[A-Z]|getPilotFunnelCounts)/
    )

    assert.notEqual(
      gateIndex,
      -1,
      `${filePath.join("/")} is missing the admin page gate`
    )
    assert.ok(
      loaderMatch,
      `${filePath.join("/")} has no inspected admin loader`
    )
    assert.ok(
      gateIndex < loaderMatch.index,
      `${filePath.join("/")} loads admin data before the page gate`
    )
  }
})

test("Given admin billing reads provider identifiers When records reach the page Then Stripe ids are masked and statuses are formatted", () => {
  const data = readProjectFile("lib", "admin", "billing-data.ts")
  const redaction = readProjectFile("lib", "admin", "billing-redaction.ts")
  const page = readProjectFile("app", "admin", "billing", "page.tsx")

  assert.match(data, /type AdminBillingRecord/)
  assert.match(data, /toAdminBillingRecord/)
  assert.match(data, /maskStripeOperationalId\(row\.stripe_customer_id\)/)
  assert.match(data, /maskStripeOperationalId\(row\.stripe_subscription_id\)/)
  assert.match(data, /formatAdminBillingStatus\(row\.status\)/)
  assert.match(redaction, /case "past_due":/)
  assert.match(redaction, /tone: "warning"/)
  assert.match(redaction, /case "cancelled":/)
  assert.match(redaction, /tone: "danger"/)
  assert.match(page, /row\.stripeSubscriptionRef/)
  assert.match(page, /row\.stripeCustomerRef/)
  assert.match(page, /StatusPill tone=\{row\.statusTone\}/)
  assert.doesNotMatch(page, /stripe_subscription_id/)
  assert.doesNotMatch(page, /stripe_customer_id/)
})
