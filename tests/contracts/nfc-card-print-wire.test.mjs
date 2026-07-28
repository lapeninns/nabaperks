import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const card = readFileSync(
  "components/merchant/qr-poster/nfc-card/a4-nfc-card.tsx",
  "utf8"
)
const action = readFileSync("app/app/qr/nfc/actions.ts", "utf8")
const square = readFileSync(
  "components/merchant/qr-poster/nfc-square/a4-nfc-square.tsx",
  "utf8"
)
const squareAction = readFileSync("app/app/qr/nfc-square/actions.ts", "utf8")
const nfcPage = readFileSync("app/app/qr/nfc/[design]/page.tsx", "utf8")
const posterActions = readFileSync("app/app/qr/actions.ts", "utf8")
const productionExport = readFileSync(
  "scripts/export-production-poster-pdfs.mjs",
  "utf8"
)
const ci = readFileSync(".github/workflows/ci.yml", "utf8")
const publicQr = readFileSync("app/q/[qrId]/page.tsx", "utf8")

test("the NFC print button fires tracking without awaiting, then prints", () => {
  assert.match(
    card,
    /void recordNfcCardPrintAction\(/,
    "tracking must be fired-and-forgotten with void, never awaited"
  )
  assert.match(card, /window\.print\(\)/, "the print affordance stays intact")
})

test("the NFC tracking action validates the design and never throws", () => {
  assert.match(action, /getNfcCardDesign\(/)
  assert.match(action, /catch\s*\{/)
  assert.match(action, /recordProductEvent\(/)
})

test("the NFC square print button records the validated download before printing", () => {
  assert.match(square, /void recordNfcSquarePrintAction\(/)
  assert.match(square, /window\.print\(\)/)
  assert.match(squareAction, /getNfcSquareDesign\(/)
  assert.match(squareAction, /catch\s*\{/)
  assert.match(squareAction, /recordProductEvent\(/)
})

test("NFC card artwork encodes the qr channel on the share URL", () => {
  assert.match(nfcPage, /appendQrShareChannel\(/)
  assert.match(nfcPage, /"qr"/)
})

test("emailed NFC square PDFs encode the qr channel; bulk export uses preview WYSIWYG", () => {
  assert.match(
    posterActions,
    /buildNfcSquarePdfAttachments\(\{\s*\.\.\.kitInput,\s*shareUrl: nfcShareUrl/
  )
  assert.match(productionExport, /buildNfcSquarePdfAttachmentsFromPreview/)
  assert.match(productionExport, /assertPrintKitPreviewOrigin/)
})

test("bulk print-kit export writes typed folders with duplex posters", () => {
  assert.match(productionExport, /output", "posters"/)
  assert.match(productionExport, /ASSET_FOLDERS/)
  assert.match(productionExport, /nfc-cards/)
  assert.match(productionExport, /nfc-plates/)
  assert.match(productionExport, /table-tents/)
  assert.match(productionExport, /QR_POSTER_PRODUCTION_DUPLEX_PAIRS/)
  assert.match(productionExport, /buildPosterPdfAttachmentsFromPreview/)
  assert.match(productionExport, /buildNfcCardPdfAttachmentsFromPreview/)
  assert.match(productionExport, /buildTentPdfAttachmentsFromPreview/)
  assert.match(productionExport, /closePrintKitBrowser/)
  assert.doesNotMatch(productionExport, /buildGoogleReviewPdfAttachments/)
})

test("CI verifies the production preview PDF path as well as vector geometry", () => {
  assert.match(ci, /Install Chromium for production print-kit rendering/)
  assert.match(ci, /PRINT_KIT_PREVIEW_ORIGIN: http:\/\/127\.0\.0\.1:3000/)
  assert.match(ci, /pnpm posters:verify-pdfs/)
  assert.match(ci, /pnpm posters:verify-production-pdfs/)
})

test("public QR join records optional src channel for analytics", () => {
  assert.match(publicQr, /parseQrShareChannel\(/)
  assert.match(publicQr, /scanSource/)
})
