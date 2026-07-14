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

test("complimentary merchant billing bypasses provider reconciliation and readback", () => {
  const panel = readProjectFile(
    "components",
    "merchant",
    "account",
    "billing-panel.tsx"
  )

  assert.match(panel, /merchant\.requires_billing !== false/)
  assert.match(panel, /if \(!requiresBilling\)/)
  assert.match(panel, /requiresBilling=\{requiresBilling\}/)

  const launchPage = readProjectFile("app", "app", "launch", "page.tsx")
  assert.match(
    launchPage,
    /merchant\.requires_billing !== false && params\.checkout === "success"/
  )
})

test("complimentary merchant billing renders no Stripe action", () => {
  const view = readProjectFile(
    "components",
    "merchant",
    "account",
    "billing-panel-view.tsx"
  )

  assert.match(view, /requiresBilling\?: boolean/)
  assert.match(view, /if \(!requiresBilling\)/)
  assert.match(view, /Complimentary access/)
  assert.match(view, /No card or Stripe subscription is required/)
})

test("checkout and portal actions reject complimentary merchants before Stripe setup", () => {
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
  assert.match(portal, /merchant\.requires_billing === false/)
  assert.ok(
    portal.indexOf("merchant.requires_billing === false") <
      portal.indexOf("getStripe"),
    "portal exemption guard must run before Stripe is called"
  )
})
