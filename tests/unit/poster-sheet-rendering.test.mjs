import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { build } from "esbuild"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import QRCode from "qrcode"

const bundle = await build({
  entryPoints: ["components/merchant/qr-poster/poster-sheet.tsx"],
  bundle: true,
  write: false,
  outfile: "poster-sheet-proof.cjs",
  platform: "node",
  format: "cjs",
  external: ["react", "react-dom"],
  jsx: "automatic",
  loader: { ".css": "local-css" },
})
const compiled = { exports: {} }
new Function(
  "require",
  "module",
  "exports",
  bundle.outputFiles.find((file) => file.path.endsWith(".cjs")).text
)(createRequire(import.meta.url), compiled, compiled.exports)
const { PosterSheet } = compiled.exports
const catalog = JSON.parse(readFileSync("config/poster-designs.json", "utf8"))
const qrDataUrl = await QRCode.toDataURL(
  "https://example.com/qa-poster-sheet",
  { width: 128 }
)

for (const template of catalog.templates) {
  test(`registered ${template.id} renders the actual A4 sheet with its venue and QR`, () => {
    const html = renderToStaticMarkup(
      createElement(PosterSheet, {
        template: template.id,
        merchantName: "Synthetic QA Venue",
        stampsRequired: 3,
        qrDataUrl,
      })
    )
    assert.match(html, /<article/)
    assert.match(html, /width:210mm/)
    assert.match(html, /height:297mm/)
    assert.ok(html.includes("Synthetic QA Venue"))
    assert.ok(html.includes(qrDataUrl))
    assert.doesNotMatch(html, /Print poster|Poster preview|Save PDF/)
  })
}

test("the sheet retains the supported stamp-count guard", () => {
  assert.throws(
    () =>
      renderToStaticMarkup(
        createElement(PosterSheet, {
          template: catalog.templates[0].id,
          merchantName: "Synthetic QA Venue",
          stampsRequired: 7,
          qrDataUrl,
        })
      ),
    /must be an integer from 1 to 6/
  )
})
