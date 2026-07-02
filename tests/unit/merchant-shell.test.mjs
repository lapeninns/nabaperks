import assert from "node:assert/strict"
import { test } from "node:test"

import { isMerchantSetupPath } from "@/lib/navigation/merchant-shell"

test("merchant setup shell is reserved for onboarding", () => {
  assert.equal(isMerchantSetupPath("/app/onboarding"), true)
  assert.equal(isMerchantSetupPath("/app/onboarding/location"), true)
  assert.equal(isMerchantSetupPath("/app/launch"), false)
  assert.equal(isMerchantSetupPath("/app/launch?tab=qr"), false)
  assert.equal(isMerchantSetupPath("/app"), false)
})
