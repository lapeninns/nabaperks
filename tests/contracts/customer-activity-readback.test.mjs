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

test("Given customer activity uses service-role reads When source is inspected Then customer scope comes only from the current session", () => {
  const activity = readProjectFile("lib", "customer", "activity.ts")

  assert.match(activity, /getCurrentCustomer\(\)/)
  assert.match(activity, /\.eq\("customer_id", customer\.id\)/)
  assert.doesNotMatch(activity, /customerId[:)]/)
  assert.doesNotMatch(activity, /\.eq\("customer_id", [^c][^)]+?\)/)
})

test("Given product event metadata reaches customer activity When DTOs are shaped Then raw metadata is allow-listed before display", () => {
  const activity = readProjectFile("lib", "customer", "activity.ts")
  const core = readProjectFile("lib", "customer", "activity-core.ts")
  const itemType = core.slice(
    core.indexOf("export type CustomerActivityItem ="),
    core.indexOf("export type CustomerActivityMetadata =")
  )

  assert.match(activity, /parseCustomerActivityMetadata/)
  assert.match(activity, /shapeCustomerActivityItem/)
  assert.match(core, /reward_name/)
  assert.match(core, /new_stamp_count/)
  assert.match(core, /assertNever/)
  assert.doesNotMatch(itemType, /metadata|email|phone|provider|response/i)
})
