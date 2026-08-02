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

test("invite and unsubscribe bearers are masked, most specific route first", () => {
  // Loyalty-invite tokens are HMACs that grant membership plus two stamps; the
  // unsubscribe siblings carry consent authority. Neither route was in the
  // allowlist, so both reached Sentry verbatim.
  assert.equal(
    sanitizeTelemetryUrl("/invite/a-secret-claim-token"),
    "/invite/[token]"
  )
  assert.equal(
    sanitizeTelemetryUrl("/invite/unsubscribe/a-secret-unsub-token"),
    "/invite/unsubscribe/[token]"
  )
  assert.equal(
    sanitizeTelemetryUrl("/claim/unsubscribe/a-secret-unsub-token"),
    "/claim/unsubscribe/[token]"
  )

  // Absolute, trailing-slash, query and fragment variants must mask too.
  assert.equal(
    sanitizeTelemetryUrl("https://nabaperks.com/invite/tok?utm=1#x"),
    "/invite/[token]"
  )
  assert.equal(
    sanitizeTelemetryUrl("/invite/unsubscribe/tok/"),
    "/invite/unsubscribe/[token]"
  )

  // Ordinary routes must stay legible or telemetry is useless.
  assert.equal(sanitizeTelemetryUrl("/home/rewards"), "/home/rewards")
})
