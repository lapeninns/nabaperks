export const NEXT_THEMES_SCRIPT_SHA256 =
  "sha256-G04KaBzNliDSI5Rx3yKGSBrkZtxusQxAU2jyz3KK2Vc="
export const NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256 =
  "sha256-J1wQB5qnh90IAwdc5uHGmBFTTupFNURrdioqoKFQF0w="
export const NEXT_THEMES_APP_RENDER_SCRIPT_SHA256 =
  "sha256-BgBkXHgyVZ0ON/UalzXrbnvY5QVt+gqIrRnCdrvAxmk="

const NEXT_THEMES_SCRIPT_HASHES: readonly string[] = [
  NEXT_THEMES_SCRIPT_SHA256,
  NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256,
  NEXT_THEMES_APP_RENDER_SCRIPT_SHA256,
]

const STATIC_MARKETING_EXACT_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/about",
  "/how-it-works",
  "/loyalty-for-pubs",
  "/loyalty-for-cafes",
  "/loyalty-for-takeaways",
  "/loyalty-for-bars",
  "/pricing",
  "/privacy",
  "/terms",
])

function scriptDevEscape(): string {
  return process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
}

function upgradeInsecureRequestsDirective(): string {
  return process.env.NODE_ENV === "development"
    ? ""
    : "; upgrade-insecure-requests"
}

function sharedContentSecurityDirectives(): readonly string[] {
  return [
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors 'none'${upgradeInsecureRequestsDirective()}`,
  ]
}

export function isStaticMarketingPath(pathname: string): boolean {
  const normalizedPath =
    pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname

  return (
    STATIC_MARKETING_EXACT_PATHS.has(normalizedPath) ||
    normalizedPath.startsWith("/guides/")
  )
}

export function dynamicContentSecurityPolicy(nonce: string): string {
  const nextThemesScriptHashes = NEXT_THEMES_SCRIPT_HASHES.map(
    (hash) => `'${hash}'`
  ).join(" ")

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${nextThemesScriptHashes} 'strict-dynamic' https://js.stripe.com https://maps.googleapis.com${scriptDevEscape()}`,
    `script-src-elem 'self' 'nonce-${nonce}' ${nextThemesScriptHashes} https://js.stripe.com https://maps.googleapis.com`,
    ...sharedContentSecurityDirectives(),
  ].join("; ")
}

export function staticMarketingContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${scriptDevEscape()}`,
    "script-src-elem 'self' 'unsafe-inline'",
    ...sharedContentSecurityDirectives(),
  ].join("; ")
}
