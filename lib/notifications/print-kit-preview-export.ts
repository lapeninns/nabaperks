import "server-only"

import { NFC_CARD_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-card-templates"
import { NFC_SQUARE_PRODUCTION_DESIGNS } from "@/lib/qr/nfc-square-templates"
import {
  duplexPosterFilename,
  QR_POSTER_PRODUCTION_DUPLEX_PAIRS,
} from "@/lib/qr/poster-duplex-pairs"
import { TENT_PRODUCTION_DESIGNS } from "@/lib/qr/tent-templates"

import { mergePdfBase64Documents } from "./print-kit-pdf-merge"
import { renderPrintKitPreviewPdf } from "./print-kit-preview-pdf"

export type PrintKitPreviewExportInput = {
  readonly previewOrigin: string
  /** Public origin encoded into QR codes (e.g. https://nabaperks.com). */
  readonly appOrigin: string
  readonly merchantName: string
  readonly qrId: string
  readonly stampsRequired: number
  readonly locality?: string | null
  readonly googleReviewUrl?: string | null
}

export type PrintKitPreviewAttachment = {
  readonly filename: string
  readonly content: string
}

function baseQuery(input: PrintKitPreviewExportInput): Record<string, string> {
  const query: Record<string, string> = {
    venue: input.merchantName.trim().slice(0, 120),
    qr: input.qrId,
    stamps: String(input.stampsRequired),
    origin: input.appOrigin.replace(/\/$/, ""),
  }
  if (input.locality?.trim()) {
    query.locality = input.locality.trim().slice(0, 120)
  }
  if (input.googleReviewUrl?.trim()) {
    query.review = input.googleReviewUrl.trim()
  }
  return query
}

async function renderPosterPage(
  input: PrintKitPreviewExportInput,
  query: Record<string, string>,
  templateId: string
): Promise<string> {
  return renderPrintKitPreviewPdf({
    previewOrigin: input.previewOrigin,
    pathname: "/dev/poster-preview",
    searchParams: { ...query, template: templateId },
    readySelector: '[data-sheet="a4"]',
    metadata: {
      title: `Nabaperks ${templateId} poster for ${input.merchantName}`,
      subject: "A4 counter poster",
    },
  })
}

/**
 * Production posters as duplex PDFs (front+back) from /dev/poster-preview.
 * Four files cover the eight production designs.
 */
export async function buildPosterPdfAttachmentsFromPreview(
  input: PrintKitPreviewExportInput
): Promise<readonly PrintKitPreviewAttachment[]> {
  const query = baseQuery(input)
  const attachments: PrintKitPreviewAttachment[] = []
  for (const pair of QR_POSTER_PRODUCTION_DUPLEX_PAIRS) {
    const front = await renderPosterPage(input, query, pair.front)
    const back = await renderPosterPage(input, query, pair.back)
    attachments.push({
      filename: duplexPosterFilename(pair),
      content: await mergePdfBase64Documents([front, back], {
        title: `Nabaperks ${pair.front} and ${pair.back} duplex posters for ${input.merchantName}`,
        subject: "A4 duplex counter poster - front and back",
      }),
    })
  }
  return attachments
}

/** Production NFC cards from /dev/nfc-card-preview. */
export async function buildNfcCardPdfAttachmentsFromPreview(
  input: PrintKitPreviewExportInput
): Promise<readonly PrintKitPreviewAttachment[]> {
  const query = baseQuery(input)
  const attachments: PrintKitPreviewAttachment[] = []
  for (const { id } of NFC_CARD_PRODUCTION_DESIGNS) {
    if (id === "google-review" && !query.review) continue
    attachments.push({
      filename: `nabaperks-nfc-card-${id}.pdf`,
      content: await renderPrintKitPreviewPdf({
        previewOrigin: input.previewOrigin,
        pathname: "/dev/nfc-card-preview",
        searchParams: { ...query, design: id },
        readySelector: '[data-sheet="cr80-nfc-card"]',
        metadata: {
          title: `Nabaperks ${id} NFC card for ${input.merchantName}`,
          subject: "CR80 NFC card - front and back at 85.5 x 54 mm",
        },
      }),
    })
  }
  return attachments
}

/** Production NFC plates from /dev/nfc-square-preview. */
export async function buildNfcSquarePdfAttachmentsFromPreview(
  input: PrintKitPreviewExportInput
): Promise<readonly PrintKitPreviewAttachment[]> {
  const query = baseQuery(input)
  const attachments: PrintKitPreviewAttachment[] = []
  for (const { id } of NFC_SQUARE_PRODUCTION_DESIGNS) {
    if (id === "google-review" && !query.review) continue
    attachments.push({
      filename: `nabaperks-nfc-plate-${id}.pdf`,
      content: await renderPrintKitPreviewPdf({
        previewOrigin: input.previewOrigin,
        pathname: "/dev/nfc-square-preview",
        searchParams: { ...query, design: id },
        readySelector: '[data-sheet="nfc-square-100"]',
        metadata: {
          title: `Nabaperks ${id} square NFC plate for ${input.merchantName}`,
          subject: "100 x 100 mm one-sided wall NFC plate",
        },
      }),
    })
  }
  return attachments
}

/** Production table tents from /dev/tent-preview. */
export async function buildTentPdfAttachmentsFromPreview(
  input: PrintKitPreviewExportInput
): Promise<readonly PrintKitPreviewAttachment[]> {
  const query = baseQuery(input)
  const attachments: PrintKitPreviewAttachment[] = []
  for (const { id } of TENT_PRODUCTION_DESIGNS) {
    attachments.push({
      filename: `nabaperks-tent-${id}.pdf`,
      content: await renderPrintKitPreviewPdf({
        previewOrigin: input.previewOrigin,
        pathname: "/dev/tent-preview",
        searchParams: { ...query, design: id },
        readySelector: '[data-sheet="a4-tent"]',
        metadata: {
          title: `Nabaperks ${id} table tent for ${input.merchantName}`,
          subject: "A4 table tent",
        },
      }),
    })
  }
  return attachments
}
