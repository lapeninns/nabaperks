export const NEXT_THEMES_SCRIPT_SHA256 =
  "sha256-G04KaBzNliDSI5Rx3yKGSBrkZtxusQxAU2jyz3KK2Vc="
export const NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256 =
  "sha256-J1wQB5qnh90IAwdc5uHGmBFTTupFNURrdioqoKFQF0w="
export const NEXT_THEMES_APP_RENDER_SCRIPT_SHA256 =
  "sha256-BgBkXHgyVZ0ON/UalzXrbnvY5QVt+gqIrRnCdrvAxmk="
export const LANDING_PAGE_JSON_LD_SHA256 =
  "sha256-88fSUvs0VK5MN3xRFnB0S5Od/1H+t1vVE/MMa6KnLDs="
export const SITE_JSON_LD_SHA256 =
  "sha256-SsEKCWRU0DJZy2mOYi2Ix2eSwmyS2uHB51VGowrvnAM="

const STATIC_INLINE_SCRIPT_HASHES: readonly string[] = [
  NEXT_THEMES_SCRIPT_SHA256,
  NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256,
  NEXT_THEMES_APP_RENDER_SCRIPT_SHA256,
  LANDING_PAGE_JSON_LD_SHA256,
  SITE_JSON_LD_SHA256,
]

export const COMMON_SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(), payment=(), usb=(), interest-cohort=(), geolocation=(self)",
  },
] as const

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

export function dynamicContentSecurityPolicy(nonce: string): string {
  const staticInlineScriptHashes = STATIC_INLINE_SCRIPT_HASHES.map(
    (hash) => `'${hash}'`
  ).join(" ")

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${staticInlineScriptHashes} 'strict-dynamic' https://js.stripe.com https://maps.googleapis.com${scriptDevEscape()}`,
    `script-src-elem 'self' 'nonce-${nonce}' ${staticInlineScriptHashes} https://js.stripe.com https://maps.googleapis.com`,
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
