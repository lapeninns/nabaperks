import { NFC_CARD_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-card-templates"
import { NFC_SQUARE_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-square-templates"
import { QR_POSTER_PRODUCTION_TEMPLATES } from "@/lib/qr/poster-templates"
import { TENT_PRODUCTION_DESIGNS } from "@/lib/qr/tent-templates"

export type PosterEmailInput = {
  readonly venueName: string
  readonly nfcCount?: number
  readonly nfcSquareCount?: number
  readonly hasGoogleReviewNfc?: boolean
}

export type PosterEmailContent = {
  readonly subject: string
  readonly text: string
  readonly html: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const POSTER_COUNT = QR_POSTER_PRODUCTION_TEMPLATES.length
const TENT_COUNT = TENT_PRODUCTION_DESIGNS.length
const NFC_COUNT = NFC_CARD_PRODUCTION_DESIGNS.length
const NFC_SQUARE_COUNT = NFC_SQUARE_PRODUCTION_DESIGNS.length

/**
 * Pure builder for the "email me the print kit" transactional email — no I/O,
 * so it is unit-testable in isolation. The action layer (app/app/qr/actions)
 * adds the Resend send and attaches poster, table-tent, and NFC card PDFs.
 * Interpolated values are HTML-escaped because `venueName` is merchant-controlled.
 */
export function buildPosterEmailContent({
  venueName,
  nfcCount = NFC_COUNT,
  nfcSquareCount = NFC_SQUARE_COUNT,
  hasGoogleReviewNfc = true,
}: PosterEmailInput): PosterEmailContent {
  const subject = "Your Nabaperks print kit PDFs"
  const nfcInstructions = [
    "Set up loyalty NFC chips with the venue join link ending ?src=nfc.",
    hasGoogleReviewNfc
      ? "Set up Google Review NFC chips with the venue's Google review link."
      : null,
    "The printed QR codes are already set up for scans.",
  ]
    .filter((line): line is string => line !== null)
    .join(" ")

  const text = [
    `Your Nabaperks print kit for ${venueName} is attached: ${POSTER_COUNT} poster${POSTER_COUNT === 1 ? "" : "s"}, ${TENT_COUNT} table tent${TENT_COUNT === 1 ? "" : "s"}, ${nfcCount} tap card${nfcCount === 1 ? "" : "s"}, and ${nfcSquareCount} wall tap plate${nfcSquareCount === 1 ? "" : "s"}.`,
    "",
    "Print everything at 100% (actual size), not fit to page. Posters and table tents use A4. Tap cards have a front page and a back page; wall tap plates have one square page.",
    "Fold each table tent along its middle crease so both faces stand upright.",
    nfcInstructions,
    "Print one copy first and test its QR code and tap point with a few phones before placing the rest.",
    "",
    "Customers scan the QR or tap the card to join in their browser — no app to download.",
  ].join("\n")

  const html = posterEmailHtml({
    venueName: escapeHtml(venueName),
    nfcCount,
    nfcSquareCount,
    hasGoogleReviewNfc,
  })

  return { subject, text, html }
}

function posterEmailHtml({
  venueName,
  nfcCount = NFC_COUNT,
  nfcSquareCount = NFC_SQUARE_COUNT,
  hasGoogleReviewNfc = true,
}: PosterEmailInput): string {
  const reviewNfcInstruction = hasGoogleReviewNfc
    ? " Set up Google Review NFC chips with the venue&rsquo;s Google review link."
    : ""

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f1e6;font-family:Arial,Helvetica,sans-serif;color:#211c16;padding:24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fbf8f1;border:2px solid #211c16;border-radius:10px;box-shadow:4px 4px 0 #211c16">
      <tr><td style="padding:24px">
        <div style="display:inline-block;margin:0 0 16px;background:#cf330a;color:#fff;border:2px solid #211c16;border-radius:999px;padding:8px 11px;font-size:18px;font-weight:800;line-height:1;box-shadow:3px 3px 0 #211c16">*</div>
        <p style="margin:0 0 8px;font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#4f473d">Nabaperks print kit</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.15;font-weight:800">Your print kit for ${venueName}</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4f473d">${POSTER_COUNT} poster${POSTER_COUNT === 1 ? "" : "s"}, ${TENT_COUNT} table tent${TENT_COUNT === 1 ? "" : "s"}, ${nfcCount} tap card${nfcCount === 1 ? "" : "s"}, and ${nfcSquareCount} wall tap plate${nfcSquareCount === 1 ? "" : "s"} are attached.</p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#4f473d">Print everything at 100% (actual size), not fit to page. Posters and table tents use A4. Tap cards have a front page and a back page; wall tap plates have one square page. Fold each table tent along its middle crease.</p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#4f473d">Set up loyalty NFC chips with the venue join link ending ?src=nfc.${reviewNfcInstruction} The printed QR codes are already set up for scans.</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4f473d">Print one copy first and test its QR code and tap point with a few phones before placing the rest.</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#4f473d">Customers scan the QR or tap the card to join in their browser. No app download needed.</p>
      </td></tr>
    </table>
  </body>
</html>`
}
