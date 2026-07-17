import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import {
  analyseTypeScript,
  walkSourceFiles,
} from "../support/poster-source-analysis.mjs"

const projectRoot = process.cwd()
const pdfDirectory = path.join(projectRoot, "lib", "notifications")
const pdfFiles = walkSourceFiles(pdfDirectory, (file) =>
  /poster-pdf.*\.ts$/.test(file)
)

test("poster PDF facade and renderer modules stay small and assertion-free", () => {
  assert.ok(pdfFiles.length >= 15)
  for (const file of pdfFiles) {
    assert.deepEqual(
      analyseTypeScript(file),
      [],
      path.relative(projectRoot, file)
    )
  }
})

test("PDF renderers depend inward and never import their public facade", () => {
  for (const file of pdfFiles) {
    if (file.endsWith(`${path.sep}poster-pdf.ts`)) continue
    const source = readFileSync(file, "utf8")
    assert.doesNotMatch(source, /from ["']\.\/poster-pdf["']/)
    assert.doesNotMatch(source, /config\/poster-designs\.json/)
  }
})
