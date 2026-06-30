import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isAllowedWebPushEndpoint,
  normalizePermissionState,
  validatePushEndpoint,
  validatePushSubscriptionInput,
} from "@/lib/notifications/push-subscription-input"

const endpoint = "https://fcm.googleapis.com/fcm/send/unit-test-endpoint"
const windowsEndpoint =
  "https://abc.notify.windows.com/w/?token=unit-test-endpoint"
const p256dh = "p".repeat(32)
const auth = "a".repeat(16)

test("validatePushSubscriptionInput accepts and trims a supported Web Push subscription", () => {
  const result = validatePushSubscriptionInput({
    endpoint: ` ${endpoint} `,
    keys: { p256dh: ` ${p256dh} `, auth: ` ${auth} ` },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.subscription, { endpoint, p256dh, auth })
})

test("validatePushSubscriptionInput rejects malformed shape, short keys, and untrusted endpoints", () => {
  const invalidInputs = [
    null,
    [],
    { endpoint, keys: null },
    { endpoint, keys: { p256dh: "short", auth } },
    { endpoint, keys: { p256dh, auth: "short" } },
    {
      endpoint: "https://example.com/push/not-allowed",
      keys: { p256dh, auth },
    },
    {
      endpoint: "http://fcm.googleapis.com/fcm/send/not-https",
      keys: { p256dh, auth },
    },
    {
      endpoint: "https://user:fcm@fcm.googleapis.com/fcm/send/with-userinfo",
      keys: { p256dh, auth },
    },
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/with-hash#frag",
      keys: { p256dh, auth },
    },
  ]

  for (const input of invalidInputs) {
    assert.deepEqual(validatePushSubscriptionInput(input), {
      ok: false,
      error: "invalid_subscription",
    })
  }
})

test("validatePushEndpoint accepts only allowed push provider hosts", () => {
  assert.equal(validatePushEndpoint(` ${endpoint} `), endpoint)
  assert.equal(validatePushEndpoint(windowsEndpoint), windowsEndpoint)
  assert.equal(isAllowedWebPushEndpoint("https://web.push.apple.com/abc"), true)
  assert.equal(
    validatePushEndpoint("https://evil.notify.windows.com.example.com/push"),
    null
  )
  assert.equal(validatePushEndpoint("https://example.com/push"), null)
})

test("normalizePermissionState accepts known browser states and collapses unknown values", () => {
  assert.equal(normalizePermissionState(" granted "), "granted")
  assert.equal(normalizePermissionState("DENIED"), "denied")
  assert.equal(normalizePermissionState("unsupported"), "unsupported")
  assert.equal(normalizePermissionState("Prompt"), "prompt")
  assert.equal(normalizePermissionState("unexpected"), "unknown")
  assert.equal(normalizePermissionState(null), "unknown")
})
