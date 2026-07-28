import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("provider return URLs and generated QR destinations share the deployed-origin resolver", () => {
  const consumers = [
    ["app", "app", "billing", "actions.ts"],
    ["app", "app", "qr", "actions.ts"],
    ["app", "app", "qr", "image", "[qrCodeId]", "route.ts"],
    ["app", "app", "qr", "nfc", "[design]", "page.tsx"],
    ["app", "app", "qr", "nfc-square", "[design]", "page.tsx"],
    ["app", "app", "qr", "poster", "[template]", "page.tsx"],
    ["app", "app", "qr", "tent", "[design]", "page.tsx"],
    ["app", "reward", "[rewardId]", "qr.png", "route.ts"],
    ["components", "merchant", "dashboard-qr-card.tsx"],
    ["components", "merchant", "launch", "qr-panel.tsx"],
  ]

  for (const segments of consumers) {
    const source = read(...segments)
    assert.match(source, /getCanonicalAppOrigin/)
    assert.doesNotMatch(source, /NEXT_PUBLIC_APP_URL/)
  }
})

test("generic Preview may omit the explicit canonical URL while Staging and Production require it", () => {
  const contract = JSON.parse(read("config", "vercel-governance-contract.json"))

  assert.ok(
    !contract.environments.preview.requiredKeys.includes("NEXT_PUBLIC_APP_URL")
  )
  assert.ok(
    contract.environments.staging.requiredKeys.includes("NEXT_PUBLIC_APP_URL")
  )
  assert.ok(
    contract.environments.production.requiredKeys.includes(
      "NEXT_PUBLIC_APP_URL"
    )
  )
})
