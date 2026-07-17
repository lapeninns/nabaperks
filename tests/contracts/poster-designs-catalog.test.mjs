import assert from "node:assert/strict"
import { readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("poster-designs.json catalogues all eight print templates for AI analysis", () => {
  const catalog = JSON.parse(readProjectFile("config", "poster-designs.json"))
  const templatesModule = readProjectFile("lib", "qr", "poster-templates.ts")
  const copyModule = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "poster-copy.ts"
  )

  assert.equal(catalog.schema, "nabaperks.poster-designs.v2")
  assert.equal(catalog.templates.length, 8)

  const ids = catalog.templates.map((template) => template.id)
  for (const id of [
    "editorial",
    "bold",
    "ticket",
    "northstar",
    "thermal",
    "table-tent",
    "table-tent-night",
    "table-tent-studio",
  ]) {
    assert.ok(ids.includes(id), `catalog includes ${id}`)
  }

  assert.match(copyModule, /poster-designs/)
  assert.match(templatesModule, /posterDesignIds\(\)/)
  assert.match(templatesModule, /posterTableTentIds\(\)/)
  assert.doesNotMatch(
    templatesModule,
    /"editorial"|"bold"|"ticket"|"northstar"|"thermal"/,
    "template IDs are not duplicated outside the catalogue parser"
  )
  assert.equal(
    catalog.templates.filter((template) => template.sheet === "b5").length,
    3
  )
  assert.equal(
    catalog.templates.filter((template) => template.sheet === "a4").length,
    5
  )
  assert.match(catalog.product.kitSummary, /Eight print-ready posters/)
})

test("poster catalogue exposes one truthful, closed customer-copy system", () => {
  const catalog = JSON.parse(readProjectFile("config", "poster-designs.json"))
  const customerCopy = JSON.stringify({
    shared: catalog.shared,
    templates: catalog.templates.map((template) => ({
      id: template.id,
      copy: template.copy,
      faces: template.faces,
    })),
  })

  assert.equal(
    catalog.shared.reassurance,
    "18+ to redeem · One visit stamp here per UK date · Rewards redeem from the next weekday · Terms apply"
  )
  assert.deepEqual(Object.keys(catalog.shared.placeholders).sort(), [
    "StampsWord",
    "stamps",
  ])
  assert.deepEqual(catalog.shared.geometry.a4, {
    sheetWidthMm: 210,
    sheetHeightMm: 297,
    safeMarginMm: 15,
  })
  assert.deepEqual(catalog.shared.geometry.b5, {
    sheetWidthMm: 176,
    sheetHeightMm: 250,
    faceHeightMm: 125,
    liveInsetMm: 5,
    foldCorridorMm: 10,
    identityRowMm: 25,
    mainRowMm: 80,
    lowerOcclusionRowMm: 20,
    topRotationDeg: 180,
  })
  assert.deepEqual(catalog.shared.qr.a4, {
    minOuterMm: 52,
    maxOuterMm: 55,
  })
  assert.deepEqual(catalog.shared.qr.b5, {
    minOuterMm: 44,
    maxOuterMm: 48,
  })
  assert.equal(catalog.shared.qr.quietZoneModules, 4)
  assert.equal(catalog.shared.qr.errorCorrectionLevel, "H")
  assert.deepEqual(catalog.shared.typeTiersPt, {
    a4HookMin: 60,
    a4HookMax: 84,
    a4SubstantiveMin: 11,
    a4SubstantiveMax: 18,
    a4FactsMin: 8,
    a4FactsMax: 12,
    b5HookMin: 28,
    b5HookMax: 34,
    b5Hook: 30,
    b5SubstantiveMin: 14,
    b5SubstantiveMax: 16,
    b5Substantive: 14,
    b5FactsMin: 12,
    b5FactsMax: 14,
    b5Facts: 12,
  })
  assert.deepEqual(
    catalog.templates.flatMap((template) =>
      template.sheet === "a4"
        ? [template.qrOuterMm]
        : [template.faces.bottom.qrOuterMm, template.faces.top.qrOuterMm]
    ),
    [52, 55, 52, 52, 52, 46, 48, 46, 46, 46, 46]
  )
  for (const template of catalog.templates.filter(
    ({ sheet }) => sheet === "a4"
  )) {
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

  const unresolvedTokens = customerCopy.match(/\{[A-Za-z][A-Za-z0-9]*\}/g) ?? []
  for (const token of unresolvedTokens) {
    assert.ok(
      token === "{stamps}" || token === "{StampsWord}",
      `unsupported poster placeholder ${token}`
    )
  }
})

test("every B5 face owns copy and print-safe face anatomy", () => {
  const catalog = JSON.parse(readProjectFile("config", "poster-designs.json"))
  const tableTents = catalog.templates.filter(
    (template) => template.sheet === "b5"
  )

  for (const template of tableTents) {
    for (const faceName of ["top", "bottom"]) {
      const face = template.faces[faceName]
      assert.ok(face.copy, `${template.id}.${faceName} has local copy`)
      assert.equal(
        Object.hasOwn(face, "copyRef"),
        false,
        `${template.id}.${faceName} has no legacy copyRef`
      )
    }
    assert.match(template.anatomy.join(" "), /Blank lower 20 mm/)
    assert.match(template.anatomy.join(" "), /Same venue, QR and stamp count/)
  }
})

test("emailed poster PDFs embed the Wet Ink typefaces", () => {
  const documentModule = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-document.ts"
  )
  const packageManifest = readProjectFile("package.json")

  assert.match(packageManifest, /"@pdf-lib\/fontkit"/)
  assert.match(documentModule, /registerFontkit\(fontkit\)/)
  assert.match(documentModule, /BricolageGrotesque-Regular\.ttf/)
  assert.match(documentModule, /BricolageGrotesque-Bold\.ttf/)
  assert.match(documentModule, /SpaceMono-Regular\.ttf/)
  assert.match(documentModule, /SpaceMono-Bold\.ttf/)
  assert.doesNotMatch(documentModule, /StandardFonts/)

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

test("browser and emailed PDF renderers consume the critical copy and QR tokens", () => {
  const qrAssets = readProjectFile("lib", "qr", "assets.ts")
  const a4Standard = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-a4-standard.ts"
  )
  const a4Ticket = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-a4-ticket.ts"
  )
  const a4Concepts = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-a4-concepts.ts"
  )
  const b5Base = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-b5-base.ts"
  )
  const b5Night = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-b5-night.ts"
  )
  const b5Studio = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-b5-studio.ts"
  )
  const modelReaders = readProjectFile("lib", "qr", "poster-model-readers.ts")
  const tokenReaders = readProjectFile("lib", "qr", "poster-token-readers.ts")
  const pdfStyle = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-style.ts"
  )
  const a4Northstar = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-a4-northstar.ts"
  )
  const a4Thermal = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-a4-thermal.ts"
  )

  assert.match(qrAssets, /posterQrDefaults\(\)/)
  assert.match(qrAssets, /dark: qr\.ink/)
  assert.match(qrAssets, /dark: "#000000"/)
  assert.match(qrAssets, /renderPosterQrCodePng/)
  assert.match(tokenReaders, /"#111111"/)
  assert.match(tokenReaders, /"#ffffff"/)
  assert.match(modelReaders, /typeTiers: posterB5TypeTiers\(\)/)
  assert.match(modelReaders, /typeTiers: posterA4TypeTiers\(templateId\)/)
  assert.match(pdfStyle, /POSTER_PALETTE\.accent/)
  assert.doesNotMatch(pdfStyle, /rgb\(207 \/ 255/)
  assert.match(a4Standard, /content\.support/)
  assert.match(a4Standard, /content\.typeTiers\.hookPt/)
  assert.ok(
    (a4Standard.match(/content\.progress/g) ?? []).length >= 2,
    "both standard A4 PDF faces retain prospective progress copy"
  )
  assert.match(a4Ticket, /content\.rewardDetail/)
  assert.match(a4Ticket, /content\.typeTiers\.hookPt/)
  assert.match(a4Ticket, /content\.progress/)
  assert.match(a4Concepts, /poster-pdf-a4-northstar/)
  assert.match(a4Concepts, /poster-pdf-a4-thermal/)
  assert.match(a4Northstar, /content\.ease/)
  assert.match(a4Northstar, /content\.typeTiers\.hookPt/)
  assert.match(a4Thermal, /content\.friction/)
  assert.match(a4Thermal, /content\.typeTiers\.hookPt/)
  assert.match(b5Base, /copy\.editionLabel/)
  assert.match(b5Base, /copy\.scanLabel/)
  assert.match(b5Base, /copy\.frictionLine/)
  assert.ok(
    (b5Base.match(/drawOfferedStampRow/g) ?? []).length >= 3,
    "both base tent PDF faces retain the prospective stamp row"
  )
  assert.match(b5Night, /copy\.chip/)
  assert.match(b5Night, /copy\.friction/)
  assert.ok(
    (b5Studio.match(/drawOfferedStampRow/g) ?? []).length >= 3,
    "both studio tent PDF faces retain the prospective stamp row"
  )
})
