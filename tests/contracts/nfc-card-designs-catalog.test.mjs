import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

const projectRoot = process.cwd()
const readProjectFile = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

test("NFC card catalogue is a closed, production native-CR80 system", () => {
  const catalog = JSON.parse(readProjectFile("config", "nfc-card-designs.json"))
  const expectedIds = ["tap"]

  assert.equal(catalog.schema, "nabaperks.nfc-card-designs.v1")
  assert.deepEqual(
    catalog.designs.map(({ id }) => id),
    expectedIds
  )
  assert.deepEqual(catalog.collection, {
    id: "nfc-card",
    name: "CR80 NFC cards",
    description:
      "Tap cards for counters, tills and guest hand-out — front and back print at CR80 size (85.5 × 54 mm).",
    format: "cr80-nfc",
    sheet: "cr80",
    revision: 4,
  })
  assert.ok(catalog.designs.every(({ rollout }) => rollout === "production"))
  assert.match(catalog.product.kitSummary, /85\.5 × 54 mm/)
})

test("NFC card geometry is native CR80 pages (not A4 imposition)", () => {
  const catalog = JSON.parse(readProjectFile("config", "nfc-card-designs.json"))
  assert.deepEqual(catalog.shared.geometry.cr80, {
    cardWidthMm: 85.5,
    cardHeightMm: 54,
    cornerRadiusMm: 2.8,
    frameInsetMm: 0.45,
    qrOuterMm: 18,
  })
  assert.equal(catalog.shared.geometry.a4, undefined)
})

test("NFC card copy stays honest to the join funnel", () => {
  const catalog = JSON.parse(readProjectFile("config", "nfc-card-designs.json"))
  const blob = JSON.stringify(catalog.designs)
  const shared = catalog.shared

  assert.doesNotMatch(blob, /free stamp/i)
  assert.doesNotMatch(blob, /first stamp free/i)
  assert.doesNotMatch(blob, /receipt/i)
  assert.doesNotMatch(blob, /is ready/i)
  assert.doesNotMatch(blob, /Today counts as stamp one/i)
  assert.doesNotMatch(blob, /"Open"/)

  assert.match(blob, /Tap to join — today's stamp after one text/)
  assert.match(blob, /Keep this card/)
  assert.match(blob, /On your number/)
  assert.match(blob, /is waiting/)
  assert.match(blob, /Venue mystery card/)
  assert.equal(shared.dieRule, "One stamp per UK day · 18+ to redeem")
  assert.equal(shared.claimFriction, "No NFC? Scan the code")
  assert.equal(shared.friction, "No app · One text · In your browser")

  const tap = catalog.designs[0]
  assert.deepEqual(tap.front.flow, ["Tap", "Stamp", "Unlock"])
  assert.deepEqual(
    tap.back.steps.map(({ title }) => title),
    ["Tap", "Keep", "Return"]
  )
})
