/**
 * The next-themes bootstrap script is inlined WITHOUT a nonce (next-themes only
 * emits one when the `nonce` prop is passed, and it is not), so `script-src-elem`
 * has to allow it by hash. The script body is
 * `(${themeScriptFn.toString()})(${argsFromNEXT_THEMES_OPTIONS})`, which means
 * it differs per BUNDLER as well as per option — three render paths, three pins:
 *
 * | constant                              | render path                                    |
 * | ------------------------------------- | ---------------------------------------------- |
 * | `NEXT_THEMES_SCRIPT_SHA256`           | `pnpm build` — webpack, minified                |
 * | `NEXT_THEMES_SERVER_RENDER_SCRIPT_..` | `react-dom/server` against `dist/index.mjs`     |
 * | `NEXT_THEMES_APP_RENDER_SCRIPT_..`    | `pnpm dev` — Turbopack, pretty-printed          |
 *
 * All three are reproducible, and `tests/unit/csp-theme-hash.test.mjs` proves it:
 * it recomputes the server-render hash from the REAL `NEXT_THEMES_OPTIONS`, and
 * checks the other two against stored script bodies whose argument tail must
 * equal the one that render produces. Change an option and all three fail
 * together, which is the point — a stale pin means CSP silently blocks the theme
 * bootstrap in production.
 *
 * Re-pinned for `enableSystem: false` (UI audit 05#61) by reading each path back:
 * the webpack hash from `.next/server/app/index.html`, the Turbopack hash from a
 * page served by `next dev`, the server-render hash from the unit test.
 */
export const NEXT_THEMES_SCRIPT_SHA256 =
  "sha256-fmWL2jTM+6Ab6Cg2xBGZEexjPaIbQaL1iq1lIRptVjQ="
export const NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256 =
  "sha256-UB8ZQDPPx/Vb2cqBe4pW3j8hm5RWjlg5zlcRw0uxtiE="
export const NEXT_THEMES_APP_RENDER_SCRIPT_SHA256 =
  "sha256-Gu0tYVCPSmBXLHFn2zKK5xeY4pDsVm8NV02PSiKFnj4="

const NEXT_THEMES_SCRIPT_HASHES: readonly string[] = [
  NEXT_THEMES_SCRIPT_SHA256,
  NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256,
  NEXT_THEMES_APP_RENDER_SCRIPT_SHA256,
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
