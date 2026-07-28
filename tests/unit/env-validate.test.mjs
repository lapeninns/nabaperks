import assert from "node:assert/strict"
import test from "node:test"

import { EnvConfigError, assertValidEnv } from "@/lib/env/validate"

const STRIPE_CONTRACT = [
  {
    name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    visibility: "public",
    kind: "string",
    description: "Stripe publishable key.",
  },
  {
    name: "STRIPE_SECRET_KEY",
    visibility: "server",
    kind: "string",
    description: "Stripe secret key.",
  },
]

test("runtime environment accepts only Stripe test-mode keys", () => {
  assert.doesNotThrow(() =>
    assertValidEnv(STRIPE_CONTRACT, {
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_runtime",
      STRIPE_SECRET_KEY: "sk_test_runtime",
    })
  )

  for (const values of [
    {
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_forbidden",
      STRIPE_SECRET_KEY: "sk_test_runtime",
    },
    {
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_runtime",
      STRIPE_SECRET_KEY: "sk_live_forbidden",
    },
    {
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "publishable_unknown",
      STRIPE_SECRET_KEY: "secret_unknown",
    },
  ]) {
    assert.throws(
      () => assertValidEnv(STRIPE_CONTRACT, values),
      (error) =>
        error instanceof EnvConfigError &&
        error.invalid.some((message) => message.includes("Stripe test-mode"))
    )
  }
})
