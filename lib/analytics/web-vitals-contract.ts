export const WEB_VITAL_METRIC_NAMES = [
  "CLS",
  "FCP",
  "INP",
  "LCP",
  "TTFB",
] as const

export const WEB_VITAL_ROUTE_KEYS = [
  "home",
  "about",
  "pricing",
  "how_it_works",
  "faq",
  "pubs",
  "guide_no_app",
  "guide_ideas",
  "guide_paper_vs_qr",
] as const

export const WEB_VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const

export const WEB_VITAL_NAVIGATION_TYPES = [
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
] as const

export const MAX_WEB_VITAL_BODY_BYTES = 2_048

export type WebVitalMetricName = (typeof WEB_VITAL_METRIC_NAMES)[number]
export type WebVitalRouteKey = (typeof WEB_VITAL_ROUTE_KEYS)[number]
export type WebVitalRating = (typeof WEB_VITAL_RATINGS)[number]
export type WebVitalNavigationType = (typeof WEB_VITAL_NAVIGATION_TYPES)[number]

export type WebVitalSample = {
  readonly metricName: WebVitalMetricName
  readonly metricId: string
  readonly value: number
  readonly delta: number
  readonly rating: WebVitalRating
  readonly routeKey: WebVitalRouteKey
  readonly navigationType: WebVitalNavigationType
}

const ROUTE_KEYS_BY_PATH: Readonly<Record<string, WebVitalRouteKey>> = {
  "/": "home",
  "/about": "about",
  "/pricing": "pricing",
  "/how-it-works": "how_it_works",
  "/faq": "faq",
  "/loyalty-for-pubs": "pubs",
  "/guides/reward-regulars-without-an-app": "guide_no_app",
  "/guides/best-loyalty-ideas-for-pubs": "guide_ideas",
  "/guides/paper-vs-qr-loyalty-for-pubs": "guide_paper_vs_qr",
}

export function webVitalRouteKey(pathname: string): WebVitalRouteKey | null {
  const normalized =
    pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname
  return ROUTE_KEYS_BY_PATH[normalized] ?? null
}

export function isWebVitalMetricName(
  value: string
): value is WebVitalMetricName {
  return (WEB_VITAL_METRIC_NAMES as readonly string[]).includes(value)
}

export function parseWebVitalSample(value: unknown): WebVitalSample | null {
  if (!isObject(value)) return null
  if (!isIncluded(WEB_VITAL_METRIC_NAMES, value.metricName)) return null
  if (!isIncluded(WEB_VITAL_ROUTE_KEYS, value.routeKey)) return null
  if (!isIncluded(WEB_VITAL_RATINGS, value.rating)) return null
  if (!isIncluded(WEB_VITAL_NAVIGATION_TYPES, value.navigationType)) return null
  if (
    typeof value.metricId !== "string" ||
    !/^[A-Za-z0-9._-]{1,128}$/.test(value.metricId)
  ) {
    return null
  }
  if (!isBoundedMetricValue(value.metricName, value.value)) return null
  if (!isBoundedMetricValue(value.metricName, value.delta)) return null

  return {
    metricName: value.metricName,
    metricId: value.metricId,
    value: value.value,
    delta: value.delta,
    rating: value.rating,
    routeKey: value.routeKey,
    navigationType: value.navigationType,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isIncluded<const Values extends readonly string[]>(
  values: Values,
  value: unknown
): value is Values[number] {
  return typeof value === "string" && values.includes(value)
}

function isBoundedMetricValue(
  metricName: WebVitalMetricName,
  value: unknown
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return false
  }
  return metricName === "CLS" ? value <= 10 : value <= 600_000
}
