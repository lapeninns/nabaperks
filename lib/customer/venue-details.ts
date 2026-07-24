const GOOGLE_REVIEW_ORIGIN = "https://search.google.com"
const GOOGLE_REVIEW_PATH = "/local/writereview"

export function normalizeVenueLocality(
  locality: string | null | undefined
): string | null {
  const normalized = locality?.trim()
  return normalized ? normalized : null
}

export function normalizeGoogleReviewUrl(
  value: string | null | undefined
): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    const placeId = url.searchParams.get("placeid")

    if (
      url.origin !== GOOGLE_REVIEW_ORIGIN ||
      url.pathname !== GOOGLE_REVIEW_PATH ||
      !placeId?.trim()
    ) {
      return null
    }

    return url.href
  } catch {
    return null
  }
}
