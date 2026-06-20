export type ScannedRewardDestination =
  | { readonly kind: "valid"; readonly href: string }
  | { readonly kind: "invalid" }

const REWARD_SCAN_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

export function normalizeScannedRewardDestination(
  value: string,
  appOrigin: string
): ScannedRewardDestination {
  const trimmedValue = value.trim()
  const originUrl = parseUrl(appOrigin)

  if (!trimmedValue || !originUrl) {
    return { kind: "invalid" }
  }

  const scannedUrl = parseUrl(trimmedValue, originUrl.origin)

  if (!scannedUrl || scannedUrl.origin !== originUrl.origin) {
    return { kind: "invalid" }
  }

  const [rootSegment, scanToken, extraSegment] = scannedUrl.pathname
    .split("/")
    .filter(Boolean)

  if (
    rootSegment !== "r" ||
    !scanToken ||
    extraSegment !== undefined ||
    !REWARD_SCAN_TOKEN_PATTERN.test(scanToken)
  ) {
    return { kind: "invalid" }
  }

  return {
    kind: "valid",
    href: `/app/rewards/scan/${encodeURIComponent(scanToken)}`,
  }
}
