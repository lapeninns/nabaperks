import {
  addBreadcrumb,
  captureRouterTransitionStart,
  init,
} from "@sentry/nextjs"

import { sanitizeTelemetryUrl } from "@/lib/observability/safe-telemetry-url"

/**
 * Redact bearer-bearing URLs at the SDK boundary, not just where we happen to
 * call `sanitizeTelemetryUrl` ourselves.
 *
 * `recordRouterTransition` only covers App Router SOFT navigations. A reward or
 * invite link arriving from an email is a HARD navigation: the SDK's own
 * pageload transaction and `event.request.url` are built from
 * `window.location`, so the token would reach Sentry without ever passing
 * through our helper.
 */
function scrubUrlFields(value: unknown): void {
  if (!value || typeof value !== "object") return
  const record = value as Record<string, unknown>
  for (const key of ["url", "from", "to"]) {
    const candidate = record[key]
    if (typeof candidate === "string") {
      record[key] = sanitizeTelemetryUrl(candidate)
    }
  }
}

export function initializeClientErrorTracking(options: {
  dsn: string
  environment: string | undefined
  release: string | undefined
  sendDefaultPii: false
  tracesSampleRate: number
}): void {
  init({
    ...options,
    enableLogs: true,
    beforeBreadcrumb(breadcrumb) {
      scrubUrlFields(breadcrumb.data)
      return breadcrumb
    },
    beforeSend(event) {
      scrubUrlFields(event.request)
      if (typeof event.transaction === "string") {
        event.transaction = sanitizeTelemetryUrl(event.transaction)
      }
      for (const breadcrumb of event.breadcrumbs ?? []) {
        scrubUrlFields(breadcrumb.data)
      }
      return event
    },
  })
}

export function recordRouterTransition(
  url: string,
  navigationType: "push" | "replace" | "traverse"
): void {
  const safeUrl = sanitizeTelemetryUrl(url)
  addBreadcrumb({
    category: "navigation",
    message: "App Router transition",
    data: { navigationType, url: safeUrl },
    level: "info",
  })
  captureRouterTransitionStart(safeUrl, navigationType)
}
