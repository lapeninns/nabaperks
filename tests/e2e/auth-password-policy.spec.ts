import { test } from "@playwright/test"

import { defineAuthPasswordPolicyTests } from "./auth-password-policy-flow"

test.describe("@MS-auth-password-policy-accessibility", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  defineAuthPasswordPolicyTests()
})
