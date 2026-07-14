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
    /merchant_locations\(name, address, address_line_1, address_line_2, address_city, address_postcode, latitude, longitude, require_geofence\)/
  )
  assert.match(onboarding, /referencedTable: "merchant_locations"/)
  assert.match(
    onboarding,
    /\.limit\(1, \{ referencedTable: "merchant_locations" \}\)/
  )
  assert.match(onboarding, /\.maybeSingle\(\)/)
  assert.doesNotMatch(onboarding, /locationName:/)
  assert.match(
    onboarding,
    /addressLine1:\s*location\?\.address_line_1 \?\? location\?\.address \?\? undefined/
  )
  assert.match(
    onboarding,
    /addressLine2: location\?\.address_line_2 \?\? undefined/
  )
  assert.match(onboarding, /isCompleteOnboardingLocation\(location\)/)
  assert.match(onboarding, /hasCompleteAddress\(location\)/)
  assert.doesNotMatch(
    onboarding,
    /if \(hasText\(location\.address\)\) return true/
  )
  assert.match(
    onboarding,
    /hasText\(location\.address_line_1\)[\s\S]+hasText\(location\.address_city\)[\s\S]+hasText\(location\.address_postcode\)/
  )
  assert.match(
    onboarding,
    /return location\.latitude !== null && location\.longitude !== null/
  )
  assert.doesNotMatch(
    onboarding,
    /select\("id", \{ count: "exact", head: true \}\)/
  )
  assert.doesNotMatch(onboarding, /locationCount/)
})

test("Given one customer-facing venue name When forms or profile edits persist Then location names cannot diverge", () => {
  const onboardingAction = readProjectFile("app", "app", "onboarding", "actions.ts")
  const launchAction = readProjectFile("app", "app", "launch", "actions.ts")
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260713140000_single_customer_facing_venue_name.sql"
  )

  assert.match(onboardingAction, /canonicalVenueName: businessName/)
  assert.match(launchAction, /canonicalVenueName: merchant\.business_name/)
  assert.match(migration, /before insert or update of name, merchant_id/)
  assert.match(migration, /after update of business_name/)
  assert.match(
    migration,
    /set name = merchants\.business_name[\s\S]+where merchant_locations\.merchant_id = merchants\.id/
  )
})
