import type { Instrumentation } from "next"

import { REQUEST_ID_HEADER } from "@/lib/observability/request-id"
import { logger } from "@/lib/observability/logger"

// Runs once per server instance. Provider-agnostic by design (AGENTS.md keeps
// Sentry/OTel optional): it emits a structured startup record useful for deploy
// observability and is the seam where an OTel/PostHog server SDK would be
// registered when `OTEL_*` / collector env is present.
export function register() {
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

// Captures server-side errors with full request/router context so they reach the
// log drain as structured, correlatable records instead of opaque stack traces.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const error = err as Error & { digest?: string }

  logger.error("request.error", {
    error,
    digest: error.digest ?? null,
    requestId: headerValue(request.headers?.[REQUEST_ID_HEADER]) ?? null,
    method: request.method,
    path: request.path,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  })
}
