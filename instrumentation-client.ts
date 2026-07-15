type SentryClient = typeof import("./lib/observability/sentry-client")

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
let sentryPromise: Promise<SentryClient | null> | undefined

function loadSentry(): Promise<SentryClient | null> {
  if (!sentryDsn) {
    return Promise.resolve(null)
  }

  sentryPromise ??= import("./lib/observability/sentry-client")
    .then((Sentry) => {
      Sentry.initializeClientErrorTracking({
        dsn: sentryDsn,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
        sendDefaultPii: false,
        tracesSampleRate: 0.1,
      })

      return Sentry
    })
    .catch(() => {
      sentryPromise = undefined
      return null
    })

  return sentryPromise
}

if (sentryDsn) {
  void loadSentry()
}

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse"
): void {
  void loadSentry().then((Sentry) => {
    if (!Sentry) {
      return
    }

    Sentry.recordRouterTransition(url, navigationType)
  })
}
