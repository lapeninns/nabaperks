import { test } from "@playwright/test"

import { defineMerchantRewardPresetAtomicAddTests } from "./merchant-reward-preset-atomic-add-flow"

test.describe("merchant reward preset atomic add", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  defineMerchantRewardPresetAtomicAddTests()
})
