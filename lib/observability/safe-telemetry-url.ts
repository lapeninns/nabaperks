const SENSITIVE_ROUTE_PATTERNS: ReadonlyArray<
  readonly [pattern: RegExp, replacement: string]
> = [
  [/^\/claim\/[^/]+\/?$/, "/claim/[token]"],
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
