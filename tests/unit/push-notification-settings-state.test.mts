import assert from "node:assert/strict"
import { test } from "node:test"

import {
  awaitPushOperation,
  requestPushPermission,
  savePushPreferences,
} from "../../components/customer/push-notification-settings-state.ts"

const preferences = {
  transactionalEnabled: true,
  reminderEnabled: true,
  marketingEnabled: false,
  quietHoursStart: "21:00",
  quietHoursEnd: "09:00",
  activeSubscriptionCount: 0,
}

test("Given a rejected preference write When the optimistic update settles Then it reports failure for rollback", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new TypeError("network unavailable")
  }

  try {
    const result = await savePushPreferences(preferences)
    assert.deepEqual(result, { kind: "failed" })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Given readiness never resolves When the bounded operation expires Then it releases the caller", async () => {
  const result = await Promise.race([
    awaitPushOperation(new Promise(() => {}), 5).then(
      () => "unexpected",
      (error: unknown) => error instanceof Error && error.name
    ),
    new Promise((resolve) => setTimeout(() => resolve("test-timeout"), 100)),
  ])

  assert.equal(result, "PushOperationTimeoutError")
})

test("Given the browser denies notifications When the settings request permission Then the denial remains actionable", async () => {
  const permission = await requestPushPermission("default", async () => "denied")

  assert.equal(permission, "denied")
})
