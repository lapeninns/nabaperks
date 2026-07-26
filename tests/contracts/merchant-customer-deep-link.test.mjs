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

test("member paging uses a stable order and resolves unpaged activity deep links", () => {
  const dashboard = read("lib", "merchant", "dashboard.ts")
  const page = read("app", "app", "customers", "page.tsx")

  assert.match(
    dashboard,
    /\.order\("created_at", \{ ascending: false \}\)\s*\.order\("id", \{ ascending: false \}\)/
  )
  assert.match(dashboard, /export async function getMerchantCustomerPage/)
  assert.match(page, /getMerchantCustomerPage/)
  assert.match(page, /if \(!requestedPage && highlightedMembershipId\)/)
  assert.match(page, /redirect\(\s*customersHighlightHref/)
})

test("member deep-link page resolution remains merchant scoped and non-disclosing", () => {
  const dashboard = read("lib", "merchant", "dashboard.ts")

  assert.match(
    dashboard,
    /\.eq\("merchant_id", merchantId\)\s*\.eq\("id", membershipId\)/
  )
  assert.match(dashboard, /if \(!target\) return null/)
})
