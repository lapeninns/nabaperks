import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { walkSourceFiles } from "../support/poster-source-analysis.mjs"

const projectRoot = process.cwd()

test("poster renderers do not revive retired stamp-row helpers", () => {
  const files = walkSourceFiles(
    path.join(projectRoot, "lib", "notifications"),
    (file) => /poster-pdf.*\.ts$/.test(file)
  )
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    assert.doesNotMatch(
      source,
      /drawStampCircles|drawStubRow|stampChip/,
      path.relative(projectRoot, file)
    )
  }
})
