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

test("offer bearer routes are masked at the leaf AND at every child route", () => {
  // The leaves, which the anchored rules already covered.
  assert.equal(sanitizeTelemetryUrl("/offer/a-claim-token"), "/offer/[token]")
  assert.equal(sanitizeTelemetryUrl("/p/a-pass-scan-token"), "/p/[token]")
  assert.equal(
    sanitizeTelemetryUrl("/pass/6f1d5f2a-0000-4000-8000-000000000001"),
    "/pass/[entitlementId]"
  )
  assert.equal(
    sanitizeTelemetryUrl("/app/offers/scan/a-pass-scan-token"),
    "/app/offers/scan/[passToken]"
  )

  // The child routes, which they did not. /pass/<id>/qr.png is refetched by the
  // pass screen on a timer, so before this it was the single most frequently
  // reported URL carrying a raw entitlement id.
  assert.equal(
    sanitizeTelemetryUrl(
      "/pass/6f1d5f2a-0000-4000-8000-000000000001/qr.png?ts=1770000000000"
    ),
    "/pass/[entitlementId]/qr.png"
  )
  assert.equal(
    sanitizeTelemetryUrl(
      "https://nabaperks.com/pass/6f1d5f2a-0000-4000-8000-000000000001/qr.png"
    ),
    "/pass/[entitlementId]/qr.png"
  )
  assert.equal(
    sanitizeTelemetryUrl(
      "/app/offers/8a2c1e44-0000-4000-8000-000000000002/qr.png?download=1"
    ),
    "/app/offers/[campaignId]/qr.png"
  )
  assert.equal(
    sanitizeTelemetryUrl("/app/offers/8a2c1e44-0000-4000-8000-000000000002/qr"),
    "/app/offers/[campaignId]/qr"
  )

  // A child route nobody has written yet must not leak on the day it appears.
  assert.equal(
    sanitizeTelemetryUrl("/pass/6f1d5f2a-0000-4000-8000-000000000001/terms"),
    "/pass/[entitlementId]"
  )
  assert.equal(
    sanitizeTelemetryUrl("/offer/a-claim-token/anything/deeper"),
    "/offer/[token]"
  )
  assert.equal(sanitizeTelemetryUrl("/p/a-pass-scan-token/x"), "/p/[token]")

  // No bearer value survives into any of those outputs.
  const SECRETS = ["6f1d5f2a", "8a2c1e44", "s3cr3tbearer"]
  for (const url of [
    "/pass/6f1d5f2a-0000-4000-8000-000000000001/qr.png",
    "/offer/s3cr3tbearer/anything",
    "/p/s3cr3tbearer/x",
    "/app/offers/8a2c1e44-0000-4000-8000-000000000002/qr.png",
    "/app/offers/scan/s3cr3tbearer",
  ]) {
    const masked = sanitizeTelemetryUrl(url)
    for (const secret of SECRETS) {
      assert.equal(
        masked.includes(secret),
        false,
        `${url} must not report ${secret}`
      )
    }
  }
})

test("masking the offer namespaces leaves their legible siblings alone", () => {
  // The /app/offers console pages are ordinary authenticated routes; masking
  // them by prefix would cost the telemetry that finds a broken desk.
  assert.equal(sanitizeTelemetryUrl("/app/offers"), "/app/offers")
  assert.equal(sanitizeTelemetryUrl("/app/offers/new"), "/app/offers/new")
  assert.equal(sanitizeTelemetryUrl("/pricing"), "/pricing")
  assert.equal(sanitizeTelemetryUrl("/offers"), "/offers")
})
