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

test("Given onboarding is submitted When source is inspected Then the full venue resolves before one atomic RPC", () => {
  const action = readProjectFile("app", "app", "onboarding", "actions.ts")
  const resolutionCall = action.indexOf(
    "resolveVenueLocationPersistencePayload"
  )
  const rpcCall = action.indexOf('.rpc("complete_merchant_onboarding"')

  assert.ok(
    resolutionCall >= 0,
    "onboarding resolves a merchant-independent venue payload"
  )
  assert.ok(
    rpcCall > resolutionCall,
    "venue resolution precedes the database mutation"
  )
  assert.doesNotMatch(action, /persistVenueLocationWrite/)
  assert.doesNotMatch(action, /create_merchant_onboarding/)
  assert.match(action, /ONBOARDING_SAVE_ERROR/)
  assert.match(action, /redirect\("\/app\/launch\?tab=card"\)/)
})

test("Given the atomic onboarding migration When source is inspected Then owner, ledger, lock, ACL, and compatibility invariants are explicit", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260710100000_atomic_merchant_onboarding.sql"
  )

  assert.match(
    migration,
    /create unique index[^;]+merchants[^;]+owner_user_id/is
  )
  assert.match(migration, /merchant_signed_up/is)
  assert.match(migration, /merchant_onboarded/is)
  assert.match(
    migration,
    /create or replace function public\.complete_merchant_onboarding\(/i
  )
  const newRpcSignature = migration.match(
    /create or replace function public\.complete_merchant_onboarding\([\s\S]+?returns table/i
  )?.[0]
  assert.ok(newRpcSignature, "new onboarding RPC signature exists")
  assert.doesNotMatch(
    newRpcSignature,
    /p_owner_user_id|p_email|p_business_slug|p_address_country|p_geocoded_at|p_geofence_pin_updated_at/i
  )
  assert.match(migration, /security definer/i)
  assert.match(migration, /set search_path (?:=|to) public, auth/i)
  assert.match(migration, /pg_advisory_xact_lock/i)
  assert.match(migration, /indexes\.indisvalid/i)
  assert.match(migration, /indexes\.indisready/i)
  assert.match(
    migration,
    /pg_catalog\.pg_get_expr\(indexes\.indpred, indexes\.indrelid\)[\s\S]+?merchant_signed_up/is
  )
  assert.match(migration, /select auth\.uid\(\)/i)
  assert.match(migration, /from auth\.users/i)
  assert.match(migration, /p_owner_user_id\s*<>\s*\(select auth\.uid\(\)\)/i)
  assert.match(
    migration,
    /create or replace function public\.create_merchant_onboarding\(/i
  )
  assert.match(
    migration,
    /revoke all on function public\.complete_merchant_onboarding/is
  )
  assert.match(
    migration,
    /revoke all on function public\.create_merchant_onboarding/is
  )
  assert.match(
    migration,
    /grant execute on function public\.complete_merchant_onboarding[^;]+authenticated, service_role/is
  )
  assert.match(
    migration,
    /grant execute on function public\.create_merchant_onboarding[^;]+authenticated, service_role/is
  )
})

test("Given an incomplete server record and a local draft When the form loads Then server values win and missing fields recover from the draft", () => {
  const form = readProjectFile("components", "merchant", "onboarding-form.tsx")
  const fields = readProjectFile(
    "components",
    "merchant",
    "onboarding-form-fields.tsx"
  )
  const addressFields = readProjectFile(
    "components",
    "merchant",
    "venue-address-fields.tsx"
  )
  const onboarding = readProjectFile("lib", "merchant", "onboarding.ts")

  assert.match(form, /mergeOnboardingDraft/)
  assert.doesNotMatch(form, /if \(hasInitialFields\) return/)
  assert.doesNotMatch(form, /const errors = state\.errors \?\? clientErrors/)
  assert.match(fields, /role="alert"/)
  assert.match(addressFields, /role="alert"/)
  assert.match(onboarding, /addressLine1:/)
  assert.match(onboarding, /addressLine2:/)
  assert.match(onboarding, /addressCity:/)
  assert.match(onboarding, /addressPostcode:/)
})

test("Given the onboarding contract When implementation is reviewed Then complete rows are first-write-wins and legacy partial rows stay incomplete", () => {
  const spec = readProjectFile(
    "micro-specs",
    "merchant",
    "onboarding-continuity.md"
  )

  assert.match(spec, /first complete write wins/i)
  assert.match(spec, /fixture-scoped database trigger/i)
  assert.match(spec, /legacy seven-argument RPC/i)
  assert.match(spec, /PUBLIC or\s+`anon`/)
})

test("Given DB proofs use short-lived schema controls When the full DB gate runs Then files execute sequentially", () => {
  const packageJson = JSON.parse(readProjectFile("package.json"))

  assert.match(
    packageJson.scripts["test:db"],
    /node --test --test-concurrency=1 tests\/db\/\*\.test\.mjs/
  )
})
