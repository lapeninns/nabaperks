import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
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

test("Given a live merchant QR When A4 poster templates are offered Then all current templates are linked", () => {
  // Given
  const qrPanelLive = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-panel-live.tsx"
  )
  const qrWorkspace = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-redesign-concept.tsx"
  )
  const posterTemplates = readProjectFile("lib", "qr", "poster-templates.ts")
  const posterDesigns = JSON.parse(
    readProjectFile("config", "poster-designs.json")
  )
  const templateIds = [
    "editorial",
    "bold",
    "ticket",
    "northstar",
    "thermal",
    "table-tent",
    "table-tent-night",
    "table-tent-studio",
  ]

  // When / Then
  assert.match(qrPanelLive, /QrWorkspace/)
  assert.match(qrWorkspace, /QR_POSTER_TEMPLATES\.map/)
  assert.match(
    qrPanelLive,
    /`\/app\/qr\/poster\/\$\{template\}\?qr=\$\{qrCodeId\}&from=\$\{encodeURIComponent\(returnHref\)\}`/
  )
  for (const templateId of templateIds) {
    assert.ok(
      posterDesigns.templates.some((template) => template.id === templateId),
      `catalogue includes ${templateId}`
    )
  }
  assert.match(posterTemplates, /posterDesignIds\(\)/)
})

test("Given the A4 poster route When implementation is inspected Then it uses protected QR context and current poster surfaces", () => {
  // Given
  const posterPage = readProjectFile(
    "app",
    "app",
    "qr",
    "poster",
    "[template]",
    "page.tsx"
  )
  const posterComponent = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "a4-poster.tsx"
  )
  const posterStyles = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "a4-poster.module.css"
  )
  const posterCopy = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "poster-copy.ts"
  )
  const posterPieces = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "poster-pieces.tsx"
  )
  const posterVariants = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "poster-variants.tsx"
  )
  const northstarPoster = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "northstar",
    "northstar-poster.tsx"
  )
  const northstarStyles = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "northstar",
    "northstar-poster.module.css"
  )
  const thermalPoster = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "thermal",
    "thermal-poster.tsx"
  )
  const thermalStyles = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "thermal",
    "thermal-poster.module.css"
  )
  const tableTentPoster = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "table-tent",
    "table-tent-poster.tsx"
  )
  const tableTentStyles = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "table-tent",
    "table-tent-poster.module.css"
  )
  const posterDesigns = readProjectFile("config", "poster-designs.json")
  const posterTemplates = readProjectFile("lib", "qr", "poster-templates.ts")
  const posterSurface = [
    posterComponent,
    posterStyles,
    posterCopy,
    posterPieces,
    posterVariants,
    northstarPoster,
    northstarStyles,
    thermalPoster,
    thermalStyles,
    tableTentPoster,
    tableTentStyles,
    posterDesigns,
  ].join("\n")

  // When / Then
  assert.match(posterPage, /getOwnedQrImageContext/)
  assert.match(posterPage, /renderPosterQrCodePng/)
  assert.match(posterTemplates, /posterDesignIds\(\)/)
  assert.match(posterTemplates, /posterTableTentIds\(\)/)
  assert.match(posterTemplates, /isQrPosterTableTent/)
  assert.match(posterComponent, /if \(template === "northstar"\)/)
  assert.match(posterComponent, /if \(template === "thermal"\)/)
  assert.match(posterComponent, /if \(template === "table-tent"\)/)
  assert.match(posterComponent, /if \(template === "table-tent-night"\)/)
  assert.match(posterComponent, /if \(template === "table-tent-studio"\)/)
  assert.match(posterComponent, /TableTentNightPoster/)
  assert.match(posterComponent, /TableTentStudioPoster/)
  assert.match(posterComponent, /isQrPosterTableTent/)
  assert.match(posterSurface, /210mm/)
  assert.match(posterSurface, /297mm/)
  assert.match(posterSurface, /No app — opens in your browser/)
  assert.match(posterSurface, /One text\. No password\./)
  assert.match(posterSurface, /Scan for today's stamp/)
  assert.match(posterSurface, /Scan to open your card/)
  assert.match(posterSurface, /18\+ to redeem/)
  assert.match(posterSurface, /Rewards redeem from the next weekday/)
  assert.doesNotMatch(posterSurface, /No app · No download · No spam/)
  assert.doesNotMatch(posterSurface, /No account needed/)
  assert.doesNotMatch(posterSurface, /claim your free stamp/i)
  assert.doesNotMatch(posterSurface, /Everyone wins/i)
  assert.doesNotMatch(posterSurface, /20 seconds/)
  assert.match(posterSurface, /venue reward/i)
  assert.match(posterStyles, /width: 52mm/)
  assert.match(posterStyles, /width: 55mm/)
  assert.match(northstarStyles, /width: 52mm/)
  assert.match(thermalStyles, /width: 52mm/)
  assert.doesNotMatch(
    posterVariants,
    /convQrHolder|boldQrHolder|ticketQrHolder/
  )
  assert.match(posterSurface, /@media print/)
  assert.match(tableTentStyles, /size: B5 portrait/)
  assert.match(tableTentStyles, /rotate\(180deg\)/)
  assert.match(tableTentStyles, /--face-h: 125mm/)
  assert.match(tableTentStyles, /176mm/)
  assert.match(tableTentStyles, /250mm/)
  assert.match(tableTentStyles, /grid-template-rows: 25mm 80mm 20mm/)
  assert.match(tableTentStyles, /width: 46mm/)
  assert.match(tableTentStyles, /width: 48mm/)
  assert.match(tableTentStyles, /\.scan/)
  assert.match(tableTentStyles, /var\(--w-accent\)/)
  const tentShared = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "table-tent",
    "faces",
    "shared.tsx"
  )
  assert.match(tentShared, /className=\{styles\.foldGuide\}/)
  assert.doesNotMatch(tentShared, /Fold to peak/)
  assert.match(tentShared, /TableTentSheet/)
  assert.match(tableTentPoster, /MysteryTentFace/)
  assert.match(tableTentPoster, /TicketTentFace/)
  assert.match(tableTentPoster, /TableTentSheet/)
  const nightPoster = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "table-tent",
    "table-tent-night-poster.tsx"
  )
  const studioPoster = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "table-tent",
    "table-tent-studio-poster.tsx"
  )
  const mysteryFace = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "table-tent",
    "faces",
    "mystery-face.tsx"
  )
  const ticketFace = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "table-tent",
    "faces",
    "ticket-face.tsx"
  )
  assert.match(nightPoster, /NightTentFace/)
  assert.match(nightPoster, /ReceiptTentFace/)
  assert.match(studioPoster, /EditorialTentFace/)
  assert.match(studioPoster, /BoldTentFace/)
  assert.match(tableTentStyles, /\.nightFace/)
  assert.match(tableTentStyles, /\.receiptFace/)
  assert.match(tableTentStyles, /\.studioMain/)
  assert.match(tableTentStyles, /\.boldFace/)
  assert.match(mysteryFace, /resolveBaseTentContent/)
  assert.match(posterDesigns, /Your visits/)
  assert.match(posterDesigns, /leave a/)
  assert.match(posterDesigns, /Fill the card\. Reveal a venue reward/)
  assert.match(posterDesigns, /Scan for today's/)
  assert.match(posterDesigns, /One visit stamp here per UK date/)
  assert.match(posterDesigns, /Rewards redeem from the next weekday/)
  assert.match(ticketFace, /resolveBaseTentContent/)
  assert.match(ticketFace, /ticketHook/)
  assert.match(ticketFace, /ticketStrap/)
  assert.match(ticketFace, /ticketClaim/)
  assert.match(posterDesigns, /One text\. No password\./)
  assert.match(posterDesigns, /Stamp one starts here\./)
  assert.match(tableTentStyles, /\.ticketStrap/)
  assert.match(tableTentStyles, /\.ticketTear/)
  assert.match(tableTentStyles, /\.ticketClaim/)
  const posterPdf = readProjectFile("lib", "notifications", "poster-pdf.ts")
  const posterPdfRender = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-render.ts"
  )
  const posterPdfB5 = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-b5.ts"
  )
  assert.match(posterPdf, /renderPosterPdf/)
  assert.match(posterPdfRender, /resolvePosterContent/)
  assert.match(posterPdfRender, /drawTableTentPdf/)
  assert.match(posterPdfB5, /drawTicketB5Face/)
  assert.match(posterPdfB5, /drawMysteryB5Face/)
  assert.match(posterPdfB5, /drawNightB5Face/)
  assert.match(posterPdfB5, /drawReceiptB5Face/)
  assert.match(posterPdfB5, /drawBoldB5Face/)
  assert.match(posterPdfB5, /drawEditorialB5Face/)
  assert.match(posterStyles, /\.pageB5/)
  assert.doesNotMatch(posterStyles, /\.pageLandscape/)
  assert.doesNotMatch(
    [posterPage, posterSurface].join("\n"),
    /pdf-lib|sharp|qr_assets|asset-store/
  )
})

test("Given poster QR styling When QR assets are rendered Then non-poster routes keep the generic QR contract", () => {
  const assets = readProjectFile("lib", "qr", "assets.ts")
  const posterPage = readProjectFile(
    "app",
    "app",
    "qr",
    "poster",
    "[template]",
    "page.tsx"
  )
  const rewardQrRoute = readProjectFile(
    "app",
    "reward",
    "[rewardId]",
    "qr.png",
    "route.ts"
  )

  assert.match(assets, /export function renderPosterQrCodePng/)
  assert.match(assets, /export function renderQrCodePng/)
  assert.match(assets, /dark: "#000000"/)
  assert.match(posterPage, /renderPosterQrCodePng/)
  assert.doesNotMatch(rewardQrRoute, /renderPosterQrCodePng/)
  assert.match(rewardQrRoute, /renderQrCodePng/)
})
