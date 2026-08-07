import assert from "node:assert/strict"
import { test } from "node:test"

import {
  REFERRAL_HEALTH_EVENT_NAMES,
  buildReferralHealthMirrorEvent,
  isReferralHealthEventName,
} from "@/lib/analytics/referral-health-core"
import { buildExternalAnalyticsProperties } from "@/lib/analytics/privacy-core"

const row = (overrides = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  event_name: "referral_settlement_failed",
  merchant_id: "22222222-2222-4222-8222-222222222222",
  customer_id: "33333333-3333-4333-8333-333333333333",
  membership_id: "44444444-4444-4444-8444-444444444444",
  metadata: { outcome: "failed", sqlstate: "P0001", error: "boom" },
  ...overrides,
})

test("Given a referral health row When it is mirrored Then only allowlisted properties survive", () => {
  const event = buildReferralHealthMirrorEvent(row())

  assert.ok(event)
  // The diagnostics stay first-party. Forwarding sqlstate/error would fail the
  // allowlist and drop the ENTIRE capture, which is the trap this guards.
  assert.deepEqual(event.metadata, { outcome: "failed" })
  assert.equal(
    event.eventId,
    row().id,
    "row id becomes $insert_id, so re-sends dedupe"
  )
  assert.equal(event.actorType, "system")
})

test("Given the mirrored properties When the privacy allowlist runs Then the capture is not dropped", () => {
  // This is the real contract: buildExternalAnalyticsProperties returns null for
  // the whole event if any single key is unknown.
  const event = buildReferralHealthMirrorEvent(row())
  const properties = buildExternalAnalyticsProperties({
    actor_type: event.actorType,
    ...event.metadata,
  })

  assert.notEqual(properties, null, "referral health events must reach PostHog")
  assert.equal(properties.outcome, "failed")
})

test("Given diagnostics were forwarded by mistake Then the allowlist would drop everything", () => {
  // Pinned so the reason for the narrowing above is visible in the test suite.
  const withDiagnostics = buildExternalAnalyticsProperties({
    actor_type: "system",
    outcome: "failed",
    sqlstate: "P0001",
  })

  assert.equal(withDiagnostics, null)
})

test("Given every mirrored event name Then each is recognised", () => {
  for (const name of REFERRAL_HEALTH_EVENT_NAMES) {
    assert.ok(isReferralHealthEventName(name))
    const event = buildReferralHealthMirrorEvent(row({ event_name: name }))
    assert.ok(event, `${name} must be mirrorable`)
    assert.equal(event.eventName, name)
  }
  assert.equal(isReferralHealthEventName("reward_unlocked"), false)
})

test("Given an unusable row When it is mirrored Then nothing is emitted", () => {
  assert.equal(buildReferralHealthMirrorEvent(row({ id: null })), null)
  assert.equal(
    buildReferralHealthMirrorEvent(row({ event_name: "qr_created" })),
    null
  )
  assert.equal(buildReferralHealthMirrorEvent(row({ metadata: {} })), null)
  assert.equal(buildReferralHealthMirrorEvent(row({ metadata: null })), null)
})

test("Given an optional identifier is absent Then the event still mirrors", () => {
  const event = buildReferralHealthMirrorEvent(row({ merchant_id: null }))

  assert.ok(event)
  assert.equal(event.merchantId, undefined)
})
