import assert from "node:assert/strict"
import test from "node:test"

import { isStrongCustomerSessionSecret } from "@/lib/security/customer-session-secret-core"

test("customer session secret policy rejects weak and placeholder material", () => {
  for (const value of [
    "x",
    "replace-me-with-a-generated-secret-value",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "abcd1234".repeat(4),
    "0123456789abcdef0123456789abcdef",
    "Aa1!Bb2@Cc3#Dd4$Ee5%Ff6^Gg7&Hh8*",
  ]) {
    assert.equal(isStrongCustomerSessionSecret(value), false)
  }
})

test("customer session secret policy accepts generated high-entropy material", () => {
  assert.equal(
    isStrongCustomerSessionSecret(
      "8f2c1d7a9b4e6f0c3a5d8e1b7c9f2a4d6e0b3c5f8a1d7e9b"
    ),
    true
  )
})
