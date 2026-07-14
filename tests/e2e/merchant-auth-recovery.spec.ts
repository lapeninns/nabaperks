import { test } from "@playwright/test"

import { defineMerchantAuthRecoveryTests } from "./merchant-auth-recovery-flow"

test.describe("merchant auth recovery", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  defineMerchantAuthRecoveryTests()
})
