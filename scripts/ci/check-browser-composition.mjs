import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { inventoryFromPlaywright, testIdentity } from "./browser-parity.mjs"

/** Selection evidence only: preserve the distinct union and remove duplication. */
export function compareBrowserComposition(
  beforeE2e,
  beforeA11y,
  afterE2e,
  afterA11y
) {
  for (const entries of [beforeE2e, beforeA11y, afterE2e, afterA11y])
    if (!Array.isArray(entries) || entries.length === 0)
      throw new Error("Every browser tier needs a non-empty inventory")
  const before = [...beforeE2e, ...beforeA11y].map(testIdentity)
  const after = [...afterE2e, ...afterA11y].map(testIdentity)
  const beforeUnion = new Set(before)
  const afterUnion = new Set(after)
  const missing = [...beforeUnion].filter((id) => !afterUnion.has(id))
  const added = [...afterUnion].filter((id) => !beforeUnion.has(id))
  const duplicatesBefore = before.length - beforeUnion.size
  const duplicatesAfter = after.length - afterUnion.size
  return {
    equivalent:
      missing.length === 0 && added.length === 0 && duplicatesAfter === 0,
    evidenceKind: "selection-only",
    beforeExecutions: before.length,
    afterExecutions: after.length,
    distinctBefore: beforeUnion.size,
    distinctAfter: afterUnion.size,
    duplicatesBefore,
    duplicatesAfter,
    missing,
    added,
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const paths = process.argv.slice(2)
    if (paths.length !== 4)
      throw new Error(
        "Usage: check-browser-composition.mjs <before-e2e.json> <before-a11y.json> <after-e2e.json> <after-a11y.json>"
      )
    const inventories = paths.map((path) =>
      inventoryFromPlaywright(JSON.parse(readFileSync(path, "utf8")))
    )
    const result = compareBrowserComposition(...inventories)
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = result.equivalent ? 0 : 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
