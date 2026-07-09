import { test } from "@playwright/test"

import { defineMerchantAuthRecoveryTests } from "./merchant-auth-recovery-flow"

test.describe("@MS-auth-recovery-ux", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  defineMerchantAuthRecoveryTests()
})
