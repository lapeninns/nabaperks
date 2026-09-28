import assert from "node:assert/strict"
import { test } from "node:test"

import { customerSignInMethodsLabel } from "@/lib/customer/sign-in-methods"

test("the profile names only the ways this wallet can actually sign back in", () => {
  const cases = [
    [
      { hasPhone: true, hasVerifiedEmail: false, emailSignInEnabled: true },
      "your phone number",
    ],
    [
      { hasPhone: true, hasVerifiedEmail: true, emailSignInEnabled: false },
      "your phone number",
    ],
    [
      { hasPhone: true, hasVerifiedEmail: true, emailSignInEnabled: true },
      "your phone number or email",
    ],
    [
      { hasPhone: false, hasVerifiedEmail: true, emailSignInEnabled: true },
      "your email",
    ],
  ]
  for (const [input, expected] of cases) {
    assert.equal(
      customerSignInMethodsLabel(input),
      expected,
      JSON.stringify(input)
    )
  }
})
