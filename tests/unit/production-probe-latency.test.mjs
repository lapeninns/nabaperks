import assert from "node:assert/strict"
import { test } from "node:test"

import { checkProductionProbeLatency } from "../../scripts/check-production-probe-latency.mjs"

const config = {
  thresholds: {
    livenessResponseMs: 100,
    readinessResponseMs: 250,
  },
}

function response(scope, status) {
  return Response.json({
    scope,
    status,
    revision: "abcdef123456",
    environment: "production",
    targetEnvironment: "production",
  })
}

test("production latency proof measures both authenticated probe contracts", async () => {
  const times = [0, 80, 80, 280]
  const requests = []
  const report = await checkProductionProbeLatency({
    monitorSecret: "monitor-test-secret",
    expectedRevision: "abcdef1234567890",
    config,
    clock: () => times.shift(),
    fetcher: async (input, init) => {
      requests.push({ input: String(input), init })
      return requests.length === 1
        ? response("liveness", "ok")
        : response("readiness", "ready")
    },
  })

  assert.deepEqual(report, {
    schema: "nabaperks.production-probe-latency.v1",
    livenessMs: 80,
    readinessMs: 200,
    thresholds: { livenessMs: 100, readinessMs: 250 },
  })
  assert.equal(requests[0].input, "https://nabaperks.com/api/health")
  assert.equal(requests[0].init.headers, undefined)
  assert.equal(requests[1].input, "https://nabaperks.com/api/readiness")
  assert.equal(
    requests[1].init.headers.authorization,
    "Bearer monitor-test-secret"
  )
})

test("production latency proof fails when either source-owned threshold is breached", async () => {
  const times = [0, 101, 101, 200]

  await assert.rejects(
    checkProductionProbeLatency({
      monitorSecret: "monitor-test-secret",
      config,
      clock: () => times.shift(),
      fetcher: async (input) =>
        String(input).endsWith("/api/health")
          ? response("liveness", "ok")
          : response("readiness", "ready"),
    }),
    /liveness exceeded 100ms/
  )
})

test("production latency proof fails closed before sending an absent secret", async () => {
  let calls = 0

  await assert.rejects(
    checkProductionProbeLatency({
      monitorSecret: "",
      config,
      fetcher: async () => {
        calls += 1
        return response("liveness", "ok")
      },
    }),
    /PRODUCTION_MONITOR_SECRET is required/
  )
  assert.equal(calls, 0)
})
