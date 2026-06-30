import assert from "node:assert/strict"
import { test } from "node:test"

import {
  formatAdminBillingStatus,
  maskStripeOperationalId,
} from "@/lib/admin/billing-redaction"

test("Given Stripe ids enter admin billing readback When formatted Then raw provider ids are shortened", () => {
  assert.equal(
    maskStripeOperationalId("sub_1Rz4VxP8W9X0Y1Z2"),
    "sub_...X0Y1Z2"
  )
  assert.equal(
    maskStripeOperationalId("cus_NabaperksPilot123456"),
    "cus_...123456"
  )
  assert.equal(maskStripeOperationalId(null), "-")
})

test("Given billing statuses enter admin readback When formatted Then support copy has stable labels and tones", () => {
  assert.deepEqual(formatAdminBillingStatus("active"), {
    label: "Active",
    tone: "good",
  })
  assert.deepEqual(formatAdminBillingStatus("trialing"), {
    label: "Trialing",
    tone: "good",
  })
  assert.deepEqual(formatAdminBillingStatus("past_due"), {
    label: "Past due",
    tone: "warning",
  })
  assert.deepEqual(formatAdminBillingStatus("cancelled"), {
    label: "Cancelled",
    tone: "danger",
  })
  assert.deepEqual(formatAdminBillingStatus(null), {
    label: "No billing record",
    tone: "neutral",
  })
})
