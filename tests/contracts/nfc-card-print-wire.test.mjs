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

test("emailed and bulk-exported NFC square PDFs encode the qr channel", () => {
  assert.match(
    posterActions,
    /buildNfcSquarePdfAttachments\(\{\s*\.\.\.kitInput,\s*shareUrl: nfcShareUrl/
  )
  assert.match(productionExport, /buildNfcSquarePdfAttachments\(nfcInput\)/)
})

test("public QR join records optional src channel for analytics", () => {
  assert.match(publicQr, /parseQrShareChannel\(/)
  assert.match(publicQr, /scanSource/)
})
