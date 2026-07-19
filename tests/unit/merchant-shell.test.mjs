import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isMerchantSetupPath,
  shouldShowMerchantSetupReminder,
} from "@/lib/navigation/merchant-shell"

test("merchant setup shell is reserved for onboarding", () => {
  assert.equal(isMerchantSetupPath("/app/onboarding"), true)
  assert.equal(isMerchantSetupPath("/app/onboarding/location"), true)
  assert.equal(isMerchantSetupPath("/app/launch"), false)
  assert.equal(isMerchantSetupPath("/app/launch?tab=qr"), false)
  assert.equal(isMerchantSetupPath("/app"), false)
})

test("setup reminder shows on merchant console routes except launch and onboarding", () => {
  assert.equal(shouldShowMerchantSetupReminder("/app"), true)
  assert.equal(shouldShowMerchantSetupReminder("/app/activity"), true)
  assert.equal(shouldShowMerchantSetupReminder("/app/qr"), true)
  assert.equal(
    shouldShowMerchantSetupReminder("/app/account?tab=billing"),
    true
  )
  assert.equal(shouldShowMerchantSetupReminder("/app/onboarding"), false)
  assert.equal(shouldShowMerchantSetupReminder("/app/launch"), false)
  assert.equal(
    shouldShowMerchantSetupReminder("/app/launch?tab=billing"),
    false
  )
  assert.equal(shouldShowMerchantSetupReminder("/app/qr/poster/window"), false)
  assert.equal(shouldShowMerchantSetupReminder("/home"), false)
})
