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

test("launch page syncs billing before assembling readiness on checkout success", () => {
  const launchPage = readProjectFile("app", "app", "launch", "page.tsx")

  const syncIndex = launchPage.indexOf("completeBillingCheckoutReturn")
  const modelIndex = launchPage.indexOf("getLaunchPageModel")

  assert.notEqual(syncIndex, -1)
  assert.notEqual(modelIndex, -1)
  assert.ok(
    syncIndex < modelIndex,
    "billing checkout sync must run before getLaunchPageModel"
  )
})

test("billing panel bypasses cached billing read after checkout success", () => {
  const billingPanel = readProjectFile(
    "components",
    "merchant",
    "account",
    "billing-panel.tsx"
  )

  assert.match(billingPanel, /getMerchantBillingFresh/)
  assert.match(billingPanel, /completeBillingCheckoutReturn/)
})
