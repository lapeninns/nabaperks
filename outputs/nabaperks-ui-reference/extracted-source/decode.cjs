#!/usr/bin/env node
/* Decode the Nabaperks self-unpacking HTML bundle into readable source files. */
const fs = require("fs")
const path = require("path")
const zlib = require("zlib")

const SRC = "/Users/amankumarshrestha/Downloads/Nabaperks Full Flow.html"
const OUT =
  "/Users/amankumarshrestha/LapenInns Project/Nabaperks/outputs/nabaperks-ui-reference/extracted-source"

const html = fs.readFileSync(SRC, "utf8")

function extractScript(type) {
  const open = `<script type="${type}">`
  const start = html.indexOf(open)
  if (start === -1) return null
  const contentStart = start + open.length
  const end = html.indexOf("</script>", contentStart)
  return html.slice(contentStart, end).trim()
}

const manifestRaw = extractScript("__bundler/manifest")
const templateRaw = extractScript("__bundler/template")
const extResRaw = extractScript("__bundler/ext_resources")

const report = { assets: [], template: null, extResources: null }

// --- template (JSON-encoded HTML string) ---
if (templateRaw) {
  const template = JSON.parse(templateRaw)
  fs.writeFileSync(path.join(OUT, "template.html"), template)
  report.template = { bytes: template.length }
}

// --- ext_resources ---
if (extResRaw) {
  report.extResources = JSON.parse(extResRaw)
}

// --- manifest assets ---
const MIME_EXT = {
  "text/javascript": "js",
  "application/javascript": "js",
  "text/css": "css",
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "text/html": "html",
  "application/json": "json",
}

if (manifestRaw) {
  const manifest = JSON.parse(manifestRaw)
  let i = 0
  for (const [uuid, entry] of Object.entries(manifest)) {
    let buf = Buffer.from(entry.data, "base64")
    const compressedBytes = buf.length
    if (entry.compressed) {
      try {
        buf = zlib.gunzipSync(buf)
      } catch (e) {
        try {
          buf = zlib.inflateSync(buf)
        } catch (_) {
          /* leave as-is */
        }
      }
    }
    const ext = MIME_EXT[entry.mime] || "bin"
    const name = `asset-${String(i).padStart(2, "0")}.${ext}`
    fs.writeFileSync(path.join(OUT, name), buf)
    report.assets.push({
      file: name,
      uuid,
      mime: entry.mime,
      compressed: !!entry.compressed,
      compressedBytes,
      decodedBytes: buf.length,
    })
    i++
  }
}

fs.writeFileSync(
  path.join(OUT, "_manifest-report.json"),
  JSON.stringify(report, null, 2)
)
console.log(JSON.stringify(report, (k, v) => (k === "extResources" ? v : v), 2))
