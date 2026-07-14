import { test } from "@playwright/test"

import { defineAuthPasswordPolicyTests } from "./auth-password-policy-flow"

test.describe("auth password policy accessibility", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  defineAuthPasswordPolicyTests()
})
