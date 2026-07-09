import { test } from "@playwright/test"

import { defineMerchantOnboardingContinuityTests } from "./merchant-onboarding-continuity-flow"

test.describe("merchant onboarding continuity @MS-merchant-onboarding-continuity", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  defineMerchantOnboardingContinuityTests()
})
