import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parseEmbeddedPdfFonts,
  productionPrintKitExpectations,
} from "../../scripts/verify-production-print-kit-pdfs.mjs"

test("production verifier covers the exact 13-file, 19-page print kit", () => {
  const expectations = productionPrintKitExpectations()

  assert.equal(expectations.length, 13)
  assert.equal(
    expectations.reduce((sum, item) => sum + item.pages, 0),
    19
  )
  assert.equal(
    expectations.reduce((sum, item) => sum + item.targets.length, 0),
    22
  )
  assert.equal(
    expectations.filter(({ filename }) => filename.includes("-poster-")).length,
    4
  )
  assert.ok(
    expectations
      .filter(({ filename }) => filename.includes("-poster-"))
      .every(({ pages }) => pages === 2)
  )
})

test("production verifier recognises Chromium embedded fonts", () => {
  const output = [
    "name type encoding emb sub uni object ID",
    "------------------------------------",
    "AAAAAA+SpaceMono-Bold CID TrueType Identity-H yes yes yes 4 0",
    "BAAAAA+ZapfDingbatsITC Type 3 Custom yes yes yes 10 0",
  ].join("\n")

  assert.deepEqual(parseEmbeddedPdfFonts(output), [
    { name: "AAAAAA+SpaceMono-Bold", embedded: true },
    { name: "BAAAAA+ZapfDingbatsITC", embedded: true },
  ])
})
