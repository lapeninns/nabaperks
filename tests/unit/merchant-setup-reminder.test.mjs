import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

test("merchant app layout mounts the shared setup reminder", () => {
  const layout = readFileSync(
    path.join(projectRoot, "app", "app", "layout.tsx"),
    "utf8"
  )

  assert.match(layout, /MerchantSetupReminder/)
  assert.match(layout, /<Suspense fallback=\{null\}>/)
})
