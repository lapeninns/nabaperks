import {
  addBreadcrumb,
  captureRouterTransitionStart,
  init,
} from "@sentry/nextjs"

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
  addBreadcrumb({
    category: "navigation",
    message: "App Router transition",
    data: { navigationType, url },
    level: "info",
  })
  captureRouterTransitionStart(url, navigationType)
}
