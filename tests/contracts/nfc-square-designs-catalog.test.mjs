import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

const projectRoot = process.cwd()
const readProjectFile = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

test("NFC square catalogue is a closed, production 100×100 wall plate system", () => {
  const catalog = JSON.parse(
    readProjectFile("config", "nfc-square-designs.json")
  )
  assert.equal(catalog.schema, "nabaperks.nfc-square-designs.v1")
  assert.deepEqual(
    catalog.designs.map(({ id }) => id),
    ["tap", "google-review"]
  )
  assert.deepEqual(catalog.collection, {
    id: "nfc-square",
    name: "Square NFC plates",
    description: "One-sided tap-and-scan plates for walls, counters and tills.",
    format: "nfc-square-100",
    sheet: "square-100",
    revision: 6,
  })
  assert.ok(catalog.designs.every(({ rollout }) => rollout === "production"))
  assert.ok(catalog.designs.every((design) => !("back" in design)))
  assert.equal("cutLabel" in catalog.shared, false)
  assert.ok(
    catalog.designs.every(
      (design) =>
        Array.isArray(design.front.flow) &&
        design.front.flow.length === 3 &&
        typeof design.front.claimLine === "string" &&
        typeof design.front.mysteryKicker === "string" &&
        typeof design.front.mysteryAccent === "string" &&
        !("stampCue" in design.front)
    )
  )
  assert.equal(
    typeof catalog.shared.dieRule,
    "string",
    "shared.dieRule is printed on the die"
  )
})

test("NFC square geometry is a native 100×100 die", () => {
  const catalog = JSON.parse(
    readProjectFile("config", "nfc-square-designs.json")
  )
  assert.equal(catalog.shared.geometry.square.cardWidthMm, 100)
  assert.equal(catalog.shared.geometry.square.cardHeightMm, 100)
  assert.equal(catalog.shared.geometry.square.qrOuterMm, 24)
  assert.equal(catalog.shared.geometry.square.googleReviewQrOuterMm, 24)
  assert.equal("a4" in catalog.shared.geometry, false)
  assert.equal("sheetWidthMm" in catalog.shared.geometry.square, false)
  assert.equal("frontOriginXMm" in catalog.shared.geometry.square, false)
})

test("NFC square copy stays honest — no free-stamp claims", () => {
  const catalog = JSON.parse(
    readProjectFile("config", "nfc-square-designs.json")
  )
  const blob = JSON.stringify(catalog.designs)
  assert.doesNotMatch(blob, /free stamp/i)
  assert.doesNotMatch(blob, /first stamp free/i)
  assert.doesNotMatch(blob, /\bVIP\b/i)
  assert.doesNotMatch(blob, /premium/i)
  assert.doesNotMatch(blob, /instant(?:ly)?/i)
  assert.match(blob, /Today's visit can be stamp one/)
  assert.match(blob, /To start/)
  assert.match(blob, /Reward sealed/)
  assert.match(blob, /Reveal at stamp \{stamps\}/)
  const review = catalog.designs.find(({ id }) => id === "google-review")
  assert.equal(review.front.brandName, "Drop a Quick Google Review.")
  assert.deepEqual(review.front.flow, ["Tap", "Rate", "Post"])
  assert.match(review.front.claimLine, /\{locality\}/)
  assert.doesNotMatch(JSON.stringify(review), /Girton/)
})
