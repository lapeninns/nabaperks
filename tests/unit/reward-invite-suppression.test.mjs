import assert from "node:assert/strict"
import { test } from "node:test"

import { shouldSuppressRewardInviteEmail } from "@/lib/merchant/reward-invite-suppression"

test("reward invite email suppression fails closed", () => {
  assert.equal(
    shouldSuppressRewardInviteEmail({
      data: { email_hmac: "suppressed" },
      error: null,
    }),
    true
  )
  assert.equal(
    shouldSuppressRewardInviteEmail({
      data: null,
      error: { message: "database unavailable" },
    }),
    true
  )
  assert.equal(
    shouldSuppressRewardInviteEmail({ data: null, error: null }),
    false
  )
})
