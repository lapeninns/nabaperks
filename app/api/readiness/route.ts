import packageJson from "@/package.json"

import { checkDatabaseReadiness } from "@/lib/observability/readiness"
import { logger } from "@/lib/observability/logger"
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/lib/observability/request-id"
import { matchesCronSecret } from "@/lib/security/cron-auth"

export const dynamic = "force-dynamic"

const SERVICE = "nabaperks"

export async function GET(request: Request): Promise<Response> {
  const startedAt = performance.now()
  const requestId = resolveRequestId(request.headers)

  if (
    !matchesCronSecret(
      request.headers.get("authorization"),
      process.env.PRODUCTION_MONITOR_SECRET
    )
  ) {
    return Response.json(
      { status: "unauthorized", scope: "readiness" },
      {
        status: 401,
        headers: {
          "cache-control": "no-store, max-age=0",
          [REQUEST_ID_HEADER]: requestId,
        },
      }
    )
  }

  const checks = await checkDatabaseReadiness({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
  const ready = checks.database === "ok"
  const durationMs = Math.round(performance.now() - startedAt)

  if (!ready) {
    logger.warn("readiness.database_unavailable", { durationMs, requestId })
  }

  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      scope: "readiness",
      service: SERVICE,
      version: packageJson.version,
      revision:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? packageJson.version,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      targetEnvironment:
        process.env.VERCEL_TARGET_ENV ??
        process.env.VERCEL_ENV ??
        process.env.NODE_ENV ??
        "unknown",
      checks,
      durationMs,
      time: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "cache-control": "no-store, max-age=0",
        [REQUEST_ID_HEADER]: requestId,
      },
    }
  )
}
