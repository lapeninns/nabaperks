/**
 * Parser for whatever the merchant camera decodes at the counter.
 *
 * A customer can present two different codes: a reward collection code
 * (`/r/<uuid>`) and a discount-pass code (`/p/<uuid>`). The payload carries no
 * prefix, namespace or version byte, so the first path segment is the ONLY
 * discriminator — which is why each namespace gets its own explicit branch and
 * anything else stays invalid.
 *
 * The uuid shape below is the fifth copy of the same literal in this repo, with
 * no shared constant tying them together:
 *   lib/merchant/reward-scanner.ts        (here)
 *   app/r/[token]/page.tsx
 *   app/app/rewards/scan/[scanToken]/page.tsx
 *   app/p/[token]/page.tsx
 *   app/app/offers/scan/[passToken]/page.tsx
 * Each is a defence-in-depth guard in front of a uuid-typed RPC argument rather
 * than a single shared rule, so they are duplicated on purpose; if one is ever
 * relaxed the others must be reviewed with it.
 */
export type ScannedRewardDestination =
  | { readonly kind: "valid"; readonly href: string }
  | { readonly kind: "invalid" }

const REWARD_SCAN_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The two accepted root segments and the merchant screen each hands off to.
 * Both destinations are read-only deep links: scanning never redeems or
 * collects anything on its own.
 */
function scanDestinationBase(rootSegment: string | undefined): string | null {
  if (rootSegment === "r") return "/app/rewards/scan"
  if (rootSegment === "p") return "/app/offers/scan"

  return null
}

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

  const destinationBase = scanDestinationBase(rootSegment)

  if (
    destinationBase === null ||
    !scanToken ||
    extraSegment !== undefined ||
    !REWARD_SCAN_TOKEN_PATTERN.test(scanToken)
  ) {
    return { kind: "invalid" }
  }

  return {
    kind: "valid",
    href: `${destinationBase}/${encodeURIComponent(scanToken)}`,
  }
}
