import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { walkSourceFiles } from "../support/poster-source-analysis.mjs"

const projectRoot = process.cwd()
const catalog = JSON.parse(
  readFileSync(path.join(projectRoot, "config", "poster-designs.json"), "utf8")
)
const rendererFiles = [
  ...walkSourceFiles(
    path.join(projectRoot, "components", "merchant", "qr-poster"),
    (file) => file.endsWith(".tsx")
  ),
  ...walkSourceFiles(path.join(projectRoot, "lib", "notifications"), (file) =>
    /poster-pdf.*\.ts$/.test(file)
  ),
]

function customerCopyStrings(value, key = "") {
  if (typeof value === "string") {
    return key === "copy" || key === "reassurance" ? [value] : []
  }
  if (Array.isArray(value))
    return value.flatMap((item) => customerCopyStrings(item, key))
  if (!value || typeof value !== "object") return []
  return Object.entries(value).flatMap(([childKey, child]) =>
    customerCopyStrings(child, childKey === "copy" ? "copy" : key)
  )
}

test("renderers consume the model instead of owning approved customer copy", () => {
  const approvedCopy = [
    ...customerCopyStrings(catalog.templates),
    catalog.shared.reassurance,
  ].filter((value) => value.length >= 18 && !value.includes("{"))

  for (const file of rendererFiles) {
    const source = readFileSync(file, "utf8")
    assert.doesNotMatch(
      source,
      /from ["'][^"']*config\/poster-designs\.json["']/
    )
    for (const copy of approvedCopy) {
      assert.ok(
        !source.includes(copy),
        `${path.relative(projectRoot, file)} duplicates catalogue copy: ${copy}`
      )
    }
  }
})

test("critical page, fold, and QR values enter adapters through resolved content", () => {
  const browser = readFileSync(
    path.join(
      projectRoot,
      "components",
      "merchant",
      "qr-poster",
      "a4-poster.tsx"
    ),
    "utf8"
  )
  const tent = readFileSync(
    path.join(
      projectRoot,
      "components",
      "merchant",
      "qr-poster",
      "table-tent",
      "faces",
      "shared.tsx"
    ),
    "utf8"
  )
  const pdf = readFileSync(
    path.join(projectRoot, "lib", "notifications", "poster-pdf-render.ts"),
    "utf8"
  )

  assert.match(browser, /copy\.geometry\.sheetWidthMm/)
  assert.match(tent, /geometry\.foldCorridorMm|geometry\.faceHeightMm/)
  assert.match(tent, /geometry\.identityRowMm/)
  assert.match(pdf, /content\.geometry\.sheetWidthMm/)
})
