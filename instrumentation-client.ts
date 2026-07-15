import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  enableLogs: true,
})

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse"
): void {
  Sentry.addBreadcrumb({
    category: "navigation",
    message: "App Router transition",
    data: { navigationType, url },
    level: "info",
  })
  Sentry.captureRouterTransitionStart(url, navigationType)
}
