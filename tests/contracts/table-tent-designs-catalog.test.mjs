import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

const projectRoot = process.cwd()
const readProjectFile = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

test("table-tent catalogue is a closed, all-production five-design A4 system", () => {
  const catalog = JSON.parse(
    readProjectFile("config", "table-tent-designs.json")
  )
  const expectedIds = ["regulars", "welcome", "sealed", "today", "classic"]

  assert.equal(catalog.schema, "nabaperks.table-tent-designs.v1")
  assert.deepEqual(
    catalog.designs.map(({ id }) => id),
    expectedIds
  )
  assert.deepEqual(catalog.collection, {
    id: "table-tent",
    name: "A4 table tents",
    description: "Fold-to-peak table tents for tables, counters and bar tops.",
    format: "a4-tent",
    sheet: "a4",
    revision: 2,
  })
  assert.ok(catalog.designs.every(({ rollout }) => rollout === "production"))
  assert.match(catalog.product.kitSummary, /Five print-ready A4 fold-to-peak/)
})

test("table-tent geometry is a real A4 sheet folded into two equal faces", () => {
  const catalog = JSON.parse(
    readProjectFile("config", "table-tent-designs.json")
  )
  assert.deepEqual(catalog.shared.geometry.a4, {
    sheetWidthMm: 210,
    sheetHeightMm: 297,
    faceWidthMm: 210,
    faceHeightMm: 148.5,
    foldAtMm: 148.5,
    faceInsetMm: 5,
  })
  // Two faces of 148.5 mm exactly reconstruct the 297 mm sheet.
  assert.equal(catalog.shared.geometry.a4.faceHeightMm * 2, 297)
  assert.equal(catalog.shared.qr.errorCorrectionLevel, "H")
  assert.equal(catalog.shared.qr.quietZoneModules, 4)
  assert.ok(catalog.shared.qr.outerMm >= 35 && catalog.shared.qr.outerMm <= 55)
})

test("table-tent copy is honest — no fabricated proof, no free-stamp claims", () => {
  const catalog = JSON.parse(
    readProjectFile("config", "table-tent-designs.json")
  )
  const copy = JSON.stringify({
    shared: catalog.shared,
    designs: catalog.designs.map(({ id, faceA, faceB }) => ({
      id,
      faceA,
      faceB,
    })),
  })

  for (const forbidden of [
    // The reference's fabricated proof and free-stamp claims must never ship.
    /first stamp(?:'s| is) (?:free|already|waiting|inked)/i,
    /\d+\s+rewards claimed/i,
    /free pint/i,
    /took one scan/i,
    /rewards claimed here/i,
    // The shared poster truthfulness guardrails apply to tents too.
    /everyone wins/i,
    /no spam/i,
    /no account/i,
    /£0\.00/i,
    /\bb5\b/i,
  ]) {
    assert.doesNotMatch(copy, forbidden)
  }
})

test("table-tent adapters use their own catalogue, never the poster one", () => {
  const source = [
    readProjectFile("lib", "qr", "tent-templates.ts"),
    readProjectFile("lib", "qr", "tent-content.ts"),
    readProjectFile(
      "components",
      "merchant",
      "qr-poster",
      "table-tent",
      "tent-sheet.tsx"
    ),
    readProjectFile("lib", "notifications", "tent-pdf.ts"),
  ].join("\n")

  assert.doesNotMatch(source, /poster-designs\.json/)
  assert.doesNotMatch(source, /\bb5\b/i)
})

test("table-tent faces are ten unique headline sets (Welcome is not Regulars reversed)", () => {
  const catalog = JSON.parse(
    readProjectFile("config", "table-tent-designs.json")
  )
  const faceKey = (face) => face.headline.join(" ").trim()
  const keys = catalog.designs.flatMap(({ faceA, faceB }) => [
    faceKey(faceA),
    faceKey(faceB),
  ])

  assert.equal(keys.length, 10)
  assert.equal(new Set(keys).size, 10)

  const welcome = catalog.designs.find(({ id }) => id === "welcome")
  const regulars = catalog.designs.find(({ id }) => id === "regulars")
  assert.ok(welcome)
  assert.ok(regulars)
  assert.notDeepEqual(
    [faceKey(welcome.faceA), faceKey(welcome.faceB)].sort(),
    [faceKey(regulars.faceA), faceKey(regulars.faceB)].sort()
  )
  assert.deepEqual(welcome.faceA.headline, [
    "How it works.",
    "Scan.",
    "Stamp.",
    "Reward.",
  ])
  assert.deepEqual(welcome.faceB.headline, [
    "New here?",
    "Your card",
    "starts now.",
  ])
})
