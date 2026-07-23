import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"

import { readSloConfig } from "./check-production-slo.mjs"

const PRODUCTION_ORIGIN = "https://nabaperks.com"

export async function checkProductionProbeLatency({
  monitorSecret,
  expectedRevision = "",
  config = readSloConfig(),
  fetcher = fetch,
  clock = () => performance.now(),
} = {}) {
  assert.ok(monitorSecret?.trim(), "PRODUCTION_MONITOR_SECRET is required")
  const thresholds = config.thresholds
  assert.ok(
    Number.isFinite(thresholds?.livenessResponseMs) &&
      thresholds.livenessResponseMs > 0,
    "liveness latency threshold is invalid"
  )
  assert.ok(
    Number.isFinite(thresholds?.readinessResponseMs) &&
      thresholds.readinessResponseMs > 0,
    "readiness latency threshold is invalid"
  )

  const liveness = await timedProbe({
    url: new URL("/api/health", PRODUCTION_ORIGIN),
    scope: "liveness",
    status: "ok",
    expectedRevision,
    fetcher,
    clock,
  })
  const readiness = await timedProbe({
    url: new URL("/api/readiness", PRODUCTION_ORIGIN),
    scope: "readiness",
    status: "ready",
    expectedRevision,
    monitorSecret,
    fetcher,
    clock,
  })

  assert.ok(
    liveness.durationMs <= thresholds.livenessResponseMs,
    `liveness exceeded ${thresholds.livenessResponseMs}ms`
  )
  assert.ok(
    readiness.durationMs <= thresholds.readinessResponseMs,
    `readiness exceeded ${thresholds.readinessResponseMs}ms`
  )

  return {
    schema: "nabaperks.production-probe-latency.v1",
    livenessMs: liveness.durationMs,
    readinessMs: readiness.durationMs,
    thresholds: {
      livenessMs: thresholds.livenessResponseMs,
      readinessMs: thresholds.readinessResponseMs,
    },
  }
}

async function timedProbe({
  url,
  scope,
  status,
  expectedRevision,
  monitorSecret,
  fetcher,
  clock,
}) {
  const startedAt = clock()
  const response = await fetcher(url, {
    headers: monitorSecret
      ? { authorization: `Bearer ${monitorSecret}` }
      : undefined,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  })
  const document = response.ok ? await response.json() : null
  const durationMs = Math.max(0, Math.round(clock() - startedAt))

  assert.equal(response.ok, true, `${scope} returned HTTP ${response.status}`)
  assert.equal(document?.scope, scope, `${scope} response scope is invalid`)
  assert.equal(document?.status, status, `${scope} response status is invalid`)
  assert.equal(
    document?.environment,
    "production",
    `${scope} environment is invalid`
  )
  assert.equal(
    document?.targetEnvironment,
    "production",
    `${scope} target environment is invalid`
  )
  if (expectedRevision) {
    assert.equal(
      document?.revision,
      expectedRevision.slice(0, 12),
      `${scope} revision is invalid`
    )
  }

  return { durationMs }
}

async function main() {
  const report = await checkProductionProbeLatency({
    monitorSecret: process.env.PRODUCTION_MONITOR_SECRET,
    expectedRevision: process.env.EXPECTED_REVISION,
    config: readSloConfig(process.env.PRODUCTION_SLO_CONFIG),
  })
  console.log(JSON.stringify(report))
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Production latency probe failed"
    )
    process.exitCode = 1
  })
}
