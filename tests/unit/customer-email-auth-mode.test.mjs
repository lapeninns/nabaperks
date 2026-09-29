import assert from "node:assert/strict"
import { test } from "node:test"

import {
  customerEmailAuthMode,
  emailPromptReason,
  emailSignInEnabled,
  emailWalletCreationEnabled,
  parseCustomerEmailAuthMode,
} from "@/lib/customer/email-auth-mode"
import { assertValidEnv } from "@/lib/env/validate"

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

test("runtime environment validation never fails on the email sign-in mode, which the parser reads as off (QA BUG-015)", () => {
  // The deploy gate (scripts/check-env.mjs) rejects an unrecognised value;
  // at runtime it must not take down every service-role path.
  for (const mode of [
    "off",
    "existing",
    "full",
    "FULL",
    "on",
    "full,existing",
  ]) {
    assert.doesNotThrow(() =>
      assertValidEnv([], { CUSTOMER_EMAIL_AUTH_MODE: mode })
    )
  }
})
