import assert from "node:assert/strict"
import { readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

const projectRoot = process.cwd()
const readProjectFile = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

test("poster catalogue is a closed, organised eight-design A4 system", () => {
  const catalog = JSON.parse(readProjectFile("config", "poster-designs.json"))
  const expectedIds = [
    "primer",
    "window",
    "pinned",
    "seal",
    "tally",
    "lastcall",
    "receipt",
    "chalk",
  ]

  assert.equal(catalog.schema, "nabaperks.poster-designs.v3")
  assert.deepEqual(catalog.collections, [
    {
      id: "counter",
      name: "A4 counter posters",
      description:
        "Portrait designs for tills, counters, windows and wall frames.",
      format: "a4-counter",
      sheet: "a4",
      revision: 2,
    },
  ])
  assert.deepEqual(
    catalog.templates.map(({ id }) => id),
    expectedIds
  )
  assert.ok(
    catalog.templates.every(
      ({ collection, format, sheet, revision }) =>
        collection === "counter" &&
        format === "a4-counter" &&
        sheet === "a4" &&
        revision === 2
    )
  )
  assert.match(catalog.product.kitSummary, /Eight print-ready A4/)
  assert.doesNotMatch(JSON.stringify(catalog), /table-tent|"b5"/i)
})

test("poster catalogue carries an explicit rollout state for every design", () => {
  const catalog = JSON.parse(readProjectFile("config", "poster-designs.json"))
  const rollouts = Object.fromEntries(
    catalog.templates.map(({ id, rollout }) => [id, rollout])
  )

  assert.deepEqual(rollouts, {
    primer: "production",
    window: "production",
    pinned: "production",
    seal: "production",
    tally: "production",
    lastcall: "production",
    receipt: "production",
    chalk: "production",
  })
  // The whole eight-design kit is in the production rotation.
  assert.ok(catalog.templates.every(({ rollout }) => rollout === "production"))
  assert.match(catalog.shared.rolloutPolicy, /production templates only/)
})

test("poster catalogue owns the complete customer-copy and print contract", () => {
  const catalog = JSON.parse(readProjectFile("config", "poster-designs.json"))
  const customerCopy = JSON.stringify({
    shared: catalog.shared,
    templates: catalog.templates.map(({ id, copy }) => ({ id, copy })),
  })

  assert.equal(
    catalog.shared.reassurance,
    "18+ to redeem · One visit stamp here per UK date · Rewards redeem from the next weekday · Terms apply"
  )
  assert.deepEqual(catalog.shared.geometry, {
    a4: { sheetWidthMm: 210, sheetHeightMm: 297, safeMarginMm: 15 },
  })
  assert.deepEqual(catalog.shared.qr.a4, { minOuterMm: 52, maxOuterMm: 55 })
  assert.deepEqual(
    catalog.templates.map(({ qrOuterMm }) => qrOuterMm),
    [54, 54, 54, 54, 54, 54, 54, 54]
  )
  for (const template of catalog.templates) {
    assert.ok(template.typeTiersPt.hook >= 60)
    assert.ok(template.typeTiersPt.hook <= 84)
    assert.ok(template.typeTiersPt.substantive >= 11)
    assert.ok(template.typeTiersPt.facts >= 8)
  }
  for (const forbiddenClaim of [
    /first stamp(?:'s| is) (?:free|already|waiting|inked)/i,
    /everyone wins/i,
    /no spam/i,
    /no account/i,
    /on us/i,
    /£0\.00/i,
  ]) {
    assert.doesNotMatch(customerCopy, forbiddenClaim)
  }
})

test("browser and PDF adapters use explicit exhaustive renderer registries", () => {
  const browserRegistry = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "poster-renderer-registry.tsx"
  )
  const pdfRegistry = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-registry.ts"
  )
  const browserHost = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "a4-poster.tsx"
  )
  const pdfHost = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-render.ts"
  )

  assert.match(browserRegistry, /satisfies Record<QrPosterTemplateId/)
  assert.match(pdfRegistry, /satisfies Record<PosterDesignId/)
  assert.match(browserHost, /PosterDesignSheet/)
  assert.match(pdfHost, /drawPosterPdf/)
  assert.doesNotMatch(browserHost, /template ===/)
  assert.doesNotMatch(pdfHost, /content\.id ===/)
})

test("emailed poster PDFs embed the Wet Ink typefaces", () => {
  const documentModule = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-document.ts"
  )
  assert.match(documentModule, /registerFontkit\(fontkit\)/)

  for (const filename of [
    "BricolageGrotesque-Regular.ttf",
    "BricolageGrotesque-Bold.ttf",
    "SpaceMono-Regular.ttf",
    "SpaceMono-Bold.ttf",
  ]) {
    assert.ok(
      statSync(path.join(projectRoot, "assets", "fonts", filename)).size >
        1_000,
      `${filename} is present and non-empty`
    )
  }
})
