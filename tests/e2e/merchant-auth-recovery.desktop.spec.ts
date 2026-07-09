import { test } from "@playwright/test"

import { defineMerchantAuthRecoveryTests } from "./merchant-auth-recovery-flow"

test.describe("@MS-auth-recovery-ux", () => {
  defineMerchantAuthRecoveryTests()
})
