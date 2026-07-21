import assert from "node:assert/strict"
import { test } from "node:test"

import { sanitizeTelemetryUrl } from "@/lib/observability/safe-telemetry-url"

test("telemetry URLs discard origins, query strings, and fragments", () => {
  assert.equal(
    sanitizeTelemetryUrl(
      "https://nabaperks.com/home/rewards?code=secret#redeem"
    ),
    "/home/rewards"
  )
})

test("telemetry URLs replace claim and scan credentials with route labels", () => {
  assert.equal(
    sanitizeTelemetryUrl("/claim/a-secret-token?unsubscribe=1"),
    "/claim/[token]"
  )
  assert.equal(sanitizeTelemetryUrl("/r/a-secret-token"), "/r/[token]")
  assert.equal(
    sanitizeTelemetryUrl("/app/rewards/scan/a-secret-scan-token"),
    "/app/rewards/scan/[scanToken]"
  )
})
