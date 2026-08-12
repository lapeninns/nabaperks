import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isCurrentPushPreferenceRequest,
  persistPushPreferences,
  requestPushPermission,
  settlePushOperation,
} from "../../components/customer/push-notification-settings-state.ts"

const preferences = {
  activeSubscriptionCount: 1,
  marketingEnabled: false,
  quietHoursEnd: "09:00",
  quietHoursStart: "21:00",
  reminderEnabled: true,
  transactionalEnabled: true,
}

test("Given a rejected optimistic preference update When persistence fails Then it returns the rollback value", async () => {
  const result = await persistPushPreferences({
    previous: preferences,
    next: { ...preferences, marketingEnabled: true },
    persist: async () => false,
  })

  assert.deepEqual(result, { kind: "rejected", rollback: preferences })
})

test("Given a hung push operation When its deadline expires Then it returns a timeout result", async () => {
  const result = await settlePushOperation(
    new Promise<never>(() => {}),
    5
  )

  assert.equal(result.kind, "timed-out")
})

test("Given denied browser permission When requesting push Then it reports the denied state", async () => {
  const result = await requestPushPermission(async () => "denied")

  assert.equal(result, "denied")
})

test("Given a newer preference request When an earlier request settles Then it cannot roll back the newer choice", () => {
  assert.equal(isCurrentPushPreferenceRequest(2, 1), false)
  assert.equal(isCurrentPushPreferenceRequest(2, 2), true)
})
