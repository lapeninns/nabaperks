import packageJson from "@/package.json"
import productionSlos from "@/config/production-slos.json"

import { CUSTOMER_LEGAL_VERSION } from "@/lib/legal/content"
import { checkDatabaseReadiness } from "@/lib/observability/readiness"
import { checkOperationalReadiness } from "@/lib/observability/operational-signals"
import { logger } from "@/lib/observability/logger"
import {
  checkConfigurationReadiness,
  checkLegalTermsReadiness,
} from "@/lib/observability/release-readiness"
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/lib/observability/request-id"
import { matchesAnyBearerSecret } from "@/lib/security/cron-auth"

export const dynamic = "force-dynamic"

const SERVICE = "nabaperks"

export async function GET(request: Request): Promise<Response> {
  const startedAt = performance.now()
  const requestId = resolveRequestId(request.headers)

  if (
    !matchesAnyBearerSecret(request.headers.get("authorization"), [
      process.env.PRODUCTION_MONITOR_SECRET,
      process.env.PRODUCTION_MONITOR_SECRET_NEXT,
    ])
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

  const environment =
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown"
  const targetEnvironment = process.env.VERCEL_TARGET_ENV ?? environment
  const allowLoopback =
    targetEnvironment === "staging" && process.env.STAGING_MODE === "ephemeral"
  const readinessOptions = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    allowLoopback,
  }
  const [database, operational, legalTerms] = await Promise.all([
    checkDatabaseReadiness(readinessOptions),
    checkOperationalReadiness({
      ...readinessOptions,
      thresholds: productionSlos.thresholds,
      requireCronHealth: targetEnvironment !== "staging",
    }),
    // Every join records CUSTOMER_LEGAL_VERSION; without its snapshot trigger
    // the database stores an older terms snapshot under it (QA BUG-006).
    checkLegalTermsReadiness({
      ...readinessOptions,
      legalVersion: CUSTOMER_LEGAL_VERSION,
    }),
  ])
  const checks = {
    database: database.database,
    operational: operational.operational,
    legalTerms: legalTerms.legalTerms,
    configuration: checkConfigurationReadiness(process.env).configuration,
  }
  const ready = Object.values(checks).every((status) => status === "ok")
  const durationMs = Math.round(performance.now() - startedAt)

  if (!ready) {
    logger.warn("readiness.dependency_unavailable", {
      durationMs,
      failedChecks: Object.entries(checks)
        .filter(([, status]) => status !== "ok")
        .map(([name]) => name),
      requestId,
    })
  }

  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      scope: "readiness",
      service: SERVICE,
      version: packageJson.version,
      revision:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? packageJson.version,
      environment,
      targetEnvironment,
      checks,
      signals: operational.signals,
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
