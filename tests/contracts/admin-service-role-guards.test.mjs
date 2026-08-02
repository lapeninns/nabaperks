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
  assert.match(adminServiceRole, /import \{ requireAdminRead \}/)
  assert.match(adminServiceRole, /await requireAdminRead\(\)/)
  assert.match(adminServiceRole, /createSupabaseServiceRoleClient\(\)/)
})

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

test("Given billing pagination selects merchants When fulfilments load Then the query follows those merchant ids", () => {
  const data = readProjectFile("lib", "admin", "billing-data.ts")

  assert.match(data, /const merchantIds = billingRows\.map/)
  assert.match(data, /if \(merchantIds\.length === 0\) return \[\]/)
  assert.match(data, /\.in\("merchant_id", merchantIds\)/)

  const fulfilmentQuery = data.match(
    /\.from\("merchant_launch_fulfilments"\)([\s\S]*?)if \(fulfilmentResult\.error\)/
  )?.[1]
  assert.ok(fulfilmentQuery)
  assert.doesNotMatch(fulfilmentQuery, /\.limit\(/)
})
