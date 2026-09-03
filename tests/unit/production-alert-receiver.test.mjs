import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"

import {
  buildProductionAlertEmail,
  deliverVerifiedProductionAlert,
  ProductionAlertError,
  verifyProductionAlert,
} from "../../supabase/functions/_shared/production-alert-core.mjs"

const SECRET = "receiver-test-secret-that-is-long-enough"
const NOW = Date.parse("2026-09-03T09:30:00.000Z")
const DELIVERY = "018f0000-0000-7000-8000-000000000001"

function payload(overrides = {}) {
  return {
    schema: "nabaperks.production-alert.v1",
    action: "trigger",
    kind: "readiness",
    dedupKey: "nabaperks-production-readiness",
    deliveryId: DELIVERY,
    severity: "critical",
    service: "nabaperks",
    environment: "production",
    summary: "Nabaperks production liveness or readiness probe failed",
    revision: "abcdef123456",
    runUrl: "https://github.com/lapeninns/nabaperks/actions/runs/123456",
    occurredAt: "2026-09-03T09:30:00.000Z",
    ...overrides,
  }
}

function signedRequest(value = payload(), overrides = {}) {
  const bodyBytes = new TextEncoder().encode(JSON.stringify(value))
  const timestamp = String(NOW / 1_000)
  const signature = createHmac("sha256", SECRET)
    .update(timestamp)
    .update(".")
    .update(bodyBytes)
    .digest("hex")
  return {
    method: "POST",
    contentType: "application/json",
    contentLength: String(bodyBytes.length),
    signature: `v1=${signature}`,
    timestamp,
    delivery: DELIVERY,
    bodyBytes,
    secret: SECRET,
    nowMilliseconds: NOW,
    ...overrides,
  }
}

async function rejectsWithCode(request, code) {
  await assert.rejects(
    verifyProductionAlert(request),
    (error) => error instanceof ProductionAlertError && error.code === code
  )
}

test("accepts an authentic readiness alert and produces bounded paging copy", async () => {
  const verified = await verifyProductionAlert(signedRequest())
  assert.deepEqual(verified, payload())
  assert.deepEqual(buildProductionAlertEmail(verified), {
    subject: "[Production alert] Nabaperks readiness triggered",
    text: [
      "The Nabaperks production readiness alert has triggered.",
      "Revision: abcdef123456",
      "Occurred at: 2026-09-03T09:30:00.000Z",
      "GitHub Actions run: https://github.com/lapeninns/nabaperks/actions/runs/123456",
    ].join("\n"),
  })
})

test("rejects the reported unsigned body-tampering exploit before JSON parsing", async () => {
  const request = signedRequest()
  request.bodyBytes = new TextEncoder().encode('{"attacker":"controlled"')
  request.contentLength = String(request.bodyBytes.length)
  await rejectsWithCode(request, "invalid_signature")
})

test("rejects alternate signed exfiltration URLs and unexpected fields", async () => {
  await rejectsWithCode(
    signedRequest(
      payload({ runUrl: "https://attacker.example/collect?secret=value" })
    ),
    "invalid_run_url"
  )
  await rejectsWithCode(
    signedRequest({ ...payload(), recipient: "attacker@example.com" }),
    "invalid_payload_shape"
  )
})

test("rejects replayed signatures and oversized bodies without trusting payload", async () => {
  await rejectsWithCode(
    signedRequest(payload(), { nowMilliseconds: NOW + 301_000 }),
    "expired_signature"
  )
  await rejectsWithCode(
    signedRequest(payload(), { contentLength: "8193" }),
    "invalid_body_size"
  )
})

test("preserves legitimate availability-SLO resolution alerts", async () => {
  const alert = payload({
    action: "resolve",
    kind: "availability-slo",
    dedupKey: "nabaperks-production-availability-slo",
    summary: "Nabaperks production availability SLO is breached",
    revision: null,
  })
  assert.deepEqual(await verifyProductionAlert(signedRequest(alert)), alert)
  assert.match(buildProductionAlertEmail(alert).subject, /resolved$/)
})

test("keeps release canary state isolated from operational incidents", async () => {
  const alert = payload({
    kind: "release-canary",
    dedupKey: "nabaperks-production-release-canary",
    summary: "Nabaperks production alert receiver release canary",
  })
  assert.deepEqual(await verifyProductionAlert(signedRequest(alert)), alert)
})

test("a durable claim failure cannot page or acknowledge an alert", async () => {
  let pageCalls = 0
  await assert.rejects(
    deliverVerifiedProductionAlert({
      payload: payload(),
      payloadHash: "a".repeat(64),
      claimDelivery: async () => {
        throw new Error("busy")
      },
      sendPage: async () => {
        pageCalls += 1
      },
      completeDelivery: async () => {},
    }),
    (error) =>
      error instanceof ProductionAlertError && error.code === "claim_failed"
  )
  assert.equal(pageCalls, 0)
})

test("legitimate claimed alerts page once and complete durable state", async () => {
  const calls = []
  const result = await deliverVerifiedProductionAlert({
    payload: payload(),
    payloadHash: "a".repeat(64),
    claimDelivery: async () => ({
      pageRequired: true,
      duplicate: false,
      recipientEmail: "operator@example.com",
    }),
    sendPage: async (_alert, recipient) => calls.push(["page", recipient]),
    completeDelivery: async (deliveryId) =>
      calls.push(["complete", deliveryId]),
  })
  assert.deepEqual(result, { accepted: true, duplicate: false })
  assert.deepEqual(calls, [
    ["page", "operator@example.com"],
    ["complete", DELIVERY],
  ])
})
