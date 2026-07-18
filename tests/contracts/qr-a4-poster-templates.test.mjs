import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

const projectRoot = process.cwd()
const readProjectFile = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

test("merchant QR surfaces link every registered A4 poster", () => {
  const catalog = JSON.parse(readProjectFile("config", "poster-designs.json"))
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

  assert.equal(catalog.templates.length, 5)
  assert.ok(catalog.templates.every(({ sheet }) => sheet === "a4"))
  assert.match(qrPanelLive, /QrWorkspace/)
  assert.match(qrWorkspace, /QR_POSTER_TEMPLATES\.map/)
  assert.match(
    qrPanelLive,
    /`\/app\/qr\/poster\/\$\{template\}\?qr=\$\{qrCodeId\}&from=\$\{encodeURIComponent\(returnHref\)\}`/
  )
})

test("poster route uses protected QR context and the unified render hosts", () => {
  const posterPage = readProjectFile(
    "app",
    "app",
    "qr",
    "poster",
    "[template]",
    "page.tsx"
  )
  const browserHost = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "a4-poster.tsx"
  )
  const browserRegistry = readProjectFile(
    "components",
    "merchant",
    "qr-poster",
    "poster-renderer-registry.tsx"
  )
  const pdfHost = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-render.ts"
  )
  const pdfRegistry = readProjectFile(
    "lib",
    "notifications",
    "poster-pdf-registry.ts"
  )

  assert.match(posterPage, /getOwnedQrImageContext/)
  assert.match(posterPage, /renderPosterQrCodePng/)
  assert.match(browserHost, /data-sheet="a4"/)
  assert.match(browserHost, /PosterDesignSheet/)
  assert.match(browserRegistry, /POSTER_BROWSER_RENDERERS/)
  assert.match(pdfHost, /resolvePosterContent/)
  assert.match(pdfHost, /drawPosterPdf/)
  assert.match(pdfRegistry, /POSTER_PDF_RENDERERS/)
  assert.doesNotMatch(
    [posterPage, browserHost, browserRegistry].join("\n"),
    /pdf-lib|sharp|qr_assets|asset-store/
  )
})

test("poster source no longer contains B5 or table-tent adapters", () => {
  const source = [
    readProjectFile("config", "poster-designs.json"),
    readProjectFile("lib", "qr", "poster-templates.ts"),
    readProjectFile(
      "components",
      "merchant",
      "qr-poster",
      "poster-renderer-registry.tsx"
    ),
    readProjectFile("lib", "notifications", "poster-pdf-registry.ts"),
  ].join("\n")

  assert.doesNotMatch(source, /table-tent|b5/i)
})
