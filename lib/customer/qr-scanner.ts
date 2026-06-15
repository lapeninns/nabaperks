export type ScannedQrDestination =
  | { readonly kind: "valid"; readonly href: string }
  | { readonly kind: "invalid" }

const QR_ID_PATTERN = /^[A-Za-z0-9_-]+$/

function parseUrl(value: string, base?: string): URL | null {
  try {
    return base ? new URL(value, base) : new URL(value)
  } catch (error) {
    if (error instanceof TypeError) {
      return null
    }

    throw error
  }
}

export function normalizeScannedQrDestination(
  value: string,
  appOrigin: string
): ScannedQrDestination {
  const trimmedValue = value.trim()
  const originUrl = parseUrl(appOrigin)

  if (!trimmedValue || !originUrl) {
    return { kind: "invalid" }
  }

  const scannedUrl = parseUrl(trimmedValue, originUrl.origin)

  if (!scannedUrl || scannedUrl.origin !== originUrl.origin) {
    return { kind: "invalid" }
  }

  const [rootSegment, qrId, extraSegment] = scannedUrl.pathname
    .split("/")
    .filter(Boolean)

  if (
    rootSegment !== "q" ||
    !qrId ||
    extraSegment !== undefined ||
    !QR_ID_PATTERN.test(qrId)
  ) {
    return { kind: "invalid" }
  }

  return { kind: "valid", href: `/q/${qrId}` }
}
