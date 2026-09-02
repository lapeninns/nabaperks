import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const exporter = readFileSync(
  new URL("../../scripts/export-production-poster-pdfs.mjs", import.meta.url),
  "utf8"
)
const vercelIgnore = readFileSync(
  new URL("../../.vercelignore", import.meta.url),
  "utf8"
)

test("poster exporter authorises the target before creating a privileged client", () => {
  const guard = exporter.indexOf("assertProductionPosterSupabaseTarget(")
  const client = exporter.indexOf("createClient(authorisedSupabaseOrigin")
  assert.ok(guard >= 0 && guard < client)
  assert.doesNotMatch(exporter, /\.env\.local\.hosted-backup/)
  assert.match(exporter, /options\.envFile \? path\.resolve/)
  assert.match(exporter, /resolveProductionPosterCredentials/)
})

test("deployment packaging excludes every dotenv credential file", () => {
  assert.match(vercelIgnore, /^\.env\*$/m)
})
