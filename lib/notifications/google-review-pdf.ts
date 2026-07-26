import "server-only"

import { normalizeGoogleReviewUrl } from "@/lib/customer/venue-details"

import {
  closeGoogleReviewPdfBrowser,
  renderGoogleReviewCardPdf,
  renderGoogleReviewPlatePdf,
} from "./google-review-pdf-render"

export type GoogleReviewPdfInput = {
  readonly merchantName: string
  readonly reviewUrl: string | null
  readonly locality?: string | null
}

export type GoogleReviewPdfAttachment = {
  readonly filename: string
  readonly content: string
}

export { closeGoogleReviewPdfBrowser }

function resolveReviewUrl(reviewUrl: string | null): string | null {
  return normalizeGoogleReviewUrl(reviewUrl)
}

/** CR80 Google review card — front and back. */
export async function buildGoogleReviewCardPdfAttachment(
  input: GoogleReviewPdfInput
): Promise<GoogleReviewPdfAttachment> {
  const reviewUrl = resolveReviewUrl(input.reviewUrl)
  if (!reviewUrl) {
    throw new Error("Google review card requires a valid review URL")
  }
  const merchantName = input.merchantName.trim().slice(0, 120)
  const locality = input.locality?.trim().slice(0, 60) || null
  return {
    filename: "nabaperks-google-card.pdf",
    content: await renderGoogleReviewCardPdf(merchantName, locality, reviewUrl),
  }
}

/** 100 × 100 mm Google review wall plate. */
export async function buildGoogleReviewPlatePdfAttachment(
  input: GoogleReviewPdfInput
): Promise<GoogleReviewPdfAttachment> {
  const reviewUrl = resolveReviewUrl(input.reviewUrl)
  if (!reviewUrl) {
    throw new Error("Google review plate requires a valid review URL")
  }
  const merchantName = input.merchantName.trim().slice(0, 120)
  const locality = input.locality?.trim().slice(0, 60) || null
  return {
    filename: "nabaperks-google-plate.pdf",
    content: await renderGoogleReviewPlatePdf(
      merchantName,
      locality,
      reviewUrl
    ),
  }
}

/**
 * Production Google review printables for a venue. Empty when the merchant
 * has no valid Google write-review URL.
 */
export async function buildGoogleReviewPdfAttachments(
  input: GoogleReviewPdfInput
): Promise<readonly GoogleReviewPdfAttachment[]> {
  if (!resolveReviewUrl(input.reviewUrl)) return []
  const [card, plate] = await Promise.all([
    buildGoogleReviewCardPdfAttachment(input),
    buildGoogleReviewPlatePdfAttachment(input),
  ])
  return [card, plate]
}
