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

test("the app and PDF renderer consume the same four local font files", () => {
  const layout = source("app", "layout.tsx")
  const pdfDocument = source("lib", "notifications", "poster-pdf-document.ts")
  const nextConfig = source("next.config.ts")
  const packageManifest = source("package.json")

  assert.match(layout, /next\/font\/local/)
  assert.doesNotMatch(layout, /next\/font\/google/)
  for (const filename of FONT_HASHES.keys()) {
    assert.match(layout, new RegExp(filename.replace(".", "\\.")))
    assert.match(pdfDocument, new RegExp(filename.replace(".", "\\.")))
  }
  assert.match(layout, /--font-bricolage-grotesque/)
  assert.match(layout, /--font-space-mono/)
  assert.match(nextConfig, /assets\/fonts\/\*\.ttf/)
  assert.match(packageManifest, /"@pdf-lib\/fontkit"/)
  assert.equal((pdfDocument.match(/subset: true/g) ?? []).length, 4)
  assert.match(pdfDocument, /retainPosterFontPrograms/)
  assert.match(pdfDocument, /opacity: 0/)
})
