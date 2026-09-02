import assert from "node:assert/strict"
import test from "node:test"

import { merchantAuthRateLimitConfigs } from "@/lib/auth/merchant-auth-rate-limit-core"

test("rotating source identities share one merchant sign-in account budget", () => {
  const first = merchantAuthRateLimitConfigs(
    "merchant-signin",
    "Owner@Example.test",
    "source-a"
  )
  const second = merchantAuthRateLimitConfigs(
    "merchant-signin",
    "owner@example.test",
    "source-b"
  )

  assert.notEqual(first[0].key, second[0].key)
  assert.equal(first[1].key, second[1].key)
  assert.equal(
    first[1].key,
    "merchant-signin:owner@example.test:account-window"
  )
})

test("signup and OTP verification retain their existing source-scoped budgets", () => {
  for (const scope of ["merchant-signup", "merchant-verify"]) {
    const configs = merchantAuthRateLimitConfigs(
      scope,
      "owner@example.test",
      "source-a"
    )
    assert.equal(configs.length, 1)
    assert.match(configs[0].key, new RegExp(`^${scope}:`))
  }
})
