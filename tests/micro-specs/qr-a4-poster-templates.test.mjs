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

test("Given a live merchant QR When A4 poster templates are offered Then all three reference styles are linked", () => {
  // Given
  const qrPanel = readProjectFile(
    "components",
    "merchant",
    "launch",
    "qr-panel.tsx"
  )

  // When / Then
  assert.match(qrPanel, /A4 poster templates/)
  assert.match(qrPanel, /\/app\/qr\/poster\/editorial\?qr=/)
  assert.match(qrPanel, /\/app\/qr\/poster\/bold\?qr=/)
  assert.match(qrPanel, /\/app\/qr\/poster\/ticket\?qr=/)
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
  const posterTemplates = readProjectFile("lib", "qr", "poster-templates.ts")
  const posterSurface = [
    posterComponent,
    posterStyles,
    posterCopy,
    posterPieces,
    posterVariants,
  ].join("\n")

  // When / Then
  assert.match(posterPage, /getOwnedQrImageContext/)
  assert.match(posterPage, /renderQrCodePng/)
  assert.match(posterTemplates, /editorial/)
  assert.match(posterTemplates, /bold/)
  assert.match(posterTemplates, /ticket/)
  assert.match(posterSurface, /210mm/)
  assert.match(posterSurface, /297mm/)
  assert.match(posterSurface, /Free · No app · 20 seconds/)
  assert.match(posterSurface, /Scan &amp; keep your card/)
  assert.match(posterSurface, /Visit twice more/)
  assert.match(posterSurface, /Break the seal/)
  assert.match(posterSurface, /Admit one · per day/)
  assert.match(posterSurface, /clip-path: polygon/)
  assert.match(posterSurface, /108mm/)
  assert.match(posterSurface, /66mm/)
  assert.match(posterSurface, /62mm/)
  assert.match(posterSurface, /@media print/)
  assert.doesNotMatch(
    [posterPage, posterSurface].join("\n"),
    /pdf-lib|sharp|qr_assets|asset-store/
  )
})
