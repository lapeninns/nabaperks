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

test("complimentary merchant billing bypasses provider reconciliation but preserves safe readback", () => {
  const panel = readProjectFile(
    "components",
    "merchant",
    "account",
    "billing-panel.tsx"
  )

  assert.match(panel, /merchant\.requires_billing !== false/)
  assert.match(panel, /if \(!requiresBilling\)/)
  assert.match(panel, /await getMerchantBilling\(merchant\.id\)/)
  assert.match(panel, /requiresBilling=\{requiresBilling\}/)
  assert.match(panel, /cleanupOutcomeQuery=\{cleanupOutcomeQuery\}/)

  const launchPage = readProjectFile("app", "app", "launch", "page.tsx")
  assert.match(
    launchPage,
    /merchant\.requires_billing !== false && params\.checkout === "success"/
  )
})

test("complimentary merchant billing is generic, launch-neutral, and cleans return params", () => {
  const view = readProjectFile(
    "components",
    "merchant",
    "account",
    "billing-panel-view.tsx"
  )

  assert.match(view, /requiresBilling\?: boolean/)
  assert.match(view, /if \(!requiresBilling\)/)
  assert.match(view, /Complimentary access/)
  assert.match(view, /No new card or Stripe subscription is required/)
  assert.match(view, /Billing access is active/)
  assert.doesNotMatch(view, /Lapen Inns owner access/)
  assert.doesNotMatch(view, /Your venue is live/)
  assert.match(view, /cleanupOutcomeQuery \? <BillingOutcomeQueryCleanup \/>/)
})

test("checkout blocks complimentary merchants while portal preserves existing Stripe management", () => {
  const actions = readProjectFile("app", "app", "billing", "actions.ts")
  const checkoutStart = actions.indexOf(
    "export async function startCheckoutAction"
  )
  const portalStart = actions.indexOf(
    "export async function openCustomerPortalAction"
  )
  const checkout = actions.slice(checkoutStart, portalStart)
  const portal = actions.slice(portalStart)

  assert.match(checkout, /merchant\.requires_billing === false/)
  assert.ok(
    checkout.indexOf("merchant.requires_billing === false") <
      checkout.indexOf("createBillingCheckoutDependencies"),
    "checkout exemption guard must run before Stripe dependencies are created"
  )
  assert.match(portal, /select\("stripe_customer_id"\)/)
  assert.match(portal, /merchant\.requires_billing === false/)
  assert.ok(
    portal.indexOf('select("stripe_customer_id")') <
      portal.indexOf("merchant.requires_billing === false"),
    "portal must check for an existing Stripe customer before applying the exemption"
  )
  assert.ok(
    portal.indexOf("merchant.requires_billing === false") >
      portal.indexOf("getStripe"),
    "the exemption must only short-circuit the missing-customer path"
  )
})
