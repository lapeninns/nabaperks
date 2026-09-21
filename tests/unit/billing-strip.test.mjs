import assert from "node:assert/strict"
import { test } from "node:test"

import { shouldShowMerchantBillingStrip } from "@/lib/merchant/billing-status-copy"

test("the console billing strip covers post-activation attention states only", () => {
  for (const status of ["past_due", "cancelled", "suspended"]) {
    assert.equal(shouldShowMerchantBillingStrip(status), true, status)
  }
  for (const status of ["active", "trialing", "trial", "not_started", ""]) {
    assert.equal(shouldShowMerchantBillingStrip(status), false, status)
  }
})
