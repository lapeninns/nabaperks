import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import {
  analyseTypeScript,
  walkSourceFiles,
} from "../support/poster-source-analysis.mjs"

const projectRoot = process.cwd()
const printDirectory = path.join(projectRoot, "lib", "print")

test("print layout modules stay small and assertion-free", () => {
  const files = walkSourceFiles(printDirectory, (file) => file.endsWith(".ts"))
  assert.ok(
    files.length >= 8,
    `expected the full module set, saw ${files.length}`
  )
  for (const file of files) {
    assert.deepEqual(
      analyseTypeScript(file),
      [],
      path.relative(projectRoot, file)
    )
  }
})

test("the print layer stays pure — no renderer imports", () => {
  const files = walkSourceFiles(printDirectory, (file) => file.endsWith(".ts"))
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    const relative = path.relative(projectRoot, file)
    assert.doesNotMatch(source, /from "pdf-lib"/, relative)
    assert.doesNotMatch(source, /from "react"/, relative)
  }
})
