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

test("Given legacy merchant profile routes When route files are inspected Then they land on the Account profile tab", () => {
  const profileRoute = readProjectFile("app", "app", "profile", "page.tsx")
  const settingsRoute = readProjectFile("app", "app", "settings", "page.tsx")

  assert.match(profileRoute, /redirect\("\/app\/account\?tab=profile"\)/)
  assert.match(settingsRoute, /redirect\("\/app\/account\?tab=profile"\)/)
})

test("Given legacy merchant billing returns When the route file is inspected Then billing outcomes are forwarded to the Account billing tab", () => {
  const billingRoute = readProjectFile("app", "app", "billing", "page.tsx")

  assert.match(
    billingRoute,
    /const query = new URLSearchParams\(\{ tab: "billing" \}\)/
  )
  assert.match(
    billingRoute,
    /if \(params\.checkout\) query\.set\("checkout", params\.checkout\)/
  )
  assert.match(
    billingRoute,
    /if \(params\.portal\) query\.set\("portal", params\.portal\)/
  )
  assert.match(billingRoute, /redirect\(`\/app\/account\?\$\{query\.toString\(\)\}`\)/)
})
