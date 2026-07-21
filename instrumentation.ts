import type { Instrumentation } from "next"
import * as Sentry from "@sentry/nextjs"

import { isFeatureEnabled } from "@/lib/feature-flags"
import { REQUEST_ID_HEADER } from "@/lib/observability/request-id"
import { logger } from "@/lib/observability/logger"
import { sanitizeTelemetryUrl } from "@/lib/observability/safe-telemetry-url"

// Runs once per server instance. Provider-agnostic by design: it emits a
// structured startup record useful for deploy
// observability and is the seam where an OTel/PostHog server SDK would be
// registered when `OTEL_*` / collector env is present.
export async function register() {
  if (isFeatureEnabled("platform_error_reporting")) {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("./sentry.server.config")
    }
    if (process.env.NEXT_RUNTIME === "edge") {
      await import("./sentry.edge.config")
    }
  }

  logger.info("server.start", {
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    nodeEnv: process.env.NODE_ENV ?? "development",
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    region: process.env.VERCEL_REGION ?? null,
  })
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const errorName = err instanceof Error ? err.name : typeof err
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String(err.digest)
      : null
  const requestId = headerValue(request.headers?.[REQUEST_ID_HEADER])
  const safeRoutePath = sanitizeTelemetryUrl(context.routePath)

  if (isFeatureEnabled("platform_error_reporting")) {
    Sentry.withScope((scope) => {
      scope.setTag("request.id", requestId ?? "missing")
      scope.setTag("next.router_kind", context.routerKind)
      scope.setTag("next.route_path", safeRoutePath)
      scope.setTag("next.route_type", context.routeType)
      Sentry.captureRequestError(
        err,
        {
          method: request.method,
          path: safeRoutePath,
          headers: requestId ? { [REQUEST_ID_HEADER]: requestId } : {},
        },
        { ...context, routePath: safeRoutePath }
      )
    })
  }

  logger.error("request.error", {
    errorName,
    digest,
    requestId: requestId ?? null,
    method: request.method,
    routerKind: context.routerKind,
    routePath: safeRoutePath,
    routeType: context.routeType,
  })
}
