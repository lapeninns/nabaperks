import assert from "node:assert/strict"
import { test } from "node:test"

import { shapeCustomerNotificationDeliveryReadback } from "@/lib/notifications/readback-core"

test("Given raw provider delivery detail When notification readback is shaped Then customer output uses safe issue codes", () => {
  assert.deepEqual(
    shapeCustomerNotificationDeliveryReadback({
      status: "permanent_failure",
      attemptNumber: 2,
      responseStatus: 410,
      failureReason:
        "Web Push endpoint expired for https://fcm.googleapis.com/fcm/send/private-token",
      createdAt: "2026-06-30T12:00:00.000Z",
    }),
    {
      status: "permanent_failure",
      attemptNumber: 2,
      issue: "subscription_expired",
      createdAt: "2026-06-30T12:00:00.000Z",
    }
  )

  assert.deepEqual(
    shapeCustomerNotificationDeliveryReadback({
      status: "retryable_failure",
      attemptNumber: 1,
      responseStatus: 503,
      failureReason: "provider timeout: upstream request id abc123",
      createdAt: "2026-06-30T12:01:00.000Z",
    }),
    {
      status: "retryable_failure",
      attemptNumber: 1,
      issue: "temporary_failure",
      createdAt: "2026-06-30T12:01:00.000Z",
    }
  )
})
