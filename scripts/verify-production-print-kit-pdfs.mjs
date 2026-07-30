import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { spawnSync } from "node:child_process"

import { PDFDocument } from "pdf-lib"

import { closePrintKitBrowser } from "@/lib/notifications/print-kit-browser"
import {
  buildNfcCardPdfAttachmentsFromPreview,
  buildNfcSquarePdfAttachmentsFromPreview,
  buildPosterPdfAttachmentsFromPreview,
  buildTentPdfAttachmentsFromPreview,
} from "@/lib/notifications/print-kit-preview-export"
import { assertPrintKitPreviewOrigin } from "@/lib/notifications/print-kit-preview-pdf"
import { NFC_CARD_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-card-templates"
import { NFC_SQUARE_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-square-templates"
import {
  duplexPosterFilename,
  QR_POSTER_PRODUCTION_DUPLEX_PAIRS,
} from "@/lib/qr/poster-duplex-pairs"
import { TENT_PRODUCTION_DESIGNS } from "@/lib/qr/tent-templates"

const APP_ORIGIN = "https://nabaperks.com"
const QR_ID = "pdf-verification"
const JOIN_TARGET = `${APP_ORIGIN}/q/${QR_ID}`
const NFC_QR_TARGET = `${JOIN_TARGET}?src=qr`
const REVIEW_TARGET =
  "https://search.google.com/local/writereview?placeid=ChIJb2pwmRLdd0gRMWzw4D30wQ4"
const VERIFICATION_VENUE =
  "The Extraordinarily Long Crown and Anchor Community Public House".slice(
    0,
    60
  )
const REQUIRED_TOOLS = ["pdftoppm", "pdffonts", "identify", "python3"]
const POINTS_PER_MM = 72 / 25.4
const PIXELS_PER_MM_300_DPI = 300 / 25.4
const FORMAT = {
  a4: { widthMm: 210, heightMm: 297 },
  cr80: { widthMm: 85.5, heightMm: 54 },
  square100: { widthMm: 100, heightMm: 100 },
}

const OPENCV_DECODE = `
import cv2, json, sys
image = cv2.imread(sys.argv[1])
if image is None:
    raise RuntimeError("OpenCV could not read raster")
detector = cv2.QRCodeDetector()
ok, values, points, _ = detector.detectAndDecodeMulti(image)
decoded = [value for value in values if value] if ok else []
if not decoded:
    value, _, _ = detector.detectAndDecode(image)
    decoded = [value] if value else []
print(json.dumps(decoded))
`

function run(executable, args) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${args.join(" ")} failed: ${result.stderr || result.stdout}`
    )
  }
  return result.stdout
}

function requiredTools() {
  const tools = new Map()
  for (const name of REQUIRED_TOOLS) {
    const result = spawnSync("which", [name], { encoding: "utf8" })
    if (result.status !== 0)
      throw new Error(`Missing required PDF QA tool: ${name}`)
    tools.set(name, result.stdout.trim())
  }
  run(tools.get("python3"), ["-c", "import cv2"])
  return tools
}

function assertNear(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, received ${actual}`
  )
}

export function parseEmbeddedPdfFonts(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => /^\S+\s+(?:CID|Type|TrueType)/.test(line))
    .map((line) => {
      const columns = line.trim().split(/\s+/)
      return { name: columns[0], embedded: columns[4] === "yes" }
    })
}

export function productionPrintKitExpectations() {
  return [
    ...QR_POSTER_PRODUCTION_DUPLEX_PAIRS.map((pair) => ({
      filename: duplexPosterFilename(pair),
      format: "a4",
      pages: 2,
      targets: [JOIN_TARGET, JOIN_TARGET],
    })),
    ...TENT_PRODUCTION_DESIGNS.map(({ id }) => ({
      filename: `nabaperks-tent-${id}.pdf`,
      format: "a4",
      pages: 1,
      targets: [JOIN_TARGET, JOIN_TARGET],
    })),
    ...NFC_CARD_PRODUCTION_DESIGNS.map(({ id }) => ({
      filename: `nabaperks-nfc-card-${id}.pdf`,
      format: "cr80",
      pages: 2,
      targets: [id === "google-review" ? REVIEW_TARGET : NFC_QR_TARGET],
    })),
    ...NFC_SQUARE_PRODUCTION_DESIGNS.map(({ id }) => ({
      filename: `nabaperks-nfc-plate-${id}.pdf`,
      format: "square100",
      pages: 1,
      targets: [id === "google-review" ? REVIEW_TARGET : NFC_QR_TARGET],
    })),
  ]
}

async function buildProductionAttachments(previewOrigin) {
  const input = {
    previewOrigin,
    appOrigin: APP_ORIGIN,
    merchantName: VERIFICATION_VENUE,
    qrId: QR_ID,
    stampsRequired: 6,
    locality: "Hartford",
    googleReviewUrl: REVIEW_TARGET,
  }
  const attachments = []
  attachments.push(...(await buildPosterPdfAttachmentsFromPreview(input)))
  attachments.push(...(await buildTentPdfAttachmentsFromPreview(input)))
  attachments.push(...(await buildNfcCardPdfAttachmentsFromPreview(input)))
  attachments.push(...(await buildNfcSquarePdfAttachmentsFromPreview(input)))
  return attachments
}

async function verifyAttachment(
  attachment,
  expectation,
  outputDirectory,
  tools
) {
  const pdfBytes = Buffer.from(attachment.content, "base64")
  assert.ok(pdfBytes.byteLength > 10_000, `${attachment.filename} has artwork`)
  const pdfPath = path.join(outputDirectory, attachment.filename)
  await writeFile(pdfPath, pdfBytes)

  const document = await PDFDocument.load(pdfBytes)
  assert.equal(document.getPageCount(), expectation.pages)
  const format = FORMAT[expectation.format]
  for (const [index, page] of document.getPages().entries()) {
    assertNear(
      page.getWidth(),
      format.widthMm * POINTS_PER_MM,
      1,
      `${attachment.filename} page ${index + 1} width`
    )
    assertNear(
      page.getHeight(),
      format.heightMm * POINTS_PER_MM,
      1,
      `${attachment.filename} page ${index + 1} height`
    )
  }

  const fonts = parseEmbeddedPdfFonts(run(tools.get("pdffonts"), [pdfPath]))
  assert.ok(fonts.length > 0, `${attachment.filename} contains print fonts`)
  assert.ok(
    fonts.every(({ embedded }) => embedded),
    `${attachment.filename} embeds every font`
  )

  const rasterBase = path.join(
    outputDirectory,
    attachment.filename.replace(/\.pdf$/, "-300dpi")
  )
  run(tools.get("pdftoppm"), ["-png", "-r", "300", pdfPath, rasterBase])

  const decoded = []
  for (let page = 1; page <= expectation.pages; page += 1) {
    const rasterPath = `${rasterBase}-${page}.png`
    const dimensions = run(tools.get("identify"), [
      "-format",
      "%w %h",
      rasterPath,
    ])
      .trim()
      .split(/\s+/)
      .map(Number)
    assertNear(
      dimensions[0],
      format.widthMm * PIXELS_PER_MM_300_DPI,
      4,
      `${attachment.filename} page ${page} raster width`
    )
    assertNear(
      dimensions[1],
      format.heightMm * PIXELS_PER_MM_300_DPI,
      4,
      `${attachment.filename} page ${page} raster height`
    )
    decoded.push(
      ...JSON.parse(
        run(tools.get("python3"), ["-c", OPENCV_DECODE, rasterPath])
      )
    )
  }
  assert.deepEqual(
    decoded.sort(),
    [...expectation.targets].sort(),
    `${attachment.filename} QR destinations`
  )

  return {
    filename: attachment.filename,
    format: expectation.format,
    pages: expectation.pages,
    fonts,
    decodedQrs: decoded,
  }
}

export async function verifyProductionPrintKitPdfs({
  outputDirectory,
  previewOrigin,
}) {
  const tools = requiredTools()
  await mkdir(outputDirectory, { recursive: true })
  await assertPrintKitPreviewOrigin(previewOrigin)

  const expectations = productionPrintKitExpectations()
  const attachments = await buildProductionAttachments(previewOrigin)
  assert.deepEqual(
    attachments.map(({ filename }) => filename),
    expectations.map(({ filename }) => filename),
    "production preview export emits the complete typed print kit"
  )

  const files = []
  for (let index = 0; index < attachments.length; index += 1) {
    files.push(
      await verifyAttachment(
        attachments[index],
        expectations[index],
        outputDirectory,
        tools
      )
    )
  }

  const report = {
    generatedAt: new Date().toISOString(),
    previewOrigin,
    renderMode: "playwright-dev-preview",
    fileCount: files.length,
    pageCount: files.reduce((sum, file) => sum + file.pages, 0),
    qrFaceCount: files.reduce((sum, file) => sum + file.decodedQrs.length, 0),
    files,
  }
  assert.equal(report.fileCount, 13)
  assert.equal(report.pageCount, 19)
  assert.equal(report.qrFaceCount, 22)
  await writeFile(
    path.join(outputDirectory, "production-print-kit-verification.json"),
    `${JSON.stringify(report, null, 2)}\n`
  )
  return report
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : ""
if (import.meta.url === invokedPath) {
  const outputDirectory = path.resolve(
    process.env.POSTER_EVIDENCE_DIR ||
      path.join("tmp", "pdfs", "production-print-kit-verified")
  )
  const previewOrigin = (
    process.env.PRINT_KIT_PREVIEW_ORIGIN || "http://127.0.0.1:3000"
  ).replace(/\/$/, "")
  try {
    const report = await verifyProductionPrintKitPdfs({
      outputDirectory,
      previewOrigin,
    })
    console.log(
      `Verified ${report.fileCount} production PDFs, ${report.pageCount} pages and ${report.qrFaceCount} QR faces in ${outputDirectory}`
    )
  } finally {
    await closePrintKitBrowser()
  }
}
