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

test("Given a live merchant QR When A4 poster templates are offered Then the current registry styles are linked", () => {
  // Given
  const qrPanel = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-panel-live.tsx"
  )
  const posterTemplates = readProjectFile("lib", "qr", "poster-templates.ts")

  // When / Then
  assert.match(qrPanel, /Print a counter poster/)
  assert.match(qrPanel, /QR_POSTER_TEMPLATES\.map/)
  assert.match(
    qrPanel,
    /href=\{`\/app\/qr\/poster\/\$\{template\.id\}\?qr=\$\{qrCodeId\}&from=\$\{encodeURIComponent\(returnHref\)\}`\}/
  )
  assert.match(posterTemplates, /"editorial"/)
  assert.match(posterTemplates, /"bold"/)
  assert.match(posterTemplates, /"ticket"/)
  assert.match(posterTemplates, /"northstar"/)
  assert.match(posterTemplates, /"thermal"/)
})

test("Given the A4 poster route When implementation is inspected Then it uses protected QR context without the old asset pipeline", () => {
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
  ].join("\n")

  // When / Then
  assert.match(posterPage, /getOwnedQrImageContext/)
  assert.match(posterPage, /renderQrCodePng/)
  assert.match(posterTemplates, /editorial/)
  assert.match(posterTemplates, /bold/)
  assert.match(posterTemplates, /ticket/)
  assert.match(posterTemplates, /northstar/)
  assert.match(posterTemplates, /thermal/)
  assert.match(posterSurface, /210mm/)
  assert.match(posterSurface, /297mm/)
  assert.match(posterSurface, /No app · 20 seconds · No spam/)
  assert.match(posterSurface, /No app download · Scan in 20 seconds/)
  assert.match(posterSurface, /No account needed · Takes 20 seconds/)
  assert.match(posterSurface, /Scan to claim your free stamp/)
  assert.match(posterSurface, /Scan to unlock your mystery reward/)
  assert.match(posterSurface, /One stamp a day · Reward revealed when unlocked/)
  assert.match(posterSurface, /No cash · No app · 20 seconds/)
  assert.match(posterSurface, /Mystery reward/)
  assert.match(posterSurface, /\.tearLine/)
  assert.match(posterSurface, /border-top: 2px dashed var\(--w-line\)/)
  assert.match(posterSurface, /88mm/)
  assert.match(posterSurface, /92mm/)
  assert.match(posterSurface, /86mm/)
  assert.match(posterSurface, /82mm/)
  assert.match(posterSurface, /66mm/)
  assert.match(posterSurface, /@media print/)
  assert.doesNotMatch(
    [posterPage, posterSurface].join("\n"),
    /pdf-lib|sharp|qr_assets|asset-store/
  )
})
