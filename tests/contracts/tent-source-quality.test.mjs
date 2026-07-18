import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import {
  analyseTypeScript,
  walkSourceFiles,
} from "../support/poster-source-analysis.mjs"

const projectRoot = process.cwd()
const qrDirectory = path.join(projectRoot, "lib", "qr")
const tentComponentDir = path.join(
  projectRoot,
  "components",
  "merchant",
  "qr-poster",
  "table-tent"
)
const notificationsDir = path.join(projectRoot, "lib", "notifications")

test("tent model, component and PDF modules stay small and assertion-free", () => {
  const files = [
    ...walkSourceFiles(qrDirectory, (file) => /tent-.*\.ts$/.test(file)),
    ...walkSourceFiles(tentComponentDir, (file) => file.endsWith(".tsx")),
    ...walkSourceFiles(notificationsDir, (file) =>
      /tent-pdf.*\.ts$/.test(file)
    ),
  ]
  assert.ok(files.length >= 10)
  for (const file of files) {
    assert.deepEqual(
      analyseTypeScript(file),
      [],
      path.relative(projectRoot, file)
    )
  }
})

test("only the tent reader reads the table-tent catalogue json", () => {
  const tentLibFiles = walkSourceFiles(qrDirectory, (file) =>
    /tent-.*\.ts$/.test(file)
  )
  for (const file of tentLibFiles) {
    const source = readFileSync(file, "utf8")
    if (file.endsWith("tent-design-reader.ts")) {
      assert.match(source, /table-tent-designs\.json/)
    } else {
      assert.doesNotMatch(source, /table-tent-designs\.json/)
    }
  }
})

test("tent PDF renderers never import a tent facade or the catalogue json", () => {
  const pdfFiles = walkSourceFiles(notificationsDir, (file) =>
    /tent-pdf.*\.ts$/.test(file)
  )
  assert.ok(pdfFiles.length >= 4)
  for (const file of pdfFiles) {
    if (file.endsWith(`${path.sep}tent-pdf.ts`)) continue
    const source = readFileSync(file, "utf8")
    assert.doesNotMatch(source, /from ["']\.\/tent-pdf["']/)
    assert.doesNotMatch(source, /table-tent-designs\.json/)
  }
})
