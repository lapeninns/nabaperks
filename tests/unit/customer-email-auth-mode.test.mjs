import assert from "node:assert/strict"
import { test } from "node:test"

import {
  customerEmailAuthMode,
  emailPromptReason,
  emailSignInEnabled,
  emailWalletCreationEnabled,
  parseCustomerEmailAuthMode,
} from "@/lib/customer/email-auth-mode"
import { assertValidEnv, EnvConfigError } from "@/lib/env/validate"

test("CUSTOMER_EMAIL_AUTH_MODE defaults to off and never widens on an unknown value", () => {
  for (const raw of [
    undefined,
    null,
    "",
    "   ",
    "on",
    "FULL",
    "true",
    "email",
  ]) {
    assert.equal(parseCustomerEmailAuthMode(raw), "off", String(raw))
  }
  assert.equal(parseCustomerEmailAuthMode(" existing "), "existing")
  assert.equal(parseCustomerEmailAuthMode("full"), "full")
})

test("each mode grants exactly its email capabilities", () => {
  const cases = [
    { env: {}, mode: "off", signIn: false, create: false, reason: "rewards" },
    {
      env: { CUSTOMER_EMAIL_AUTH_MODE: "off" },
      mode: "off",
      signIn: false,
      create: false,
      reason: "rewards",
    },
    {
      env: { CUSTOMER_EMAIL_AUTH_MODE: "existing" },
      mode: "existing",
      signIn: true,
      create: false,
      reason: "wifi_sign_in",
    },
    {
      env: { CUSTOMER_EMAIL_AUTH_MODE: "full" },
      mode: "full",
      signIn: true,
      create: true,
      reason: "wifi_sign_in",
    },
  ]
  for (const { env, mode, signIn, create, reason } of cases) {
    assert.equal(customerEmailAuthMode(env), mode)
    assert.equal(emailSignInEnabled(env), signIn, mode)
    assert.equal(emailWalletCreationEnabled(env), create, mode)
    assert.equal(emailPromptReason(env), reason, mode)
  }
})

test("environment validation accepts the three modes and rejects anything else", () => {
  for (const mode of ["off", "existing", "full"]) {
    assert.doesNotThrow(() =>
      assertValidEnv([], { CUSTOMER_EMAIL_AUTH_MODE: mode })
    )
  }
  assert.throws(
    () => assertValidEnv([], { CUSTOMER_EMAIL_AUTH_MODE: "on" }),
    (error) =>
      error instanceof EnvConfigError &&
      error.invalid.includes(
        "CUSTOMER_EMAIL_AUTH_MODE must be off, existing or full"
      )
  )
})
