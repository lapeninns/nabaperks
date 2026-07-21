import {
  addBreadcrumb,
  captureRouterTransitionStart,
  init,
} from "@sentry/nextjs"

import { sanitizeTelemetryUrl } from "@/lib/observability/safe-telemetry-url"

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
