import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const fontDirectory = path.join(projectRoot, "assets", "fonts")

const FONT_HASHES = new Map([
  [
    "BricolageGrotesque-Regular.ttf",
    "dcfe24ee4e7aa40aa13a91837acca9b170befd4dbbbcf9e084a0db1c1676e06f",
  ],
  [
    "BricolageGrotesque-Bold.ttf",
    "f83cb3f1ddb91bdb02868eeddb4f817b326aef993f96fe6f8a3b40b0f31c689b",
  ],
  [
    "SpaceMono-Regular.ttf",
    "95837e182baeeada83368f7748db28357f0a1b75c6b84ff7065b5edf933c8e18",
  ],
  [
    "SpaceMono-Bold.ttf",
    "405e73d41afb7e5906efce206a326af5c956f38e255f35421c260e861e599c59",
  ],
])

function source(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Wet Ink browser and PDF fonts are pinned local binaries", () => {
  for (const [filename, expectedHash] of FONT_HASHES) {
    const bytes = readFileSync(path.join(fontDirectory, filename))
    assert.equal(bytes.subarray(0, 4).toString("hex"), "00010000")
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash)
  }

  assert.match(
    source("assets", "fonts", "BricolageGrotesque-OFL.txt"),
    /SIL OPEN FONT LICENSE/i
  )
  assert.match(
    source("assets", "fonts", "SpaceMono-OFL.txt"),
    /SIL OPEN FONT LICENSE/i
  )
  const provenance = source("assets", "fonts", "README.md")
  assert.match(provenance, /84745e5b96261ae5f8c6c856e262fe78d1d6efdd/)
  assert.match(provenance, /389b770410cc0b7c21c85673bfa2077420fe7f65/)
})

test("the app consumes local web fonts and the PDF renderer retains their TTF sources", () => {
  const layout = source("app", "layout.tsx")
  const webFonts = source("lib", "brand-fonts.ts")
  const pdfDocument = source("lib", "notifications", "poster-pdf-document.ts")
  const nextConfig = source("next.config.ts")
  const packageManifest = source("package.json")

  assert.match(webFonts, /next\/font\/local/)
  assert.match(layout, /BRAND_FONT_CLASSES/)
  assert.match(layout, /BRAND_FONT_VARIABLES/)
  assert.doesNotMatch(layout + webFonts, /next\/font\/google/)
  for (const filename of FONT_HASHES.keys()) {
    const webFilename = filename.replace(".ttf", ".woff2")
    assert.match(webFonts, new RegExp(webFilename.replace(".", "\\.")))
    assert.match(pdfDocument, new RegExp(filename.replace(".", "\\.")))
  }
  assert.match(webFonts, /--font-bricolage-grotesque/)
  assert.match(webFonts, /--font-space-mono/)
  assert.match(nextConfig, /assets\/fonts\/\*\.ttf/)
  assert.match(packageManifest, /"@pdf-lib\/fontkit"/)
  assert.equal((pdfDocument.match(/subset: true/g) ?? []).length, 4)
  assert.match(pdfDocument, /retainPosterFontPrograms/)
  assert.match(pdfDocument, /opacity: 0/)
})

// Pin the verified outputs of scripts/build-web-fonts.py.
const WEB_FONT_HASHES = new Map([
  [
    "BricolageGrotesque-Bold-Latin.woff2",
    "01081ecda5acc3de84bd75ffec044c359537226205d114cb42461c8023141800",
  ],
  [
    "BricolageGrotesque-Bold.woff2",
    "29219a61395efea3da60516dc884a984cbd46c521f24911018704260672b91ca",
  ],
  [
    "BricolageGrotesque-Regular-Latin.woff2",
    "5e826be6b3092c89df003db683ec61357fb3718bbc7cd6589e428ed745359b96",
  ],
  [
    "BricolageGrotesque-Regular.woff2",
    "fdbd0f157ab1a2fabad32a0b5aa9c687370bc7d889efde2339d33882a133af37",
  ],
  [
    "SpaceMono-Bold-Latin.woff2",
    "26b0d05365911a6c830ede610f5c2f22b3198752c893e0e0281f8ff579268737",
  ],
  [
    "SpaceMono-Bold.woff2",
    "aa90806275743a460cb47b707d975c27358473cd6068bba1d4c62d13d747b120",
  ],
  [
    "SpaceMono-Regular-Latin.woff2",
    "183d819efd15f02383d5588e66b604d105101a5e3cf4aefafb41ad4a60740f44",
  ],
  [
    "SpaceMono-Regular.woff2",
    "a3281287939a152ec1485709aff1a77515b4f0d657a24fcda3a5a439aa39adb2",
  ],
])

test("web fonts retain the verified lossless WOFF2 outputs", () => {
  for (const [filename, expectedHash] of WEB_FONT_HASHES) {
    const bytes = readFileSync(path.join(fontDirectory, filename))
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "wOF2")
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash)
  }
})
