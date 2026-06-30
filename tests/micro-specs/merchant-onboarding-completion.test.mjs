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

test("Given a merchant has only a partial location row When onboarding status is checked Then completion requires saved venue fields", () => {
  const onboarding = readProjectFile("lib", "merchant", "onboarding.ts")

  assert.match(onboarding, /type MerchantOnboardingLocation = \{/)
  assert.match(
    onboarding,
    /"name, address, address_line_1, address_city, address_postcode, latitude, longitude, require_geofence"/
  )
  assert.match(onboarding, /\.maybeSingle\(\)/)
  assert.match(onboarding, /locationName: location\?\.name \?\? undefined/)
  assert.match(onboarding, /isCompleteOnboardingLocation\(location\)/)
  assert.match(onboarding, /hasCompleteAddress\(location\)/)
  assert.match(
    onboarding,
    /return location\.latitude !== null && location\.longitude !== null/
  )
  assert.doesNotMatch(onboarding, /select\("id", \{ count: "exact", head: true \}\)/)
  assert.doesNotMatch(onboarding, /locationCount/)
})
