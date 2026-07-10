import { test } from "@playwright/test"

import { defineMerchantOnboardingContinuityTests } from "./merchant-onboarding-continuity-flow"

test.describe("merchant onboarding continuity @MS-merchant-onboarding-continuity", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  defineMerchantOnboardingContinuityTests()
})
