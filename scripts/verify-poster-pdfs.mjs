import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { spawnSync } from "node:child_process"

import { buildAllPosterPdfAttachments } from "@/lib/notifications/poster-pdf"
import { resolvePosterContent } from "@/lib/qr/poster-content"
import { posterDesignIds } from "@/lib/qr/poster-designs"
import {
  containsPosterCopy,
  posterVisibleCopy,
} from "../tests/support/poster-output-copy.mjs"

const QR_TARGET = "https://nabaperks.com/q/pdf-verification"
const VERIFICATION_VENUE =
  "The Extraordinarily Long Crown and Anchor Community Public House".slice(
    0,
    60
  )
const REQUIRED_TOOLS = [
  "pdfinfo",
  "pdftoppm",
  "pdffonts",
  "pdftotext",
  "identify",
  "python3",
]
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
const FITZ_QR_GEOMETRY = `
import fitz, json, statistics, sys
page = fitz.open(sys.argv[1])[0]
drawings = page.get_drawings()

def near_colour(actual, expected):
    return actual is not None and all(abs(a - e) < 0.01 for a, e in zip(actual, expected))

boxes = []
for drawing in drawings:
    rect = drawing["rect"]
    if not near_colour(drawing.get("fill"), (1.0, 1.0, 1.0)):
        continue
    if abs(rect.width - rect.height) > 0.2 or not 110 <= rect.width <= 170:
        continue
    modules = []
    for candidate in drawings:
        module = candidate["rect"]
        if not near_colour(candidate.get("fill"), (17 / 255, 17 / 255, 17 / 255)):
            continue
        if abs(module.width - module.height) > 0.1 or not 1 < module.width < 6:
            continue
        if module.x0 < rect.x0 - 0.1 or module.y0 < rect.y0 - 0.1:
            continue
        if module.x1 > rect.x1 + 0.1 or module.y1 > rect.y1 + 0.1:
            continue
        modules.append(module)
    if len(modules) < 100:
        continue
    module_size = statistics.median(module.width for module in modules)
    data_x0 = min(module.x0 for module in modules)
    data_y0 = min(module.y0 for module in modules)
    data_x1 = max(module.x1 for module in modules)
    data_y1 = max(module.y1 for module in modules)
    boxes.append({
        "outerPt": rect.width,
        "outerMm": rect.width * 25.4 / 72,
        "modulePt": module_size,
        "dataModulesX": round((data_x1 - data_x0) / module_size),
        "dataModulesY": round((data_y1 - data_y0) / module_size),
        "quietLeft": round((data_x0 - rect.x0) / module_size),
        "quietRight": round((rect.x1 - data_x1) / module_size),
        "quietBottom": round((data_y0 - rect.y0) / module_size),
        "quietTop": round((rect.y1 - data_y1) / module_size),
    })
print(json.dumps(boxes))
`
const FITZ_LAYOUT_GEOMETRY = `
import fitz, json, sys
page = fitz.open(sys.argv[1])[0]
mm = 72 / 25.4
drawings = page.get_drawings()

lines = []
max_text_pt = 0
for block in page.get_text("dict")["blocks"]:
    for line in block.get("lines", []):
        text = "".join(span["text"] for span in line["spans"]).strip()
        if not text:
            continue
        max_text_pt = max(max_text_pt, *(span["size"] for span in line["spans"]))
        lines.append({"text": text, "bbox": line["bbox"], "dir": line["dir"]})

qr_boxes = []
for drawing in drawings:
    rect = drawing["rect"]
    fill = drawing.get("fill")
    if fill is None or not all(abs(value - 1.0) < 0.01 for value in fill):
        continue
    if abs(rect.width - rect.height) <= 0.2 and 110 <= rect.width <= 170:
        qr_boxes.append(rect)

def clearances(rectangles):
    return {
        "left": min(rect[0] for rect in rectangles) / mm,
        "top": min(rect[1] for rect in rectangles) / mm,
        "right": min(page.rect.width - rect[2] for rect in rectangles) / mm,
        "bottom": min(page.rect.height - rect[3] for rect in rectangles) / mm,
    }

result = {
    "pageMm": [page.rect.width / mm, page.rect.height / mm],
    "maxTextPt": max_text_pt,
    "textClearanceMm": clearances([line["bbox"] for line in lines]),
    "qrClearanceMm": clearances(qr_boxes),
}

print(json.dumps(result))
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

export function parsePdfInfo(output) {
  const pages = Number(output.match(/^Pages:\s+(\d+)/m)?.[1])
  const size = output.match(/^Page size:\s+([\d.]+) x ([\d.]+) pts/m)
  if (!size || !Number.isFinite(pages))
    throw new Error("Invalid pdfinfo output")
  return { pages, widthPt: Number(size[1]), heightPt: Number(size[2]) }
}

export function parsePdfFonts(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => /^NAB[A-Z]+\+/.test(line))
    .map((line) => {
      const columns = line.trim().split(/\s+/)
      return {
        name: columns[0],
        embedded: columns[4] === "yes",
        subset: columns[5] === "yes",
        unicode: columns[6] === "yes",
      }
    })
}

export function assertPosterLayoutGeometry(layout, content, filename) {
  const minimumClearance = content.geometry.safeMarginMm - 1
  for (const [kind, clearances] of [
    ["text", layout.textClearanceMm],
    ["QR", layout.qrClearanceMm],
  ]) {
    for (const [edge, clearance] of Object.entries(clearances)) {
      assert.ok(
        clearance >= minimumClearance,
        `${filename} ${kind} ${edge} clearance preserves the ${content.geometry.safeMarginMm} mm safe frame`
      )
    }
  }
  assertNear(
    layout.maxTextPt,
    content.typeTiers.hookPt,
    0.2,
    `${filename} catalogue A4 hook tier`
  )
  return {
    safeMarginMm: content.geometry.safeMarginMm,
    textClearanceMm: layout.textClearanceMm,
    qrClearanceMm: layout.qrClearanceMm,
    measuredHookPt: layout.maxTextPt,
  }
}
function requiredTools() {
  const tools = new Map()
  for (const name of REQUIRED_TOOLS) {
    const result = spawnSync("which", [name], { encoding: "utf8" })
    if (result.status !== 0)
      throw new Error(`Missing required PDF QA tool: ${name}`)
    tools.set(name, result.stdout.trim())
  }
  run(tools.get("python3"), ["-c", "import cv2, fitz"])
  return tools
}

function assertNear(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, received ${actual}`
  )
}

export async function verifyPosterPdfs(outputDirectory) {
  const tools = requiredTools()
  await mkdir(outputDirectory, { recursive: true })
  // Verify every registered design, not just the production email bundle —
  // review and experimental templates still print on direct request.
  const attachments = await buildAllPosterPdfAttachments({
    merchantName: VERIFICATION_VENUE,
    shareUrl: QR_TARGET,
    stampsRequired: 6,
  })
  assert.equal(attachments.length, posterDesignIds().length)

  const sheets = []
  for (const attachment of attachments) {
    const pdfPath = path.join(outputDirectory, attachment.filename)
    await writeFile(pdfPath, Buffer.from(attachment.content, "base64"))
    const templateId = attachment.filename
      .replace(/^nabaperks-poster-/, "")
      .replace(/\.pdf$/, "")
    const content = resolvePosterContent(templateId, 6)
    const expected = {
      widthPt: 595.28,
      heightPt: 841.89,
      widthPx: 2480,
      heightPx: 3508,
    }

    const info = parsePdfInfo(run(tools.get("pdfinfo"), [pdfPath]))
    assert.equal(info.pages, 1)
    assertNear(
      info.widthPt,
      expected.widthPt,
      0.25,
      `${attachment.filename} width`
    )
    assertNear(
      info.heightPt,
      expected.heightPt,
      0.25,
      `${attachment.filename} height`
    )

    const fonts = parsePdfFonts(run(tools.get("pdffonts"), [pdfPath]))
    assert.equal(
      fonts.length,
      4,
      `${attachment.filename} embeds four Wet Ink fonts`
    )
    assert.ok(
      fonts.every((font) => font.embedded && font.subset && font.unicode)
    )

    const text = run(tools.get("pdftotext"), ["-layout", pdfPath, "-"])
    assert.ok(
      containsPosterCopy(text, VERIFICATION_VENUE),
      `${attachment.filename} renders the complete 60-character venue name`
    )
    for (const expectedCopy of posterVisibleCopy(content)) {
      assert.ok(
        containsPosterCopy(text, expectedCopy),
        `${attachment.filename} renders catalogue copy: ${expectedCopy}`
      )
    }
    assert.match(text, /18\+ to redeem/)
    assert.doesNotMatch(
      text,
      /Everyone wins|No account needed|claim your free stamp/i
    )

    const rasterBase = path.join(
      outputDirectory,
      attachment.filename.replace(/\.pdf$/, "-300dpi")
    )
    run(tools.get("pdftoppm"), [
      "-png",
      "-r",
      "300",
      "-singlefile",
      pdfPath,
      rasterBase,
    ])
    const rasterPath = `${rasterBase}.png`
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
      expected.widthPx,
      2,
      `${attachment.filename} raster width`
    )
    assertNear(
      dimensions[1],
      expected.heightPx,
      2,
      `${attachment.filename} raster height`
    )

    const decodedQrs = JSON.parse(
      run(tools.get("python3"), ["-c", OPENCV_DECODE, rasterPath])
    )
    assert.equal(decodedQrs.length, 1)
    assert.ok(decodedQrs.every((target) => target === QR_TARGET))

    const qrGeometry = JSON.parse(
      run(tools.get("python3"), ["-c", FITZ_QR_GEOMETRY, pdfPath])
    )
    const expectedQrMm = [content.qr.outerMm]
    const measuredQrMm = qrGeometry
      .map(({ outerMm }) => outerMm)
      .sort((left, right) => left - right)
    assert.equal(qrGeometry.length, expectedQrMm.length)
    measuredQrMm.forEach((outerMm, index) => {
      assertNear(
        outerMm,
        expectedQrMm[index],
        0.1,
        `${attachment.filename} QR ${index + 1} outer size`
      )
    })
    for (const geometry of qrGeometry) {
      assert.equal(geometry.dataModulesX, geometry.dataModulesY)
      assert.deepEqual(
        [
          geometry.quietLeft,
          geometry.quietRight,
          geometry.quietBottom,
          geometry.quietTop,
        ],
        [4, 4, 4, 4],
        `${attachment.filename} preserves the four-module quiet zone`
      )
    }

    const measuredLayout = JSON.parse(
      run(tools.get("python3"), ["-c", FITZ_LAYOUT_GEOMETRY, pdfPath])
    )
    const physicalLayout = assertPosterLayoutGeometry(
      measuredLayout,
      content,
      attachment.filename
    )

    sheets.push({
      filename: attachment.filename,
      format: "A4",
      page: info,
      rasterPx: dimensions,
      fonts,
      decodedQrs,
      qrGeometry,
      physicalLayout,
    })
  }

  const report = {
    generatedAt: new Date().toISOString(),
    target: QR_TARGET,
    venue: VERIFICATION_VENUE,
    sheetCount: sheets.length,
    faceCount: sheets.reduce(
      (count, sheet) => count + sheet.decodedQrs.length,
      0
    ),
    sheets,
  }
  assert.equal(report.faceCount, posterDesignIds().length)
  await writeFile(
    path.join(outputDirectory, "poster-pdf-verification.json"),
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
      path.join("tmp", "pdfs", "poster-verified")
  )
  const report = await verifyPosterPdfs(outputDirectory)
  console.log(
    `Verified ${report.sheetCount} poster PDFs and ${report.faceCount} QR faces in ${outputDirectory}`
  )
}
