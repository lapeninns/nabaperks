import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parseCustomerActivityMetadata,
  shapeCustomerActivityItem,
} from "@/lib/customer/activity-core"

test("Given product event metadata contains private fields When customer activity is shaped Then only safe labels are used", () => {
  const metadata = parseCustomerActivityMetadata({
    reward_name: "Mystery roast",
    new_stamp_count: 4,
    email: "guest@example.com",
    phone: "+447700900123",
    provider_response: "internal request id abc123",
  })

  assert.deepEqual(metadata, {
    rewardName: "Mystery roast",
    newStampCount: 4,
  })

  assert.deepEqual(
    shapeCustomerActivityItem({
      id: "event-1",
      eventName: "reward_unlocked",
      category: "reward",
      metadata,
      businessName: "The Old Crown",
      createdAt: "2026-06-30T12:00:00.000Z",
    }),
    {
      id: "event-1",
      eventName: "reward_unlocked",
      category: "reward",
      badgeLabel: "Reward",
      title: "Reward unlocked at The Old Crown",
      description: "Mystery roast is ready to claim.",
      businessName: "The Old Crown",
      createdAt: "2026-06-30T12:00:00.000Z",
    }
  )
})
