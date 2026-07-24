import { normalizeGoogleReviewUrl } from "@/lib/customer/venue-details"

export const GOOGLE_REVIEW_NFC_DESIGN_ID = "google-review"

type NfcDestinationInput = {
  readonly designId: string
  readonly joinUrl: string
  readonly googleReviewUrl?: string | null
}

/**
 * Keep every physical design wired to its intended server-owned destination.
 * Review pieces never silently fall back to the loyalty join funnel.
 */
export function resolveNfcDestination({
  designId,
  joinUrl,
  googleReviewUrl,
}: NfcDestinationInput): string | null {
  if (designId === GOOGLE_REVIEW_NFC_DESIGN_ID) {
    return normalizeGoogleReviewUrl(googleReviewUrl)
  }
  return joinUrl
}
