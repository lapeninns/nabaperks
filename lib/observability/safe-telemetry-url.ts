const SENSITIVE_ROUTE_PATTERNS: ReadonlyArray<
  readonly [pattern: RegExp, replacement: string]
> = [
  // Order matters: the more specific unsubscribe routes must match before the
  // single-segment rules, which would otherwise fall through and emit the raw
  // bearer token as a pathname.
  [/^\/claim\/unsubscribe\/[^/]+\/?$/, "/claim/unsubscribe/[token]"],
  [/^\/invite\/unsubscribe\/[^/]+\/?$/, "/invite/unsubscribe/[token]"],
  // Offer campaigns: the claim link, the pass-scan handoff, the customer pass
  // and the staff deep link all carry bearer-like path parameters.
  //
  // A rule anchored immediately after the parameter only ever matches the leaf.
  // /pass/<entitlementId> has a child — /pass/<entitlementId>/qr.png, which the
  // pass screen refetches on a timer — and an anchored single-segment rule
  // never sees it, so every image request, resource breadcrumb and error URL
  // carried the raw entitlement id to Sentry while this block claimed to be
  // masking it. The three token namespaces therefore end in a rule that matches
  // the parameter followed by ANY remaining path, so a child route added later
  // is masked from the day it exists rather than from the day someone notices.
  // Named children are listed first, so telemetry keeps the route detail it can
  // safely have.
  [/^\/offer\/[^/]+(?:\/|$)/, "/offer/[token]"],
  [/^\/p\/[^/]+(?:\/|$)/, "/p/[token]"],
  [/^\/pass\/[^/]+\/qr\.png\/?$/, "/pass/[entitlementId]/qr.png"],
  [/^\/pass\/[^/]+(?:\/|$)/, "/pass/[entitlementId]"],
  // /app/offers has legible siblings (/app/offers itself, /app/offers/new), so
  // this namespace is masked route by route rather than by prefix.
  [/^\/app\/offers\/scan\/[^/]+\/?$/, "/app/offers/scan/[passToken]"],
  [/^\/app\/offers\/[^/]+\/qr\.png\/?$/, "/app/offers/[campaignId]/qr.png"],
  [/^\/app\/offers\/[^/]+\/qr\/?$/, "/app/offers/[campaignId]/qr"],
  [/^\/claim\/[^/]+\/?$/, "/claim/[token]"],
  [/^\/invite\/[^/]+\/?$/, "/invite/[token]"],
  [/^\/r\/[^/]+\/?$/, "/r/[token]"],
  [/^\/app\/rewards\/scan\/[^/]+\/?$/, "/app/rewards/scan/[scanToken]"],
]

/**
 * Keep telemetry useful at the route level without sending query strings,
 * fragments, origins, or bearer-like path parameters to a third party.
 */
export function sanitizeTelemetryUrl(value: string): string {
  const pathname = readPathname(value)

  for (const [pattern, replacement] of SENSITIVE_ROUTE_PATTERNS) {
    if (pattern.test(pathname)) return replacement
  }

  return pathname
}

function readPathname(value: string): string {
  try {
    return new URL(value, "https://telemetry.invalid").pathname || "/"
  } catch {
    const pathname = value.split(/[?#]/, 1)[0]
    return pathname?.startsWith("/") ? pathname : "/"
  }
}
