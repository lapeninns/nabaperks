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

test("Given merchant activity uses service-role reads When a caller passes a merchant id Then it is verified against the current session merchant first", () => {
  const activity = readProjectFile("lib", "merchant", "activity.ts")

  assert.match(
    activity,
    /import \{ getCurrentMerchant \} from "@\/lib\/auth\/session"/
  )
  assert.match(
    activity,
    /const scopedMerchantId = await requireCurrentMerchantId\(merchantId\)/
  )
  assert.match(activity, /\.eq\("merchant_id", scopedMerchantId\)/)
  assert.match(
    activity,
    /async function requireCurrentMerchantId\(merchantId: string\)/
  )
  assert.match(activity, /merchant\.id !== merchantId/)
  assert.match(
    activity,
    /Current merchant access required for activity readback/
  )
})

test("Given merchant activity builds client search text When product event metadata is present Then only explicit safe metadata keys are indexed", () => {
  const activity = readProjectFile(
    "lib",
    "merchant",
    "activity-display-helpers.ts"
  )
  const display = readProjectFile("lib", "merchant", "activity-display.ts")
  const allowlistMatch = activity.match(
    /const SEARCHABLE_METADATA_KEYS = new Set<string>\(\[([\s\S]*?)\]\)/
  )

  assert.ok(allowlistMatch, "activity metadata search must use an allow-list")
  const allowlist = allowlistMatch[1]
  for (const key of [
    "reward_name",
    "new_stamp_count",
    "business_date",
    "geo_status",
    "destination_type",
    "asset_type",
    "source",
    "plan",
    "status",
  ]) {
    assert.match(allowlist, new RegExp(`"${key}"`))
  }

  for (const piiKey of [
    "full_name",
    "email",
    "phone",
    "phone_hmac",
    "phone_ciphertext",
    "date_of_birth",
    "address",
    "ip",
  ]) {
    assert.doesNotMatch(allowlist, new RegExp(`"${piiKey}"`))
  }

  assert.match(display, /\.\.\.metadataSearchValues\(row\.metadata\)/)
  assert.match(activity, /SEARCHABLE_METADATA_KEYS\.has\(key\)/)
  assert.doesNotMatch(activity, /JSON\.stringify\(metadata\)/)
  assert.doesNotMatch(activity, /Object\.values\(metadata\)/)
})
