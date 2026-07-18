import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"

import {
  analyseTypeScript,
  walkSourceFiles,
} from "../support/poster-source-analysis.mjs"

const projectRoot = process.cwd()
const qrDirectory = path.join(projectRoot, "lib", "qr")
const browserDirectory = path.join(
  projectRoot,
  "components",
  "merchant",
  "qr-poster"
)

test("poster model and browser modules stay small and assertion-free", () => {
  const files = [
    ...walkSourceFiles(qrDirectory, (file) => /poster-.*\.ts$/.test(file)),
    ...walkSourceFiles(browserDirectory, (file) => file.endsWith(".tsx")),
  ]
  assert.ok(files.length >= 20)
  for (const file of files) {
    assert.deepEqual(
      analyseTypeScript(file),
      [],
      path.relative(projectRoot, file)
    )
  }
})

test("only the strict catalogue parser reads poster-designs.json", async () => {
  const files = walkSourceFiles(qrDirectory, (file) =>
    /poster-.*\.ts$/.test(file)
  )
  for (const file of files) {
    const source = await import("node:fs").then(({ readFileSync }) =>
      readFileSync(file, "utf8")
    )
    if (file.endsWith("poster-design-reader.ts")) {
      assert.match(source, /poster-designs\.json/)
    } else {
      assert.doesNotMatch(source, /poster-designs\.json/)
    }
  }
})

test("the source analyser detects every forbidden construct", () => {
  const source = [
    "const one: any = 1",
    "const two = one as number",
    "const three = <number>one",
    "const four = one!",
  ].join("\n")
  assert.deepEqual(analyseTypeScript("fixture.ts", source), [
    "explicit any",
    "as assertion",
    "angle assertion",
    "non-null assertion",
  ])
  assert.match(
    analyseTypeScript("long.ts", `${"x\n".repeat(249)}x`)[0],
    /line count 250/
  )
})
